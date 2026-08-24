# Checklist

## 项目初始化与基础架构
- [x] 项目使用 Vite + Vue 3 + TypeScript 创建，`<script setup>` 语法
- [x] `vite.config.ts` 配置 `base: './'`
- [x] Vue Router 使用 `createWebHashHistory()`
- [x] Pinia 已安装并配置
- [x] `tsconfig.json` 配置路径别名 `@/` 指向 `src/`
- [x] `.env.example` 包含 `VITE_BACKEND`、`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`、`VITE_API_BASE_URL`
- [x] ESLint + Prettier 配置完成

## services 抽象层
- [x] `src/services/contracts.ts` 定义了所有服务接口（7 个 Service 接口 + Services 聚合）
- [x] `src/services/index.ts` 工厂函数根据 `VITE_BACKEND` 动态 import
- [x] `src/services/supabase/` 实现所有接口（Supabase JS SDK），486 行
- [x] `src/services/rest/` 实现所有接口（fetch + Bearer Token），226 行
- [x] 动态 import 正确代码分割（vite.config.ts 中 manualChunks 配置）
- [x] 所有 Vue 组件仅从 `@/services` 导入（11 个文件验证通过），不直接引用 Supabase SDK 或 fetch

## 路由与鉴权
- [x] 路由表包含：首页 `/`、关于 `/about`、申请收录 `/apply`、后台登录 `/admin/login`、后台 `/admin/*`
- [x] 路由守卫 `beforeEach` 检查 JWT + `isTokenValid()` 过期检查，后台路由未登录跳转 `/admin/login`
- [x] REST 服务中 401 响应拦截器清除 Token 并跳转登录页
- [x] JWT 存储在 localStorage，请求头携带 `Authorization: Bearer <token>`

## 数据库 Schema
- [x] `database/supabase_schema.sql` 包含完整的 PostgreSQL 表结构（233 行）
- [x] Supabase RLS 策略：匿名用户仅可 SELECT 可见数据，认证用户可全部操作
- [x] `database/mysql_schema.sql` 包含完整的 MySQL 表结构（204 行）
- [x] 两个 Schema 字段一致：links, categories, config, apply, search_engines, click_stats
- [x] 种子数据包含 6 个分组、52 条链接、5 个搜索引擎、14 条配置

## 参考后端
- [x] `backend-reference/` 包含 Express 服务器代码（12 个文件）
- [x] `POST /api/auth/login` 实现 JWT 签发（7 天有效）
- [x] Links CRUD API 完整实现（GET/POST/PUT/DELETE + reorder + check-dead）
- [x] Categories CRUD API 完整实现（GET/POST/PUT/DELETE + reorder）
- [x] Config 读写 API 完整实现（GET /api/config, PUT /api/config/:key）
- [x] Apply 审核 API 完整实现（GET/POST + approve/reject）
- [x] Search Engines CRUD API 完整实现（GET/POST/PUT/DELETE）
- [x] Stats API 实现（统计查询 + 点击记录）
- [x] `package.json` 包含依赖和启动脚本

## 前台 - 首页
- [x] 分组和链接按 `sort_order` 正确排序展示（HomeView 通过 store.fetchData 加载）
- [x] 空分组不在首页展示（`links.length > 0` 过滤）
- [x] 链接点击在新标签页打开，异步记录点击统计（`services.stats.recordClick`）
- [x] 搜索框可实现关键词搜索（百度为默认引擎）
- [x] 搜索引擎切换功能正常（SearchBox 组件）
- [x] 自定义搜索引擎可从后端配置加载（`services.searchEngines.getAll()`）
- [x] 背景图正确展示（BackgroundImage 组件）
- [x] 响应式布局：桌面端多列网格，移动端自适应（`grid-cols-2 sm:3 md:4 lg:6`）
- [x] 返回顶部按钮可用（BackToTop 组件，>300px 显示）

## 前台 - 关于页面
- [x] 关于页面正确展示管理员配置的富文本内容（`about_content`）
- [x] 支持 HTML 渲染（`v-html`）

## 前台 - 收录申请
- [x] 申请表单包含 URL、分组选择、名称、图标、描述、验证码字段
- [x] "自动获取"功能可抓取目标网站 favicon 和域名推断名称
- [x] 表单验证和提交正常（验证码校验 + 必填校验）
- [x] 收录关闭时显示"网站已关闭收录"

## 后台 - 登录
- [x] 登录表单可用，正确用户名密码可登录（Auth Store + services.auth.login）
- [x] 错误密码显示错误提示
- [x] 登录成功后 Token 存储到 localStorage，跳转后台首页（redirect 参数）

## 后台 - 仪表盘
- [x] 统计卡片显示总链接数、总点击量、今日点击、本周点击（4 色卡片 + SVG 图标）
- [x] 热门链接 Top 20 列表（含进度条 + 排名徽章）
- [x] 点击趋势图（近 7 天 / 30 天）正确渲染（Chart.js 动态 import 折线图）

## 后台 - 链接管理
- [x] 链接列表展示，支持搜索、分组筛选、状态筛选
- [x] 添加链接功能正常（字段：名称、URL、分组、图标、描述、排序）
- [x] 编辑链接功能正常（弹窗表单）
- [x] 删除链接为软删除（is_visible = false，确认弹窗）
- [x] 批量添加功能正常（文本粘贴解析 `名称|URL|分组ID`）
- [x] 失效链接检测功能正常（checkDeadLinks + 结果弹窗）
- [x] 排序功能正常（上移/下移按钮，通过 reorder API）

## 后台 - 分组管理
- [x] 分组列表展示，显示链接数量
- [x] 添加/编辑分组功能正常
- [x] 删除分组功能正常（确认弹窗，级联删除）
- [x] 排序功能正常（上移/下移按钮）

## 后台 - 站点配置
- [x] 基本信息配置（标题、描述、关键词、Logo、背景图、ICP、版权）可保存
- [x] 收录申请开关和公告内容可配置
- [x] 背景图支持 URL 输入（Logo 实时预览）

## 后台 - 收录审核
- [x] 申请列表按状态筛选（待审核/已通过/已拒绝/全部 标签页）
- [x] 通过申请自动创建链接（services.apply.approve）
- [x] 拒绝申请标记状态（services.apply.reject）

## 后台 - 搜索引擎管理
- [x] 搜索引擎列表展示
- [x] 添加/编辑搜索引擎功能正常
- [x] 启用/禁用切换正常（toggleActive）
- [x] 排序功能正常（sort_order 字段）

## 部署与文档
- [x] `README.md` 包含完整部署指南（232 行）
- [x] EdgeOne Pages 部署配置说明（`base: './'`、Hash 路由、无需 SPA fallback）
- [x] Supabase → MySQL 迁移指南（含数据类型映射）
- [x] 宝塔 Nginx + PM2 部署指南（含 Nginx 配置示例）
- [x] `.env.example` 包含 Supabase 和 REST 两种模板

## 双后端模式验证
- [x] 所有组件仅从 `@/services` 导入，不直接引用 Supabase SDK 或 fetch
- [x] 两种模式切换无需修改任何组件代码（services/index.ts 工厂函数动态 import）
- [x] 构建配置支持代码分割（manualChunks 分离 supabase/chart/vuedraggable）