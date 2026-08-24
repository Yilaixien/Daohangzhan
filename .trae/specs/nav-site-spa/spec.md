# 网址导航网站 Spec

## Why
基于参考网站「六零导航页」(LyLme Spage) 的核心功能，使用 Vue 3 + TypeScript 现代技术栈重构，打造一个纯前端 SPA 架构的网址导航站。支持分类链接导航、搜索引擎、后台管理、用户收录申请、数据统计和拖拽排序，通过双后端策略模式（Supabase / 自建 REST API）实现灵活部署，最终产物为静态 HTML/CSS/JS，可直接部署到 EdgeOne Pages。

## What Changes
- 使用 Vue 3 + Vite + TypeScript + Pinia + Vue Router (Hash Mode) 全新开发
- 纯前端 SPA 架构，无 SSR 框架依赖（不用 Nuxt/Next.js）
- 双后端策略模式：构建时通过 `VITE_BACKEND` 环境变量切换 Supabase 或自建 REST API
- services 抽象层：`contracts.js`（统一接口）+ `index.js`（工厂动态 import）+ `supabase/` + `rest/` 实现
- 动态 import 代码分割，组件仅从 `services/index.js` 导入
- JWT 鉴权，单管理员模式，路由守卫保护后台
- 新增拖拽排序/自定义布局功能
- 新增数据统计/访问分析功能
- 提供 PostgreSQL (Supabase) 和 MySQL 双数据库 schema
- 提供 Node.js Express 参考后端实现
- **BREAKING**: 原项目为 PHP 单体架构，本方案为纯前端 SPA + 后端 API 分离架构

## Impact
- Affected specs: 无（全新项目）
- Affected code: 全新代码库，无现有代码影响
- 交付物:
  1. 完整 Vue3 + Vite + Pinia + Router 前端代码
  2. `database/supabase_schema.sql`（PostgreSQL + RLS + 种子数据）
  3. `database/mysql_schema.sql`（MySQL + 种子数据）
  4. `backend-reference/`（Node Express + MySQL 参考后端）
  5. `README.md`（部署与配置指南）

---

## ADDED Requirements

### Requirement: 分类链接导航
系统 SHALL 在首页按分组展示网站链接，用户可点击链接直接跳转到目标网站。

#### Scenario: 首页加载分组和链接
- **WHEN** 用户访问首页
- **THEN** 系统从后端加载所有可见分组（按 `sort_order` 排序），每个分组下展示所有可见链接（按 `sort_order` 排序），每个链接显示图标、名称和描述

#### Scenario: 链接点击跳转
- **WHEN** 用户点击某个链接
- **THEN** 系统在新标签页打开目标 URL，并记录点击统计（如果启用统计功能）

#### Scenario: 空分组不展示
- **WHEN** 某个分组下没有可见链接
- **THEN** 该分组不在首页展示

---

### Requirement: 搜索引擎
系统 SHALL 在首页提供搜索框，支持内置搜索引擎和自定义搜索引擎切换。

#### Scenario: 默认搜索引擎搜索
- **WHEN** 用户在搜索框输入关键词并回车
- **THEN** 系统使用默认搜索引擎（百度）打开搜索结果页

#### Scenario: 切换搜索引擎
- **WHEN** 用户点击搜索框下方的搜索引擎图标
- **THEN** 系统切换到该搜索引擎，后续搜索使用新引擎

#### Scenario: 自定义搜索引擎
- **WHEN** 管理员在后台添加了自定义搜索引擎
- **THEN** 该搜索引擎出现在首页搜索框下方供用户选择

---

### Requirement: 后台管理 - 链接管理
系统 SHALL 提供后台管理界面，管理员可对链接进行增删改查操作。

#### Scenario: 链接列表查看
- **WHEN** 管理员登录后台并访问链接管理页
- **THEN** 系统展示所有链接列表，支持按分组筛选、按状态筛选、关键词搜索

#### Scenario: 添加链接
- **WHEN** 管理员填写链接名称、URL、选择分组、设置图标并提交
- **THEN** 系统保存链接，默认排序值为当前分组最大值 + 10，状态为可见

#### Scenario: 编辑链接
- **WHEN** 管理员修改链接的任意字段并保存
- **THEN** 系统更新链接信息，首页立即反映变更

#### Scenario: 删除链接
- **WHEN** 管理员删除某个链接
- **THEN** 系统软删除该链接（设置 `is_visible = false`），首页不再展示

#### Scenario: 批量添加链接
- **WHEN** 管理员使用批量添加功能，按格式粘贴多行链接数据
- **THEN** 系统批量解析并创建链接记录

#### Scenario: 失效链接检测
- **WHEN** 管理员触发失效链接检测
- **THEN** 系统逐个检查链接的 HTTP 状态码，标记返回 4xx/5xx 的链接

---

