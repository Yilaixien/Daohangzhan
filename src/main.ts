import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import { useThemeStore } from './stores/theme'
import { detectLowEnd } from './utils/device'
import './style.css'

// 低配置环境（核数≤4 或内存≤4GB）：静态降级毛玻璃，缓解 PC 低配滚动卡顿
if (detectLowEnd()) {
  document.documentElement.setAttribute('data-low-end', 'true')
}

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

// 挂载前同步应用主题，避免闪白
useThemeStore(pinia).init()

app.mount('#app')