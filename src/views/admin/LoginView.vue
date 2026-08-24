<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 relative overflow-hidden">
    <!-- 背景装饰 -->
    <div class="absolute inset-0 opacity-10">
      <div class="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl"></div>
      <div class="absolute bottom-10 right-10 w-96 h-96 bg-white rounded-full blur-3xl"></div>
    </div>

    <!-- 已登录自动跳转 -->
    <div v-if="authStore.isAuthenticated" class="text-center text-white">
      <p class="text-lg">您已登录，正在跳转...</p>
    </div>

    <!-- 登录卡片 -->
    <div v-else class="relative z-10 bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4">
      <!-- Logo 区域 -->
      <div class="text-center mb-8">
        <div class="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 class="text-2xl font-bold text-gray-800">后台管理</h2>
        <p class="text-sm text-gray-500 mt-1">请输入管理员账号登录</p>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-5">
        <!-- 用户名 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">用户名</label>
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </span>
            <input
              v-model="username"
              type="text"
              required
              placeholder="请输入用户名"
              class="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm transition-colors"
            />
          </div>
        </div>

        <!-- 密码 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">密码</label>
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </span>
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              required
              placeholder="请输入密码"
              class="w-full pl-10 pr-12 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm transition-colors"
            />
            <button
              type="button"
              @click="showPassword = !showPassword"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg v-if="!showPassword" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            </button>
          </div>
        </div>

        <!-- 错误提示 -->
        <Transition name="fade">
          <div v-if="authStore.errorMsg" class="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-2.5 rounded-lg flex items-start gap-2">
            <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{{ authStore.errorMsg }}</span>
          </div>
        </Transition>

        <!-- 提交 -->
        <button
          type="submit"
          :disabled="authStore.loading"
          class="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
        >
          <svg v-if="authStore.loading" class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          {{ authStore.loading ? '登录中...' : '登 录' }}
        </button>
      </form>

      <div class="mt-6 text-center">
        <router-link to="/" class="text-sm text-gray-500 hover:text-blue-600 transition-colors">
          返回首页
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const showPassword = ref(false)

// 已登录直接跳转
onMounted(() => {
  if (authStore.isAuthenticated) {
    router.replace('/admin/dashboard')
  }
})

async function handleLogin() {
  try {
    await authStore.login(username.value, password.value)
    const redirect = (route.query.redirect as string) || '/admin/dashboard'
    router.replace(redirect)
  } catch {
    // 错误已在 store 中处理
  }
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>