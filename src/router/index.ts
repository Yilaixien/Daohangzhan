import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/frontend/HomeView.vue'),
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('@/views/frontend/AboutView.vue'),
  },
  {
    path: '/apply',
    name: 'apply',
    component: () => import('@/views/frontend/ApplyView.vue'),
  },
  {
    path: '/admin/login',
    name: 'admin-login',
    component: () => import('@/views/admin/LoginView.vue'),
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('@/views/admin/AdminLayout.vue'),
    redirect: '/admin/dashboard',
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'admin-dashboard',
        component: () => import('@/views/admin/DashboardView.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'links',
        name: 'admin-links',
        component: () => import('@/views/admin/LinksView.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'categories',
        name: 'admin-categories',
        component: () => import('@/views/admin/CategoriesView.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'config',
        name: 'admin-config',
        component: () => import('@/views/admin/ConfigView.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'apply',
        name: 'admin-apply',
        component: () => import('@/views/admin/ApplyManageView.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'search-engines',
        name: 'admin-search-engines',
        component: () => import('@/views/admin/SearchEnginesView.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'theme',
        name: 'admin-theme',
        component: () => import('@/views/admin/ThemeManageView.vue'),
        meta: { requiresAuth: true },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/frontend/NotFoundView.vue'),
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

// 检查 JWT 是否有效
function isTokenValid(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    const now = Math.floor(Date.now() / 1000)
    return payload.exp > now
  } catch {
    return false
  }
}

// 路由守卫：检查后台页面是否需要登录
router.beforeEach((to, _from, next) => {
  if (to.matched.some((record) => record.meta.requiresAuth)) {
    const token = localStorage.getItem('auth_token')
    if (!token || !isTokenValid(token)) {
      if (token) {
        localStorage.removeItem('auth_token')
      }
      next({ name: 'admin-login', query: { redirect: to.fullPath } })
      return
    }
  }
  next()
})

export default router