/**
 * EdgeOne Makers Edge Functions —— 登录 + 后台写代理 + 公开只读快照缓存 + 点击统计批量写入
 *
 * 路由：本项目作为单个 Makers 项目部署, 本文件位于 edge-functions/api/ 目录,
 *       由平台文件系统路由映射为 <站点>/api/**（多级匹配, [[default]] 兜底）,
 *       前端 VITE_API_BASE_URL 默认采用同域 '/api', 无需跨域。
 *
 * 职责：
 *  - POST /api/auth/login        校验 config.admin_user/admin_pwd(bcrypt) 后签发 HS256 JWT（7d）
 *  - GET  /api/frontend-data     公开只读快照（Blob 缓存优先, 零回源；未命中/过期才回源 Neon 重建）
 *  - POST /api/stats/click       公开点击统计（模块级内存缓冲 + 批量/延迟写入 click_stats）
 *  - 其余 /api/* 路由             验签(Bearer) 后以 nav_admin 执行 SQL, 返回 { data } / { message }
 *  - PUT /config/admin_pwd       写入时数据库侧 bcrypt 加密；GET 一律脱敏（哈希不出服务器）
 *
 * 只读快照缓存（核心目标：尽量减少对 Neon 的直接查询次数）：
 *  - 快照存于 Blob（@edgeone/pages-blob），key=frontend-data.json，结构：
 *      { schema_version, version(重建毫秒时间戳→ETag), generated_at, data:{config,categories,links,search_engines} }
 *  - 读路径：FRESH(age<TTL) 直接返回零回源 → STALE(TTL≤age<TTL+SWR) 返回旧快照+waitUntil 后台刷新
 *    → 未命中/超窗 同步重建写回再返回；回源失败用旧快照降级(STALE_DEGRADED)或 503
 *  - 后台写成功（links/categories/config/search-engines/apply 审核）后 waitUntil 主动重建覆盖同一快照
 *  - 并发去重：模块级 inflightRebuilds 共享同一 Promise（同隔离实例内只回源一次, 防缓存击穿）
 *
 * 点击统计：
 *  - clickBuffer 内存缓冲 + 条数/时间阈值触发 waitUntil 批量 INSERT；失败回写缓冲（上限 500 条）重试
 *
 * 安全边界：
 *  - DATABASE_URL_ADMIN（nav_admin 连接串）与 JWT_SECRET 只存 Makers 项目环境变量
 *    （函数经 context.env 读取, 不进前端 bundle）
 *  - 后台读 = 不含 is_visible/is_active 过滤（后台需看到隐藏/停用行）, 与公开快照语义不同, 勿复用
 *  - JWT 对数据库层仅是会话状态标记（Postgres/RLS 不校验）；本函数每次 jwtVerify 验签
 *  - 公开快照必须显式过滤 config.admin_pwd（nav_admin 全表可见, 与 nav_read RLS 不同）
 *
 * 环境变量注入：
 *  - 线上: context.env（Makers 平台每次请求新建对象, 不可作缓存键）
 *  - 本地/工具: process.env 兜底
 *  - 缓存键使用 dbUrl::jwtSecret 字符串; neon() 返回连接池, 必须全局单例只建一次
 *
 * 平台限制提醒：单次执行 CPU 200ms（不含 I/O 等待）。登录密码校验走数据库侧
 *   pgcrypto.crypt（Neon 独立 CPU），边缘函数仅做 I/O 等待，避免 bcrypt CPU 超限 545。函数代码包 <=5MB。
 */
import { neon } from '@neondatabase/serverless'
import { SignJWT, jwtVerify } from 'jose'
import { getStore } from '@edgeone/pages-blob'
// 注：密码校验已改为数据库侧 pgcrypto.crypt（规避边缘函数 CPU 限制），不再依赖 bcryptjs

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
}

// ---------- 只读快照缓存 ----------
const SNAPSHOT_STORE_DEFAULT = 'nav-snapshot'
const SNAPSHOT_KEY = 'frontend-data.json'
const SNAPSHOT_SCHEMA_VERSION = 1
// 同一边缘隔离实例内并发重建只回源一次（缓存击穿防护）
const inflightRebuilds = new Map()
const blobStoreCache = new Map()

