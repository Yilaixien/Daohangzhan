<template>
  <FrontendLayout>
    <!-- 首屏：留白 + 主次层级，标语已移除 -->
    <section class="relative flex flex-col items-center justify-center px-4 sm:px-6 min-h-screen">
      <!-- 右上日期时间（向下滚动后整体淡出，日期随之消失） -->
      <div
        class="fixed top-5 right-5 sm:right-7 z-40 transition-all duration-500 select-none pointer-events-none"
        :class="scrolled ? 'opacity-0 -translate-y-4' : 'opacity-100'"
      >
        <DateTimeDisplay />
      </div>

      <!-- 隐形阻挡层：吸顶时防止下方图标穿透到导航条背景 -->
      <div v-if="scrolled" class="sticky-shield"></div>

      <!-- 搜索区（吸顶 shell） -->
      <div class="search-shell w-full transition-all duration-500" :class="{ stuck: scrolled }">
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
    </section>

    <!-- 下方内容区 -->
    <div class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
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

const scrolled = ref(false)

function handleScroll() {
  scrolled.value = window.scrollY > 60
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
/* 搜索区外壳：普通态居中，吸顶态变为顶部通栏玻璃条 */
.search-shell {
  position: relative;
  width: 100%;
}

.search-shell.stuck {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 40;
  padding: 10px 16px;
  background: var(--glass-bg-strong);
  border-bottom: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
}

/* 隐形阻挡层：吸顶条下方，防止图标滚动穿透显示 */
.sticky-shield {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 72px;
  z-index: 30;
  pointer-events: none;
  background: linear-gradient(180deg, var(--glass-shield) 0%, transparent 100%);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
}

/* 保证过渡流畅 */
.search-shell,
.sticky-shield {
  will-change: transform, opacity;
}
</style>