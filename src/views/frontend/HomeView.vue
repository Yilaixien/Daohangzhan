<template>
  <FrontendLayout>
    <!-- 首屏顶部留白区（日期时间 + 顶部留白，链接无需滚动即可见） -->
    <section class="relative px-4 sm:px-6 pt-14 sm:pt-16 pb-4">
      <!-- 右上日期时间（恒显，不随滚动变化） -->
      <div class="fixed top-5 right-5 sm:right-7 z-40 select-none pointer-events-none">
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
        <section
          v-for="category in store.categoriesWithLinks"
          :key="category.id"
          class="mb-10 [content-visibility:auto] [contain-intrinsic-size:auto_360px]"
        >
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
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useHomeStore } from '@/stores/home'
import { useScroll } from '@/composables/useScroll'
import FrontendLayout from './FrontendLayout.vue'
import SearchBox from '@/components/frontend/SearchBox.vue'
import LinkCard from '@/components/frontend/LinkCard.vue'
import DateTimeDisplay from '@/components/frontend/DateTimeDisplay.vue'
import BackToTop from '@/components/frontend/BackToTop.vue'

const store = useHomeStore()
const { scrollY } = useScroll()

const shellRef = ref<HTMLElement | null>(null)
// 吸顶阈值 = 搜索条起始偏移（滚动位置为 0 时测量）。
// sticky top:0 元素在 scrollY >= 起始偏移时恰好触顶，与原「rect.top <= 0」判定等价，
// 但滚动帧内不再读布局（避免每帧强制同步布局）。
const stuckAt = ref(0)

function measure() {
  stuckAt.value = shellRef.value?.getBoundingClientRect().top ?? 0
}

const scrolled = computed(() => scrollY.value >= stuckAt.value)

onMounted(async () => {
  await store.fetchData()
  // fetchData 完成后测量（确保排版稳定），窗口缩放时重新测量
  measure()
  window.addEventListener('resize', measure)
})

onUnmounted(() => {
  window.removeEventListener('resize', measure)
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
  will-change: transform; /* 仅合成器可处理的属性才提示 */
  contain: paint; /* 隔离内部绘制，避免溢出重绘 */
  transition: max-width 0.45s cubic-bezier(0.22, 1, 0.36, 1),
    padding 0.45s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease;
}

/* 吸顶态：变通栏（平滑过渡），无背景/分隔线/投影，只留搜索胶囊悬浮 */
.search-shell.stuck {
  max-width: none;
}
</style>