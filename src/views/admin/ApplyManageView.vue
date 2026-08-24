<template>
  <div>
    <h2 class="text-xl font-semibold text-gray-800 mb-6">收录审核</h2>

    <!-- 状态筛选 -->
    <div class="bg-white rounded-lg shadow-sm p-4 mb-4 flex gap-2">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        @click="currentTab = tab.value"
        class="px-4 py-1.5 text-sm rounded-lg transition-colors"
        :class="currentTab === tab.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
      >
        {{ tab.label }}
        <span v-if="tab.count !== undefined" class="ml-1 opacity-70">({{ tab.count }})</span>
      </button>
    </div>

    <!-- 申请列表 -->
    <div class="bg-white rounded-lg shadow-sm overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50 border-b">
            <tr>
              <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">网站名称</th>
              <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">URL</th>
              <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">分组</th>
              <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">申请时间</th>
              <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">状态</th>
              <th class="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="filteredApplies.length === 0">
              <td colspan="6" class="text-center py-12 text-gray-400">暂无申请</td>
            </tr>
            <tr v-for="apply in filteredApplies" :key="apply.id" class="hover:bg-gray-50 transition-colors">
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <img v-if="isImageIcon(apply.icon)" :src="apply.icon ?? undefined" class="w-5 h-5 rounded" @error="($event.target as HTMLImageElement).style.display='none'" />
                  <span class="text-sm text-gray-700 font-medium">{{ apply.name }}</span>
                </div>
                <p v-if="apply.description" class="text-xs text-gray-400 mt-0.5">{{ apply.description }}</p>
              </td>
              <td class="px-4 py-3 hidden md:table-cell">
                <a :href="apply.url" target="_blank" class="text-sm text-blue-600 hover:underline truncate max-w-[200px] block">{{ apply.url }}</a>
              </td>
              <td class="px-4 py-3 hidden sm:table-cell">
                <span class="text-sm text-gray-500">{{ getCategoryName(apply.category_id) }}</span>
              </td>
              <td class="px-4 py-3 hidden sm:table-cell">
                <span class="text-sm text-gray-500">{{ formatDate(apply.created_at) }}</span>
              </td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex px-2 py-0.5 text-xs rounded-full"
                  :class="{
                    'bg-yellow-100 text-yellow-700': apply.status === 'pending',
                    'bg-green-100 text-green-700': apply.status === 'approved',
                    'bg-red-100 text-red-700': apply.status === 'rejected',
                  }"
                >
                  {{ statusLabel(apply.status) }}
                </span>
              </td>
              <td class="px-4 py-3">
                <div class="flex justify-end gap-2">
                  <template v-if="apply.status === 'pending'">
                    <button @click="approveApply(apply.id)" :disabled="operating" class="text-xs text-green-600 hover:text-green-800 disabled:opacity-50">通过</button>
                    <button @click="rejectApply(apply.id)" :disabled="operating" class="text-xs text-red-600 hover:text-red-800 disabled:opacity-50">拒绝</button>
                  </template>
                  <span v-else class="text-xs text-gray-400">-</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { services } from '@/services'
import type { Apply, Category } from '@/services/contracts'

const applies = ref<Apply[]>([])
const categories = ref<Category[]>([])
const loading = ref(true)
const operating = ref(false)
const currentTab = ref('pending')

const tabs: { value: string; label: string; count?: number }[] = [
  { value: 'pending', label: '待审核' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已拒绝' },
  { value: 'all', label: '全部' },
]

const filteredApplies = computed(() => {
  if (currentTab.value === 'all') return applies.value
  return applies.value.filter(a => a.status === currentTab.value)
})

function getCategoryName(id: string | number) {
  return categories.value.find(c => c.id == id)?.name || '-'
}

function statusLabel(status: string) {
  return { pending: '待审核', approved: '已通过', rejected: '已拒绝' }[status] || status
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function isImageIcon(icon: string | null): boolean {
  if (!icon) return false
  return icon.startsWith('http://') || icon.startsWith('https://')
}

async function loadData() {
  loading.value = true
  try {
    const [allApplies, allCats] = await Promise.all([
      services.apply.getAll(),
      services.categories.getAll(),
    ])
    applies.value = allApplies
    categories.value = allCats
  } catch {} finally {
    loading.value = false
  }
}

async function approveApply(id: string | number) {
  operating.value = true
  try {
    await services.apply.approve(id)
    await loadData()
  } catch {} finally {
    operating.value = false
  }
}

async function rejectApply(id: string | number) {
  operating.value = true
  try {
    await services.apply.reject(id)
    await loadData()
  } catch {} finally {
    operating.value = false
  }
}

onMounted(loadData)
</script>
