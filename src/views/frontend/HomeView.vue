<template>
  <FrontendLayout>
    <!-- 首屏顶部留白区（日期时间 + 顶部留白，链接无需滚动即可见） -->
    <section class="relative px-4 sm:px-6 pt-14 sm:pt-16 pb-4">
      <!-- 右上日期时间（恒显，不随滚动变化） -->
      <div class="fixed top-5 right-5 sm:right-7 z-40 select-none pointer-events-none">
        <DateTimeDisplay />
      </div>
    </section>

    <!-- 搜索区（居中窄条，随页面自然滚动、不吸顶） -->
    <div class="search-shell w-full">
      <SearchBox
        :engines="store.searchEngines"
        :engine="store.currentEngine"
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
              <div class="w-12 h-12 rounded-xl mb-3" style="background: var(--glass-bg-strong)"></div>
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
import { onMounted } from 'vue'
import { useHomeStore } from '@/stores/home'
import FrontendLayout from './FrontendLayout.vue'
import SearchBox from '@/components/frontend/SearchBox.vue'
import LinkCard from '@/components/frontend/LinkCard.vue'
import DateTimeDisplay from '@/components/frontend/DateTimeDisplay.vue'
import BackToTop from '@/components/frontend/BackToTop.vue'

const store = useHomeStore()

onMounted(() => {
  store.fetchData()
})
</script>

<style scoped>
/* 搜索区外壳：居中窄条，不吸顶、无滚动动画 */
.search-shell {
  max-width: 42rem;
  margin: 0 auto;
  padding: 12px 16px;
}
</style>