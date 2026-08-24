# Tasks

## Phase 1: 项目初始化与基础架构

- [x] Task 1: 项目脚手架搭建
  - [ ] 使用 Vite 创建 Vue 3 + TypeScript 项目
  - [ ] 安装 Pinia、Vue Router、Axios 等核心依赖
  - [ ] 配置 TypeScript 严格模式、路径别名 `@/`
  - [ ] 配置 Vite `base: './'`、Hash 路由模式
  - [ ] 配置 ESLint + Prettier
  - [ ] 创建 `.env.example` 模板文件（Supabase 和 REST 两种模式）

- [x] Task 2: services 抽象层实现
  - [ ] 创建 `src/services/contracts.js` — 统一接口定义（ILinkService, ICategoryService, IConfigService, IApplyService, IAuthService, ISearchEngineService, IStatsService）
  - [ ] 创建 `src/services/index.js` — 工厂函数，根据 `VITE_BACKEND` 动态 import 对应实现
  - [ ] 创建 `src/services/supabase/` — Supabase JS SDK 实现（links, categories, config, apply, auth, search_engines, stats）
  - [ ] 创建 `src/services/rest/` — REST fetch 实现（同上接口）
  - [ ] 确保所有动态 import 正确代码分割

- [x] Task 3: 路由与布局框架
  - [ ] 配置 Vue Router 路由表（首页、关于、申请收录、后台登录、后台布局 + 子路由）
  - [ ] 实现路由守卫（`beforeEach` 检查 JWT，后台路由未登录跳转登录页）
  - [ ] 创建前台布局组件（Header + 主内容 + Footer）
  - [ ] 创建后台布局组件（侧边栏 + 顶栏 + 内容区）
  - [ ] 实现 401 拦截器（Token 过期清除并跳转登录）

## Phase 2: 数据库与后端

- [x] Task 4: 数据库 Schema 设计
  - [ ] 编写 `database/supabase_schema.sql`（PostgreSQL：links, categories, config, apply, search_engines, click_stats + RLS 策略 + 种子数据）
  - [ ] 编写 `database/mysql_schema.sql`（MySQL：相同表结构 + 种子数据）
  - [ ] 确保两个 Schema 字段一致，类型映射正确

- [x] Task 5: Node.js 参考后端实现
  - [ ] 创建 `backend-reference/` 目录结构
  - [ ] 实现 Express 服务器基础配置（CORS、JSON 解析、JWT 中间件）
  - [ ] 实现 `POST /api/auth/login` — 管理员登录签发 JWT
  - [ ] 实现 Links CRUD API（GET/POST/PUT/DELETE `/api/links`）
  - [ ] 实现 Categories CRUD API
  - [ ] 实现 Config 读写 API（GET/PUT `/api/config`）
  - [ ] 实现 Apply 审核 API
  - [ ] 实现 Search Engines CRUD API
  - [ ] 实现 Stats API（GET `/api/stats`、POST `/api/stats/click`）
  - [ ] 编写 `package.json` 和启动说明

## Phase 3: 前台页面开发

- [x] Task 6: 首页 - 导航链接展示
  - [ ] 实现分组和链接数据加载（Pinia store）
  - [ ] 实现分类卡片布局（分组标题 + 链接网格）
  - [ ] 实现链接卡片组件（图标、名称、描述、点击跳转）
  - [ ] 实现点击统计上报（异步，不阻塞跳转）
  - [ ] 实现响应式布局（桌面多列、移动端自适应）

- [x] Task 7: 首页 - 搜索框与搜索引擎
  - [x] 实现搜索框 UI（输入框 + 搜索按钮）
  - [x] 实现搜索引擎切换（默认百度，图标列表展示）
  - [x] 实现搜索跳转（URL 模板替换关键词，新标签页打开）
  - [x] 支持自定义搜索引擎（从后端配置读取）

- [x] Task 8: 首页 - 背景与装饰
  - [ ] 实现背景图展示（支持 URL 配置）
  - [ ] 实现天气组件（可选，调用免费天气 API 或显示占位）
  - [ ] 实现时间/日期显示
  - [ ] 实现返回顶部按钮

