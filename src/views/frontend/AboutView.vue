<template>
  <FrontendLayout>
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- 加载状态 -->
      <div v-if="loading" class="glass p-8 rounded-lg animate-pulse">
        <div class="h-7 rounded w-32 mb-6" style="background: var(--glass-bg-strong)"></div>
        <div class="space-y-3">
          <div class="h-4 rounded w-full" style="background: var(--glass-bg-strong)"></div>
          <div class="h-4 rounded w-5/6" style="background: var(--glass-bg-strong)"></div>
          <div class="h-4 rounded w-4/6" style="background: var(--glass-bg-strong)"></div>
        </div>
      </div>

      <!-- 内容 -->
      <div v-else class="glass p-6 sm:p-8">
        <h2 class="text-xl font-bold glass-text mb-6 pb-3" style="border-bottom: 1px solid var(--glass-border)">
          关于本站
        </h2>
        <div v-if="content" class="prose max-w-none glass-text-soft" v-html="content"></div>
        <div v-else class="text-center py-12 glass-text-faint">
          <p class="text-lg">暂无内容</p>
          <p class="text-sm mt-2">请前往后台配置关于页面内容</p>
        </div>
      </div>
    </div>
  </FrontendLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { services } from '@/services'
import FrontendLayout from './FrontendLayout.vue'

const loading = ref(true)
const content = ref('')

onMounted(async () => {
  try {
    // 公开只读快照（边缘函数，命中零回源 Neon）
    const data = await services.frontendData.getAll()
    content.value = data.config['about_content'] || ''
  } catch {
    // 加载失败
  } finally {
    loading.value = false
  }
})
</script>