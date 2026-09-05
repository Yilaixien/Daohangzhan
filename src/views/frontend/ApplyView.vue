<template>
  <FrontendLayout>
    <div class="max-w-lg mx-auto px-4 py-8">
      <div class="glass p-6 sm:p-8">
        <h2 class="text-xl font-bold glass-text mb-6 text-center">申请收录</h2>

        <!-- 收录已关闭 -->
        <div v-if="applyStatus === 2" class="text-center py-8">
          <div class="text-4xl mb-3">🔒</div>
          <p class="text-lg glass-text-soft">网站已关闭收录</p>
          <p class="text-sm glass-text-faint mt-2">感谢您的关注</p>
          <router-link to="/" class="inline-block mt-4 glass-link text-sm">
            返回首页
          </router-link>
        </div>

        <!-- 收录公告 -->
        <div v-if="applyStatus !== 2 && applyNotice" class="mb-6">
          <div class="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800" v-html="applyNotice"></div>
        </div>

        <!-- 申请表单 -->
        <form v-if="applyStatus !== 2" @submit.prevent="handleSubmit" class="space-y-4">
          <!-- URL -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              URL链接地址 <span class="text-red-500">*</span>
            </label>
            <div class="flex gap-2">
              <input
                v-model="form.url"
                type="url"
                required
                placeholder="https://example.com"
                class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                @blur="autoFetch"
              />
              <button
                type="button"
                @click="autoFetch"
                :disabled="fetching"
                class="px-3 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {{ fetching ? '获取中...' : '自动获取' }}
              </button>
            </div>
          </div>

          <!-- 分组 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              选择分组 <span class="text-red-500">*</span>
            </label>
            <select
              v-model="form.category_id"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-white"
            >
              <option value="">请选择分组</option>
              <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                {{ cat.name }}
              </option>
            </select>
          </div>

          <!-- 网站名称 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              网站名称 <span class="text-red-500">*</span>
            </label>
            <input
              v-model="form.name"
              type="text"
              required
              placeholder="填写网站名称"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            />
          </div>

          <!-- 网站图标 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              网站图标
            </label>
            <div class="flex items-center gap-3">
              <input
                v-model="form.icon"
                type="text"
                placeholder="填写图标URL，或自动获取"
                class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              />
              <div v-if="form.icon" class="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-gray-50 rounded-lg border">
                <img
                  :src="form.icon"
                  alt="预览"
                  class="w-8 h-8 object-contain"
                  @error="($event.target as HTMLImageElement).style.display='none'"
                />
              </div>
            </div>
          </div>

          <!-- 描述 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              网站描述
            </label>
            <textarea
              v-model="form.description"
              rows="2"
              placeholder="简单描述网站内容（可选）"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm resize-none"
            ></textarea>
          </div>

          <!-- 验证码 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              验证码 <span class="text-red-500">*</span>
            </label>
            <div class="flex gap-2">
              <input
                v-model="form.captcha"
                type="text"
                required
                maxlength="4"
                placeholder="请输入验证码"
                class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              />
              <button
                type="button"
                @click="refreshCaptcha"
                class="px-2 py-1 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex-shrink-0"
                title="刷新验证码"
              >
                <span class="text-lg font-bold text-gray-600 tracking-wider select-none leading-none">{{ captchaCode }}</span>
              </button>
            </div>
          </div>

          <!-- 错误提示 -->
          <div v-if="errorMsg" class="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
            {{ errorMsg }}
          </div>

          <!-- 成功提示 -->
          <div v-if="successMsg" class="text-sm text-green-600 bg-green-50 px-3 py-2 rounded">
            {{ successMsg }}
          </div>

          <!-- 提交 -->
          <button
            type="submit"
            :disabled="submitting"
            class="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {{ submitting ? '提交中...' : '提交申请' }}
          </button>
        </form>
      </div>
    </div>
  </FrontendLayout>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { services } from '@/services'
import type { Category } from '@/services/contracts'
import FrontendLayout from './FrontendLayout.vue'

const applyStatus = ref(0) // 0=关闭, 1=审核模式, 2=关闭
const applyNotice = ref('')
const categories = ref<Category[]>([])
const fetching = ref(false)
// 自动获取 API 地址（来自站点配置，留空回退默认值）
const fetchTitleApi = ref('https://lianjie.hjke.cn/api/title?url={url}')
const fetchIconApi = ref('https://a.favicon.im/{hostname}')
const submitting = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

const form = reactive({
  url: '',
  category_id: '',
  name: '',
  icon: '',
  description: '',
  captcha: '',
})

const captchaCode = ref('')
const captchaAnswer = ref('')

function generateCaptcha() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  captchaCode.value = code
  captchaAnswer.value = code
}

function refreshCaptcha() {
  generateCaptcha()
  form.captcha = ''
}

onMounted(async () => {
  try {
    // 公开只读快照（边缘函数，命中零回源 Neon）：config + categories 一次取回
    const data = await services.frontendData.getAll()
    const config = data.config
    const applyVal = parseInt(config.apply || '0')
    applyStatus.value = applyVal
    applyNotice.value = config.apply_gg || ''
    if (config.fetch_title_api) fetchTitleApi.value = config.fetch_title_api
    if (config.fetch_icon_api) fetchIconApi.value = config.fetch_icon_api
    categories.value = data.categories
  } catch {}

  generateCaptcha()
})

async function autoFetch() {
  if (!form.url || fetching.value) return
  fetching.value = true
  try {
    const raw = form.url.startsWith('http') ? form.url : `https://${form.url}`
    let hostname = ''
    try {
      hostname = new URL(raw).hostname
    } catch {
      errorMsg.value = 'URL格式不正确'
      return
    }
    if (!form.url.startsWith('http')) {
      form.url = raw
    }

    // 图标：站点配置的 API 模板，纯前端拼 URL 直接填充
    form.icon = fetchIconApi.value
      .replace(/\{hostname\}/g, hostname)
      .replace(/\{url\}/g, encodeURIComponent(raw))

    // 名称：请求站点配置的名称 API（名称已填时跳过）
    if (!form.name) {
      try {
        const apiUrl = fetchTitleApi.value
          .replace(/\{url\}/g, encodeURIComponent(raw))
          .replace(/\{hostname\}/g, hostname)
        const resp = await fetch(apiUrl)
        if (resp.ok) {
          const json = await resp.json()
          const name = json?.data?.title ?? json?.title ?? json?.name
          if (name) form.name = String(name).trim()
        }
      } catch {
        // 名称获取失败静默处理，由用户手填
      }
    }
  } catch {
    errorMsg.value = 'URL格式不正确'
  } finally {
    fetching.value = false
  }
}

async function handleSubmit() {
  errorMsg.value = ''
  successMsg.value = ''

  // 验证码校验
  if (form.captcha.toUpperCase() !== captchaAnswer.value) {
    errorMsg.value = '验证码错误，请重新输入'
    refreshCaptcha()
    return
  }

  if (!form.url || !form.category_id || !form.name) {
    errorMsg.value = '请填写必填字段'
    return
  }

  submitting.value = true
  try {
    await services.apply.create({
      name: form.name,
      url: form.url,
      category_id: form.category_id,
      icon: form.icon || null,
      description: form.description || null,
    })
    successMsg.value = '提交成功！请等待管理员审核。'
    // 重置表单
    form.url = ''
    form.category_id = ''
    form.name = ''
    form.icon = ''
    form.description = ''
    form.captcha = ''
    refreshCaptcha()
  } catch (e: any) {
    errorMsg.value = e.message || '提交失败，请稍后再试'
  } finally {
    submitting.value = false
  }
}
</script>