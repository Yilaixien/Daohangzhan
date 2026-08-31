import { ref, onMounted, onUnmounted } from 'vue'

/**
 * 日期时间展示逻辑（供首屏主角块与吸顶小时间共用）
 */
export function useDateTime() {
  const timeStr = ref('')
  const dateStr = ref('')
  const weekdayStr = ref('')

  let timer: ReturnType<typeof setInterval> | null = null

  function update() {
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    timeStr.value = `${hh}:${mm}`
    const y = now.getFullYear()
    const mo = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    dateStr.value = `${y}年${mo}月${d}日`
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

  return { timeStr, dateStr, weekdayStr }
}