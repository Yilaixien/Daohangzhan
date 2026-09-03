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

// ---------- 滚动中标记（滚动期间降级 backdrop-filter 等重活，提升跟手度） ----------
let scrollingApplied = false
let idleTimer: ReturnType<typeof setTimeout> | null = null

function setScrolling(on: boolean) {
  if (scrollingApplied === on) return
  scrollingApplied = on
  // CSS 侧据此在触摸设备滚动期间关闭毛玻璃模糊（html[data-scrolling]）
  document.documentElement.setAttribute('data-scrolling', on ? 'true' : '')
  if (!on && idleTimer) {
    clearTimeout(idleTimer)
    idleTimer = null
  }
}

function onScroll() {
  // 滚动开始立即打标，连续 150ms 无滚动事件或触发 scrollend 时移除
  setScrolling(true)
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = setTimeout(() => setScrolling(false), 150)

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
      // 支持 scrollend 的浏览器（Chrome 114+）滚动停止时立即恢复
      if ('onscrollend' in window) {
        window.addEventListener('scrollend', () => setScrolling(false))
      }
    }
  })

  // SPA 内页面级组件常驻，监听不做注销，避免多组件生命周期竞争。
  return { scrollY }
}