// ---------- 点击统计（批量/延迟写入, 避免每次点击直连 Neon） ----------
const CLICK_BATCH_SIZE_DEFAULT = 20 // 条数阈值
const CLICK_MAX_AGE_SECONDS_DEFAULT = 10 // 时间阈值（距首条缓冲）
const CLICK_BUFFER_CAP = 500 // 缓冲上限（防 DB 长时故障内存无限增长）
const clickBuffer = [] // { link_id, user_agent }
let clickBufferStart = 0 // 首条缓冲时间戳（毫秒）
let flushChain = Promise.resolve() // 批量写串行化, 防并发批重叠

// ---------- 运行时（按值缓存, 全局单例） ----------
const sqlCache = new Map()
const secretCache = new Map()

function readEnv(env, key) {
  // 兼容 Makers context.env（线上）与本地 Node 调试（process.env）。
  // 边缘运行时无 process 全局，必须先 typeof 保护，否则直接 ReferenceError
  return env?.[key] || (typeof process !== 'undefined' ? process.env?.[key] : undefined)
}

function getSql(env) {
  const dbUrl = readEnv(env, 'DATABASE_URL_ADMIN')
  if (!dbUrl) throw new Error('缺少环境变量 DATABASE_URL_ADMIN')
  const cacheKey = `sql::${dbUrl}`
  if (!sqlCache.has(cacheKey)) {
    // neon() 返回连接池 → 必须全局单例, 按 cacheKey 只创建一次
    sqlCache.set(cacheKey, neon(dbUrl))
  }
  return sqlCache.get(cacheKey)
}

function getSecret(env) {
  const jwtSecret = readEnv(env, 'JWT_SECRET')
  if (!jwtSecret) throw new Error('缺少环境变量 JWT_SECRET')
  const cacheKey = `secret::${jwtSecret}`
  if (!secretCache.has(cacheKey)) {
    secretCache.set(cacheKey, new TextEncoder().encode(jwtSecret))
  }
  return secretCache.get(cacheKey)
}

function getRuntime(env) {
  return { sql: getSql(env), secret: getSecret(env) }
}

function getSnapshotStore(env) {
  const name = readEnv(env, 'SNAPSHOT_STORE_NAME') || SNAPSHOT_STORE_DEFAULT
  const consistency = readEnv(env, 'SNAPSHOT_READ_CONSISTENCY') === 'strong' ? 'strong' : 'eventual'
  const cacheKey = `${name}::${consistency}`
  if (!blobStoreCache.has(cacheKey)) {
    blobStoreCache.set(cacheKey, getStore({ name, consistency }))
  }
  return blobStoreCache.get(cacheKey)
}

function ok(data, status = 200) {
  return new Response(JSON.stringify({ data }), { status, headers: CORS_HEADERS })
}

function fail(message, status = 400) {
  return new Response(JSON.stringify({ message }), { status, headers: CORS_HEADERS })
}

const first = (rows) => (Array.isArray(rows) && rows.length ? rows[0] : undefined)

async function verifyToken(request, rt) {
  const auth = request.headers.get('Authorization') || ''
  if (!auth.startsWith('Bearer ')) return null
  try {
    return await jwtVerify(auth.slice(7), rt.secret)
  } catch {
    return null
  }
}

// ---------- 只读快照：重建 / 去重 / 响应 ----------
// 重建快照：4 表并行查询（nav_admin）→ setJSON 写回 Blob
async function rebuildSnapshot(env) {
  const sql = getSql(env)
  const started = Date.now()
  const [configRows, categories, links, engines] = await Promise.all([
    sql`SELECT key, value FROM config WHERE key <> 'admin_pwd'`,
    sql`SELECT * FROM categories WHERE is_visible = true ORDER BY sort_order`,
    sql`SELECT * FROM links WHERE is_visible = true ORDER BY sort_order`,
    sql`SELECT * FROM search_engines WHERE is_active = true ORDER BY sort_order`,
  ])
  const config = {}
  for (const r of configRows) config[r.key] = r.value
  const snapshot = {
    schema_version: SNAPSHOT_SCHEMA_VERSION,
    version: String(started),
    generated_at: new Date(started).toISOString(),
    data: { config, categories, links, search_engines: engines },
  }
  await getSnapshotStore(env).setJSON(SNAPSHOT_KEY, snapshot)
  console.log(JSON.stringify({
    event: 'snapshot_rebuilt', key: SNAPSHOT_KEY,
    rows: { categories: categories.length, links: links.length, engines: engines.length },
    latency_ms: Date.now() - started,
  }))
  return snapshot
}

