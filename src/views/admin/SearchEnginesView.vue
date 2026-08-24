<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-semibold text-gray-800">搜索引擎管理</h2>
      <button @click="openAdd" class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
        添加引擎
      </button>
    </div>

    <div class="bg-white rounded-lg shadow-sm overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">名称</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">搜索模板</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">排序</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">状态</th>
            <th class="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-if="engines.length === 0">
            <td colspan="5" class="text-center py-12 text-gray-400">暂无搜索引擎</td>
          </tr>
          <tr v-for="e in engines" :key="e.id" class="hover:bg-gray-50 transition-colors">
            <td class="px-4 py-3">
              <div class="flex items-center gap-2">
                <img v-if="isImageIcon(e.icon)" :src="e.icon ?? undefined" class="w-5 h-5 rounded" @error="($event.target as HTMLImageElement).style.display='none'" />
                <span class="text-sm text-gray-700 font-medium">{{ e.name }}</span>
              </div>
            </td>
            <td class="px-4 py-3 hidden md:table-cell">
              <code class="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{{ e.url_template }}</code>
            </td>
            <td class="px-4 py-3">
              <span class="text-sm text-gray-500">{{ e.sort_order }}</span>
            </td>
            <td class="px-4 py-3">
              <button
                @click="toggleActive(e)"
                class="inline-flex px-2 py-0.5 text-xs rounded-full transition-colors"
                :class="e.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'"
              >
                {{ e.is_active ? '启用' : '禁用' }}
              </button>
            </td>
            <td class="px-4 py-3">
              <div class="flex justify-end gap-2">
                <button @click="openEdit(e)" class="text-xs text-blue-600 hover:text-blue-800">编辑</button>
                <button @click="confirmDelete(e)" class="text-xs text-red-600 hover:text-red-800">删除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 添加/编辑弹窗 -->
    <div v-if="showForm" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="showForm = false">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 class="text-lg font-semibold text-gray-800 mb-4">{{ editingEngine ? '编辑引擎' : '添加引擎' }}</h3>
        <form @submit.prevent="saveEngine" class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">名称 *</label>
            <input v-model="form.name" type="text" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">搜索模板 *</label>
            <input v-model="form.url_template" type="text" required placeholder="https://example.com/search?q={keyword}" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            <p class="text-xs text-gray-400 mt-1">使用 <code class="bg-gray-100 px-1 rounded">{keyword}</code> 作为搜索关键词占位符</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">图标 URL</label>
            <input v-model="form.icon" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">排序值</label>
            <input v-model="form.sort_order" type="number" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" @click="showForm = false" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
            <button type="submit" :disabled="saving" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {{ saving ? '保存中...' : '保存' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- 删除确认 -->
    <div v-if="showDeleteConfirm" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="showDeleteConfirm = false">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center">
        <p class="text-gray-700 mb-4">确定要删除引擎「{{ deleteTarget?.name }}」吗？</p>
        <div class="flex justify-center gap-2">
          <button @click="showDeleteConfirm = false" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
          <button @click="doDelete" class="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">确认删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { services } from '@/services'
import type { SearchEngine } from '@/services/contracts'

const engines = ref<SearchEngine[]>([])
const saving = ref(false)
const showForm = ref(false)
const showDeleteConfirm = ref(false)
const editingEngine = ref<SearchEngine | null>(null)
const deleteTarget = ref<SearchEngine | null>(null)

const form = ref({
  name: '',
  url_template: '',
  icon: '',
  sort_order: 10,
})

function isImageIcon(icon: string | null): boolean {
  if (!icon) return false
  return icon.startsWith('http://') || icon.startsWith('https://')
}

async function loadData() {
  try {
    engines.value = await services.searchEngines.getAll()
  } catch {}
}

function openAdd() {
  editingEngine.value = null
  form.value = { name: '', url_template: '', icon: '', sort_order: 10 }
  showForm.value = true
}

function openEdit(engine: SearchEngine) {
  editingEngine.value = engine
  form.value = {
    name: engine.name,
    url_template: engine.url_template,
    icon: engine.icon || '',
    sort_order: engine.sort_order,
  }
  showForm.value = true
}

async function saveEngine() {
  saving.value = true
  try {
    if (editingEngine.value) {
      await services.searchEngines.update(editingEngine.value.id, form.value)
    } else {
      await services.searchEngines.create(form.value)
    }
    showForm.value = false
    await loadData()
  } catch {} finally {
    saving.value = false
  }
}

function confirmDelete(engine: SearchEngine) {
  deleteTarget.value = engine
  showDeleteConfirm.value = true
}

async function doDelete() {
  if (!deleteTarget.value) return
  await services.searchEngines.remove(deleteTarget.value.id)
  showDeleteConfirm.value = false
  deleteTarget.value = null
  await loadData()
}

async function toggleActive(engine: SearchEngine) {
  await services.searchEngines.update(engine.id, {
    name: engine.name,
    url_template: engine.url_template,
    icon: engine.icon || null,
    sort_order: engine.sort_order,
    is_active: !engine.is_active,
  })
  await loadData()
}

onMounted(loadData)
</script>