### Requirement: 后台管理 - 分组管理
系统 SHALL 提供分组管理功能，管理员可创建、编辑、删除、排序分组。

#### Scenario: 分组列表查看
- **WHEN** 管理员访问分组管理页
- **THEN** 系统展示所有分组，显示分组名称、链接数量、排序值、可见状态

#### Scenario: 添加分组
- **WHEN** 管理员创建新分组
- **THEN** 系统保存分组，默认排序值为当前最大值 + 10

#### Scenario: 分组排序
- **WHEN** 管理员调整分组排序值
- **THEN** 系统按新排序值重新排列分组，首页按新顺序展示

---

### Requirement: 后台管理 - 站点配置
系统 SHALL 提供站点配置界面，管理员可修改网站标题、描述、Logo、背景图、ICP备案号、版权信息等。

#### Scenario: 修改站点基本信息
- **WHEN** 管理员修改网站标题、描述、关键词并保存
- **THEN** 系统更新配置，页面 meta 标签和标题立即生效

#### Scenario: 设置背景图片
- **WHEN** 管理员上传或填写背景图片 URL
- **THEN** 系统保存背景图配置，首页展示对应背景

#### Scenario: 开启/关闭收录申请
- **WHEN** 管理员在配置中切换收录申请开关（开放/审核/关闭）
- **THEN** 系统更新收录申请状态，申请页面相应变化

#### Scenario: 修改收录公告
- **WHEN** 管理员编辑收录公告内容
- **THEN** 系统更新公告，申请页面展示最新公告

---

### Requirement: 用户收录申请
系统 SHALL 提供公开的收录申请页面，用户可提交网站链接供管理员审核。

#### Scenario: 提交收录申请
- **WHEN** 用户在申请页面填写 URL、选择分组、填写网站名称和图标，完成验证码并提交
- **THEN** 系统保存申请记录，状态为待审核

#### Scenario: 自动获取网站信息
- **WHEN** 用户在申请页面输入 URL 后点击"自动获取"
- **THEN** 系统抓取目标网站的标题和图标（favicon），自动填充表单

#### Scenario: 收录已关闭
- **WHEN** 管理员关闭了收录功能
- **THEN** 申请页面显示"网站已关闭收录"

#### Scenario: 审核收录申请
- **WHEN** 管理员在后台审核申请（通过/拒绝）
- **THEN** 通过的申请自动创建为链接，拒绝的申请标记为已拒绝

---

### Requirement: 管理员登录鉴权
系统 SHALL 提供管理员登录功能，使用 JWT 进行身份验证，路由守卫保护后台页面。

#### Scenario: 管理员登录
- **WHEN** 用户在后台登录页输入正确的用户名和密码
- **THEN** 后端返回 JWT Token，前端存储到 localStorage，跳转到后台首页

#### Scenario: 登录失败
- **WHEN** 用户输入错误的用户名或密码
- **THEN** 系统显示错误提示，不跳转

#### Scenario: 未登录访问后台
- **WHEN** 未登录用户直接访问 `/#/admin` 或任何后台子路由
- **THEN** 路由守卫拦截请求，重定向到登录页

#### Scenario: Token 过期
- **WHEN** 已登录用户的 JWT Token 过期
- **THEN** 后端返回 401，前端清除 Token 并跳转到登录页

---

### Requirement: 拖拽排序
系统 SHALL 支持在后台管理界面通过拖拽方式调整链接和分组的排序。

#### Scenario: 拖拽调整链接排序
- **WHEN** 管理员在链接管理页面拖拽某条链接到新位置
- **THEN** 系统自动更新该链接及受影响链接的 `sort_order` 值

#### Scenario: 拖拽调整分组排序
- **WHEN** 管理员在分组管理页面拖拽某个分组到新位置
- **THEN** 系统自动更新该分组及受影响分组的 `sort_order` 值

---

### Requirement: 数据统计/访问分析
系统 SHALL 记录链接点击数据，并在后台提供统计面板。

#### Scenario: 链接点击统计
- **WHEN** 用户点击首页某个链接
- **THEN** 系统异步记录该链接的点击事件（链接 ID、时间戳、User-Agent）

#### Scenario: 统计面板展示
- **WHEN** 管理员访问后台统计面板
- **THEN** 系统展示以下数据：
  - 总链接数、总点击量
  - 今日点击量、本周点击量
  - 热门链接 Top 20（按点击量排序）
  - 点击趋势图（近 7 天/30 天）

#### Scenario: 统计不收集用户隐私
- **WHEN** 系统记录点击事件
- **THEN** 仅记录链接 ID 和时间戳，不记录用户 IP、Cookie 等隐私信息

---

### Requirement: 多模板/主题切换
系统 SHALL 支持在后台切换前端主题模板。

#### Scenario: 切换模板
- **WHEN** 管理员在后台选择不同的模板并保存
- **THEN** 系统更新配置，首页按要求渲染新模板

