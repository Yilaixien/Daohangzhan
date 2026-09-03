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
            <label class="block text-sm font-medium text-gray-700 mb-1">URL *</label>
            <div class="flex gap-2">
              <input v-model="form.url" type="url" required class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" @blur="autoFetch()" />
              <button type="button" @click="autoFetch(true)" :disabled="fetching" class="px-3 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors whitespace-nowrap">
                {{ fetching ? '获取中...' : '自动获取' }}
              </button>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">名称 *</label>
            <input v-model="form.title" type="text" required placeholder="输入链接后自动获取" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            <p v-if="fetching" class="text-xs text-gray-400 mt-1">正在获取名称...</p>
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
        <textarea v-model="batchText" rows="6" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="百度 | https://www.baidu.com | 1"></textarea>
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

    <!-- 死链检测结果弹窗 -->
    <div v-if="showCheckResult" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="showCheckResult = false">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold text-gray-800">死链检测结果</h3>
            <p class="text-sm text-gray-500 mt-1">共 {{ checkResults.length }} 个链接，<span :class="deadCount > 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'">{{ deadCount }}</span> 个可能失效</p>
          </div>
          <button @click="showCheckResult = false" class="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <div class="flex-1 overflow-y-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b sticky top-0">
              <tr>
                <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">名称</th>
                <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">URL</th>
                <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">状态</th>
                <th class="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="entry in checkResults" :key="entry.link.id" class="hover:bg-gray-50 transition-colors">
                <td class="px-4 py-3 text-gray-700 font-medium">{{ entry.link.title }}</td>
                <td class="px-4 py-3 hidden sm:table-cell">
                  <a :href="entry.link.url" target="_blank" class="text-blue-600 hover:underline truncate max-w-[220px] block">{{ entry.link.url }}</a>
                </td>
                <td class="px-4 py-3">
                  <span v-if="entry.status === 0" class="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded">无法访问</span>
                  <span v-else-if="entry.status >= 400" class="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded">失效({{ entry.status }})</span>
                  <span v-else class="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded">存活({{ entry.status }})</span>
                </td>
                <td class="px-4 py-3 text-right whitespace-nowrap">
                  <template v-if="isDeadStatus(entry.status)">
                    <button @click="hideDeadLink(entry)" :disabled="checkSaving" class="px-2 py-1 text-xs text-amber-700 bg-amber-100 hover:bg-amber-200 rounded disabled:opacity-50">隐藏</button>
                    <button @click="confirmDelete(entry.link)" :disabled="checkSaving" class="ml-2 px-2 py-1 text-xs text-red-700 bg-red-100 hover:bg-red-200 rounded disabled:opacity-50">删除</button>
                  </template>
                  <span v-else class="text-xs text-gray-400">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50">
          <button v-if="deadCount > 0" @click="hideAllDead" :disabled="checkSaving" class="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
            {{ checkSaving ? '处理中...' : '一键隐藏全部失效' }}
          </button>
          <button @click="showCheckResult = false" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { services } from '@/services'
import type { Link, Category } from '@/services/contracts'

// 自动获取名称/图标的默认 API（可在「站点配置 → 抓取设置」中单独覆盖）
const DEFAULT_FETCH_NAME_API = 'https://lianjie.hjke.cn/api/title?url={url}'
const DEFAULT_FETCH_ICON_API = 'https://a.favicon.im/{hostname}'
const fetchNameApi = ref(DEFAULT_FETCH_NAME_API)
const fetchIconApi = ref(DEFAULT_FETCH_ICON_API)

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
const fetching = ref(false) // 添加链接时自动获取名称/图标中

// 死链检测结果弹窗
const showCheckResult = ref(false)
const checkSaving = ref(false)
const checkResults = ref<{ link: Link; status: number }[]>([])

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
    const [allLinks, allCats, allConfig] = await Promise.all([
      services.links.getAll(),
      services.categories.getAll(),
      services.config.getAll(),
    ])
    links.value = allLinks
    categories.value = allCats
    // 抓取 API 地址来自站点配置（未配置时使用默认值）
    if (allConfig.fetch_name_api) fetchNameApi.value = allConfig.fetch_name_api
    if (allConfig.fetch_icon_api) fetchIconApi.value = allConfig.fetch_icon_api
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

