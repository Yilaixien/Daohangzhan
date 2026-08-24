<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-semibold text-gray-800">链接管理</h2>
      <div class="flex gap-2">
        <button @click="showBatchAdd = true" class="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
          批量添加
        </button>
        <button @click="checkDeadLinks" :disabled="checking" class="px-3 py-1.5 text-sm bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors disabled:opacity-50">
          {{ checking ? '检测中...' : '死链检测' }}
        </button>
        <button @click="openAdd" class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          添加链接
        </button>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="bg-white rounded-lg shadow-sm p-4 mb-4 flex flex-wrap gap-3">
      <input v-model="searchQuery" type="text" placeholder="搜索链接名称..." class="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-48 outline-none focus:ring-2 focus:ring-blue-500" />
      <select v-model="filterCategory" class="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500">
        <option value="">全部分组</option>
        <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
      </select>
      <select v-model="filterStatus" class="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500">
        <option value="">全部状态</option>
        <option value="visible">可见</option>
        <option value="hidden">隐藏</option>
      </select>
    </div>

    <!-- 链接列表 -->
    <div class="bg-white rounded-lg shadow-sm overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50 border-b">
            <tr>
              <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase w-8">#</th>
              <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">名称</th>
              <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">URL</th>
              <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">分组</th>
              <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">排序</th>
              <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">状态</th>
              <th class="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="filteredLinks.length === 0">
              <td colspan="7" class="text-center py-12 text-gray-400">暂无链接</td>
            </tr>
            <tr v-for="(link, index) in filteredLinks" :key="link.id" class="hover:bg-gray-50 transition-colors">
              <td class="px-4 py-3 text-sm text-gray-400">{{ index + 1 }}</td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <img v-if="isImageIcon(link.icon)" :src="link.icon ?? undefined" class="w-5 h-5 rounded" @error="($event.target as HTMLImageElement).style.display='none'" />
                  <span class="text-sm text-gray-700 font-medium">{{ link.title }}</span>
                </div>
              </td>
              <td class="px-4 py-3 hidden md:table-cell">
                <a :href="link.url" target="_blank" class="text-sm text-blue-600 hover:underline truncate max-w-[200px] block">{{ link.url }}</a>
              </td>
              <td class="px-4 py-3 hidden sm:table-cell">
                <span class="text-sm text-gray-500">{{ getCategoryName(link.category_id) }}</span>
              </td>
              <td class="px-4 py-3 hidden sm:table-cell">
                <span class="text-sm text-gray-500">{{ link.sort_order }}</span>
              </td>
              <td class="px-4 py-3">
                <span class="inline-flex px-2 py-0.5 text-xs rounded-full" :class="link.is_visible ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'">
                  {{ link.is_visible ? '可见' : '隐藏' }}
                </span>
              </td>
              <td class="px-4 py-3">
                <div class="flex justify-end gap-2">
                  <button @click="openEdit(link)" class="text-xs text-blue-600 hover:text-blue-800">编辑</button>
                  <button @click="confirmDelete(link)" class="text-xs text-red-600 hover:text-red-800">删除</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 添加/编辑弹窗 -->
    <div v-if="showForm" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="showForm = false">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <h3 class="text-lg font-semibold text-gray-800 mb-4">{{ editingLink ? '编辑链接' : '添加链接' }}</h3>
        <form @submit.prevent="saveLink" class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">名称 *</label>
            <input v-model="form.title" type="text" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">URL *</label>
            <input v-model="form.url" type="url" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">分组 *</label>
            <select v-model="form.category_id" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">请选择分组</option>
              <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">图标 URL</label>
            <input v-model="form.icon" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">描述</label>
            <input v-model="form.description" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">排序值</label>
            <input v-model="form.sort_order" type="number" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" @click="showForm = false" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">取消</button>
            <button type="submit" :disabled="saving" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {{ saving ? '保存中...' : '保存' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- 批量添加弹窗 -->
    <div v-if="showBatchAdd" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="showBatchAdd = false">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <h3 class="text-lg font-semibold text-gray-800 mb-4">批量添加链接</h3>
        <p class="text-sm text-gray-500 mb-3">每行一个链接，格式：<code class="bg-gray-100 px-1 rounded">名称 | URL | 分组ID</code></p>
        <textarea v-model="batchText" rows="6" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono" placeholder="百度 | https://www.baidu.com | 1"></textarea>
        <div class="flex justify-end gap-2 mt-4">
          <button @click="showBatchAdd = false" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
          <button @click="handleBatchAdd" :disabled="batchSaving" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {{ batchSaving ? '导入中...' : '批量导入' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="showDeleteConfirm" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="showDeleteConfirm = false">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center">
        <p class="text-gray-700 mb-4">确定要删除链接「{{ deleteTarget?.title }}」吗？</p>
        <div class="flex justify-center gap-2">
          <button @click="showDeleteConfirm = false" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
          <button @click="doDelete" class="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">确认删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { services } from '@/services'
import type { Link, Category } from '@/services/contracts'

const links = ref<Link[]>([])
const categories = ref<Category[]>([])
const loading = ref(true)
const saving = ref(false)
const checking = ref(false)
const batchSaving = ref(false)
const searchQuery = ref('')
const filterCategory = ref<string | number>('')
const filterStatus = ref('')

const showForm = ref(false)
const showBatchAdd = ref(false)
const showDeleteConfirm = ref(false)
const editingLink = ref<Link | null>(null)
const deleteTarget = ref<Link | null>(null)
const batchText = ref('')

const form = ref({
  title: '',
  url: '',
  category_id: '' as string | number,
  icon: '',
  description: '',
  sort_order: 10,
})

const filteredLinks = computed(() => {
  let result = links.value
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(l => l.title.toLowerCase().includes(q))
  }
  if (filterCategory.value) {
    result = result.filter(l => l.category_id == filterCategory.value)
  }
  if (filterStatus.value === 'visible') {
    result = result.filter(l => l.is_visible)
  } else if (filterStatus.value === 'hidden') {
    result = result.filter(l => !l.is_visible)
  }
  return result
})

function getCategoryName(id: string | number) {
  return categories.value.find(c => c.id == id)?.name || '-'
}

function isImageIcon(icon: string | null): boolean {
  if (!icon) return false
  return icon.startsWith('http://') || icon.startsWith('https://')
}

async function loadData() {
  loading.value = true
  try {
    const [allLinks, allCats] = await Promise.all([
      services.links.getAll(),
      services.categories.getAll(),
    ])
    links.value = allLinks
    categories.value = allCats
  } catch {} finally {
    loading.value = false
  }
}

function openAdd() {
  editingLink.value = null
  form.value = { title: '', url: '', category_id: '', icon: '', description: '', sort_order: 10 }
  showForm.value = true
}

function openEdit(link: Link) {
  editingLink.value = link
  form.value = {
    title: link.title,
    url: link.url,
    category_id: link.category_id,
    icon: link.icon || '',
    description: link.description || '',
    sort_order: link.sort_order,
  }
  showForm.value = true
}

async function saveLink() {
  saving.value = true
  try {
    if (editingLink.value) {
      await services.links.update(editingLink.value.id, {
        title: form.value.title,
        url: form.value.url,
        category_id: form.value.category_id,
        icon: form.value.icon || null,
        description: form.value.description || null,
        sort_order: form.value.sort_order,
      })
    } else {
      await services.links.create({
        title: form.value.title,
        url: form.value.url,
        category_id: form.value.category_id,
        icon: form.value.icon || null,
        description: form.value.description || null,
        sort_order: form.value.sort_order,
      })
    }
    showForm.value = false
    await loadData()
  } catch {} finally {
    saving.value = false
  }
}

function confirmDelete(link: Link) {
  deleteTarget.value = link
  showDeleteConfirm.value = true
}

async function doDelete() {
  if (!deleteTarget.value) return
  await services.links.remove(deleteTarget.value.id)
  showDeleteConfirm.value = false
  deleteTarget.value = null
  await loadData()
}

async function handleBatchAdd() {
  if (!batchText.value.trim()) return
  batchSaving.value = true
  const lines = batchText.value.trim().split('\n').filter(l => l.trim())
  for (const line of lines) {
    const parts = line.split('|').map(p => p.trim())
    if (parts.length >= 3) {
      try {
        await services.links.create({
          title: parts[0],
          url: parts[1],
          category_id: parts[2],
        })
      } catch {}
    }
  }
  batchText.value = ''
  showBatchAdd.value = false
  batchSaving.value = false
  await loadData()
}

async function checkDeadLinks() {
  checking.value = true
  try {
    const results = await services.links.checkDeadLinks()
    const deadCount = results.filter(r => r.status === 0 || r.status >= 400).length
    alert(`检测完成：共 ${results.length} 个链接，${deadCount} 个可能失效`)
  } catch {} finally {
    checking.value = false
  }
}

onMounted(loadData)
</script>
