# 网址导航站

基于 Vue 3 + Vite + TypeScript + Pinia 的纯前端 SPA 网址导航站。数据层采用「**前端直连 Neon (PostgreSQL) 公开读 + EdgeOne Makers 项目内 Edge Functions 代理后台**」架构（默认模式 `neon`），并保留自建 REST API（Node.js + Express + MySQL）作为参考后端模式（`rest`）。整个项目（静态站点 + 后台函数）作为**单个 EdgeOne Makers 项目**构建与部署。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Vue 3 (Composition API + `<script setup>`) |
| 构建工具 | Vite 5+ |
| 类型系统 | TypeScript 5+ |
| 状态管理 | Pinia |
| 路由 | Vue Router 4 (Hash Mode) |
| CSS | Tailwind CSS 4 |
| 图表 | Chart.js (动态 import) |
| 拖拽 | vuedraggable (SortableJS) |
| 数据层（前台直连） | `@neondatabase/serverless`（HTTP 驱动）+ PostgreSQL RLS 双角色（nav_read/nav_admin） |
| 后台代理（Makers Edge Functions） | 项目内 `edge-functions/api/**`；`jose`（HS256 JWT 签发/验签）+ `bcryptjs`（管理员密码校验） |
| 参考后端（可选） | Node.js + Express + MySQL |

## 功能特性

- 分类链接导航，支持拖拽排序
- 多搜索引擎切换（百度/必应/谷歌等，支持自定义）
- 后台管理（链接/分组/配置/收录审核/搜索引擎管理）
- 用户收录申请（含验证码和自动获取网站信息）
- 数据统计仪表盘（趋势图 + 热门链接）
- 响应式设计（桌面端 + 移动端）
- 背景图 + 毛玻璃效果 + 实时时钟 + 返回顶部
- 数据层双通道：前台公开读写直连 Neon（RLS 强制行过滤），后台读写经 Makers Edge Functions（`edge-functions/api/**`，nav_admin）；构建期经 `VITE_BACKEND=neon|rest` 切换

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，根据后端模式填写配置：

```env
# 后端模式：neon（默认） | rest
VITE_BACKEND=neon

# 浏览器直连 Neon HTTP /sql 的连接串（角色 nav_read，RLS 过滤公开数据；会内联进构建产物，安全边界=RLS）
VITE_NEON_DATABASE_URL=postgresql://nav_read:xxx@ep-xxx.region.aws.neon.tech/neondb?sslmode=require

# EdgeOne Makers 同站函数路由（edge-functions/api/**）; 默认相对路径同域调用, 如需自定义域名再覆盖
VITE_API_BASE_URL=/api
```

> 注意：`nav_admin` 连接串与 `JWT_SECRET` 不写入 `.env`（不进入前端 bundle），配置在 EdgeOne Makers 控制台项目环境变量（函数经 `context.env` 读取）。

### 3. 初始化数据库

**Neon 模式（默认，推荐）：**

