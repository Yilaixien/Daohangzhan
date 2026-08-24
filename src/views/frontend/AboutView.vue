<template>
  <FrontendLayout>
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- 加载状态 -->
      <div v-if="loading" class="bg-white/80 backdrop-blur-sm rounded-lg shadow-sm p-8 animate-pulse">
        <div class="h-7 bg-gray-200 rounded w-32 mb-6"></div>
        <div class="space-y-3">
          <div class="h-4 bg-gray-200 rounded w-full"></div>
          <div class="h-4 bg-gray-200 rounded w-5/6"></div>
          <div class="h-4 bg-gray-200 rounded w-4/6"></div>
        </div>
      </div>

      <!-- 内容 -->
      <div v-else class="bg-white/80 backdrop-blur-sm rounded-lg shadow-sm p-6 sm:p-8">
        <h2 class="text-xl font-bold text-gray-800 mb-6 pb-3 border-b border-gray-200">
          关于本站
        </h2>
        <div v-if="content" class="prose max-w-none text-gray-700" v-html="content"></div>
        <div v-else class="text-center py-12 text-gray-400">
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
    content.value = (await services.config.get('about_content')) || ''
  } catch {
    // 加载失败
  } finally {
    loading.value = false
  }
})
</script>