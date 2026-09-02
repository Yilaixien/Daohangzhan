import { neon } from '@neondatabase/serverless'
import type { Services, Link, Category, Apply, SearchEngine, StatsOverview } from '../contracts'

// ============================================================
// Neon（PostgreSQL）服务实现 —— 前端直连公开读 + EdgeOne Makers 函数代理后台
//
// 数据源分工：
//  - 公开读写：浏览器直连 Neon HTTP /sql（角色 nav_read，RLS 强制行级过滤，
//    等价 Supabase anon key）。见 database/neon_schema.sql 的 rd_* 策略。
//  - 后台读写：一律走 Makers 项目内 Edge Functions（edge-functions/api/**，
//    函数内以 nav_admin 执行，后台读含隐藏/停用行 —— 与该实现的前台直连 SQL
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
  const res = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  })
  if (res.status === 401) {
    localStorage.removeItem('auth_token')
    window.location.hash = '#/admin/login'
    throw new Error('Unauthorized')
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body.message || `HTTP ${res.status}`)
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
        // 公开写（nav_read；失败仅告警，不影响跳转）
        try {
          await readSql`INSERT INTO click_stats (link_id, user_agent) VALUES (${linkId}, ${navigator.userAgent.substring(0, 500)})`
        } catch (error) {
          console.error('Failed to record click:', error)
        }
      },
    },
  }
}