// 并发去重：同一隔离内进行中的重建共享同一 Promise；结束后删除以便重试
function refreshSnapshot(env) {
  const existing = inflightRebuilds.get(SNAPSHOT_KEY)
  if (existing) return existing
  const task = rebuildSnapshot(env).finally(() => inflightRebuilds.delete(SNAPSHOT_KEY))
  inflightRebuilds.set(SNAPSHOT_KEY, task)
  return task
}

function snapshotHeaders(etag, status, age, degraded, browserMaxAge, swr) {
  return {
    ...CORS_HEADERS,
    ETag: etag || '',
    'Cache-Control': `public, max-age=${browserMaxAge}, s-maxage=0, stale-while-revalidate=${swr}`,
    'X-Snapshot-Status': status,
    'X-Snapshot-Age': String(age),
    ...(degraded ? { 'X-Snapshot-Degraded': 'true' } : {}),
  }
}

function snapshotResponse(snap, etag, status, age, degraded, browserMaxAge, swr) {
  const headers = snapshotHeaders(etag, status, age, degraded, browserMaxAge, swr)
  const started = Date.now()
  console.log(JSON.stringify({ event: 'snapshot_serve', status, age_s: age, latency_ms: Date.now() - started }))
  return new Response(
    JSON.stringify({ data: snap.data, version: snap.version, generated_at: snap.generated_at }),
    { status: 200, headers },
  )
}

// 可选错误上报：重建失败/降级时 POST 到 webhook（默认关闭）
function reportError(env, event, error) {
  const url = readEnv(env, 'SNAPSHOT_ALERT_WEBHOOK')
  if (!url) return
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, error: String(error?.message || error), ts: Date.now() }),
  }).catch(() => {})
}

// 公开只读端点：快照优先 → SWR → 同步重建 → 旧快照降级
async function serveFrontendData(request, env, ctx) {
  const store = getSnapshotStore(env)
  const ttl = Math.max(0, Number(readEnv(env, 'SNAPSHOT_TTL_SECONDS')) || 600)
  const swr = Math.max(0, Number(readEnv(env, 'SNAPSHOT_SWR_SECONDS')) || 300)
  const browserMaxAge = Math.max(0, Number(readEnv(env, 'SNAPSHOT_BROWSER_MAX_AGE')) || 60)
  const nowMs = Date.now()

  let snap = null
  try {
    snap = await store.get(SNAPSHOT_KEY, { type: 'json' })
  } catch (error) {
    console.error(JSON.stringify({ event: 'snapshot_read_error', error: String(error?.message || error) }))
  }

  const age = snap?.generated_at ? Math.max(0, Math.floor((nowMs - Date.parse(snap.generated_at)) / 1000)) : Infinity
  const etag = snap?.version ? `"${snap.version}"` : null

  // ETag 协商：浏览器/CDN 携 If-None-Match 时 304（省带宽；写后重建 version 变化 → 自动拿到新数据）
  if (etag && request.headers.get('If-None-Match') === etag) {
    return new Response(null, { status: 304, headers: snapshotHeaders(etag, 'FRESH', age, false, browserMaxAge, swr) })
  }

  if (snap && age < ttl) {
    return snapshotResponse(snap, etag, 'FRESH', age, false, browserMaxAge, swr)
  }
  if (snap && age < ttl + swr) {
    // stale-while-revalidate：先回旧快照，后台异步重建，用户无感
    try {
      if (ctx?.waitUntil) ctx.waitUntil(refreshSnapshot(env).catch(() => {}))
      else refreshSnapshot(env).catch(() => {})
    } catch (error) {
      console.error(JSON.stringify({ event: 'snapshot_swr_trigger_error', error: String(error?.message || error) }))
    }
    return snapshotResponse(snap, etag, 'STALE', age, false, browserMaxAge, swr)
  }

  // 未命中 / 超 SWR 窗口 → 同步回源重建
  try {
    const rebuilt = await refreshSnapshot(env)
    return snapshotResponse(rebuilt, `"${rebuilt.version}"`, 'REBUILT', 0, false, browserMaxAge, swr)
  } catch (error) {
    console.error(JSON.stringify({ event: 'snapshot_rebuild_error', error: String(error?.message || error) }))
    reportError(env, 'snapshot_rebuild_error', error)
    if (snap) {
      // 回源失败：用旧快照降级（即使已严重过期），保证可用性
      return snapshotResponse(snap, etag, 'STALE_DEGRADED', age, true, browserMaxAge, swr)
    }
    return fail('数据暂时不可用，请稍后重试', 503)
  }
}

