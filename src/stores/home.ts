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
      // 加载站点配置
      const config = await services.config.getAll()
      siteConfig.value = config
      if (config['home-title']) {
        homeTitle.value = config['home-title'].replace(/<[^>]*>/g, '')
      }
      // 加载搜索引擎
      try {
        const engines = await services.searchEngines.getAll()
        if (engines.length > 0) {
          searchEngines.value = engines
          currentEngine.value = engines[0]
        }
      } catch {
        // 使用默认搜索引擎
      }

      // 加载分组和链接
      const categories = await services.categories.getAll()
      const result: CategoryWithLinks[] = []
      for (const cat of categories) {
        const links = await services.links.getByCategory(cat.id)
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