<template>
  <div>
    <h2 class="text-xl font-semibold text-gray-800 mb-2">主题管理</h2>
    <p class="text-sm text-gray-400 mb-6">选择前台默认主题，保存后立即生效。</p>

    <div v-if="loading" class="bg-white rounded-lg shadow-sm p-6 animate-pulse">
      <div class="h-5 bg-gray-200 rounded w-32 mb-4"></div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="h-40 bg-gray-200 rounded-lg"></div>
        <div class="h-40 bg-gray-200 rounded-lg"></div>
      </div>
    </div>

    <form v-else @submit.prevent="save" class="bg-white rounded-lg shadow-sm p-6">
      <!-- 主题选项卡片 -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          v-for="item in themeOptions"
          :key="item.value"
          class="border-2 rounded-xl p-4 cursor-pointer transition-all"
          :class="theme === item.value
            ? 'border-blue-500 ring-2 ring-blue-200'
            : 'border-gray-200 hover:border-gray-300'"
          @click="theme = item.value"
        >
          <!-- 渐变预览块 -->
          <div
            class="h-14 rounded-lg mb-3"
            :style="{ background: item.preview }"
          ></div>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-semibold text-gray-800">{{ item.name }}</p>
              <p class="text-xs text-gray-400 mt-0.5">{{ item.desc }}</p>
            </div>
            <!-- 选中圆点 -->
            <span
              class="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors"
              :class="theme === item.value ? 'border-blue-500 bg-blue-500' : 'border-gray-300'"
            >
              <svg v-if="theme === item.value" class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
              </svg>
            </span>
          </div>
        </div>
      </div>

      <!-- 保存 -->
      <div class="flex justify-end mt-6">
        <button
          type="submit"
          :disabled="saving"
          class="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {{ saving ? '保存中...' : '保存配置' }}
        </button>
      </div>

      <!-- 保存成功提示 -->
      <div
        v-if="savedMsg"
        class="fixed bottom-6 right-6 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm"
      >
        {{ savedMsg }}
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { services } from '@/services'
import { useThemeStore } from '@/stores/theme'
import type { ThemeName } from '@/stores/theme'

const loading = ref(true)
const saving = ref(false)
const savedMsg = ref('')

const theme = ref<ThemeName>('light')

const themeOptions: { value: ThemeName; name: string; desc: string; preview: string }[] = [
  {
    value: 'light',
    name: '毛玻璃浅色（默认）',
    desc: '通透轻盈的白色玻璃，深邃蓝紫极光背景，默认主题',
    preview: 'linear-gradient(160deg, #1e2a78, #35247f 48%, #5b2a9d)',
  },
  {
    value: 'dark',
    name: '毛玻璃深色',
    desc: '近黑深蓝的暗色玻璃，适合夜间浏览',
    preview: 'linear-gradient(160deg, #050816, #0a1030 48%, #131031)',
  },
]

onMounted(async () => {
  try {
    const value = await services.config.get('theme')
    if (value === 'dark' || value === 'light') {
      theme.value = value
    }
  } catch {
    // 读取失败时使用默认值
  } finally {
    loading.value = false
  }
})

async function save() {
  saving.value = true
  try {
    await services.config.set('theme', theme.value)
    useThemeStore().apply(theme.value)
    savedMsg.value = '配置已保存'
    setTimeout(() => { savedMsg.value = '' }, 2000)
  } catch {
    // 保存失败
  } finally {
    saving.value = false
  }
}
</script>