#### Scenario: 默认模板
- **WHEN** 系统首次安装
- **THEN** 默认使用内置基础模板（参考 5iux 风格）

---

### Requirement: 双后端策略模式
系统 SHALL 通过 services 抽象层支持 Supabase 和自建 REST API 两种后端，构建时通过环境变量切换。

#### Scenario: Supabase 模式
- **WHEN** `VITE_BACKEND=supabase`
- **THEN** 系统使用 Supabase JS SDK 进行数据操作，读取操作走 RLS 匿名访问，写操作通过 JWT 鉴权

#### Scenario: REST API 模式
- **WHEN** `VITE_BACKEND=rest`
- **THEN** 系统使用 fetch 调用自建 REST API，所有请求带 Bearer JWT Token

#### Scenario: 组件不感知后端实现
- **WHEN** 任意 Vue 组件调用 services 方法
- **THEN** 组件仅从 `services/index.js` 导入，不直接引用 Supabase SDK 或 fetch 调用

---

### Requirement: 站点信息展示
系统 SHALL 提供关于页面和公告区域，展示站点介绍和最新公告。

#### Scenario: 关于页面
- **WHEN** 用户访问关于页面
- **THEN** 系统展示管理员配置的站点介绍内容（支持 HTML 富文本）

#### Scenario: 首页公告
- **WHEN** 管理员在后台配置了公告内容
- **THEN** 首页展示公告区域

---

### Requirement: 响应式设计
系统 SHALL 适配桌面端和移动端，提供良好的跨设备体验。

#### Scenario: 桌面端布局
- **WHEN** 用户在桌面浏览器访问
- **THEN** 链接以多列网格布局展示，搜索框居中

#### Scenario: 移动端布局
- **WHEN** 用户在移动设备访问（视口宽度 < 768px）
- **THEN** 链接以单列或双列布局展示，搜索框全宽适配

---

## 数据结构设计

### links 表（链接）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | int / uuid | 主键 |
| title | varchar(255) | 链接名称 |
| url | varchar(2048) | 链接地址 |
| description | varchar(255) | 链接描述 |
| category_id | int / uuid | 所属分组 ID（外键 → categories.id） |
| icon | text | 图标（URL 或 SVG 内联） |
| sort_order | int | 排序值（默认 10） |
| is_visible | boolean | 是否可见 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

### categories 表（分组）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | int / uuid | 主键 |
| name | varchar(100) | 分组名称 |
| sort_order | int | 排序值 |
| is_visible | boolean | 是否可见 |
| created_at | timestamptz | 创建时间 |

### config 表（站点配置）
| 字段 | 类型 | 说明 |
|------|------|------|
| key | varchar(50) | 配置键 |
| value | text | 配置值 |
| description | varchar(255) | 配置说明 |

### apply 表（收录申请）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | int / uuid | 主键 |
| name | varchar(255) | 网站名称 |
| url | varchar(2048) | 网站地址 |
| category_id | int / uuid | 申请分组 ID（外键 → categories.id） |
| icon | text | 网站图标 |
| description | varchar(255) | 描述 |
| status | varchar(20) | 状态（pending/approved/rejected） |
| created_at | timestamptz | 申请时间 |

### search_engines 表（搜索引擎）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | int / uuid | 主键 |
| name | varchar(50) | 引擎名称 |
| url_template | varchar(2048) | 搜索 URL 模板（`{keyword}` 占位） |
| icon | text | 引擎图标 |
| sort_order | int | 排序值 |
| is_active | boolean | 是否启用 |

### click_stats 表（点击统计）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint / uuid | 主键 |
| link_id | int / uuid | 关联链接 ID |
| clicked_at | timestamptz | 点击时间 |
| user_agent | varchar(500) | 浏览器 UA |

---

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端框架 | Vue 3 (Composition API) | `<script setup>` 语法 |
| 构建工具 | Vite 5+ | 快速 HMR，开箱即用 TypeScript |
| 类型系统 | TypeScript 5+ | 严格模式 |
| 状态管理 | Pinia | 替代 Vuex |
| 路由 | Vue Router 4 (Hash Mode) | `createWebHashHistory()` |
| UI 组件 | 自定义 + 少量无样式组件库 | 不引入重量级 UI 库 |
| 图标 | 阿里 Iconfont SVG Symbol | 按需引入 |
| HTTP 客户端 | Supabase SDK / Fetch API | 通过 services 抽象层调用 |
| 拖拽 | vuedraggable (SortableJS) | 后台排序功能 |
| 图表 | Chart.js (按需动态 import) | 统计面板 |
| 后端 (Supabase) | Supabase JS SDK v2 | PostgreSQL + RLS + Auth |
| 后端 (自建) | Node.js + Express | JWT 鉴权，RESTful API |
| 数据库 | PostgreSQL / MySQL | 双 schema 支持 |
| 部署 | EdgeOne Pages | 静态站点托管 |