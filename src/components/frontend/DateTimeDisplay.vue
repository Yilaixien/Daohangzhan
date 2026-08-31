<template>
  <div class="text-right select-none">
    <!-- 日期：字号略大 -->
    <div class="glass-text text-xl sm:text-2xl font-medium tracking-wide">
      {{ dateStr }} {{ weekdayStr }}
    </div>
    <!-- 时间：位于日期下方，字体略微加宽 -->
    <div class="glass-text text-sm sm:text-base font-semibold tracking-[0.3em] mt-1.5 ml-auto w-fit tabular-nums">
      {{ timeStr }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDateTime } from '@/composables/useDateTime'

const { timeStr, dateStr, weekdayStr } = useDateTime()
</script>