// 渲染抓取 API 的 URL 模板：{url}（完整链接，自动编码）与 {hostname}（域名）占位符；
// 模板无占位符时视为接口根地址，自动追加 ?url= 参数。
function resolveFetchUrl(template: string, rawUrl: string, hostname: string): string {
  const tpl = template || ''
  if (tpl.includes('{url}') || tpl.includes('{hostname}')) {
    return tpl
      .replace(/\{url\}/g, encodeURIComponent(rawUrl))
      .replace(/\{hostname\}/g, hostname)
  }
  const sep = tpl.includes('?') ? '&' : '?'
  return `${tpl}${sep}url=${encodeURIComponent(rawUrl)}`
}

// 宽容解析接口返回：名称取 data.title ?? title ?? name；图标取 data.icon ?? icon
function pickTitle(json: any): string | undefined {
  const v = json?.data?.title ?? json?.title ?? json?.name
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}
function pickIcon(json: any): string | undefined {
  const v = json?.data?.icon ?? json?.icon
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

// 输入链接后自动获取名称与图标（仅添加模式生效；force 为 true 时强制覆盖已填名称）
async function autoFetch(force = false) {
  if (editingLink.value || fetching.value) return
  let raw = form.value.url.trim()
  if (!raw) return
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
    raw = 'https://' + raw
    form.value.url = raw
  }
  let hostname = ''
  try {
    hostname = new URL(raw).hostname
  } catch {
    return // URL 非法时静默放弃
  }

  // 1. 图标：占位符模板直接拼串立即填充（无需网络）；否则视为 JSON 接口请求解析，失败回退默认模板
  const iconTpl = fetchIconApi.value || DEFAULT_FETCH_ICON_API
  if (iconTpl.includes('{url}') || iconTpl.includes('{hostname}')) {
    form.value.icon = iconTpl
      .replace(/\{url\}/g, encodeURIComponent(raw))
      .replace(/\{hostname\}/g, hostname)
  } else {
    fetching.value = true
    try {
      const resp = await fetch(resolveFetchUrl(iconTpl, raw, hostname))
      if (resp.ok) {
        const iconUrl = pickIcon(await resp.json())
        if (iconUrl) form.value.icon = iconUrl
      }
    } catch {
      // 图标接口失败不中断，走默认模板兜底
    }
    if (!form.value.icon) {
      form.value.icon = DEFAULT_FETCH_ICON_API.replace(/\{hostname\}/g, hostname)
    }
  }

  fetching.value = true
  try {
    // 2. 请求名称 API（站点可配置）获取名称
    const nameTpl = fetchNameApi.value || DEFAULT_FETCH_NAME_API
    const resp = await fetch(resolveFetchUrl(nameTpl, raw, hostname))
    if (!resp.ok) throw new Error('request failed')
    const json = await resp.json()
    const name = pickTitle(json)
    if (name && (!form.value.title || force)) {
      form.value.title = name
    }
  } catch {
    // 获取失败静默处理：名称留空由用户手填，不影响保存
  } finally {
    fetching.value = false
  }
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
  const targetId = String(deleteTarget.value.id)
  await services.links.remove(deleteTarget.value.id)
  showDeleteConfirm.value = false
  deleteTarget.value = null
  checkResults.value = checkResults.value.filter(e => String(e.link.id) !== targetId)
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

function isDeadStatus(status: number): boolean {
  return status === 0 || status >= 400
}

const deadCount = computed(() => checkResults.value.filter(e => isDeadStatus(e.status)).length)

async function checkDeadLinks() {
  checking.value = true
  try {
    const results = await services.links.checkDeadLinks()
    const statusByLink = new Map(results.map(r => [String(r.id), r.status]))
    checkResults.value = links.value
      .filter(l => statusByLink.has(String(l.id)))
      .map(l => ({ link: l, status: statusByLink.get(String(l.id))! }))
    showCheckResult.value = true
  } catch {} finally {
    checking.value = false
  }
}

async function hideDeadLink(entry: { link: Link; status: number }) {
  checkSaving.value = true
  try {
    await services.links.update(entry.link.id, { is_visible: false })
    checkResults.value = checkResults.value.filter(e => String(e.link.id) !== String(entry.link.id))
    await loadData()
  } catch {} finally {
    checkSaving.value = false
  }
}

async function hideAllDead() {
  checkSaving.value = true
  const dead = checkResults.value.filter(e => isDeadStatus(e.status))
  try {
    await Promise.all(dead.map(e => services.links.update(e.link.id, { is_visible: false }).catch(() => {})))
    checkResults.value = checkResults.value.filter(e => !isDeadStatus(e.status))
    await loadData()
  } finally {
    checkSaving.value = false
  }
}

onMounted(loadData)
</script>
