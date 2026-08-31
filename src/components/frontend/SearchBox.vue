<template>
  <div
    class="search-inner mx-auto whitespace-nowrap"
    :class="stuck ? 'max-w-3xl pr-20' : 'max-w-2xl'"
  >
    <!-- 搜索行 -->
    <div
      class="glass flex items-center rounded-full overflow-hidden"
      :class="stuck ? 'h-12' : 'h-12 sm:h-14'"
    >
      <div class="pl-5 flex-shrink-0 glass-text-faint">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
      <input
        v-model="keyword"
        type="text"
        :placeholder="`使用 ${engine.name} 搜索`"
        class="glass-input flex-1 px-3 h-full min-w-0"
        @keyup.enter="search"
      />
      <button
        @click="search"
        class="h-full px-6 text-sm transition-opacity hover:opacity-85"
        style="background: var(--glass-bg-strong); border-left: 1px solid var(--glass-border)"
      >
        搜索
      </button>
    </div>

    <!-- 搜索引擎选择按钮（吸顶时收起） -->
    <div
      class="flex justify-center flex-wrap gap-2.5 mt-4 overflow-hidden transition-all duration-500"
      :class="stuck ? 'opacity-0 max-h-0 mt-0 pointer-events-none' : 'opacity-100 max-h-20'"
    >
      <button
        v-for="e in engines"
        :key="e.id"
        type="button"
        class="glass-chip"
        :class="{ 'active': engine.id === e.id }"
        @click="$emit('change-engine', e)"
      >
        <img v-if="e.icon && isImageIcon(e.icon)" :src="e.icon" alt="" />
        <span v-else-if="e.icon" v-html="e.icon"></span>
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
  /** 吸顶态：搜索框变宽变长，与导航条高度持平 */
  stuck?: boolean
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