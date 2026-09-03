<template>
  <div class="glass-page min-h-screen flex flex-col relative">
    <!-- 全局玻璃氛围背景（渐变兜底 / 背景图） -->
    <BackgroundImage :bg-url="bgUrl" />

    <!-- 左上角导航胶囊（滚动时整个区域向上淡出） -->
    <header
      class="fixed top-4 left-4 z-40 glass rounded-full transition-all duration-500"
      :class="navHidden && 'nav-hidden'"
    >
      <div class="flex items-center gap-1 px-2 py-1.5">
        <router-link to="/" class="pill-link flex items-center gap-2 px-2 py-1">
          <img v-if="siteLogo" :src="siteLogo" alt="Logo" class="h-7 w-7 rounded-full object-contain" />
          <span class="text-base font-bold glass-text leading-none">{{ siteTitle || '上网导航' }}</span>
        </router-link>
        <nav class="flex items-center gap-0.5 sm:gap-1">
          <router-link
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            class="btn-glass pill-link glass-link px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm"
          >
            {{ item.label }}
          </router-link>
        </nav>
      </div>
    </header>

    <!-- 主内容 -->
    <main class="flex-1 relative z-10">
      <slot />
    </main>

    <!-- 底部 -->
    <footer class="glass-strip py-5 mt-auto relative z-10">
      <div class="max-w-7xl mx-auto px-4 text-center text-sm glass-text-faint">
        <p v-if="copyright" v-html="copyright"></p>
        <p v-if="icp" class="mt-1">
          <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener" class="glass-link">{{ icp }}</a>
        </p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { services } from '@/services'
import { useThemeStore } from '@/stores/theme'
import { useScroll } from '@/composables/useScroll'
import BackgroundImage from '@/components/frontend/BackgroundImage.vue'

const siteTitle = ref('')
const siteLogo = ref('')
const copyright = ref('')
const icp = ref('')
const bgUrl = ref('')

const themeStore = useThemeStore()
const { scrollY } = useScroll()

const navItems = [
  { path: '/', label: '首页' },
  { path: '/about', label: '关于' },
  { path: '/apply', label: '申请收录' },
]

// 由共享滚动源派生，无需自行挂载 scroll 监听
const navHidden = computed(() => scrollY.value > 64)

onMounted(async () => {
  try {
    const config = await services.config.getAll()
    siteTitle.value = config.title || ''
    siteLogo.value = config.logo || ''
    copyright.value = config.copyright || ''
    icp.value = config.icp || ''
    bgUrl.value = config.background || ''
    themeStore.syncFromConfig(config.theme)
  } catch {
    // 配置加载失败时使用默认值
  }
})
</script>

<style scoped>
.nav-hidden {
  transform: translateY(-150%);
  opacity: 0;
  pointer-events: none;
}

.pill-link {
  border-radius: 9999px;
  transition: background 0.2s ease;
}
</style>