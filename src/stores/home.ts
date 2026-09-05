import { defineStore } from 'pinia'
import { ref } from 'vue'
import { services } from '@/services'
import type { Category, Link, SearchEngine } from '@/services/contracts'

export interface CategoryWithLinks extends Category {
  links: Link[]
}

export const useHomeStore = defineStore('home', () => {
  const loading = ref(true)
  const homeTitle = ref('上网，从这里开始！')
  const siteConfig = ref<Record<string, string>>({})

  const searchEngines = ref<SearchEngine[]>([
    {
      id: 'default',
      name: '百度',
      url_template: 'https://www.baidu.com/s?wd={keyword}',
      icon: null,
      sort_order: 1,
      is_active: true,
    } as SearchEngine,
  ])
  const currentEngine = ref<SearchEngine>(searchEngines.value[0])

  const categoriesWithLinks = ref<CategoryWithLinks[]>([])

  async function fetchData() {
    loading.value = true
    try {
      // 公开只读数据一次拉取（边缘函数快照，命中零回源 Neon）
      const data = await services.frontendData.getAll()
      siteConfig.value = data.config
      if (data.config['home-title']) {
        homeTitle.value = data.config['home-title'].replace(/<[^>]*>/g, '')
      }
      // 加载搜索引擎
      if (data.search_engines.length > 0) {
        searchEngines.value = data.search_engines
        currentEngine.value = data.search_engines[0]
      }

      // 按分组聚合链接
      const result: CategoryWithLinks[] = []
      for (const cat of data.categories) {
        const links = data.links.filter((l) => l.category_id === cat.id)
        if (links.length > 0) {
          result.push({ ...cat, links })
        }
      }
      categoriesWithLinks.value = result
    } catch {
      // 加载失败
    } finally {
      loading.value = false
    }
  }

  function setCurrentEngine(engine: SearchEngine) {
    currentEngine.value = engine
  }

  function doSearch(keyword: string) {
    if (!keyword.trim()) return
    const url = currentEngine.value.url_template.replace(
      '{keyword}',
      encodeURIComponent(keyword.trim())
    )
    window.open(url, '_blank')
  }

  async function recordClick(link: Link) {
    services.stats.recordClick(link.id).catch(() => {})
  }

  return {
    loading,
    homeTitle,
    siteConfig,
    searchEngines,
    currentEngine,
    categoriesWithLinks,
    fetchData,
    setCurrentEngine,
    doSearch,
    recordClick,
  }
})