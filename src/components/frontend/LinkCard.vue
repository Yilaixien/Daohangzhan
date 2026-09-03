<template>
  <a
    :href="link.url"
    target="_blank"
    rel="noopener"
    class="glass-card flex flex-col items-center p-4 group"
    @click="$emit('click', link)"
  >
    <!-- 图标区域：白底圆角底衬，使图标呈现类手机 App 的统一风格 -->
    <div class="w-12 h-12 mb-3 flex items-center justify-center">
      <div
        v-if="isImageIcon && !imageError"
        class="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center overflow-hidden"
      >
        <img
          :src="link.icon!"
          :alt="link.title"
          class="w-8 h-8 object-contain"
          loading="lazy"
          decoding="async"
          @error="imageError = true"
        />
      </div>
      <div
        v-else-if="link.icon && !isImageIcon"
        class="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-3xl group-hover:scale-110 transition-transform overflow-hidden"
        v-html="link.icon"
      ></div>
      <div
        v-else
        class="w-10 h-10 rounded-xl text-base font-bold glass-text"
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