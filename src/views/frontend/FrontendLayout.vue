<template>
  <div class="glass-page min-h-screen flex flex-col relative">
    <!-- 全局玻璃氛围背景（渐变兜底 / 背景图） -->
    <BackgroundImage :bg-url="bgUrl" />

    <!-- 主内容 -->
    <main class="flex-1 relative z-10">
      <!-- 顶部导航：页面流内普通行，贴视口左侧、随页面滚动、无玻璃背景、无隐藏动画 -->
      <div class="px-4 sm:px-6 pt-6 pb-3 flex items-center gap-4">
        <router-link v-if="siteLogo" to="/" class="flex items-center shrink-0">
          <img :src="siteLogo" alt="Logo" class="h-7 w-7 rounded-full object-contain" />
        </router-link>
        <nav class="flex items-center gap-5 sm:gap-6">
          <router-link
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            class="glass-text text-base font-bold leading-none transition-opacity hover:opacity-75"
          >
            {{ item.label }}
          </router-link>
        </nav>
      </div>
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
import { ref, onMounted } from 'vue'
import { services } from '@/services'
import { useThemeStore } from '@/stores/theme'
import BackgroundImage from '@/components/frontend/BackgroundImage.vue'

const siteLogo = ref('')
const copyright = ref('')
const icp = ref('')
const bgUrl = ref('')

const themeStore = useThemeStore()

const navItems = [
  { path: '/', label: '首页' },
  { path: '/about', label: '关于' },
  { path: '/apply', label: '申请收录' },
]

onMounted(async () => {
  try {
    // 公开只读快照（边缘函数，命中零回源 Neon）
    const data = await services.frontendData.getAll()
    const config = data.config
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