<template>
  <a
    :href="link.url"
    target="_blank"
    rel="noopener"
    class="glass-card flex flex-col items-center p-4 group"
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
        class="w-8 h-8 rounded-lg text-sm font-bold glass-text"
        style="background: var(--glass-bg-strong); border: 1px solid var(--glass-border)"
      >
        {{ link.title.charAt(0) }}
      </div>
    </div>

    <!-- 标题 -->
    <span class="text-xs glass-text text-center leading-tight line-clamp-1">
      {{ link.title }}
    </span>

    <!-- 描述 -->
    <span
      v-if="link.description"
      class="text-xs glass-text-faint text-center mt-1 line-clamp-1"
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