// ---------- 点击统计：缓冲 + 批量/延迟写入 ----------
function scheduleClickFlush(env, ctx) {
  if (clickBuffer.length === 0) return
  const batchSize = Math.max(1, Number(readEnv(env, 'CLICK_BATCH_SIZE')) || CLICK_BATCH_SIZE_DEFAULT)
  const maxAgeMs = Math.max(1, Number(readEnv(env, 'CLICK_MAX_AGE_SECONDS')) || CLICK_MAX_AGE_SECONDS_DEFAULT) * 1000
  const due = clickBuffer.length >= batchSize || Date.now() - clickBufferStart >= maxAgeMs
  if (!due) return
  const task = flushClicks(env)
  try {
    if (ctx?.waitUntil) ctx.waitUntil(task)
    else task.catch(() => {})
  } catch {
    task.catch(() => {})
  }
}

// 整批取出 → 参数化多行 INSERT（一条语句写整批）；失败回写缓冲等待下轮重试
function flushClicks(env) {
  const batch = clickBuffer.splice(0, clickBuffer.length)
  clickBufferStart = 0
  if (batch.length === 0) return flushChain
  flushChain = flushChain.then(async () => {
    try {
      const sql = getSql(env)
      const params = []
      const values = []
      for (const c of batch) {
        params.push(c.link_id, c.user_agent)
        values.push(`($${params.length - 1}, $${params.length})`)
      }
      await sql.unsafe(`INSERT INTO click_stats (link_id, user_agent) VALUES ${values.join(', ')}`, params)
      console.log(JSON.stringify({ event: 'click_flush', count: batch.length }))
    } catch (error) {
      console.error(JSON.stringify({ event: 'click_flush_error', count: batch.length, error: String(error?.message || error) }))
      // 失败回写缓冲（受 CLICK_BUFFER_CAP 上限保护），等待下轮触发重试
      const overflow = Math.max(0, clickBuffer.length + batch.length - CLICK_BUFFER_CAP)
      const retry = overflow > 0 ? batch.slice(0, batch.length - overflow) : batch
      clickBuffer.unshift(...retry)
      if (clickBuffer.length > 0) clickBufferStart = clickBufferStart || Date.now()
    }
  })
  return flushChain
}

async function handleClickStat(env, ctx, body) {
  const linkId = body?.link_id
  if (typeof linkId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(linkId)) {
    return fail('link_id 无效', 400)
  }
  if (clickBuffer.length >= CLICK_BUFFER_CAP) clickBuffer.shift() // 丢弃最旧，防无限增长
  if (clickBuffer.length === 0) clickBufferStart = Date.now()
  clickBuffer.push({
    link_id: linkId,
    user_agent: typeof body?.user_agent === 'string' ? body.user_agent.slice(0, 500) : null,
  })
  scheduleClickFlush(env, ctx)
  return ok({ buffered: clickBuffer.length }) // 先响应，落库在 waitUntil 后台完成
}

