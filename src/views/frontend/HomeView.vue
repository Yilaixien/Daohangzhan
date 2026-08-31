<template>
  <FrontendLayout>
    <!-- 首屏顶部留白区（日期时间 + 顶部留白，链接无需滚动即可见） -->
    <section class="relative px-4 sm:px-6 pt-28 sm:pt-32 pb-4">
      <!-- 右上日期时间（向下滚动后整体淡出，日期随之消失） -->
      <div
        class="fixed top-5 right-5 sm:right-7 z-40 transition-all duration-500 select-none pointer-events-none"
        :class="scrolled ? 'opacity-0 -translate-y-4' : 'opacity-100'"
      >
        <DateTimeDisplay />
      </div>
    </section>

    <!-- 搜索区（sticky 吸顶：不脱离文档流、无布局跳变） -->
    <div ref="shellRef" class="search-shell w-full" :class="{ stuck: scrolled }">
      <SearchBox
        :engines="store.searchEngines"
        :engine="store.currentEngine"
        :stuck="scrolled"
        @search="store.doSearch"
        @change-engine="store.setCurrentEngine"
      />
      <!-- 吸顶小时间：时间不消失，始终可见 -->
      <span
        v-if="scrolled"
        class="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 glass-text font-semibold text-sm tracking-[0.25em] tabular-nums"
      >
        {{ timeStr }}
      </span>
    </div>

    <!-- 下方内容区 -->
    <div class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-16">
      <!-- 加载状态 -->
      <div v-if="store.loading" class="space-y-8">
        <div v-for="i in 3" :key="i" class="animate-pulse">
          <div
            class="h-5 rounded w-24 mb-4"
            style="background: var(--glass-bg); border: 1px solid var(--glass-border)"
          ></div>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div
              v-for="j in 6"
              :key="j"
              class="rounded-lg p-4 flex flex-col items-center"
              style="background: var(--glass-bg); border: 1px solid var(--glass-border)"
            >
              <div class="w-10 h-10 rounded-lg mb-2" style="background: var(--glass-bg-strong)"></div>
              <div class="h-3 rounded w-12" style="background: var(--glass-bg-strong)"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- 分组导航区域 -->
      <div v-else>
        <section v-for="category in store.categoriesWithLinks" :key="category.id" class="mb-10">
          <h3
            class="glass-text text-lg font-semibold mb-4 pb-2"
            style="border-bottom: 1px solid var(--glass-border)"
          >
            {{ category.name }}
          </h3>

          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <LinkCard
              v-for="link in category.links"
              :key="link.id"
              :link="link"
              @click="store.recordClick"
            />
          </div>
        </section>

        <!-- 空状态 -->
        <div v-if="store.categoriesWithLinks.length === 0" class="text-center py-16 glass-text-faint">
          <p class="text-lg">暂无链接</p>
          <p class="text-sm mt-2">请前往后台添加链接</p>
        </div>
      </div>
    </div>

    <!-- 返回顶部 -->
    <BackToTop />
  </FrontendLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useHomeStore } from '@/stores/home'
import { useDateTime } from '@/composables/useDateTime'
import FrontendLayout from './FrontendLayout.vue'
import SearchBox from '@/components/frontend/SearchBox.vue'
import LinkCard from '@/components/frontend/LinkCard.vue'
import DateTimeDisplay from '@/components/frontend/DateTimeDisplay.vue'
import BackToTop from '@/components/frontend/BackToTop.vue'

const store = useHomeStore()
const { timeStr } = useDateTime()

const shellRef = ref<HTMLElement | null>(null)
const scrolled = ref(false)

let ticking = false
function handleScroll() {
  if (ticking) return
  ticking = true
  requestAnimationFrame(() => {
    ticking = false
    // 以搜索条自身位置判定吸顶：恰好在触顶瞬间切换，无瞬移
    scrolled.value = (shellRef.value?.getBoundingClientRect().top ?? 0) <= 0
  })
}

onMounted(() => {
  store.fetchData()
  window.addEventListener('scroll', handleScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<style scoped>
/* 搜索区外壳：position: sticky，不脱离文档流、无布局跳变 */
.search-shell {
  position: sticky;
  top: 0;
  z-index: 40;
  max-width: 42rem;
  margin: 0 auto;
  padding: 12px 16px;
  transform: translateZ(0); /* GPU 合成层，稳定 backdrop-filter */
  will-change: transform;
  transition: background-color 0.35s ease, border-color 0.35s ease,
    box-shadow 0.35s ease, opacity 0.35s ease;
}

/* 吸顶态：变通栏（瞬时切换，避免逐帧布局动画），底部 border 作为分隔线 */
.search-shell.stuck {
  max-width: none;
  background: var(--glass-bg-strong);
  border-bottom: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow);
}
</style>