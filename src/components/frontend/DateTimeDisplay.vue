<template>
  <div class="text-right select-none">
    <!-- 日期：辅助信息，字号缩小 -->
    <div class="glass-text font-datetime text-sm sm:text-base font-medium tracking-wide">
      {{ dateStr }} {{ weekdayStr }}
    </div>
    <!-- 时间：主视觉，位于日期下方，字体放大并略微加宽 -->
    <div class="glass-text font-datetime text-2xl sm:text-3xl font-semibold tracking-[0.3em] mt-1.5 ml-auto w-fit tabular-nums">
      {{ timeStr }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDateTime } from '@/composables/useDateTime'

const { timeStr, dateStr, weekdayStr } = useDateTime()
</script>