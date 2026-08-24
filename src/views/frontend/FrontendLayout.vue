<template>
  <div class="min-h-screen flex flex-col relative">
    <!-- 顶部导航 -->
    <header class="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/50 sticky top-0 z-20">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-14">
          <!-- Logo -->
          <router-link to="/" class="flex items-center space-x-2">
            <img v-if="siteLogo" :src="siteLogo" alt="Logo" class="h-8 w-8 rounded" />
            <span class="text-lg font-bold text-gray-800">{{ siteTitle || '上网导航' }}</span>
          </router-link>

          <!-- 导航链接 -->
          <nav class="flex items-center space-x-4">
            <router-link to="/" class="text-sm text-gray-600 hover:text-blue-600 transition-colors">
              首页
            </router-link>
            <router-link to="/about" class="text-sm text-gray-600 hover:text-blue-600 transition-colors">
              关于
            </router-link>
            <router-link to="/apply" class="text-sm text-gray-600 hover:text-blue-600 transition-colors">
              申请收录
            </router-link>
          </nav>
        </div>
      </div>
    </header>

    <!-- 主内容 -->
    <main class="flex-1">
      <slot />
    </main>

    <!-- 底部 -->
    <footer class="bg-white/60 backdrop-blur-sm border-t border-gray-200/50 py-4 mt-auto">
      <div class="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500">
        <p v-if="copyright" v-html="copyright"></p>
        <p v-if="icp" class="mt-1">
          <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener" class="hover:text-blue-600">{{ icp }}</a>
        </p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { services } from '@/services'

const siteTitle = ref('')
const siteLogo = ref('')
const copyright = ref('')
const icp = ref('')

onMounted(async () => {
  try {
    const config = await services.config.getAll()
    siteTitle.value = config.title || ''
    siteLogo.value = config.logo || ''
    copyright.value = config.copyright || ''
    icp.value = config.icp || ''
  } catch {
    // 配置加载失败时使用默认值
  }
})
</script>