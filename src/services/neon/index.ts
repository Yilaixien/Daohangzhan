import { neon } from '@neondatabase/serverless'
import type { Services, Link, Category, Apply, SearchEngine, StatsOverview, FrontendData } from '../contracts'

// ============================================================
// Neon（PostgreSQL）服务实现 —— 公开快照读（边缘函数）+ 直连兜底 + EdgeOne Makers 函数代理后台
//
// 数据源分工：
//  - 公开只读（首页/关于/申请收录/前台布局）：统一走 Makers 边缘函数 GET /api/frontend-data
//    —— 函数优先返回 Blob 快照（命中零回源 Neon），未命中/过期才回源重建；本实现仅在
//    边缘端点不可用时降级直连 nav_read 组装同结构数据（正常路径不触发）。
//  - 点击统计：POST /api/stats/click（边缘函数内存缓冲 + 批量/延迟写入 click_stats），
//    不再由浏览器直连 Neon。
//  - 公开写：收录申请提交仍由浏览器直连 nav_read（RLS 仅允许 INSERT）。
//  - 后台读写：一律走 Makers 项目内 Edge Functions（edge-functions/api/**，
//    函数内以 nav_admin 执行，后台读含隐藏/停用行 —— 与该实现的直连 SQL
//    语义不同，勿互相复用）。函数随 Makers 单项目部署，同域路由，默认 /api。
//  - JWT 定位：自签 JWT 仅是"会话状态标记"（localStorage 路由守卫 + 函数 API 的
//    Bearer 头）；Postgres/RLS 不校验它。密钥只存在于 Makers 项目环境变量。
// ============================================================

const neonDbUrl = import.meta.env.VITE_NEON_DATABASE_URL as string | undefined
// Makers 同域部署：函数路由即 <站点>/api/**，默认相对路径 /api（无跨域）；可用 VITE_API_BASE_URL 覆盖
const apiBase = (import.meta.env.VITE_API_BASE_URL as string) || '/api'

if (!neonDbUrl) {
  throw new Error('缺少环境变量 VITE_NEON_DATABASE_URL（浏览器直连 Neon 的 nav_read 连接串）')
}

// 公开数据源（nav_read）
const readSql = neon(neonDbUrl)

// ---------- 函数 API 客户端 ----------
function getToken(): string | null {
  return localStorage.getItem('auth_token')
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const fullInit: RequestInit = { ...options, headers: { ...headers, ...options.headers } }

  // EdgeOne 边缘函数偶发执行异常（如 545：bcrypt 等重 CPU 操作触达单次执行限制），
  // 指数退避自动重试；业务性 4xx（401/校验失败）不重试
  const MAX_ATTEMPTS = 3
  let lastErr: Error | null = null
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** (attempt - 2)))
    try {
      return await doApiFetch<T>(path, fullInit)
    } catch (error) {
      lastErr = error as Error
      if (!(error as Error & { retryable?: boolean }).retryable) throw error
    }
  }
  throw lastErr ?? new Error('请求失败，请重试')
}

