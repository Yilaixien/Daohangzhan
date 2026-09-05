# 基于 EdgeOne Makers 的 Neon 只读加速缓存层方案

## 一、摘要

在现有「前端直连 Neon(nav_read) + Makers Edge Functions 代理后台(nav_admin)」架构上，新增一个**只读快照缓存层**：

- 新增公开端点 `GET /api/frontend-data`（无鉴权），由最近的 EdgeOne 边缘节点处理；
- 边缘函数优先读取 **Blob 对象存储**中的快照文件（含数据体 + 生成时间戳 + 版本号）；
- 快照命中且未过期（TTL 可配置）→ 直接返回，**完全不回源 Neon**；
- 未命中/过期 → 以 **nav_admin** 并行查询 `config/categories/links/search_engines` 重建快照，写回 Blob 后返回 JSON；
- 后台写操作（links/categories/config/search-engines/apply 审核）在数据库修改成功后，通过 `context.waitUntil` 主动重建并覆盖同一份快照；
- 前端公开页面（首页/关于/申请收录/前台布局）统一改走该端点，前台对 Neon 的直连查询收敛为**每页面 1 次边缘请求**（且命中后为 0 次回源），后台管理读保持实时、不缓存。

实现语言与依赖：Edge Functions 侧新增 `@edgeone/pages-blob`（Makers 官方 Blob SDK），前端仅做服务层路由调整，无 UI 改动。

---

## 二、现状分析

