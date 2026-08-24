<template>
  <div>
    <h2 class="text-xl font-semibold text-gray-800 mb-6">仪表盘</h2>

    <!-- 加载状态 -->
    <div v-if="loading" class="space-y-6">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div v-for="i in 4" :key="i" class="bg-white rounded-lg shadow-sm p-5 animate-pulse">
          <div class="h-4 bg-gray-200 rounded w-16 mb-3"></div>
          <div class="h-8 bg-gray-200 rounded w-20"></div>
        </div>
      </div>
      <div class="bg-white rounded-lg shadow-sm p-5 animate-pulse">
        <div class="h-5 bg-gray-200 rounded w-24 mb-4"></div>
        <div class="h-48 bg-gray-200 rounded"></div>
      </div>
    </div>

    <!-- 内容 -->
    <template v-else>
      <!-- 统计卡片 -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div class="bg-white rounded-lg shadow-sm p-5 border-l-4 border-blue-500">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">总链接数</p>
              <p class="text-2xl font-bold text-gray-800 mt-1">{{ stats.total_links }}</p>
            </div>
            <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow-sm p-5 border-l-4 border-purple-500">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">总点击量</p>
              <p class="text-2xl font-bold text-gray-800 mt-1">{{ stats.total_clicks }}</p>
            </div>
            <div class="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow-sm p-5 border-l-4 border-yellow-500">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">今日点击</p>
              <p class="text-2xl font-bold text-yellow-600 mt-1">{{ stats.today_clicks }}</p>
            </div>
            <div class="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow-sm p-5 border-l-4 border-green-500">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">本周点击</p>
              <p class="text-2xl font-bold text-green-600 mt-1">{{ stats.week_clicks }}</p>
            </div>
            <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- 趋势图 -->
      <div class="bg-white rounded-lg shadow-sm p-5 mb-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-700">点击趋势</h3>
          <div class="flex gap-2">
            <button
              v-for="d in [7, 30]"
              :key="d"
              @click="switchTrendDays(d)"
              class="px-3 py-1 text-xs rounded-full transition-colors"
              :class="trendDays === d ? 'bg-blue-100 text-blue-700 font-medium' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
            >
              近 {{ d }} 天
            </button>
          </div>
        </div>
        <div class="relative h-64">
          <canvas ref="chartCanvas" class="w-full h-full"></canvas>
          <div v-if="!chartReady" class="absolute inset-0 flex items-center justify-center bg-white/50">
            <span class="text-gray-400">图表加载中...</span>
          </div>
        </div>
      </div>

      <!-- 热门链接 -->
      <div class="bg-white rounded-lg shadow-sm p-5">
        <h3 class="text-lg font-semibold text-gray-700 mb-4">热门链接 Top 20</h3>
        <div v-if="topLinks.length === 0" class="text-gray-400 text-center py-8">
          <p>暂无数据</p>
          <p class="text-sm mt-1">用户点击链接后将在此展示</p>
        </div>
        <div v-else class="space-y-1">
          <div
            v-for="(link, index) in topLinks"
            :key="link.link_id"
            class="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div class="flex items-center gap-3">
              <span
                class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                :class="index < 3 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'"
              >
                {{ index + 1 }}
              </span>
              <span class="text-sm text-gray-700">{{ link.title }}</span>
            </div>
            <div class="flex items-center gap-4">
              <!-- 进度条 -->
              <div class="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden hidden sm:block">
                <div
                  class="h-full bg-blue-500 rounded-full"
                  :style="{ width: maxCount > 0 ? (link.count / maxCount * 100) + '%' : '0%' }"
                ></div>
              </div>
              <span class="text-sm text-gray-500 w-12 text-right">{{ link.count }} 次</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { services } from '@/services'
import type { StatsOverview } from '@/services/contracts'

const loading = ref(true)
const stats = ref<StatsOverview>({
  total_links: 0,
  total_clicks: 0,
  today_clicks: 0,
  week_clicks: 0,
})
const topLinks = ref<{ link_id: number | string; title: string; count: number }[]>([])
const trendData = ref<{ date: string; count: number }[]>([])
const trendDays = ref(7)
const chartReady = ref(false)

const chartCanvas = ref<HTMLCanvasElement | null>(null)
let chartInstance: any = null

const maxCount = computed(() => {
  if (topLinks.value.length === 0) return 0
  return Math.max(...topLinks.value.map((l) => l.count))
})

async function loadData() {
  loading.value = true
  try {
    const [overview, top, trend] = await Promise.all([
      services.stats.getOverview(),
      services.stats.getTopLinks(20),
      services.stats.getTrend(trendDays.value),
    ])
    stats.value = overview
    topLinks.value = top
    trendData.value = trend
  } catch {
    // 加载失败
  } finally {
    loading.value = false
  }
}

async function switchTrendDays(days: number) {
  trendDays.value = days
  try {
    trendData.value = await services.stats.getTrend(days)
  } catch {}
  await nextTick()
  renderChart()
}

async function renderChart() {
  if (!chartCanvas.value) return

  // 动态 import Chart.js
  const { Chart, registerables } = await import('chart.js')
  Chart.register(...registerables)

  if (chartInstance) {
    chartInstance.destroy()
  }

  const labels = trendData.value.map((d) => d.date.slice(5)) // "MM-DD"
  const values = trendData.value.map((d) => d.count)

  chartInstance = new Chart(chartCanvas.value, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '点击量',
          data: values,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: '#3b82f6',
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1f2937',
          titleColor: '#fff',
          bodyColor: '#fff',
          padding: 10,
          cornerRadius: 8,
          displayColors: false,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#9ca3af', font: { size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: '#f3f4f6' },
          ticks: {
            color: '#9ca3af',
            font: { size: 11 },
            callback: (value: any) => (Number.isInteger(value) ? value : ''),
          },
        },
      },
    },
  })

  chartReady.value = true
}

onMounted(async () => {
  await loadData()
  await nextTick()
  await renderChart()
})

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.destroy()
  }
})
</script>