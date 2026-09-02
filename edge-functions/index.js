/**
 * EdgeOne Functions —— 登录 + 后台写代理（"前端直连 + 代理后台"的薄后端）
 *
 * 职责：
 *  - POST /auth/login    校验 config.admin_user/admin_pwd(bcrypt) 后签发 HS256 JWT（7d）
 *  - 其余路由            验签(Bearer) 后以 nav_admin 执行 SQL, 返回 { data } / { message }
 *
 * 安全边界：
 *  - DATABASE_URL_ADMIN（nav_admin 连接串）与 JWT_SECRET 只存本函数环境变量, 不落入前端 bundle
 *  - 后台读 = 不含 is_visible/is_active 过滤（后台需看到隐藏/停用行）, 与前台直连 SQL 语义不同, 勿复用
 *  - JWT 对数据库层仅是会话状态标记（Postgres/RLS 不校验）；本函数每次 jwtVerify 验签
 *
 * 部署：
 *  - 函数环境变量：DATABASE_URL_ADMIN（nav_admin 连接串）、JWT_SECRET（≥32 字符随机串）
 *  - 触发路径与前端 VITE_API_BASE_URL 对应（如 https://<函数域名>/api）
 *  - 依赖：npm i @neondatabase/serverless jose bcryptjs
 *  - EdgeOne 边缘函数事件契约可能与本文件入口略有差异, 部署时对照控制台文档
 *    调整 handleRequest 之上的平台适配层（这里按 Web 标准 Request/Response 实现）
 */
import { neon } from '@neondatabase/serverless'
import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'

const DATABASE_URL_ADMIN = process.env.DATABASE_URL_ADMIN
const JWT_SECRET = process.env.JWT_SECRET

if (!DATABASE_URL_ADMIN || !JWT_SECRET) {
  throw new Error('缺少环境变量 DATABASE_URL_ADMIN / JWT_SECRET（仅配置在函数服务端）')
}

const sql = neon(DATABASE_URL_ADMIN)
const secret = new TextEncoder().encode(JWT_SECRET)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
}

function ok(data, status = 200) {
  return new Response(JSON.stringify({ data }), { status, headers: CORS_HEADERS })
}

function fail(message, status = 400) {
  return new Response(JSON.stringify({ message }), { status, headers: CORS_HEADERS })
}

const first = (rows) => (Array.isArray(rows) && rows.length ? rows[0] : undefined)

// 单个待办接口：单条 SQL 即一个隐式事务, 天然原子
async function verifyToken(request) {
  const auth = request.headers.get('Authorization') || ''
  if (!auth.startsWith('Bearer ')) return null
  try {
    return await jwtVerify(auth.slice(7), secret)
  } catch {
    return null
  }
}

// ---------- 登录 ----------
async function login(request) {
  const body = await request.json().catch(() => ({}))
  const { username, password } = body || {}
  const rows = await sql`SELECT key, value FROM config WHERE key IN ('admin_user','admin_pwd')`
  const cfg = {}
  for (const r of rows) cfg[r.key] = r.value
  const adminUser = cfg.admin_user || 'admin'
  const adminPwdHash = cfg.admin_pwd || ''
  if (username !== adminUser || !adminPwdHash) {
    return fail('用户名或密码错误', 401)
  }
  // 异步 compare, 勿用同步 compareSync 以免阻塞事件循环
  const passwordValid = await bcrypt.compare(password || '', adminPwdHash)
  if (!passwordValid) {
    return fail('用户名或密码错误', 401)
  }
  const token = await new SignJWT({ role: 'admin', sub: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret)
  return ok({ token })
}

// ---------- 后台读写路由 ----------
// 语义须知：后台读均不加 is_visible/is_active 过滤（需含隐藏/停用行）, 勿与前台直连 SQL 混用
async function handleApi(url, request, body) {
  const segments = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean)

  // POST /auth/login（无需验签）
  if (url.pathname.replace(/\/+$/, '').endsWith('/auth/login') && request.method === 'POST') {
    return login(request)
  }

  // 其余一律验签
  if (!(await verifyToken(request))) {
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
    const updated = await updateByWhitelist('links', 'id', segments[1], body, ['title', 'url', 'description', 'category_id', 'icon', 'sort_order', 'is_visible'])
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
    const updated = await updateByWhitelist('categories', 'id', segments[1], body, ['name', 'sort_order', 'is_visible'])
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
  // GET /config
  if (segments[0] === 'config' && segments.length === 1 && request.method === 'GET') {
    const rows = await sql`SELECT key, value FROM config`
    return ok(rows)
  }
  // GET /config/:key
  if (segments[0] === 'config' && segments.length === 2 && request.method === 'GET') {
    const rows = await sql`SELECT value FROM config WHERE key = ${segments[1]} LIMIT 1`
    return ok(first(rows)?.value ?? null)
  }
  // PUT /config/:key（upsert）
  if (segments[0] === 'config' && segments.length === 2 && request.method === 'PUT') {
    const value = body?.value ?? null
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
    const updated = await updateByWhitelist('search_engines', 'id', segments[1], body, ['name', 'url_template', 'icon', 'sort_order', 'is_active'])
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
async function updateByWhitelist(table, idCol, id, body, allowedFields) {
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

// ---------- 入口（平台适配层） ----------
/**
 * EdgeOne 边缘函数入口。本实现按 Web 标准 Request/Response 编写,
 * 事件契约以 EdgeOne 控制台文档为准, 按需在此层做转换:
 *   例: export default async function (event) { const req = 从 event 构造 Request; return handleRequest(req) }
 */
export async function handleRequest(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  const url = new URL(request.url)
  const body = request.method === 'GET' || request.method === 'DELETE' ? null : await request.json().catch(() => ({}))
  try {
    return await handleApi(url, request, body)
  } catch (error) {
    console.error(error)
    return fail(error?.message || 'Internal Server Error', 500)
  }
}

export default handleRequest