| 项 | 现状 | 问题 |
|---|---|---|
| 首页数据 | [home.ts](file:///workspace/src/stores/home.ts#L29-L64) 依次 `config.getAll()`、`searchEngines.getAll()`、`categories.getAll()`、按分组 `links.getByCategory()`（N+1） | 每次首页加载向 Neon 发 N+2 个查询，全部是浏览器直连、无缓存 |
| 前台布局/关于/申请 | [FrontendLayout.vue](file:///workspace/src/views/frontend/FrontendLayout.vue#L58-L69) `config.getAll()`、[AboutView.vue](file:///workspace/src/views/frontend/AboutView.vue#L37-L45) `config.get('about_content')`、[ApplyView.vue](file:///workspace/src/views/frontend/ApplyView.vue#L209-L224) `config.getAll()` + `categories.getAll()` | 同样直连 Neon，无缓存 |
| 公开读实现 | [neon/index.ts](file:///workspace/src/services/neon/index.ts#L141-L158) 用 `readSql`（nav_read）直连 | RLS 已过滤可见行，但查询数无法收敛 |
| 后台写 | `edge-functions/api/[[default]].js` 以 nav_admin 执行 SQL（JWT 验签） | 写后前台仍要等 TTL 才见新数据 |
| 函数运行时 | 单次 CPU 200ms（不含 I/O）；`runtimeCache` 模块级单例；`getRuntime` 同时要求 `DATABASE_URL_ADMIN` + `JWT_SECRET` | 公开读端点不应依赖 JWT_SECRET，需小幅重构 |
| 存储 | 平台已提供 Blob（`@edgeone/pages-blob`：`getStore`/`set`/`setJSON`/`get`/`list`，默认 60s 最终一致、可选 strong，单值 ≤25MB，首次 `getStore` 自动建命名空间）与 `context.waitUntil`（后台任务） | 可直接承载快照缓存与 SWR |

结论：新增一个聚合快照端点即可把「前台公开读」收敛为 1 次边缘请求，命中后 0 回源；管理端读（含隐藏行、stats、apply）保持原样不缓存。

---

## 三、总体架构

```
浏览器(前台公开读)                 EdgeOne 边缘节点                  Neon (PostgreSQL)
    │  GET /api/frontend-data        │                                 │
    ├──────────────────────────────► │ ① 读 Blob 快照 frontend-data.json│
    │                                ├──► Blob(最终一致, 可配 strong)   │
    │                                │ ② 命中且 age<TTL → 直接返回 ★   │
    │                                │ ③ TTL≤age<TTL+SWR → 返回旧快照  │
    │                                │    + waitUntil 后台刷新(异步)    │
    │                                │ ④ 未命中/超 SWR → 并行查询4表    │
    │                                ├───────────────────────────────► │
    │                                │ ◄── 重建快照 → setJSON 写回 Blob │
    │                                │ ⑤ 回源失败 → 旧快照降级/503      │
    │ ◄───────────────────────────── │ 200 JSON / 304                  │
    │                                │                                 │
后台管理写  POST/PUT/DELETE /api/*    │                                 │
    ├──────────────────────────────► │ JWT 验签 → nav_admin 执行 SQL    │
    │ ◄── 200 OK（先响应浏览器）      │  成功后 waitUntil(重建快照)      │
    │                                ├──► 重建 → setJSON 覆盖同一快照   │
```

快照只覆盖**公开只读数据**：`config`（剔除 `admin_pwd`）、`categories`（visible）、`links`（visible）、`search_engines`（active）。`apply` 提交、`click_stats`、管理端读（含隐藏行/stats）保持原有实时路径，不缓存。

---

## 四、详细设计

### 4.1 快照数据结构（Blob key：`frontend-data.json`）

```json
{
  "schema_version": 1,
  "version": "1780000000000",
  "generated_at": "2026-09-06T08:00:00.000Z",
  "data": {
    "config": { "title": "...", "home-title": "...", "..." : "..." },
    "categories": [ { "id": "...", "name": "...", "sort_order": 10, "is_visible": true, "created_at": "..." } ],
    "links": [ { "id": "...", "title": "...", "url": "...", "category_id": "...", "icon": "...", "sort_order": 10, "is_visible": true, "created_at": "...", "updated_at": "..." } ],
    "search_engines": [ { "id": "...", "name": "...", "url_template": "...", "icon": "...", "sort_order": 10, "is_active": true } ]
  }
}
```

- `generated_at`：生成时间戳（ISO8601），TTL 判龄依据；
- `version`：重建时刻毫秒时间戳字符串，**单调递增**，作为 ETag 与版本号（后台写重建后自然变化）；
- `schema_version`：快照格式版本，数据体结构变更时 +1（与 ETag 解耦）。

### 4.2 读取流程（边缘函数 `GET /api/frontend-data`）

1. `store.get('frontend-data.json', { type: 'json' })`（读一致性默认 `eventual`，可用环境变量切 `strong`）；
2. 计算 `age = (now - generated_at)/1000`；若带 `If-None-Match` 且等于当前快照 `version` → 直接返回 **304**（附 ETag）；
3. 分支（见 4.3）：
   - `age < TTL` → 命中，直接返回，**零回源**；
   - `TTL ≤ age < TTL + SWR` → 返回旧快照 + `waitUntil` 后台异步重建（stale-while-revalidate）；
   - 其余（未命中/超窗）→ **同步**重建后返回；
4. 返回体保持项目统一信封：`{ data: {config,categories,links,search_engines}, version, generated_at }`，兼容前端 `apiFetch` 的 `'data' in body` 约定。

### 4.3 TTL 与刷新策略

| 阶段 | 判定 | 行为 | 回源 Neon |
|---|---|---|---|
| 新鲜 | `age < TTL` | 直接返回快照 | 否 |
| 过期-可容忍 | `TTL ≤ age < TTL + SWR` | 先返回旧快照（毫秒级），`context.waitUntil` 后台重建 | 是（异步，用户无感） |
| 严重过期/未命中 | `age ≥ TTL + SWR` 或不存在 | **同步**重建：4 表 `Promise.all` 并行查询 → `setJSON` 写回 → 返回新快照 | 是（同步，首访/断缓存时） |
| 后台写成功后 | 任一数据写成功 | `waitUntil` 主动重建并覆盖同一快照 | 是（异步，先响应写请求） |

- **默认值**：`SNAPSHOT_TTL_SECONDS=600`（10 分钟）、`SNAPSHOT_SWR_SECONDS=300`（5 分钟）。即：0–10min 零回源；10–15min 返回旧数据且后台自动刷新；15min 后首访触发同步重建。
- **效果**：稳态下（流量持续）Neon 回源频率 ≤ 每 TTL 每节点 1 次 + 后台写 N 次，首页对 Neon 的查询从 N+2/次 降为 0/次（命中时）。
- SWR 窗口内的「先返回旧快照」是对需求 4「过期即回源重建」的增强（用户明确要求设计此类策略）：用户无感知延迟，重建失败也不影响当次响应。

### 4.4 回源失败降级（旧快照兜底）

- **Blob 读取失败**（SDK 异常）→ 记录日志，跳过快照，直接走同步重建（退化为「每次回源」的兜底链路）；
- **同步重建失败**（Neon 查询/SDK 写回异常）：
  - 若存在旧快照（任意年龄）→ 返回旧快照，响应加 `X-Snapshot-Status: STALE_DEGRADED` + `X-Snapshot-Degraded: true`，HTTP 200；仅记录错误日志，不打断用户；
  - 若**连旧快照都没有** → 返回 `503 { message: '数据暂时不可用，请稍后重试' }`；
- **前端二级兜底**（[neon/index.ts] `frontendData.getAll()`）：边缘端点请求失败时，降级为浏览器直连 nav_read 组装同结构数据（保留现有 `readSql` 能力），保证页面可用；正常路径不触发。

### 4.5 并发去重与缓存击穿防护

- **模块级 in-flight 去重**：`inflightRebuilds: Map<key, Promise<snapshot>>`——同一边缘隔离实例内，若已有一个重建在进行，后续并发请求**共享同一 Promise**，不重复回源；`finally` 中删除条目以便下次重建（失败也可重试）。与现有 `runtimeCache` 单例模式一致（边缘运行时模块状态按隔离实例持久）。
- **缓存击穿**：首次冷启动/集中过期时，仅第一个请求真正回源，其余等待其完成（毫秒级），不会同时打爆 Neon。
- **跨节点说明**：EdgeOne 多边缘节点间无共享内存，无法全局锁；靠 TTL+SWR 把跨节点重复回源收敛到「每 TTL 每节点 1 次」，且单次重建仅 4 条并行轻查询，偶发重复可接受。文档注明，不做过度设计（如分布式锁）。

### 4.6 响应头设计（Cache-Control / ETag）

```http
Content-Type: application/json; charset=utf-8
Cache-Control: public, max-age=60, s-maxage=0, stale-while-revalidate=<SNAPSHOT_SWR_SECONDS>
ETag: "<version>"                                   # 如 "1780000000000"
X-Snapshot-Status: FRESH | STALE | REBUILT | STALE_DEGRADED
X-Snapshot-Age: <age 秒>
```

- `ETag`：以快照 `version`（重建毫秒时间戳）为值；请求带 `If-None-Match` 且相等 → `304`（无 body，省带宽；后台写重建后 version 变化 → 浏览器自动拿到新数据）；
- `Cache-Control`：`max-age=60` 允许浏览器复用 1 分钟（可配 `SNAPSHOT_BROWSER_MAX_AGE`），过期后带 `If-None-Match` 向边缘重验证（边缘读 Blob 快照，极廉价）；`s-maxage=0` 保证 **EdgeOne 平台 CDN 层不长期固定旧 JSON**，使「过期/写后刷新」逻辑由函数层独占控制（重要：站点平台缓存规则中对 `/api/frontend-data` 建议设为「不缓存/绕过」）；
- `X-Snapshot-Status`/`X-Snapshot-Age`：可观测性头，便于 curl/控制台排查命中与降级。

### 4.7 日志与错误上报

- **结构化日志**（`console.log/error`，JSON 单行，EdgeOne 控制台可查）：
  - `snapshot_rebuilt`：`{ event, key, rows:{categories,links,engines}, latency_ms }`（重建成功）；
  - `snapshot_read_error` / `snapshot_rebuild_error`：`{ event, error }`（Blob 读失败 / 重建失败）；
  - `snapshot_serve`：`{ event, status: FRESH|STALE|REBUILT|STALE_DEGRADED, age_s, latency_ms }`（每次响应，便于对账命中率）；
- **错误上报**：可选环境变量 `SNAPSHOT_ALERT_WEBHOOK`——重建失败或降级时 POST `{ event, error, ts }` 到该 URL（如企业微信群机器人/Server 酱），默认关闭，避免引入额外依赖；
- **对账指标**：由 `X-Snapshot-Status` + `snapshot_serve` 日志统计命中率/回源率/降级次数。

### 4.8 一致性说明

- Blob 默认**最终一致（≈秒级，文档保证 60s 内全局可见）**：后台写重建后，边缘读取存在短暂传播窗口。导航站场景可接受（旧数据仅多存活数秒，且 SWR 机制已保证不阻塞）；
- 如需「写后立即读到最新」（例如强一致需求），设 `SNAPSHOT_READ_CONSISTENCY=strong`（读直达主存储，延迟略增）——默认 `eventual`，保持最快读路径。

---

## 五、代码改动清单（文件级）

### 5.1 `edge-functions/api/[[default]].js`（核心，可部署代码）

改动 4 处：

**(a) 新增 import 与快照模块常量**

```js
import { getStore } from '@edgeone/pages-blob'

// ---------- 只读快照缓存（Neon → Blob → 边缘响应） ----------
const SNAPSHOT_STORE_DEFAULT = 'nav-snapshot'
const SNAPSHOT_KEY = 'frontend-data.json'
const SNAPSHOT_SCHEMA_VERSION = 1
// 模块级去重：同一边缘隔离实例内并发重建只回源一次（缓存击穿防护）
const inflightRebuilds = new Map()
const blobStoreCache = new Map()
```

**(b) 将 `getRuntime` 拆分为 `getSql` / `getSecret`（公开读端点不应依赖 JWT_SECRET）**

```js
const sqlCache = new Map()
const secretCache = new Map()

function getSql(env) {
  const read = (key) => env?.[key] || (typeof process !== 'undefined' ? process.env?.[key] : undefined)
  const dbUrl = read('DATABASE_URL_ADMIN')
  if (!dbUrl) throw new Error('缺少环境变量 DATABASE_URL_ADMIN')
  const cacheKey = `sql::${dbUrl}`
  if (!sqlCache.has(cacheKey)) sqlCache.set(cacheKey, neon(dbUrl))
  return sqlCache.get(cacheKey)
}

function getSecret(env) {
  const read = (key) => env?.[key] || (typeof process !== 'undefined' ? process.env?.[key] : undefined)
  const jwtSecret = read('JWT_SECRET')
  if (!jwtSecret) throw new Error('缺少环境变量 JWT_SECRET')
  const cacheKey = `secret::${jwtSecret}`
  if (!secretCache.has(cacheKey)) secretCache.set(cacheKey, new TextEncoder().encode(jwtSecret))
  return secretCache.get(cacheKey)
}

function getRuntime(env) {
  return { sql: getSql(env), secret: getSecret(env) }
}

function getSnapshotStore(env) {
  const name = env?.SNAPSHOT_STORE_NAME || SNAPSHOT_STORE_DEFAULT
  const consistency = env?.SNAPSHOT_READ_CONSISTENCY === 'strong' ? 'strong' : 'eventual'
  const cacheKey = `${name}::${consistency}`
  if (!blobStoreCache.has(cacheKey)) blobStoreCache.set(cacheKey, getStore({ name, consistency }))
  return blobStoreCache.get(cacheKey)
}
```

**(c) 快照重建 + 去重 + 公开读端点（`GET /api/frontend-data`）**

```js
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

function snapshotHeaders(etag, status, age, degraded) {
  const env = process.env // 仅本地；线上由调用方注入，见 serveFrontendData
  const swr = 300
  return {
    ...CORS_HEADERS,
    ETag: etag || '',
    'Cache-Control': `public, max-age=${60}, s-maxage=0, stale-while-revalidate=${swr}`,
    'X-Snapshot-Status': status,
    'X-Snapshot-Age': String(age),
    ...(degraded ? { 'X-Snapshot-Degraded': 'true' } : {}),
  }
}

// 公开只读端点：快照优先 → SWR → 同步重建 → 旧快照降级
async function serveFrontendData(request, env, ctx) {
  const store = getSnapshotStore(env)
  const ttl = Math.max(0, Number(env?.SNAPSHOT_TTL_SECONDS) || 600)
  const swr = Math.max(0, Number(env?.SNAPSHOT_SWR_SECONDS) || 300)
  const browserMaxAge = Math.max(0, Number(env?.SNAPSHOT_BROWSER_MAX_AGE) || 60)
  const nowMs = Date.now()

  let snap = null
  try {
    snap = await store.get(SNAPSHOT_KEY, { type: 'json' })
  } catch (error) {
    console.error(JSON.stringify({ event: 'snapshot_read_error', error: String(error?.message || error) }))
  }

  const age = snap?.generated_at ? Math.max(0, Math.floor((nowMs - Date.parse(snap.generated_at)) / 1000)) : Infinity
  const etag = snap?.version ? `"${snap.version}"` : null

  if (etag && request.headers.get('If-None-Match') === etag) {
    return new Response(null, { status: 304, headers: snapshotHeaders(etag, 'FRESH', age, false, browserMaxAge, swr) })
  }

  if (snap && age < ttl) {
    return snapshotResponse(snap, etag, 'FRESH', age, false, browserMaxAge, swr)
  }
  if (snap && age < ttl + swr) {
    // stale-while-revalidate：先回旧快照，后台异步重建
    try { ctx?.waitUntil?.(refreshSnapshot(env).catch(() => {})) } catch (error) {
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
  const url = env?.SNAPSHOT_ALERT_WEBHOOK
  if (!url) return
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, error: String(error?.message || error), ts: Date.now() }),
  }).catch(() => {})
}
```

> `snapshotHeaders` 内对 `browserMaxAge/swr` 以参数传入（上面代码为展示简洁将默认值内联，最终实现以参数化版本为准：`snapshotHeaders(etag, status, age, degraded, browserMaxAge, swr)`，`Cache-Control: public, max-age=${browserMaxAge}, s-maxage=0, stale-while-revalidate=${swr}`）。

**(d) 路由接入 + 后台写触发重建**

- `handleApi` 增加 `env, ctx` 参数；在 `login` 分支之后、JWT 验签**之前**插入公开读路由：

```js
// GET /api/frontend-data（公开只读快照，无需验签）
if (segments[0] === 'frontend-data' && segments.length === 1 && request.method === 'GET') {
  return serveFrontendData(request, env, ctx)
}
```

- 后台写成功后触发重建（`handleRequest` 收口，一处实现，覆盖所有写路由）：

```js
// 数据写成功后才触发快照重建（fire-and-forget，不阻塞写响应）
function shouldTriggerSnapshotRebuild(url, request) {
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') return false
  const path = url.pathname.replace(/\/+$/, '')
  if (path.endsWith('/auth/login')) return false
  // 匿名提交收录申请不改变公开快照（apply 不在快照内）
  if (request.method === 'POST' && path.endsWith('/apply')) return false
  return true
}

function afterDataWrite(env, ctx) {
  const task = refreshSnapshot(env).catch((error) =>
    console.error(JSON.stringify({ event: 'snapshot_rebuild_after_write_error', error: String(error?.message || error) })),
  )
  try {
    if (ctx?.waitUntil) ctx.waitUntil(task)
  } catch {
    task.catch(() => {})
  }
}

export async function handleRequest(request, env, ctx) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
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
```

### 5.2 依赖声明

- `edge-functions/package.json`：`dependencies` 增加 `"@edgeone/pages-blob": "^0.0.16"`；
- 根 `package.json`：`dependencies` 增加 `"@edgeone/pages-blob": "^0.0.16"`（构建时 `npm ci` 安装、esbuild 才能解析并内联进函数 bundle；与 jose/@neondatabase 同模式）；
- 执行 `npm install` 更新 `package-lock.json`。

### 5.3 前端改动

- `src/services/contracts.ts`：新增

```ts
// 公开只读快照（边缘函数 /api/frontend-data 返回的聚合数据）
export interface FrontendData {
  config: Record<string, string>
  categories: Category[]
  links: Link[]
  search_engines: SearchEngine[]
}
export interface IFrontendDataService {
  getAll(): Promise<FrontendData>
}
// Services 接口增加: frontendData: IFrontendDataService
```

- `src/services/neon/index.ts`：实现 `frontendData.getAll()`——先请求 `/frontend-data`（`apiFetch`），失败则降级直连 nav_read 组装同结构（保留现有 `readSql` 四段查询，正常路径不触发）：

```ts
frontendData: {
  async getAll() {
    try {
      return await apiFetch<FrontendData>('/frontend-data')
    } catch (error) {
      console.error('frontend-data 快照不可用，降级直连 Neon:', error)
      const [configRows, categories, links, engines] = await Promise.all([
        readSql`SELECT key, value FROM config`,
        readSql`SELECT * FROM categories WHERE is_visible = true ORDER BY sort_order`,
        readSql`SELECT * FROM links WHERE is_visible = true ORDER BY sort_order`,
        readSql`SELECT * FROM search_engines WHERE is_active = true ORDER BY sort_order`,
      ])
      const config: Record<string, string> = {}
      for (const row of configRows as unknown as { key: string; value: string | null }[]) config[row.key] = row.value || ''
      return {
        config,
        categories: categories as unknown as Category[],
        links: links as unknown as Link[],
        search_engines: engines as unknown as SearchEngine[],
      }
    }
  },
}
```

- `src/services/rest/index.ts`：实现 `frontendData.getAll()`——按现有语义组合（`/config`、`/categories`、`/search-engines`、按分组 `links.getByCategory`），保持 rest 模式可用（参考后端，不新增服务端路由）。
- `src/stores/home.ts`：`fetchData` 改为单次 `services.frontendData.getAll()`：

```ts
async function fetchData() {
  loading.value = true
  try {
    const data = await services.frontendData.getAll()
    siteConfig.value = data.config
    if (data.config['home-title']) homeTitle.value = data.config['home-title'].replace(/<[^>]*>/g, '')
    if (data.search_engines.length > 0) {
      searchEngines.value = data.search_engines
      currentEngine.value = data.search_engines[0]
    }
    const result: CategoryWithLinks[] = []
    for (const cat of data.categories) {
      const links = data.links.filter((l) => l.category_id === cat.id)
      if (links.length > 0) result.push({ ...cat, links })
    }
    categoriesWithLinks.value = result
  } catch {
    // 加载失败
  } finally {
    loading.value = false
  }
}
```

- 前台三个视图改走快照（各 1 处，语义等价，含 fallback 到默认值逻辑不变）：
  - `src/views/frontend/FrontendLayout.vue`：`const data = await services.frontendData.getAll()` 后取 `data.config` 的 logo/copyright/icp/background/theme；
  - `src/views/frontend/AboutView.vue`：`content.value = (await services.frontendData.getAll()).config['about_content'] || ''`；
  - `src/views/frontend/ApplyView.vue`：`const data = await services.frontendData.getAll()` 一次取 `config` 与 `categories`（原两次请求合一）。

### 5.4 文档与环境变量

- `.env.example`：在「Makers 项目环境变量（仅函数读取）」区追加：

```env
# 只读快照缓存（边缘函数读取；Makers 控制台配置，不进前端 bundle）
# SNAPSHOT_STORE_NAME=nav-snapshot        # Blob 命名空间，首次调用自动创建
# SNAPSHOT_TTL_SECONDS=600                # 快照新鲜期（秒），期内零回源
# SNAPSHOT_SWR_SECONDS=300                # stale-while-revalidate 窗口（秒）
# SNAPSHOT_BROWSER_MAX_AGE=60             # 浏览器 Cache-Control max-age（秒）
# SNAPSHOT_READ_CONSISTENCY=eventual      # Blob 读一致性：eventual|strong
# SNAPSHOT_ALERT_WEBHOOK=                 # 可选：重建失败/降级错误上报 URL
```

- `README.md`：API 表增加 `GET /api/frontend-data` 行（公开只读快照端点，含 ETag/304）；「Makers 项目环境变量」表增加上述 6 项；数据层一句话更新（前台公开读经边缘快照，命中零回源）。

---

## 六、环境变量汇总

| 变量 | 默认 | 说明 |
|---|---|---|
| `SNAPSHOT_STORE_NAME` | `nav-snapshot` | Blob 命名空间名（首次 `getStore` 自动创建） |
| `SNAPSHOT_TTL_SECONDS` | `600` | 快照新鲜期，期内零回源 |
| `SNAPSHOT_SWR_SECONDS` | `300` | 过期容忍窗：窗内返回旧快照 + 后台异步刷新 |
| `SNAPSHOT_BROWSER_MAX_AGE` | `60` | 浏览器缓存秒数（之后带 ETag 重验证） |
| `SNAPSHOT_READ_CONSISTENCY` | `eventual` | `eventual`（最快）/ `strong`（写后立即可读，延迟略增） |
| `SNAPSHOT_ALERT_WEBHOOK` | 空 | 可选：错误上报 URL（重建失败/降级时 POST JSON） |

---

## 七、假设与决策

1. **快照范围 = 公开只读数据**（config 去 `admin_pwd` / visible categories / visible links / active search_engines）；管理端读（含隐藏行、stats、apply）保持实时、不缓存——避免破坏后台语义。
2. **Blob 默认最终一致（≈秒级~60s）**：后台写重建后，边缘存在短暂传播窗口，导航站可接受；需要强一致时配置 `SNAPSHOT_READ_CONSISTENCY=strong`。
3. **并发去重范围为同一边缘隔离实例**（模块级 Promise 共享）；跨节点不做分布式锁，靠 TTL+SWR 收敛，偶发重复重建成本低（4 条并行查询）。
4. **ETag 直接复用 `version`**（重建毫秒时间戳），简单单调、天然随写更新；不引入内容哈希。
5. **`getRuntime` 拆分**为 `getSql`/`getSecret`：公开读端点不依赖 `JWT_SECRET`，行为向后兼容（`getRuntime` 仍同时要求两者）。
6. **写触发收口在 `handleRequest`**：任意非 GET/HEAD/OPTIONS、非 login、非匿名 apply 提交的 2xx 响应后 `waitUntil` 重建——一处实现覆盖所有写路由，避免在各分支重复埋点。
7. **前端保留直连兜底**：`frontendData.getAll()` 失败时降级 nav_read 组装，保证边缘故障时首页仍可用。
8. **平台缓存规则**：`/api/frontend-data` 建议在 EdgeOne 站点缓存规则中配置「不缓存」，使过期/写后刷新由函数层独占控制（`s-maxage=0` 亦兜底）。
9. 生产 `VITE_NEON_DATABASE_URL`（nav_read）仍保留：供 apply 提交、click_stats、死链检测与快照降级兜底使用，不删除。

---

## 八、验证步骤

1. **构建**：`npm install` 后 `npm run build`（vue-tsc + vite + esbuild 内联 `@edgeone/pages-blob` 到函数 bundle）必须通过；若 esbuild `--platform=browser` 打包 pages-blob 报错，将该步改为 `--platform=node`。
2. **本地联调**：`edgeone makers dev`（环境变量：`DATABASE_URL_ADMIN`、`JWT_SECRET`，快照变量可不配用默认）：
   - `curl localhost:8088/api/frontend-data` → 首次返回 `X-Snapshot-Status: REBUILT` 且 `data` 四段齐全（config 无 `admin_pwd`）；
   - 立即再次请求 → `X-Snapshot-Status: FRESH`（零回源）；
   - `curl -H 'If-None-Match: "<version>"'` → `304`；
   - 登录后台 `PUT /api/links/:id` 修改标题 → 等待后 `GET /api/frontend-data` 可见新值（最终一致窗口内可能旧值，属预期）；
   - 把 `SNAPSHOT_TTL_SECONDS=0` 临时验证 SWR 分支：age≥0 → `STALE` + 后台刷新。
3. **降级验证**：临时改错 `DATABASE_URL_ADMIN` → 有旧快照时返回 `STALE_DEGRADED`（200）；清空快照（`store.delete` 或换 store 名）→ `503`。
4. **日志对账**：EdgeOne 控制台函数日志出现 `snapshot_rebuilt` / `snapshot_serve` 且命中率（FRESH 占比）随流量上升。
5. **前端回归**：首页/关于/申请收录正常渲染；管理端增删改查正常且数据实时（不受缓存影响）。

---

## 九、部署注意事项

- Makers 控制台新增函数环境变量：`SNAPSHOT_*`（6 项，见上表）；`@edgeone/pages-blob` 随函数 bundle 内联，无需额外配置；
- 首次访问 `/api/frontend-data` 时平台自动创建 `nav-snapshot` 命名空间（控制台 Blob 页可查看/浏览快照对象，只读）；
- 站点平台缓存规则对 `/api/frontend-data` 建议「不缓存」，避免 CDN 层固化旧 JSON；
- 若历史上前台直连量较大，可观察到 Neon 查询量显著下降（首页 N+2 查询 → 0 回源命中）。
