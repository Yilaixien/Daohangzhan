<template>
  <a
    :href="link.url"
    target="_blank"
    rel="noopener"
    class="flex flex-col items-center p-4 bg-white rounded-lg shadow-sm hover:shadow-md hover:scale-105 transition-all duration-200 group"
    @click="$emit('click', link)"
  >
    <!-- 图标区域 -->
    <div class="w-10 h-10 mb-2 flex items-center justify-center">
      <img
        v-if="isImageIcon && !imageError"
        :src="link.icon!"
        :alt="link.title"
        class="w-8 h-8 object-contain"
        @error="imageError = true"
      />
      <div
        v-else-if="link.icon && !isImageIcon"
        class="text-2xl group-hover:scale-110 transition-transform"
        v-html="link.icon"
      ></div>
      <div
        v-else
        class="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold"
      >
        {{ link.title.charAt(0) }}
      </div>
    </div>

    <!-- 标题 -->
    <span class="text-xs text-gray-700 text-center leading-tight line-clamp-1">
      {{ link.title }}
    </span>

    <!-- 描述 -->
    <span
      v-if="link.description"
      class="text-xs text-gray-400 text-center mt-1 line-clamp-1"
    >
      {{ link.description }}
    </span>
  </a>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Link } from '@/services/contracts'

const props = defineProps<{
  link: Link
}>()

defineEmits<{
  click: [link: Link]
}>()

const imageError = ref(false)

const isImageIcon = computed(() => {
  const icon = props.link.icon
  if (!icon) return false
  return (
    icon.startsWith('http://') ||
    icon.startsWith('https://') ||
    icon.startsWith('./') ||
    icon.startsWith('/')
  )
})
</script>