// ---------- 登录 ----------
// body 由 handleRequest 统一解析后传入（request 流只能读一次，login 内不可再 request.json()）
// 密码校验在数据库侧执行（pgcrypto.crypt，Neon 独立 CPU）：
//   bcrypt cost=10 在边缘函数内计算会偶发触达 EdgeOne 单次 200ms CPU 限制（HTTP 545 "Error return from script"）；
//   交给 Neon 后边缘函数只剩 I/O 等待，登录接口稳定。
//   $2b$（bcryptjs 生成）与 $2a$ 算法等价，先归一化$2b$->$2a$ 再交由 crypt 校验。
async function login(request, rt, body) {
  const { sql } = rt
  const { username, password } = body || {}
  const rows = await sql`SELECT key, value FROM config WHERE key IN ('admin_user','admin_pwd')`
  const cfg = {}
  for (const r of rows) cfg[r.key] = r.value
  const adminUser = cfg.admin_user || 'admin'
  const adminPwdHash = cfg.admin_pwd || ''
  if (username !== adminUser || !adminPwdHash) {
    return fail('用户名或密码错误', 401)
  }
  const checks = await sql`
    SELECT (replace(value, '$2b$', '$2a$') = crypt(${password || ''}, replace(value, '$2b$', '$2a$'))) AS ok
    FROM config WHERE key = 'admin_pwd' LIMIT 1
  `
  if (!checks[0]?.ok) {
    return fail('用户名或密码错误', 401)
  }
  const token = await new SignJWT({ role: 'admin', sub: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(rt.secret)
  return ok({ token })
}

// ---------- 后台读写路由 ----------
// 语义须知：后台读均不加 is_visible/is_active 过滤（需含隐藏/停用行）, 勿与公开快照 SQL 混用
async function handleApi(url, request, body, rt, env, ctx) {
  const { sql } = rt
  const segments = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean)

  // POST /api/auth/login（无需验签）
  if (url.pathname.replace(/\/+$/, '').endsWith('/auth/login') && request.method === 'POST') {
    return login(request, rt, body)
  }

  // GET /api/frontend-data（公开只读快照, 无需验签）
  if (segments[0] === 'frontend-data' && segments.length === 1 && request.method === 'GET') {
    return serveFrontendData(request, env, ctx)
  }

  // POST /api/stats/click（公开点击统计：内存缓冲 + 批量/延迟写入, 无需验签）
  if (segments[0] === 'stats' && segments[1] === 'click' && request.method === 'POST') {
    return handleClickStat(env, ctx, body)
  }

  // 其余一律验签
  if (!(await verifyToken(request, rt))) {
    return fail('认证令牌无效或已过期', 401)
  }

  // ---- links ----
  // GET /links（后台含隐藏行）
  if (segments[0] === 'links' && segments.length === 1 && request.method === 'GET') {
    const rows = await sql`SELECT * FROM links ORDER BY sort_order`
    return ok(rows)
  }
  // POST /links
  if (segments[0] === 'links' && segments.length === 1 && request.method === 'POST') {
    const { title, url, category_id, icon, description, sort_order, is_visible } = body || {}
    let finalOrder = sort_order
    if (!finalOrder) {
      const rows = await sql`SELECT COALESCE(MAX(sort_order),0) + 10 AS n FROM links WHERE category_id = ${category_id}`
      finalOrder = first(rows)?.n || 10
    }
    const created = await sql`
      INSERT INTO links (title, url, category_id, icon, description, sort_order, is_visible)
      VALUES (${title}, ${url}, ${category_id}, ${icon ?? null}, ${description ?? null}, ${finalOrder}, ${is_visible ?? true})
      RETURNING *
    `
    return ok(created[0])
  }
  // PUT /links/:id
  if (segments[0] === 'links' && segments.length === 2 && request.method === 'PUT') {
    const updated = await updateByWhitelist('links', 'id', segments[1], body, ['title', 'url', 'description', 'category_id', 'icon', 'sort_order', 'is_visible'], rt)
    return ok(updated)
  }
  // DELETE /links/:id（软删除, 保留后台可见可恢复）
  if (segments[0] === 'links' && segments.length === 2 && request.method === 'DELETE') {
    await sql`UPDATE links SET is_visible = false WHERE id = ${segments[1]}`
    return ok({ id: segments[1] })
  }
  // POST /links/reorder
  if (segments[0] === 'links' && segments[1] === 'reorder' && request.method === 'POST') {
    const items = body?.items || []
    if (!Array.isArray(items) || items.length === 0) return fail('items 不能为空')
    // 非交互事务, 全部更新原子提交
    await sql.transaction(items.map((it) => sql`UPDATE links SET sort_order = ${it.sort_order} WHERE id = ${it.id}`))
    return ok({ updated: items.length })
  }

  // ---- categories ----
  if (segments[0] === 'categories' && segments.length === 1 && request.method === 'GET') {
    const rows = await sql`SELECT * FROM categories ORDER BY sort_order`
    return ok(rows)
  }
  if (segments[0] === 'categories' && segments.length === 1 && request.method === 'POST') {
    const { name, sort_order, is_visible } = body || {}
    let finalOrder = sort_order
    if (!finalOrder) {
      const rows = await sql`SELECT COALESCE(MAX(sort_order),0) + 10 AS n FROM categories`
      finalOrder = first(rows)?.n || 10
    }
    const created = await sql`
      INSERT INTO categories (name, sort_order, is_visible)
      VALUES (${name}, ${finalOrder}, ${is_visible ?? true})
      RETURNING *
    `
    return ok(created[0])
  }
  if (segments[0] === 'categories' && segments.length === 2 && request.method === 'PUT') {
    const updated = await updateByWhitelist('categories', 'id', segments[1], body, ['name', 'sort_order', 'is_visible'], rt)
    return ok(updated)
  }
  if (segments[0] === 'categories' && segments.length === 2 && request.method === 'DELETE') {
    await sql`UPDATE categories SET is_visible = false WHERE id = ${segments[1]}`
    return ok({ id: segments[1] })
  }
  if (segments[0] === 'categories' && segments[1] === 'reorder' && request.method === 'POST') {
    const items = body?.items || []
    if (!Array.isArray(items) || items.length === 0) return fail('items 不能为空')
    await sql.transaction(items.map((it) => sql`UPDATE categories SET sort_order = ${it.sort_order} WHERE id = ${it.id}`))
    return ok({ updated: items.length })
  }

  // ---- config ----
  // 敏感键 admin_pwd 一律脱敏：哈希永不出服务器（与"客户端无法读取"的开发规范一致）
  // GET /config
  if (segments[0] === 'config' && segments.length === 1 && request.method === 'GET') {
    const rows = await sql`SELECT key, value FROM config`
    return ok(rows.filter((r) => r.key !== 'admin_pwd'))
  }
  // GET /config/:key
  if (segments[0] === 'config' && segments.length === 2 && request.method === 'GET') {
    if (segments[1] === 'admin_pwd') return ok(null)
    const rows = await sql`SELECT value FROM config WHERE key = ${segments[1]} LIMIT 1`
    return ok(first(rows)?.value ?? null)
  }
  // PUT /config/:key（upsert）
  if (segments[0] === 'config' && segments.length === 2 && request.method === 'PUT') {
    const value = body?.value ?? null
    // admin_pwd：空值不修改（保留原哈希）；非空用数据库侧 bcrypt 加密（pgcrypto.crypt，
    //   Neon 独立 CPU，规避边缘函数 CPU 限制），与 login 校验的 crypt 逻辑一致
    if (segments[1] === 'admin_pwd') {
      if (value == null || value === '') return ok({ key: segments[1], value: null })
      await sql`
        INSERT INTO config (key, value) VALUES ('admin_pwd', crypt(${value}, gen_salt('bf', 10)))
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `
      return ok({ key: segments[1], value: null })
    }
    await sql`
      INSERT INTO config (key, value) VALUES (${segments[1]}, ${value})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `
    return ok({ key: segments[1], value })
  }

  // ---- apply ----
  // GET /apply[?status=]
  if (segments[0] === 'apply' && segments.length === 1 && request.method === 'GET') {
    const status = url.searchParams.get('status')
    const rows = status
      ? await sql`SELECT * FROM apply WHERE status = ${status} ORDER BY created_at DESC`
      : await sql`SELECT * FROM apply ORDER BY created_at DESC`
    return ok(rows)
  }
  // POST /apply/:id/approve —— 单条 CTE = 一个隐式事务: 读申请→建链接→更新状态, 原子完成
  if (segments[0] === 'apply' && segments[2] === 'approve' && request.method === 'POST') {
    const id = segments[1]
    const applied = await sql`
      WITH a AS (
        SELECT id, name, url, category_id, icon, description
        FROM apply WHERE id = ${id} AND status = 'pending'
        FOR UPDATE
      ), ins AS (
        INSERT INTO links (title, url, category_id, icon, description, sort_order, is_visible)
        SELECT a.name, a.url, a.category_id, a.icon, a.description,
               (SELECT COALESCE(MAX(sort_order),0) + 10 FROM links WHERE category_id = a.category_id),
               true
        FROM a
        RETURNING *
      )
      UPDATE apply SET status = 'approved' WHERE id = ${id}
        AND EXISTS (SELECT 1 FROM ins)
      RETURNING id
    `
    if (!applied || applied.length === 0) return fail('申请不存在或已处理', 404)
    return ok({ id })
  }
  // POST /apply/:id/reject
  if (segments[0] === 'apply' && segments[2] === 'reject' && request.method === 'POST') {
    await sql`UPDATE apply SET status = 'rejected' WHERE id = ${segments[1]}`
    return ok({ id: segments[1] })
  }

  // ---- search-engines ----
  if (segments[0] === 'search-engines' && segments.length === 1 && request.method === 'GET') {
    const rows = await sql`SELECT * FROM search_engines ORDER BY sort_order`
    return ok(rows)
  }
  if (segments[0] === 'search-engines' && segments.length === 1 && request.method === 'POST') {
    const { name, url_template, icon, sort_order, is_active } = body || {}
    let finalOrder = sort_order
    if (!finalOrder) {
      const rows = await sql`SELECT COALESCE(MAX(sort_order),0) + 10 AS n FROM search_engines`
      finalOrder = first(rows)?.n || 10
    }
    const created = await sql`
      INSERT INTO search_engines (name, url_template, icon, sort_order, is_active)
      VALUES (${name}, ${url_template}, ${icon ?? null}, ${finalOrder}, ${is_active ?? true})
      RETURNING *
    `
    return ok(created[0])
  }
  if (segments[0] === 'search-engines' && segments.length === 2 && request.method === 'PUT') {
    const updated = await updateByWhitelist('search_engines', 'id', segments[1], body, ['name', 'url_template', 'icon', 'sort_order', 'is_active'], rt)
    return ok(updated)
  }
  if (segments[0] === 'search-engines' && segments.length === 2 && request.method === 'DELETE') {
    await sql`UPDATE search_engines SET is_active = false WHERE id = ${segments[1]}`
    return ok({ id: segments[1] })
  }

  // ---- stats ----
  // GET /stats/overview
  if (segments[0] === 'stats' && segments[1] === 'overview' && request.method === 'GET') {
    const [linksRow] = await sql`SELECT count(*) FILTER (WHERE is_visible) AS total_links FROM links`
    const [clicks] = await sql`SELECT count(*) AS total FROM click_stats`
    const [today] = await sql`SELECT count(*) AS total FROM click_stats WHERE clicked_at >= date_trunc('day', now())`
    const [week] = await sql`SELECT count(*) AS total FROM click_stats WHERE clicked_at >= now() - interval '7 days'`
    return ok({
      total_links: Number(linksRow?.total_links || 0),
      total_clicks: Number(clicks?.total || 0),
      today_clicks: Number(today?.total || 0),
      week_clicks: Number(week?.total || 0),
    })
  }
  // GET /stats/top-links?limit=
  if (segments[0] === 'stats' && segments[1] === 'top-links' && request.method === 'GET') {
    const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100)
    const rows = await sql`
      SELECT cs.link_id, l.title, count(*) AS count
      FROM click_stats cs
      JOIN links l ON l.id = cs.link_id
      GROUP BY cs.link_id, l.title
      ORDER BY count DESC
      LIMIT ${limit}
    `
    return ok(rows)
  }
  // GET /stats/trend?days=
  if (segments[0] === 'stats' && segments[1] === 'trend' && request.method === 'GET') {
    const days = Math.min(Number(url.searchParams.get('days')) || 7, 90)
    const rows = await sql`
      SELECT to_char(clicked_at, 'YYYY-MM-DD') AS date, count(*) AS count
      FROM click_stats
      WHERE clicked_at >= date_trunc('day', now()) - (${days} - 1) * interval '1 day'
      GROUP BY 1
      ORDER BY 1
    `
    // 补充缺失日为 0, 保证前端图表连续
    const counts = {}
    for (const r of rows) counts[r.date] = Number(r.count)
    const daysArr = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      daysArr.push({ date: key, count: counts[key] || 0 })
    }
    return ok(daysArr)
  }

  return fail(`未匹配的路由: ${request.method} ${url.pathname}`, 404)
}