1. 在 [Neon Console](https://console.neon.tech) 创建项目，并用 Neon CLI（`neonctl` / `npx neon@latest ...`）或控制台创建两个登录角色：`nav_read`（公开读 + apply/click_stats 插入）、`nav_admin`（全表权限）。
2. 在 SQL Editor（以项目主角色）执行 `database/neon_schema.sql`（建表 + 种子 + RLS 策略 + GRANT）。
3. 生成并写入管理员密码的 bcrypt 哈希（配置项 `config.admin_pwd`，仅函数代理内校验，对匿名不可见；密码要求 16 位以上强随机，**成本因子固定 10**：Edge Functions 单次 CPU 200ms 限制下 cost≥11 有超限风险）：

```bash
# 生成 bcrypt 哈希（将 <16位以上强随机密码> 替换为真实密码）
node -e "console.log(require('bcryptjs').hashSync('<16位以上强随机密码>', 10))"
# 在 Neon SQL Editor 执行：将上一步输出的 hash 写入 admin_pwd
UPDATE config SET value='<上一步输出的hash>' WHERE key='admin_pwd';
```

**MySQL 参考模式（可选）：**

```bash
mysql < database/mysql_schema.sql
cd backend-reference
cp .env.example .env   # 编辑数据库连接信息
npm install
npm start
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 `http://localhost:5173`。

### 5. 构建生产版本

```bash
npm run build
```

构建产物在 `dist/` 目录（已自包含 `edge-functions/` 函数目录）。

## 部署指南

### EdgeOne Makers 一体化部署（静态站点 + 后台函数，推荐）

项目整体作为一个 Makers 项目部署，`edge-functions/` 目录即函数入口（文件系统路由），无需单独部署边缘函数：

1. 安装并登录 CLI：`npm install -g edgeone` → `edgeone login`（选 China）。
2. 在 [Makers 控制台](https://console.cloud.tencent.com/edgeone/pages) 创建项目（或 `edgeone makers create`），将本仓库关联/上传。
3. 控制台配置**项目环境变量**：
   - 构建变量（内联进前端 bundle）：`VITE_BACKEND=neon`、`VITE_NEON_DATABASE_URL`（nav_read）、`VITE_API_BASE_URL=/api`
   - 函数变量（仅函数经 `context.env` 读取）：`DATABASE_URL_ADMIN`（nav_admin）、`JWT_SECRET`（≥32 字符随机串）
4. 构建：`npm run build`——脚本内置于首步执行 `npm ci` **全新安装依赖**（严格按 `package-lock.json`，杜绝缓存旧依赖），再 `vue-tsc` 类型检查、`vite build`，并自动把 `edge-functions/` 与函数依赖清单复制进 `dist/` 使其自包含。
5. 部署：`edgeone makers deploy ./dist`（或将 `dist/` 上传到控制台）。函数由平台打包：**jose / bcryptjs 同时声明在根 `package.json` 与 `edge-functions/package.json`**（平台以仓库根 `node_modules` 打包函数，子目录不单独安装依赖；这两包未被前端 import，不会进入前端 bundle）。
6. 配置要点：输出目录 `dist`、构建命令 `npm run build`、**无需 SPA fallback**（Hash 路由，`#` 后路径由前端处理）。

**本地开发调试（函数 + 前端同源）：** `edgeone makers dev`（默认 8088 端口同时提供函数服务与前端，`VITE_API_BASE_URL=/api` 同域调用，无跨域；`edgeone makers link` 可将控制台环境变量同步到本地）。

**函数入口与路由：** `edge-functions/api/[[default]].js` 承载全部 `/api/**` 请求（平台文件系统路由，多级匹配）。安全边界：`nav_admin` 凭据与 JWT 密钥只存在于 Makers 项目环境变量；JWT 对数据库层仅是会话状态标记（Postgres/RLS 不校验），对函数 API 是真实凭证（每次验签）。

### 宝塔 Nginx + PM2 部署（参考 REST 后端，可选；与 Makers 部署无关）

仅在 `rest` 模式（自建 MySQL 后端）时使用：

**后端部署：**

1. 在 VPS 上安装 Node.js (v18+) 和 PM2
2. 上传 `backend-reference/` 目录
3. 配置 `.env` 文件（数据库连接、JWT 密钥）
4. 启动：

```bash
cd backend-reference
npm install
pm2 start src/index.js --name nav-api
pm2 save
pm2 startup
```

**前端部署：**

1. 将 `dist/` 目录上传到网站根目录
2. Nginx 配置示例：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /www/wwwroot/nav-site/dist;
    index index.html;

    # API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # SPA 静态文件
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

> 历史路径：如需继续使用自建 REST (MySQL) 后端，执行 `database/mysql_schema.sql` 并按数据映射 `UUID→VARCHAR(36)`、`TIMESTAMPTZ→DATETIME`、`BOOLEAN→TINYINT(1)`、`BIGSERIAL→BIGINT UNSIGNED AUTO_INCREMENT` 迁移，前端 `VITE_BACKEND=rest` 配置 `VITE_API_BASE_URL`。

## Makers Edge Functions 路由（API 说明）

函数路由即文件系统路由：`edge-functions/api/[[default]].js` 承载全部 `/api/**`（`VITE_API_BASE_URL` 默认同域 `/api`）。统一返回体 `{ data }` / `{ message }`；除 `POST /api/auth/login` 外均需 `Authorization: Bearer <JWT>` 验签。

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 校验 `config.admin_user` / `admin_pwd`（bcrypt）→ 签发 HS256 JWT（7d） |
| GET | `/api/links`、`/api/categories`、`/api/search-engines`、`/api/config`、`/api/config/:key` | 后台读（**含隐藏/停用行**，与前台直连的可见行语义不同，勿混用） |
| GET | `/api/apply?status=` | 申请列表（可按状态过滤；不设匿名读） |
| POST | `/api/links`、`/api/categories`、`/api/search-engines` | 新建（自动计算 sort_order） |
| PUT | `/api/links/:id`、`/api/categories/:id`、`/api/search-engines/:id`、`/api/config/:key` | 更新（config 为 upsert） |
| DELETE | `/api/links/:id`、`/api/categories/:id`、`/api/search-engines/:id` | 软删除（置 is_visible=false / is_active=false，后台仍可见） |
| POST | `/api/links/reorder`、`/api/categories/reorder` | 批量排序（事务提交） |
| POST | `/api/apply/:id/approve`、`/api/apply/:id/reject` | 审核通过（单条 CTE 原子：建链接+更新状态）/ 拒绝 |
| GET | `/api/stats/overview`、`/api/stats/top-links?limit=`、`/api/stats/trend?days=` | 统计（总数/今日/热门 Top N/趋势，缺失日补 0） |

前台直连（nav_read，不经函数）的只读数据：首页分组/链接/搜索引擎/站点配置、收录申请提交、点击统计记录、死链检测所需的公开链接列表。

## 项目结构

```
├── src/
│   ├── components/
│   │   ├── admin/          # 后台组件
│   │   ├── common/         # 通用组件
│   │   └── frontend/       # 前台组件
│   │       ├── BackgroundImage.vue
│   │       ├── BackToTop.vue
│   │       ├── DateTimeDisplay.vue
│   │       ├── LinkCard.vue
│   │       └── SearchBox.vue
│   ├── router/
│   │   └── index.ts        # 路由配置 + 守卫
│   ├── services/
│   │   ├── contracts.ts    # 接口定义（服务契约/API 边界）
│   │   ├── index.ts        # 工厂函数（按 VITE_BACKEND 动态 import）
│   │   ├── neon/           # Neon 实现：前台直连(nav_read) + 后台走 Makers 函数
│   │   │   └── index.ts
│   │   └── rest/           # REST API 实现（MySQL 参考后端，可选）
│   │       └── index.ts
│   ├── stores/
│   │   ├── auth.ts         # 鉴权 Store
│   │   └── home.ts         # 首页数据 Store
│   ├── views/
│   │   ├── admin/          # 后台页面
│   │   │   ├── AdminLayout.vue
│   │   │   ├── LoginView.vue
│   │   │   ├── DashboardView.vue
│   │   │   ├── LinksView.vue
│   │   │   ├── CategoriesView.vue
│   │   │   ├── ConfigView.vue
│   │   │   ├── ApplyManageView.vue
│   │   │   └── SearchEnginesView.vue
│   │   └── frontend/       # 前台页面
│   │       ├── FrontendLayout.vue
│   │       ├── HomeView.vue
│   │       ├── AboutView.vue
│   │       ├── ApplyView.vue
│   │       └── NotFoundView.vue
│   ├── App.vue
│   ├── main.ts
│   └── style.css
├── edge-functions/         # Makers Edge Functions（登录 + 后台写；随单项目部署）
│   ├── api/
│   │   └── [[default]].js  # 路由入口：承载全部 /api/**（onRequest + context.env）
│   └── package.json        # 函数依赖唯一声明（jose/bcryptjs/@neondatabase/serverless）
├── database/
│   ├── neon_schema.sql     # Neon PostgreSQL + RLS(双角色) + GRANT + 种子数据
│   └── mysql_schema.sql    # MySQL 参考后端 schema + 种子数据
├── backend-reference/      # Node.js Express 参考后端（可选）
│   ├── src/
│   │   ├── index.js
│   │   ├── middleware/
│   │   └── routes/
│   ├── package.json
│   └── .env.example
├── .env.example
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 后台管理

- 后台地址：`http://localhost:5173/#/admin/login`
- 管理员用户名：`config.admin_user` 配置项（默认 `admin`）
- 管理员密码：为 `config.admin_pwd` 中 bcrypt 哈希对应的明文密码（哈希由 Makers 函数在服务端校验，客户端无法读取）

## 环境变量说明

**前端（构建变量，EdgeOne Makers 控制台 / `.env`）**

| 变量 | 必填 | 说明 |
|------|------|------|
| `VITE_BACKEND` | 否 | 后端模式：`neon`（默认）或 `rest` |
| `VITE_NEON_DATABASE_URL` | neon 模式 | 浏览器直连 Neon 的连接串（角色 nav_read，RLS 过滤；内联进 bundle） |
| `VITE_API_BASE_URL` | 否 | Makers 同站函数路由（默认 `/api`）；rest 模式下为自建 API 地址 |

**Makers 项目环境变量（仅函数读取，函数经 `context.env` 访问，不进 bundle）**

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL_ADMIN` | neon 模式 | nav_admin 连接串（后台代理执行 SQL 用） |
| `JWT_SECRET` | neon 模式 | HS256 JWT 密钥（≥32 字符随机串） |

## License

Apache-2.0