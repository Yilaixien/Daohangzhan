<template>
  <div class="min-h-screen flex bg-gray-100">
    <!-- 侧边栏 -->
    <aside class="w-56 bg-gray-900 text-white flex flex-col flex-shrink-0">
      <!-- Logo -->
      <div class="h-14 flex items-center px-5 border-b border-gray-700">
        <router-link to="/admin/dashboard" class="text-lg font-bold text-white hover:text-blue-400 transition-colors">
          后台管理
        </router-link>
      </div>

      <!-- 导航菜单 -->
      <nav class="flex-1 py-4 px-3 space-y-1">
        <router-link
          v-for="item in menuItems"
          :key="item.path"
          :to="item.path"
          class="flex items-center px-3 py-2.5 rounded-lg text-sm transition-colors"
          :class="isActive(item.path) ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'"
        >
          <span class="mr-3 text-lg">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </router-link>
      </nav>

      <!-- 底部 -->
      <div class="px-3 py-4 border-t border-gray-700">
        <router-link to="/" class="flex items-center px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors rounded-lg">
          <span class="mr-3">🏠</span>
          <span>返回前台</span>
        </router-link>
        <button
          @click="handleLogout"
          class="w-full flex items-center px-3 py-2 mt-1 text-sm text-gray-400 hover:text-red-400 transition-colors rounded-lg"
        >
          <span class="mr-3">🚪</span>
          <span>退出登录</span>
        </button>
      </div>
    </aside>

    <!-- 右侧内容区 -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- 顶栏 -->
      <header class="h-14 bg-white shadow-sm border-b border-gray-200 flex items-center justify-between px-6">
        <h1 class="text-lg font-semibold text-gray-800">{{ currentPageTitle }}</h1>
        <div class="flex items-center space-x-3">
          <span class="text-sm text-gray-500 font-datetime">
            {{ currentTime }}
          </span>
        </div>
      </header>

      <!-- 页面内容 -->
      <main class="flex-1 p-6 overflow-auto">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const menuItems = [
  { path: '/admin/dashboard', label: '仪表盘', icon: '📊' },
  { path: '/admin/links', label: '链接管理', icon: '🔗' },
  { path: '/admin/categories', label: '分组管理', icon: '📁' },
  { path: '/admin/apply', label: '收录审核', icon: '✅' },
  { path: '/admin/search-engines', label: '搜索引擎', icon: '🔍' },
  { path: '/admin/config', label: '站点配置', icon: '⚙️' },
  { path: '/admin/theme', label: '主题管理', icon: '🎨' },
]

function isActive(path: string): boolean {
  return route.path === path || route.path.startsWith(path + '/')
}

const currentPageTitle = computed(() => {
  const item = menuItems.find((m) => isActive(m.path))
  return item?.label || '后台管理'
})

const currentTime = ref('')
let timer: ReturnType<typeof setInterval> | null = null

function updateTime() {
  const now = new Date()
  currentTime.value = now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

onMounted(() => {
  updateTime()
  timer = setInterval(updateTime, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

function handleLogout() {
  authStore.logout()
  router.push('/admin/login')
}
</script>