// 白名单动态 UPDATE（列名来自常量, 无注入风险）
async function updateByWhitelist(table, idCol, id, body, allowedFields, rt) {
  const { sql } = rt
  const sets = []
  const params = []
  for (const field of allowedFields) {
    if (body && body[field] !== undefined) {
      params.push(body[field])
      sets.push(`${field} = $${params.length}`)
    }
  }
  if (sets.length === 0) {
    throw new Error('没有可更新的字段')
  }
  params.push(id)
  const query = `UPDATE ${table} SET ${sets.join(', ')}, updated_at = now() WHERE ${idCol} = $${params.length} RETURNING *`
  const rows = await sql.unsafe(query, params)
  return rows[0]
}

// ---------- 后台写成功后触发快照重建（收口一处, 覆盖所有写路由） ----------
function shouldTriggerSnapshotRebuild(url, request) {
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') return false
  const path = url.pathname.replace(/\/+$/, '')
  if (path.endsWith('/auth/login')) return false
  // 匿名提交收录申请与点击统计不改变公开快照（不在快照内）
  if (request.method === 'POST' && (path.endsWith('/apply') || path.endsWith('/stats/click'))) return false
  return true
}

function afterDataWrite(env, ctx) {
  const task = refreshSnapshot(env).catch((error) =>
    console.error(JSON.stringify({ event: 'snapshot_rebuild_after_write_error', error: String(error?.message || error) })),
  )
  try {
    if (ctx?.waitUntil) ctx.waitUntil(task)
    else task.catch(() => {})
  } catch {
    task.catch(() => {})
  }
}

