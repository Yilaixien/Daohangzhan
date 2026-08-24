# 网址导航站

基于 Vue 3 + Vite + TypeScript + Pinia 的纯前端 SPA 网址导航站，支持双后端策略（Supabase / 自建 REST API），构建产物为静态 HTML/CSS/JS，可直接部署到 EdgeOne Pages。

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
| 后端 (Supabase) | Supabase JS SDK v2 |
| 后端 (自建) | Node.js + Express + MySQL |

## 功能特性

- 分类链接导航，支持拖拽排序
- 多搜索引擎切换（百度/必应/谷歌等，支持自定义）
- 后台管理（链接/分组/配置/收录审核/搜索引擎管理）
- 用户收录申请（含验证码和自动获取网站信息）
- 数据统计仪表盘（趋势图 + 热门链接）
- 响应式设计（桌面端 + 移动端）
- 背景图 + 毛玻璃效果 + 实时时钟 + 返回顶部
- 双后端策略模式（构建时通过环境变量切换）

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，根据后端模式填写配置：

```env
# 后端模式：supabase | rest
VITE_BACKEND=supabase

# Supabase 配置（VITE_BACKEND=supabase 时使用）
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# 自建 REST API 配置（VITE_BACKEND=rest 时使用）
VITE_API_BASE_URL=https://your-api.example.com/api
```

### 3. 初始化数据库

**Supabase 模式：**
在 Supabase SQL Editor 中执行 `database/supabase_schema.sql`。

**MySQL 模式：**
在 MySQL 中执行 `database/mysql_schema.sql`，然后启动参考后端：

```bash
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

构建产物在 `dist/` 目录。

## 部署指南

### EdgeOne Pages 部署

1. 构建项目：`npm run build`
2. 将 `dist/` 目录上传到 EdgeOne Pages
3. 配置要点：
   - 构建命令：`npm run build`
   - 输出目录：`dist`
   - **无需 SPA fallback 配置**（项目使用 Hash 路由，URL 中 `#` 后的路径由前端处理）

### 宝塔 Nginx + PM2 部署（自建 REST API 后端）

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

### Supabase → MySQL 迁移指南

1. 在 Supabase 导出数据：`pg_dump` 或 Supabase Dashboard → Export
2. 使用 `database/mysql_schema.sql` 在 MySQL 中创建表结构
3. 数据类型映射：
   - `UUID` → `VARCHAR(36)` 或 `INT UNSIGNED AUTO_INCREMENT`
   - `TIMESTAMPTZ` → `DATETIME`
   - `BOOLEAN` → `TINYINT(1)`
   - `BIGSERIAL` → `BIGINT UNSIGNED AUTO_INCREMENT`
4. 迁移种子数据（INSERT 语句已在两个文件中保持一致）
5. 修改前端 `.env`：`VITE_BACKEND=rest`，配置 `VITE_API_BASE_URL`
6. 重新构建前端：`npm run build`

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
│   │   ├── contracts.ts    # 接口定义
│   │   ├── index.ts        # 工厂函数（动态 import）
│   │   ├── supabase/       # Supabase 实现
│   │   │   └── index.ts
│   │   └── rest/           # REST API 实现
│   │       └── index.ts
│   ├── stores/
│   │   ├── auth.ts         # 鉴权 Store
│   │   └── home.ts         # 首页数据 Store
│   ├── types/
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
├── database/
│   ├── supabase_schema.sql # PostgreSQL + RLS + 种子数据
│   └── mysql_schema.sql    # MySQL + 种子数据
├── backend-reference/      # Node.js Express 参考后端
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
- 默认管理员账号：`admin`
- 管理员密码：在 Supabase Auth 中创建用户，或在 config 表中设置 `admin_user` / `admin_pwd`

## 环境变量说明

| 变量 | 必填 | 说明 |
|------|------|------|
| `VITE_BACKEND` | 是 | 后端模式：`supabase` 或 `rest` |
| `VITE_SUPABASE_URL` | Supabase 模式 | Supabase 项目 URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase 模式 | Supabase 匿名密钥 |
| `VITE_API_BASE_URL` | REST 模式 | 自建 API 地址 |

## License

Apache-2.0