<template>
  <div class="max-w-2xl mx-auto">
    <!-- 搜索框 -->
    <div class="flex items-center bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
      <div class="pl-4 text-gray-400">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <input
        v-model="keyword"
        type="text"
        :placeholder="`使用 ${engine.name} 搜索`"
        class="flex-1 px-3 py-3 border-0 outline-none text-gray-700"
        @keyup.enter="search"
      />
      <button
        @click="search"
        class="px-6 py-3 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 transition-colors"
      >
        搜索
      </button>
    </div>

    <!-- 搜索引擎切换 -->
    <div class="flex justify-center flex-wrap gap-3 mt-4">
      <button
        v-for="e in engines"
        :key="e.id"
        @click="$emit('change-engine', e)"
        class="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-colors"
        :class="engine.id === e.id
          ? 'bg-blue-100 text-blue-700 font-medium'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
      >
        <img v-if="e.icon && isImageIcon(e.icon)" :src="e.icon" class="w-3.5 h-3.5 rounded" />
        <span v-else-if="e.icon" v-html="e.icon" class="w-3.5 h-3.5"></span>
        {{ e.name }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { SearchEngine } from '@/services/contracts'

defineProps<{
  engines: SearchEngine[]
  engine: SearchEngine
}>()

const emit = defineEmits<{
  search: [keyword: string]
  'change-engine': [engine: SearchEngine]
}>()

const keyword = ref('')

function search() {
  if (keyword.value.trim()) {
    emit('search', keyword.value.trim())
  }
}

function isImageIcon(icon: string): boolean {
  return icon.startsWith('http://') || icon.startsWith('https://') || icon.startsWith('./') || icon.startsWith('/')
}
</script>