async function doApiFetch<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase}${path}`, init).catch(() => {
    throw Object.assign(new Error('网络请求失败（边缘节点波动），已自动重试'), { retryable: true })
  })

  // 401：登录接口抛出函数侧原因（如"用户名或密码错误"）；其余接口视为会话失效，清除令牌并回登录页
  if (res.status === 401) {
    if (!/\/auth\/login$/.test(path)) {
      localStorage.removeItem('auth_token')
      window.location.hash = '#/admin/login'
      throw new Error('认证已失效，请重新登录')
    }
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.message || '用户名或密码错误')
  }

  // 响应必须是 JSON；否则说明请求根本没打到函数（例如被静态资源/SPA 兜底成 HTML）
  let body: any
  try {
    body = await res.json()
  } catch {
    // 5xx 非 JSON：EdgeOne 函数执行异常（如 545），可重试
    if (res.status >= 500) {
      throw Object.assign(new Error(`Edge 函数瞬时异常（HTTP ${res.status}），已自动重试`), { retryable: true })
    }
    throw new Error(
      `接口返回异常：HTTP ${res.status}，响应非 JSON（content-type: ${res.headers.get('content-type') || '未知'}）。` +
        '请确认 Edge Functions 已随 Makers 项目部署、/api 路由已生效（响应为 HTML 首页即函数未生效）',
    )
  }
  if (!res.ok) {
    // 5xx（含 EdgeOne 545 等函数偶发失败）可重试
    if (res.status >= 500) {
      throw Object.assign(new Error(body?.message || `HTTP ${res.status}`), { retryable: true })
    }
    throw new Error(body?.message || `HTTP ${res.status}`)
  }
  if (!body || typeof body !== 'object' || !('data' in body)) {
    throw new Error('接口返回缺少 data 字段：函数可能未部署或 /api 路由未生效')
  }
  return body.data as T
}

// ---------- 死链检测参数与工具（浏览器侧检测，仅需公开链接列表） ----------
const DETECT_TIMEOUT = 5000 // 单链接超时（毫秒）
const DETECT_CONCURRENCY = 5 // 同时检测的链接数

// no-cors 下无法读取真实 HTTP 状态码，以「请求是否成功建立」判定可达性：可达记 200，失败（超时/网络错误）记 0
async function detectUrlReachable(url: string, timeoutMs: number): Promise<number> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      mode: 'no-cors',
      cache: 'no-store',
    })
    return 200
  } catch {
    return 0
  } finally {
    clearTimeout(timer)
  }
}

// 并发执行器：按 limit 分片，控制同时在途的 worker 数量
async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<{ id: number | string; status: number }>) {
  const results: { id: number | string; status: number }[] = []
  let index = 0
  async function runner() {
    while (index < items.length) {
      const current = index++
      results[current] = await worker(items[current])
    }
  }
  const runners = []
  for (let i = 0; i < Math.min(limit, items.length); i++) {
    runners.push(runner())
  }
  await Promise.all(runners)
  return results
}

export function createServices(): Services {
  return {
    links: {
      // 公开读（nav_read，仅可见行；RLS 亦强制此过滤）
      async getAll() {
        const rows = await readSql`SELECT * FROM links WHERE is_visible = true ORDER BY sort_order`
        return rows as unknown as Link[]
      },

      async getByCategory(categoryId) {
        const rows = await readSql`SELECT * FROM links WHERE category_id = ${categoryId} AND is_visible = true ORDER BY sort_order`
        return rows as unknown as Link[]
      },

      async getById(id) {
        const rows = await readSql`SELECT * FROM links WHERE id = ${id} LIMIT 1`
        return (rows[0] as unknown as Link) || null
      },

      // 后台写（走函数代理，nav_admin）
      async create(data) {
        return apiFetch<Link>('/links', {
          method: 'POST',
          body: JSON.stringify(data),
        })
      },

      async update(id, data) {
        return apiFetch<Link>(`/links/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        })
      },

      async remove(id) {
        await apiFetch<void>(`/links/${id}`, { method: 'DELETE' })
      },

      async reorder(items) {
        await apiFetch<void>('/links/reorder', {
          method: 'POST',
          body: JSON.stringify({ items }),
        })
      },

      async checkDeadLinks() {
        const rows = await readSql`SELECT id, url FROM links WHERE is_visible = true`
        return runWithConcurrency(rows as unknown as { id: string; url: string }[], DETECT_CONCURRENCY, async (link) => ({
          id: link.id,
          status: await detectUrlReachable(link.url, DETECT_TIMEOUT),
        }))
      },
    },

    categories: {
      async getAll() {
        const rows = await readSql`SELECT * FROM categories WHERE is_visible = true ORDER BY sort_order`
        return rows as unknown as Category[]
      },

      async getById(id) {
        const rows = await readSql`SELECT * FROM categories WHERE id = ${id} LIMIT 1`
        return (rows[0] as unknown as Category) || null
      },

      async create(data) {
        return apiFetch<Category>('/categories', {
          method: 'POST',
          body: JSON.stringify(data),
        })
      },

      async update(id, data) {
        return apiFetch<Category>(`/categories/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        })
      },

      async remove(id) {
        await apiFetch<void>(`/categories/${id}`, { method: 'DELETE' })
      },

      async reorder(items) {
        await apiFetch<void>('/categories/reorder', {
          method: 'POST',
          body: JSON.stringify({ items }),
        })
      },
    },

    config: {
      async getAll() {
        const rows = await readSql`SELECT key, value FROM config`
        const result: Record<string, string> = {}
        for (const row of rows as unknown as { key: string; value: string | null }[]) {
          result[row.key] = row.value || ''
        }
        return result
      },

      async get(key) {
        const rows = await readSql`SELECT value FROM config WHERE key = ${key} LIMIT 1`
        const row = rows[0] as unknown as { value: string | null } | undefined
        return row?.value || null
      },

      async set(key, value) {
        await apiFetch<void>(`/config/${encodeURIComponent(key)}`, {
          method: 'PUT',
          body: JSON.stringify({ value }),
        })
      },
    },

    apply: {
      async getAll() {
        return apiFetch<Apply[]>('/apply')
      },

      async getByStatus(status) {
        return apiFetch<Apply[]>(`/apply?status=${encodeURIComponent(status)}`)
      },

      async create(data) {
        // 公开提交（nav_read，匿名可插入）
        const rows = await readSql`
          INSERT INTO apply (name, url, category_id, icon, description)
          VALUES (${data.name}, ${data.url}, ${data.category_id}, ${data.icon ?? null}, ${data.description ?? null})
          RETURNING *
        `
        return rows[0] as unknown as Apply
      },

      async approve(id) {
        await apiFetch<void>(`/apply/${id}/approve`, { method: 'POST' })
      },

      async reject(id) {
        await apiFetch<void>(`/apply/${id}/reject`, { method: 'POST' })
      },
    },

    auth: {
      // 自建极简 JWT：登录由函数校验 config.admin_user/admin_pwd(bcrypt) 后签发
      async login(username, password) {
        const { token } = await apiFetch<{ token: string }>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username, password }),
        })
        localStorage.setItem('auth_token', token)
        return token
      },

      logout() {
        localStorage.removeItem('auth_token')
      },

      getToken() {
        return getToken()
      },

      isAuthenticated() {
        return !!getToken()
      },
    },

    searchEngines: {
      async getAll() {
        const rows = await readSql`SELECT * FROM search_engines WHERE is_active = true ORDER BY sort_order`
        return rows as unknown as SearchEngine[]
      },

      async create(data) {
        return apiFetch<SearchEngine>('/search-engines', {
          method: 'POST',
          body: JSON.stringify(data),
        })
      },

      async update(id, data) {
        return apiFetch<SearchEngine>(`/search-engines/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        })
      },

      async remove(id) {
        await apiFetch<void>(`/search-engines/${id}`, { method: 'DELETE' })
      },
    },

    stats: {
      async getOverview() {
        return apiFetch<StatsOverview>('/stats/overview')
      },

      async getTopLinks(limit = 20) {
        return apiFetch<{ link_id: number | string; title: string; count: number }[]>(`/stats/top-links?limit=${limit}`)
      },

      async getTrend(days = 7) {
        return apiFetch<{ date: string; count: number }[]>(`/stats/trend?days=${days}`)
      },

      async recordClick(linkId) {
        // 边缘函数缓冲批量写入（避免每次点击直连 Neon）；失败仅告警，不影响跳转
        try {
          await apiFetch<void>('/stats/click', {
            method: 'POST',
            body: JSON.stringify({ link_id: linkId, user_agent: navigator.userAgent.substring(0, 500) }),
          })
        } catch (error) {
          console.error('Failed to record click:', error)
        }
      },
    },

    frontendData: {
      // 公开只读快照：优先边缘函数（命中 Blob 快照零回源）；失败降级直连 nav_read 组装同结构
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
          for (const row of configRows as unknown as { key: string; value: string | null }[]) {
            config[row.key] = row.value || ''
          }
          return {
            config,
            categories: categories as unknown as Category[],
            links: links as unknown as Link[],
            search_engines: engines as unknown as SearchEngine[],
          }
        }
      },
    },
  }
}