import type { Services, Link, Category, Apply, SearchEngine, StatsOverview } from '../contracts'

const API_BASE = import.meta.env.VITE_API_BASE_URL as string

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const token = localStorage.getItem('auth_token')
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`
  const res = await fetch(url, {
    ...options,
    headers: { ...getHeaders(), ...options.headers },
  })
  if (res.status === 401) {
    localStorage.removeItem('auth_token')
    window.location.hash = '#/admin/login'
    throw new Error('Unauthorized')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `HTTP ${res.status}`)
  }
  return res.json()
}

export function createServices(): Services {
  return {
    links: {
      async getAll() {
        return request<Link[]>('/links')
      },

      async getByCategory(categoryId) {
        return request<Link[]>(`/links?category_id=${categoryId}`)
      },

      async getById(id) {
        const data = await request<Link[]>(`/links?id=${id}`)
        return data.length > 0 ? data[0] : null
      },

      async create(data) {
        return request<Link>('/links', {
          method: 'POST',
          body: JSON.stringify(data),
        })
      },

      async update(id, data) {
        return request<Link>(`/links/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        })
      },

      async remove(id) {
        await request<void>(`/links/${id}`, { method: 'DELETE' })
      },

      async reorder(items) {
        await request<void>('/links/reorder', {
          method: 'POST',
          body: JSON.stringify({ items }),
        })
      },

      async checkDeadLinks() {
        return request<{ id: number | string; status: number }[]>('/links/check-dead')
      },
    },

    categories: {
      async getAll() {
        return request<Category[]>('/categories')
      },

      async getById(id) {
        return request<Category>(`/categories/${id}`)
      },

      async create(data) {
        return request<Category>('/categories', {
          method: 'POST',
          body: JSON.stringify(data),
        })
      },

      async update(id, data) {
        return request<Category>(`/categories/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        })
      },

      async remove(id) {
        await request<void>(`/categories/${id}`, { method: 'DELETE' })
      },

      async reorder(items) {
        await request<void>('/categories/reorder', {
          method: 'POST',
          body: JSON.stringify({ items }),
        })
      },
    },

    config: {
      async getAll() {
        return request<Record<string, string>>('/config')
      },

      async get(key) {
        const data = await request<{ value: string }>(`/config/${key}`)
        return data?.value || null
      },

      async set(key, value) {
        await request<void>(`/config/${key}`, {
          method: 'PUT',
          body: JSON.stringify({ value }),
        })
      },
    },

    apply: {
      async getAll() {
        return request<Apply[]>('/apply')
      },

      async getByStatus(status) {
        return request<Apply[]>(`/apply?status=${status}`)
      },

      async create(data) {
        return request<Apply>('/apply', {
          method: 'POST',
          body: JSON.stringify(data),
        })
      },

      async approve(id) {
        await request<void>(`/apply/${id}/approve`, { method: 'POST' })
      },

      async reject(id) {
        await request<void>(`/apply/${id}/reject`, { method: 'POST' })
      },
    },

    auth: {
      async login(username, password) {
        const data = await request<{ token: string }>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username, password }),
        })
        localStorage.setItem('auth_token', data.token)
        return data.token
      },

      logout() {
        localStorage.removeItem('auth_token')
      },

      getToken() {
        return localStorage.getItem('auth_token')
      },

      isAuthenticated() {
        return !!localStorage.getItem('auth_token')
      },
    },

    searchEngines: {
      async getAll() {
        return request<SearchEngine[]>('/search-engines')
      },

      async create(data) {
        return request<SearchEngine>('/search-engines', {
          method: 'POST',
          body: JSON.stringify(data),
        })
      },

      async update(id, data) {
        return request<SearchEngine>(`/search-engines/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        })
      },

      async remove(id) {
        await request<void>(`/search-engines/${id}`, { method: 'DELETE' })
      },
    },

    stats: {
      async getOverview() {
        return request<StatsOverview>('/stats/overview')
      },

      async getTopLinks(limit = 20) {
        return request<{ link_id: number | string; title: string; count: number }[]>(`/stats/top-links?limit=${limit}`)
      },

      async getTrend(days = 7) {
        return request<{ date: string; count: number }[]>(`/stats/trend?days=${days}`)
      },

      async recordClick(linkId) {
        await request<void>('/stats/click', {
          method: 'POST',
          body: JSON.stringify({ link_id: linkId }),
        })
      },
    },

    frontendData: {
      // 组合现有 REST 接口，保持与原调用模式一致（参考后端，无边缘快照缓存）
      async getAll() {
        const [config, categories, search_engines] = await Promise.all([
          request<Record<string, string>>('/config'),
          request<Category[]>('/categories'),
          request<SearchEngine[]>('/search-engines'),
        ])
        const links: Link[] = []
        for (const cat of categories) {
          const catLinks = await request<Link[]>(`/links?category_id=${cat.id}`)
          links.push(...catLinks)
        }
        return { config, categories, links, search_engines }
      },
    },
  }
}