<template>
  <!-- contain: paint 隔离背景层重绘；transform 提升为独立合成层（模糊只栅格化一次） -->
  <div class="fixed inset-0 -z-10 overflow-hidden" style="contain: paint">
    <!-- 渐变兜底（始终存在，保证无背景图时玻璃质感依然成立） -->
    <div
      class="absolute inset-0"
      style="background: linear-gradient(160deg, var(--page-bg-1), var(--page-bg-2) 48%, var(--page-bg-3))"
    ></div>

    <!-- 极光高光（fixed 大尺寸 + blur 元素提层缓存，避免滚动时重栅格化） -->
    <div
      class="absolute -top-48 -left-48 w-[46rem] h-[46rem] rounded-full opacity-40 blur-[90px]"
      style="background: radial-gradient(circle, rgba(147, 145, 255, 0.55), transparent 65%); transform: translateZ(0); will-change: transform"
    ></div>
    <div
      class="absolute -bottom-56 -right-40 w-[42rem] h-[42rem] rounded-full opacity-30 blur-[100px]"
      style="background: radial-gradient(circle, rgba(56, 189, 248, 0.5), transparent 65%); transform: translateZ(0); will-change: transform"
    ></div>

    <!-- 用户配置的背景图（可选） -->
    <div
      v-if="bgUrl"
      class="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000"
      style="transform: translateZ(0)"
      :style="{ backgroundImage: `url(${bgUrl})` }"
    ></div>

    <!-- 有图时加深蒙层保证白字可读 -->
    <div v-if="bgUrl" class="absolute inset-0" style="background: rgba(10, 15, 40, 0.35)"></div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  bgUrl: string
}>()
</script>