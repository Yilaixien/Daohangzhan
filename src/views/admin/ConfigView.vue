<template>
  <div>
    <h2 class="text-xl font-semibold text-gray-800 mb-6">站点配置</h2>

    <div v-if="loading" class="bg-white rounded-lg shadow-sm p-8 animate-pulse">
      <div class="h-4 bg-gray-200 rounded w-32 mb-4"></div>
      <div class="space-y-3">
        <div class="h-10 bg-gray-200 rounded"></div>
        <div class="h-10 bg-gray-200 rounded"></div>
        <div class="h-10 bg-gray-200 rounded"></div>
      </div>
    </div>

    <form v-else @submit.prevent="saveAll" class="space-y-6">
      <!-- 基本信息 -->
      <div class="bg-white rounded-lg shadow-sm p-6">
        <h3 class="text-lg font-semibold text-gray-700 mb-4 pb-2 border-b">基本信息</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">网站标题</label>
            <input v-model="config.title" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">首页标题 (HTML)</label>
            <input v-model="config['home-title']" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">网站描述</label>
            <input v-model="config.description" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">关键字</label>
            <input v-model="config.keywords" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
            <div class="flex items-center gap-2">
              <input v-model="config.logo" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              <img v-if="config.logo" :src="config.logo" class="w-8 h-8 rounded object-contain" @error="($event.target as HTMLImageElement).style.display='none'" />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">背景图 URL</label>
            <input v-model="config.background" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">ICP备案号</label>
            <input v-model="config.icp" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="京ICP备XXXXXXXX号" />
          </div>
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">版权信息 (HTML)</label>
            <input v-model="config.copyright" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </div>

      <!-- 收录设置 -->
      <div class="bg-white rounded-lg shadow-sm p-6">
        <h3 class="text-lg font-semibold text-gray-700 mb-4 pb-2 border-b">收录设置</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">收录开关</label>
            <select v-model="config.apply" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500">
              <option value="0">关闭</option>
              <option value="1">审核模式</option>
              <option value="2">关闭收录</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">收录公告 (HTML)</label>
            <textarea v-model="config.apply_gg" rows="4" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"></textarea>
          </div>
        </div>
      </div>

      <!-- 关于页面 -->
      <div class="bg-white rounded-lg shadow-sm p-6">
        <h3 class="text-lg font-semibold text-gray-700 mb-4 pb-2 border-b">关于页面</h3>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">关于页面内容 (HTML)</label>
          <textarea v-model="config.about_content" rows="6" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"></textarea>
        </div>
      </div>

      <!-- 管理员 -->
      <div class="bg-white rounded-lg shadow-sm p-6">
        <h3 class="text-lg font-semibold text-gray-700 mb-4 pb-2 border-b">管理员设置</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">管理员账号</label>
            <input v-model="config.admin_user" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">管理员密码</label>
            <input v-model="config.admin_pwd" type="password" placeholder="留空则不修改" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </div>

      <!-- 保存 -->
      <div class="flex justify-end">
        <button type="submit" :disabled="saving" class="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {{ saving ? '保存中...' : '保存配置' }}
        </button>
      </div>

      <!-- 提示 -->
      <div v-if="savedMsg" class="fixed bottom-6 right-6 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
        {{ savedMsg }}
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { services } from '@/services'

const loading = ref(true)
const saving = ref(false)
const savedMsg = ref('')

const config = reactive<Record<string, string>>({
  title: '',
  'home-title': '',
  description: '',
  keywords: '',
  logo: '',
  background: '',
  icp: '',
  copyright: '',
  apply: '1',
  apply_gg: '',
  about_content: '',
  admin_user: 'admin',
  admin_pwd: '',
  template: 'default',
})

const configKeys = Object.keys(config)

onMounted(async () => {
  try {
    const all = await services.config.getAll()
    for (const key of configKeys) {
      if (all[key] !== undefined) {
        config[key] = all[key]
      }
    }
  } catch {} finally {
    loading.value = false
  }
})

async function saveAll() {
  saving.value = true
  try {
    for (const key of configKeys) {
      await services.config.set(key, config[key])
    }
    savedMsg.value = '配置已保存'
    setTimeout(() => { savedMsg.value = '' }, 2000)
  } catch {} finally {
    saving.value = false
  }
}
</script>