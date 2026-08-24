<template>
  <div class="text-center select-none">
    <div class="text-5xl font-light text-gray-700 tracking-wider tabular-nums">
      {{ timeStr }}
    </div>
    <div class="text-sm text-gray-500 mt-2">
      {{ dateStr }}
      <span class="mx-2">·</span>
      {{ weekdayStr }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const timeStr = ref('')
const dateStr = ref('')
const weekdayStr = ref('')

let timer: ReturnType<typeof setInterval> | null = null

function update() {
  const now = new Date()
  timeStr.value = now.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  dateStr.value = now.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  weekdayStr.value = weekdays[now.getDay()]
}

onMounted(() => {
  update()
  timer = setInterval(update, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>