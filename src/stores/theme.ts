import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ThemeName = 'light' | 'dark'

const STORAGE_KEY = 'site_theme'

/**
 * 前台主题：默认毛玻璃浅色，由后台「站点配置」切换并整体生效
 */
export const useThemeStore = defineStore('theme', () => {
  const theme = ref<ThemeName>('light')

  function apply(next: ThemeName) {
    theme.value = next
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // 忽略存储异常
    }
  }

  /** 从后台配置同步主题，非法/缺省值不覆盖当前状态 */
  function syncFromConfig(value: string | undefined | null) {
    if (value === 'light' || value === 'dark') {
      if (value !== theme.value) apply(value)
    }
  }

  /** 挂载前同步应用缓存主题，避免闪白 */
  function init() {
    const cached = localStorage.getItem(STORAGE_KEY)
    apply(cached === 'dark' ? 'dark' : 'light')
  }

  return { theme, apply, syncFromConfig, init }
})