<template>
  <FrontendLayout>
    <!-- 背景图 -->
    <BackgroundImage :bg-url="store.siteConfig.background || ''" />

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
      <!-- 时间日期 -->
      <DateTimeDisplay class="mb-8" />

      <!-- 搜索框区域 -->
      <div class="text-center mb-10">
        <h2 class="text-2xl font-bold text-gray-800 mb-6">{{ store.homeTitle }}</h2>
        <SearchBox
          :engines="store.searchEngines"
          :engine="store.currentEngine"
          @search="store.doSearch"
          @change-engine="store.setCurrentEngine"
        />
      </div>

      <!-- 加载状态 -->
      <div v-if="store.loading" class="space-y-8">
        <div v-for="i in 3" :key="i" class="animate-pulse">
          <div class="h-5 bg-gray-200/60 rounded w-24 mb-4"></div>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div v-for="j in 6" :key="j" class="bg-white/80 backdrop-blur-sm rounded-lg p-4 flex flex-col items-center">
              <div class="w-10 h-10 bg-gray-200/60 rounded-lg mb-2"></div>
              <div class="h-3 bg-gray-200/60 rounded w-12"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- 分组导航区域 -->
      <div v-else>
        <section
          v-for="category in store.categoriesWithLinks"
          :key="category.id"
          class="mb-10"
        >
          <h3 class="text-lg font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-200/60">
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
        <div v-if="store.categoriesWithLinks.length === 0" class="text-center py-16 text-gray-400">
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
import BackgroundImage from '@/components/frontend/BackgroundImage.vue'
import DateTimeDisplay from '@/components/frontend/DateTimeDisplay.vue'
import BackToTop from '@/components/frontend/BackToTop.vue'

const store = useHomeStore()

onMounted(() => {
  store.fetchData()
})
</script>