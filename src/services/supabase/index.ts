import { createClient } from '@supabase/supabase-js'
import type { Services, Link, Category, Apply, SearchEngine, StatsOverview } from '../contracts'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

const supabase = createClient(supabaseUrl, supabaseAnonKey)

function getHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token')
  if (token) {
    return { Authorization: `Bearer ${token}` }
  }
  return {}
}

export function createServices(): Services {
  return {
    links: {
      async getAll() {
        const { data, error } = await supabase
          .from('links')
          .select('*')
          .eq('is_visible', true)
          .order('sort_order')
        if (error) throw error
        return data as Link[]
      },

      async getByCategory(categoryId) {
        const { data, error } = await supabase
          .from('links')
          .select('*')
          .eq('category_id', categoryId)
          .eq('is_visible', true)
          .order('sort_order')
        if (error) throw error
        return data as Link[]
      },

      async getById(id) {
        const { data, error } = await supabase
          .from('links')
          .select('*')
          .eq('id', id)
          .single()
        if (error) return null
        return data as Link
      },

      async create(data) {
        // 自动计算 sort_order
        if (!data.sort_order) {
          const { data: existing } = await supabase
            .from('links')
            .select('sort_order')
            .eq('category_id', data.category_id)
            .order('sort_order', { ascending: false })
            .limit(1)
          const maxOrder = existing && existing.length > 0 ? existing[0].sort_order : 0
          data.sort_order = maxOrder + 10
        }
        const { data: created, error } = await supabase
          .from('links')
          .insert([{ ...data, is_visible: true }])
          .select()
          .single()
        if (error) throw error
        return created as Link
      },

      async update(id, data) {
        const { data: updated, error } = await supabase
          .from('links')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        return updated as Link
      },

      async remove(id) {
        const { error } = await supabase
          .from('links')
          .update({ is_visible: false })
          .eq('id', id)
        if (error) throw error
      },

      async reorder(items) {
        for (const item of items) {
          const { error } = await supabase
            .from('links')
            .update({ sort_order: item.sort_order })
            .eq('id', item.id)
          if (error) throw error
        }
      },

      async checkDeadLinks() {
        const { data: links } = await supabase
          .from('links')
          .select('id, url')
          .eq('is_visible', true)
        if (!links) return []
        const results: { id: number | string; status: number }[] = []
        for (const link of links) {
          try {
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 5000)
            const resp = await fetch(link.url, {
              method: 'HEAD',
              signal: controller.signal,
              mode: 'no-cors',
            })
            clearTimeout(timeout)
            results.push({ id: link.id, status: resp.status })
          } catch {
            results.push({ id: link.id, status: 0 })
          }
        }
        return results
      },
    },

    categories: {
      async getAll() {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .eq('is_visible', true)
          .order('sort_order')
        if (error) throw error
        return data as Category[]
      },

      async getById(id) {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .eq('id', id)
          .single()
        if (error) return null
        return data as Category
      },

      async create(data) {
        if (!data.sort_order) {
          const { data: existing } = await supabase
            .from('categories')
            .select('sort_order')
            .order('sort_order', { ascending: false })
            .limit(1)
          const maxOrder = existing && existing.length > 0 ? existing[0].sort_order : 0
          data.sort_order = maxOrder + 10
        }
        const { data: created, error } = await supabase
          .from('categories')
          .insert([{ ...data, is_visible: true }])
          .select()
          .single()
        if (error) throw error
        return created as Category
      },

      async update(id, data) {
        const { data: updated, error } = await supabase
          .from('categories')
          .update(data)
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        return updated as Category
      },

      async remove(id) {
        const { error } = await supabase
          .from('categories')
          .update({ is_visible: false })
          .eq('id', id)
        if (error) throw error
      },

      async reorder(items) {
        for (const item of items) {
          const { error } = await supabase
            .from('categories')
            .update({ sort_order: item.sort_order })
            .eq('id', item.id)
          if (error) throw error
        }
      },
    },

    config: {
      async getAll() {
        const { data, error } = await supabase
          .from('config')
          .select('key, value')
        if (error) throw error
        const result: Record<string, string> = {}
        for (const row of data) {
          result[row.key] = row.value || ''
        }
        return result
      },

      async get(key) {
        const { data, error } = await supabase
          .from('config')
          .select('value')
          .eq('key', key)
          .single()
        if (error) return null
        return data?.value || null
      },

      async set(key, value) {
        const { data: existing } = await supabase
          .from('config')
          .select('key')
          .eq('key', key)
          .single()
        if (existing) {
          const { error } = await supabase
            .from('config')
            .update({ value })
            .eq('key', key)
          if (error) throw error
        } else {
          const { error } = await supabase
            .from('config')
            .insert([{ key, value }])
          if (error) throw error
        }
      },
    },

    apply: {
      async getAll() {
        const { data, error } = await supabase
          .from('apply')
          .select('*')
          .order('created_at', { ascending: false })
        if (error) throw error
        return data as Apply[]
      },

      async getByStatus(status) {
        const { data, error } = await supabase
          .from('apply')
          .select('*')
          .eq('status', status)
          .order('created_at', { ascending: false })
        if (error) throw error
        return data as Apply[]
      },

      async create(data) {
        const { data: created, error } = await supabase
          .from('apply')
          .insert([{ ...data, status: 'pending' }])
          .select()
          .single()
        if (error) throw error
        return created as Apply
      },

      async approve(id) {
        // 获取申请信息
        const { data: apply } = await supabase
          .from('apply')
          .select('*')
          .eq('id', id)
          .single()
        if (!apply) throw new Error('申请不存在')

        // 自动创建链接
        const { data: existing } = await supabase
          .from('links')
          .select('sort_order')
          .eq('category_id', apply.category_id)
          .order('sort_order', { ascending: false })
          .limit(1)
        const maxOrder = existing && existing.length > 0 ? existing[0].sort_order : 0

        await supabase.from('links').insert([{
          title: apply.name,
          url: apply.url,
          category_id: apply.category_id,
          icon: apply.icon,
          description: apply.description,
          sort_order: maxOrder + 10,
          is_visible: true,
        }])

        // 更新申请状态
        const { error } = await supabase
          .from('apply')
          .update({ status: 'approved' })
          .eq('id', id)
        if (error) throw error
      },

      async reject(id) {
        const { error } = await supabase
          .from('apply')
          .update({ status: 'rejected' })
          .eq('id', id)
        if (error) throw error
      },
    },

    auth: {
      async login(username, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: username,
          password,
        })
        if (error) throw error
        const token = data.session?.access_token || ''
        localStorage.setItem('auth_token', token)
        return token
      },

      logout() {
        localStorage.removeItem('auth_token')
        supabase.auth.signOut()
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
        const { data, error } = await supabase
          .from('search_engines')
          .select('*')
          .eq('is_active', true)
          .order('sort_order')
        if (error) throw error
        return data as SearchEngine[]
      },

      async create(data) {
        const { data: created, error } = await supabase
          .from('search_engines')
          .insert([data])
          .select()
          .single()
        if (error) throw error
        return created as SearchEngine
      },

      async update(id, data) {
        const { data: updated, error } = await supabase
          .from('search_engines')
          .update(data)
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        return updated as SearchEngine
      },

      async remove(id) {
        const { error } = await supabase
          .from('search_engines')
          .update({ is_active: false })
          .eq('id', id)
        if (error) throw error
      },
    },

    stats: {
      async getOverview() {
        const { count: totalLinks } = await supabase
          .from('links')
          .select('*', { count: 'exact', head: true })
          .eq('is_visible', true)

        const { count: totalClicks } = await supabase
          .from('click_stats')
          .select('*', { count: 'exact', head: true })

        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const { count: todayClicks } = await supabase
          .from('click_stats')
          .select('*', { count: 'exact', head: true })
          .gte('clicked_at', today.toISOString())

        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        const { count: weekClicks } = await supabase
          .from('click_stats')
          .select('*', { count: 'exact', head: true })
          .gte('clicked_at', weekAgo.toISOString())

        return {
          total_links: totalLinks || 0,
          total_clicks: totalClicks || 0,
          today_clicks: todayClicks || 0,
          week_clicks: weekClicks || 0,
        }
      },

      async getTopLinks(limit = 20) {
        const { data, error } = await supabase
          .from('click_stats')
          .select('link_id, links!inner(title)')
          .limit(limit)

        if (error) throw error

        // 手动聚合计数
        const countMap = new Map<string, { link_id: string; title: string; count: number }>()
        for (const row of data) {
          const linkId = row.link_id
          const title = (row.links as any)?.title || '未知'
          if (countMap.has(linkId)) {
            countMap.get(linkId)!.count++
          } else {
            countMap.set(linkId, { link_id: linkId, title, count: 1 })
          }
        }

        return Array.from(countMap.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, limit)
      },

      async getTrend(days = 7) {
        const since = new Date()
        since.setDate(since.getDate() - days)
        since.setHours(0, 0, 0, 0)

        const { data, error } = await supabase
          .from('click_stats')
          .select('clicked_at')
          .gte('clicked_at', since.toISOString())

        if (error) throw error

        // 按天聚合
        const dayMap = new Map<string, number>()
        for (let i = 0; i < days; i++) {
          const d = new Date()
          d.setDate(d.getDate() - i)
          dayMap.set(d.toISOString().split('T')[0], 0)
        }

        for (const row of data) {
          const day = row.clicked_at.split('T')[0]
          if (dayMap.has(day)) {
            dayMap.set(day, (dayMap.get(day) || 0) + 1)
          }
        }

        return Array.from(dayMap.entries())
          .map(([date, count]) => ({ date, count }))
          .reverse()
      },

      async recordClick(linkId) {
        const { error } = await supabase
          .from('click_stats')
          .insert([{
            link_id: linkId,
            user_agent: navigator.userAgent.substring(0, 500),
          }])
        if (error) {
          console.error('Failed to record click:', error)
        }
      },
    },
  }
}