// ---------- 入口（Makers 约定） ----------
/**
 * Makers Edge Functions 入口: export default onRequest(context)
 * context.request = 标准 Request; context.env = Makers 环境变量（每次请求为新对象, 不可作缓存键）
 * context.waitUntil = 后台任务（SWR 刷新 / 点击批量落库 / 写后重建）
 * 本文件路径 edge-functions/api/[[default]].js → 站点 /api/** 全部由此分发
 */
export async function handleRequest(request, env, ctx) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  let rt
  try {
    rt = getRuntime(env)
  } catch (error) {
    console.error('[runtime init]', error)
    return fail(error?.message || 'Internal Server Error', 500)
  }
  const url = new URL(request.url)
  const body = request.method === 'GET' || request.method === 'DELETE' ? null : await request.json().catch(() => ({}))
  try {
    const res = await handleApi(url, request, body, rt, env, ctx)
    // 数据写成功后主动重建并覆盖同一快照，使边缘侧数据及时生效（先响应写请求）
    if (res.status >= 200 && res.status < 300 && shouldTriggerSnapshotRebuild(url, request)) {
      afterDataWrite(env, ctx)
    }
    return res
  } catch (error) {
    console.error(error)
    return fail(error?.message || 'Internal Server Error', 500)
  }
}

export default function onRequest(context) {
  return handleRequest(context.request, context.env, context)
}