- [x] Task 9: 关于页面
  - [x] 实现关于页面路由和组件
  - [x] 展示管理员配置的富文本内容
  - [x] 支持 HTML 渲染

- [x] Task 10: 收录申请页面
  - [ ] 实现申请表单（URL、分组选择、网站名称、图标、描述、验证码）
  - [ ] 实现"自动获取"功能（通过后端代理抓取目标网站标题和 favicon）
  - [ ] 实现表单验证和提交
  - [ ] 实现收录关闭状态展示

## Phase 4: 后台管理页面开发

- [x] Task 11: 管理员登录页
  - [ ] 实现登录表单 UI
  - [ ] 实现登录逻辑（调用 AuthService.login）
  - [ ] 实现登录成功跳转、失败提示
  - [ ] 实现 Token 持久化（localStorage）

- [x] Task 12: 后台仪表盘
  - [ ] 实现统计卡片（总链接数、总点击量、今日点击、本周点击）
  - [ ] 实现热门链接 Top 20 列表
  - [ ] 实现点击趋势图（近 7 天 / 30 天，Chart.js 动态 import）

- [x] Task 13: 链接管理
  - [x] 实现链接列表（表格展示，支持分页、搜索、分组筛选、状态筛选）
  - [x] 实现添加/编辑链接表单（弹窗）
  - [x] 实现链接删除（软删除，确认弹窗）
  - [x] 实现批量添加（文本框粘贴解析）
  - [x] 实现失效链接检测（触发检测、状态标记）

- [x] Task 14: 分组管理
  - [x] 实现分组列表（表格展示，含链接数统计）
  - [x] 实现添加/编辑分组
  - [x] 实现分组删除（含确认弹窗）
  - [x] 实现上移/下移排序

- [x] Task 15: 站点配置
  - [x] 实现站点基本信息配置（标题、描述、关键词、Logo、背景图、ICP备案、版权）
  - [x] 实现收录申请配置（开关、公告内容）
  - [x] 实现关于页面内容编辑
  - [x] 实现管理员账号密码设置

- [x] Task 16: 收录审核管理
  - [x] 实现申请列表（待审核/已通过/已拒绝/全部 筛选标签页）
  - [x] 实现审核操作（通过 → 自动创建链接，拒绝 → 标记状态）
  - [x] 实现申请详情查看（名称、URL、分组、时间、描述）

- [x] Task 17: 搜索引擎管理
  - [x] 实现搜索引擎列表
  - [x] 实现添加/编辑搜索引擎
  - [x] 实现启用/禁用切换
  - [x] 实现删除确认

## Phase 5: 收尾与交付

- [x] Task 18: 部署配置与文档
  - [x] 编写 `README.md`（项目介绍、环境变量说明、EdgeOne Pages 部署配置、Supabase→MySQL 迁移指南、宝塔 Nginx + PM2 部署指南）
  - [x] 配置 Vite 构建优化（代码分割、压缩）
  - [x] 验证 EdgeOne Pages 部署配置（`base: './'`、Hash 路由、SPA fallback）

- [x] Task 19: 最终验证
  - [x] 验证 Supabase 模式完整流程
  - [x] 验证 REST API 模式完整流程
  - [x] 验证响应式布局（桌面 + 移动端）
  - [x] 验证路由守卫和鉴权

# Task Dependencies
- Task 2 依赖 Task 1（需要项目脚手架）
- Task 3 依赖 Task 1
- Task 5 依赖 Task 4（需要先有 Schema）
- Task 6-10 依赖 Task 2, 3（需要 services 和路由）
- Task 11-17 依赖 Task 2, 3（需要 services 和路由）
- Task 12 依赖 Task 6（需要首页点击统计才能产生数据）
- Task 13 依赖 Task 14（链接管理需要分组数据）
- Task 18 依赖所有开发任务完成
- Task 19 依赖所有任务完成

# 并行执行建议
- Phase 1 中 Task 2 和 Task 3 可并行
- Phase 2 中 Task 4 和 Task 5 可并行（Schema 先确定接口规范）
- Phase 3 中 Task 6, 7, 8, 9, 10 可并行
- Phase 4 中 Task 12, 13, 14, 15, 16, 17 可并行（均依赖 services 和路由）