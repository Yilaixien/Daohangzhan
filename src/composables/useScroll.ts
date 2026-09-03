import { ref, onMounted } from 'vue'

/**
 * 共享滚动源：模块级单例，页面所有滚动状态统一由这一个被动监听驱动。
 *
 * 优化动机：原先每个组件各自挂 window scroll 监听，部分未节流，
 * 并在滚动帧内读取布局（getBoundingClientRect）导致强制同步布局。
 * 此处收敛为单个 rAF 节流的监听，只发布响应式 scrollY，
 * 消费者用 computed 派生状态——scrollY 每帧更新，但布尔态不变时不触发重渲染。
 */
const scrollY = ref(0)

let started = false
let ticking = false

function onScroll() {
  if (ticking) return
  ticking = true
  requestAnimationFrame(() => {
    scrollY.value = window.scrollY
    // 帧末补一针复位，避免下一帧的滚动事件被吞掉造成滞后
    requestAnimationFrame(() => {
      ticking = false
    })
  })
}

export function useScroll() {
  onMounted(() => {
    if (!started) {
      started = true
      // 挂载时补读当前位置（浏览器可能恢复了滚动位置）
      scrollY.value = window.scrollY
      window.addEventListener('scroll', onScroll, { passive: true })
    }
  })

  // SPA 内页面级组件常驻，监听不做注销，避免多组件生命周期竞争。
  return { scrollY }
}