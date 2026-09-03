<template>
  <Transition name="fade">
    <button
      v-show="visible"
      @click="scrollToTop"
      class="btn-glass fixed bottom-6 right-6 w-10 h-10 text-white rounded-full shadow-lg transition-all duration-200 flex items-center justify-center z-50"
      title="返回顶部"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    </button>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useScroll } from '@/composables/useScroll'

const { scrollY } = useScroll()

// 由共享滚动源派生，无需自行挂载 scroll 监听
const visible = computed(() => scrollY.value > 300)

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>