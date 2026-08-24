<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-semibold text-gray-800">分组管理</h2>
      <button @click="openAdd" class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
        添加分组
      </button>
    </div>

    <div class="bg-white rounded-lg shadow-sm overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase w-8">#</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">分组名称</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">排序</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">链接数</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">状态</th>
            <th class="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-if="categories.length === 0">
            <td colspan="6" class="text-center py-12 text-gray-400">暂无分组</td>
          </tr>
          <tr v-for="(cat, index) in categories" :key="cat.id" class="hover:bg-gray-50 transition-colors">
            <td class="px-4 py-3 text-sm text-gray-400">{{ index + 1 }}</td>
            <td class="px-4 py-3">
              <span class="text-sm text-gray-700 font-medium">{{ cat.name }}</span>
            </td>
            <td class="px-4 py-3">
              <span class="text-sm text-gray-500">{{ cat.sort_order }}</span>
            </td>
            <td class="px-4 py-3">
              <span class="text-sm text-gray-500">{{ cat.linkCount || 0 }}</span>
            </td>
            <td class="px-4 py-3">
              <span class="inline-flex px-2 py-0.5 text-xs rounded-full" :class="cat.is_visible ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'">
                {{ cat.is_visible ? '可见' : '隐藏' }}
              </span>
            </td>
            <td class="px-4 py-3">
              <div class="flex justify-end gap-2">
                <button @click="moveUp(index)" :disabled="index === 0" class="text-xs text-gray-500 hover:text-blue-600 disabled:opacity-30">↑</button>
                <button @click="moveDown(index)" :disabled="index === categories.length - 1" class="text-xs text-gray-500 hover:text-blue-600 disabled:opacity-30">↓</button>
                <button @click="openEdit(cat)" class="text-xs text-blue-600 hover:text-blue-800">编辑</button>
                <button @click="confirmDelete(cat)" class="text-xs text-red-600 hover:text-red-800">删除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 添加/编辑弹窗 -->
    <div v-if="showForm" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="showForm = false">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 class="text-lg font-semibold text-gray-800 mb-4">{{ editingCat ? '编辑分组' : '添加分组' }}</h3>
        <form @submit.prevent="saveCategory" class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">分组名称 *</label>
            <input v-model="form.name" type="text" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
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
        <p class="text-gray-700 mb-4">确定要删除分组「{{ deleteTarget?.name }}」吗？<br><span class="text-sm text-gray-400">关联的链接也会被删除</span></p>
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
import type { Category } from '@/services/contracts'

interface CategoryWithCount extends Category {
  linkCount?: number
}

const categories = ref<CategoryWithCount[]>([])
const saving = ref(false)
const showForm = ref(false)
const showDeleteConfirm = ref(false)
const editingCat = ref<Category | null>(null)
const deleteTarget = ref<Category | null>(null)

const form = ref({ name: '', sort_order: 10 })

async function loadData() {
  try {
    const cats = await services.categories.getAll()
    // 统计每个分组的链接数量
    const links = await services.links.getAll()
    categories.value = cats.map(cat => ({
      ...cat,
      linkCount: links.filter(l => l.category_id == cat.id).length,
    }))
  } catch {}
}

function openAdd() {
  editingCat.value = null
  form.value = { name: '', sort_order: 10 }
  showForm.value = true
}

function openEdit(cat: Category) {
  editingCat.value = cat
  form.value = { name: cat.name, sort_order: cat.sort_order }
  showForm.value = true
}

async function saveCategory() {
  saving.value = true
  try {
    if (editingCat.value) {
      await services.categories.update(editingCat.value.id, form.value)
    } else {
      await services.categories.create(form.value)
    }
    showForm.value = false
    await loadData()
  } catch {} finally {
    saving.value = false
  }
}

function confirmDelete(cat: Category) {
  deleteTarget.value = cat
  showDeleteConfirm.value = true
}

async function doDelete() {
  if (!deleteTarget.value) return
  await services.categories.remove(deleteTarget.value.id)
  showDeleteConfirm.value = false
  deleteTarget.value = null
  await loadData()
}

async function moveUp(index: number) {
  if (index === 0) return
  const a = categories.value[index - 1]
  const b = categories.value[index]
  await services.categories.reorder([
    { id: a.id, sort_order: b.sort_order },
    { id: b.id, sort_order: a.sort_order },
  ])
  await loadData()
}

async function moveDown(index: number) {
  if (index === categories.value.length - 1) return
  const a = categories.value[index]
  const b = categories.value[index + 1]
  await services.categories.reorder([
    { id: a.id, sort_order: b.sort_order },
    { id: b.id, sort_order: a.sort_order },
  ])
  await loadData()
}

onMounted(loadData)
</script>