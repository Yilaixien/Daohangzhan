import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { services } from '@/services'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('auth_token'))
  const loading = ref(false)
  const errorMsg = ref('')

  const isAuthenticated = computed(() => {
    if (!token.value) return false
    // 检查 JWT 是否过期
    try {
      const payload = JSON.parse(atob(token.value.split('.')[1]))
      const now = Math.floor(Date.now() / 1000)
      return payload.exp > now
    } catch {
      return false
    }
  })

  async function login(username: string, password: string) {
    loading.value = true
    errorMsg.value = ''
    try {
      const newToken = await services.auth.login(username, password)
      token.value = newToken
      localStorage.setItem('auth_token', newToken)
      return newToken
    } catch (e: any) {
      errorMsg.value = e.message || '登录失败，请检查用户名和密码'
      throw e
    } finally {
      loading.value = false
    }
  }

  function logout() {
    services.auth.logout()
    token.value = null
    localStorage.removeItem('auth_token')
  }

  return {
    token,
    loading,
    errorMsg,
    isAuthenticated,
    login,
    logout,
  }
})