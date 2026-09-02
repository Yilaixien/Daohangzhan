# Supabase → Neon 迁移实施方案（前端直连公开读 + EdgeOne Makers 单项目内置函数代理后台）

## 1. 概述

将本导航站（Vue 3 SPA，部署于腾讯云 EdgeOne Makers——原 EdgeOne Pages 升级更名，平台内置函数能力）的数据库从 Supabase 迁移到 Neon (PostgreSQL)。

用户已确认的关键决策：

1. **数据迁移**：不迁移现有生产数据，直接用 [supabase\_schema.sql](file:///workspace/database/supabase_schema.sql) 的种子数据在 Neon 上重新初始化。
2. **认证方案**：不使用任何外部 Auth 服务（含 Neon Managed Better Auth），自建极简 JWT 鉴权，仅 1 个超级管理员账号。
3. **连接模式**：公开数据前端直连（延续当前直连形态）；后台登录与写操作经 **EdgeOne Makers 单项目内的 Edge Functions 薄代理**（`edge-functions/api/**`，随项目一体化部署，本期实施，代理先行）。
4. **安全边界最高优先级**：`nav_admin` 连接串与 JWT 密钥**只存在于 Makers 项目环境变量**（函数经 `context.env` 读取），绝不出现在 VITE\_\* 构建变量/bundle 中。

> 重要架构发现（依据 Neon 官方文档）：Neon Data API（`@neondatabase/neon-js`，PostgREST 兼容）只接受**自定义 JWT 提供方经 JWKS URL 的非对称签名校验**，且匿名访问也需要 Auth 提供方签发匿名令牌——纯前端自签 HS256 JWT 无法通过其校验，因此本方案**不使用 Data API**。公开读采用 `@neondatabase/serverless` HTTP 驱动（浏览器内 `fetch` 到 `https://<compute-host>/sql`，请求内基本认证用 `nav_read` 连接串），RLS 在数据库层强制行级过滤；后台经函数代理走 `nav_admin`。

## 2. 现状分析

### 2.1 数据模型（6 张表，见 [supabase\_schema.sql](file:///workspace/database/supabase_schema.sql)）

| 表                | 关键字段                                                                                                      | 说明                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `categories`     | UUID PK, name, sort\_order, is\_visible                                                                   | 分组                                 |
| `links`          | UUID PK, title, url, category\_id FK→categories, icon, sort\_order, is\_visible, created\_at, updated\_at | 链接（软删除：remove 置 is\_visible=false） |
| `config`         | key VARCHAR PK, value TEXT                                                                                | 站点配置，含 `admin_user`/`admin_pwd`    |
| `apply`          | UUID PK, name, url, category\_id FK, status(pending/approved/rejected)                                    | 收录申请                               |
| `search_engines` | UUID PK, name, url\_template, is\_active                                                                  | 搜索引擎                               |
| `click_stats`    | BIGSERIAL PK, link\_id FK→links, clicked\_at, user\_agent                                                 | 点击统计                               |

现有 RLS：anon 只读可见行 + apply/click\_stats 插入；`auth.role()='authenticated'` 全表 ALL。两处改进：`anon_select_apply ... USING (true)`（匿名可读全部申请，疑似疏漏）将关闭；`auth_all_*` 将限定为仅 `nav_admin` 角色可达。

### 2.2 前端架构

- [src/services/index.ts](file:///workspace/src/services/index.ts)：按 `VITE_BACKEND`（`supabase` | `rest`）动态 import 服务实现。

- [src/services/supabase/index.ts](file:///workspace/src/services/supabase/index.ts)：Supabase JS SDK v2 实现全部 7 个服务（links / categories / config / apply / auth / searchEngines / stats）；登录为 `signInWithPassword({ email: username, password })`（**username 实为邮箱**）；令牌存 `localStorage.auth_token`。

- [src/services/rest/index.ts](file:///workspace/src/services/rest/index.ts)：备选 REST 实现（含 401 处理范式，`request()` 内清 token + 跳登录——**本方案复用该模式改造成函数客户端时可直接借鉴**）；当前未使用，保留。

- [src/services/contracts.ts](file:///workspace/src/services/contracts.ts)：统一 `Services` 接口，是替换实现的边界，**不需要改动**。

- [src/stores/auth.ts](file:///workspace/src/stores/auth.ts) + [src/router/index.ts](file:///workspace/src/router/index.ts#L88-L112)：基于 `localStorage.auth_token` + JWT 载荷 `exp` 过期判断做路由守卫——**继续复用**（函数签发的 JWT 带 `exp` 即可）。

- [vite.config.ts](file:///workspace/vite.config.ts#L17-L27)：manualChunks 含 `@supabase/supabase-js`，需替换。

### 2.3 部署现状

- 纯静态构建产物（`base: './'` + Hash 路由）+ 项目内 `edge-functions/` 函数目录，整体部署到 EdgeOne Makers，无 SPA fallback。

- VITE\_\* 变量在 EdgeOne Makers 控制台按项目环境变量配置（构建期内联进 bundle）；`DATABASE_URL_ADMIN`/`JWT_SECRET` 同为项目环境变量（函数经 `context.env` 读取）。

- 腾讯云 EdgeOne 已把 Pages 升级为 Makers，平台内置函数（Edge Functions）能力；函数以仓库 `edge-functions/` 目录承载（文件系统即路由），**整个项目（静态站+函数）作为一个 Makers 项目部署，无需单独部署边缘函数**。

- [backend-reference/](file:///workspace/backend-reference) 是 MySQL 参考后端（当前未部署），不在本次迁移范围。

## 3. 目标架构

```
Browser (EdgeOne Makers 单项目: 静态站 + edge-functions/api/**)
 ├─ 公开读写（前台，前端直连）: @neondatabase/serverless HTTP 驱动 (neon())
 │    VITE_NEON_DATABASE_URL → 角色 nav_read
 │    RLS: 仅可见行 SELECT / config(排除 admin_pwd) SELECT / apply INSERT / click_stats INSERT
 ├─ 登录 + 后台写（Makers 项目内 Edge Functions, 文件系统路由）: 同域 VITE_API_BASE_URL=/api
 │    POST /api/auth/login      → [函数] 读 config.admin_user/admin_pwd(bcrypt) → bcrypt 校验 → 服务端 HS256 签发 JWT(7d)
 │    POST/GET/PUT /api/links|categories|config|search-engines|apply|stats
 │                              → [函数] jose 验签(Bearer, 401 拒绝) → SQL 以 nav_admin 执行 → JSON 响应
 │    JWT 密钥 + DATABASE_URL_ADMIN 仅存 Makers 项目环境变量(context.env)，不进 bundle、不进浏览器
 └─ 会话: JWT 存 localStorage('auth_token')，仅用于 ①路由守卫(本地 exp) ②函数 API 的 Bearer 头
        ⚠️ 定位声明: 对数据库层而言 JWT 只是"会话状态标记"（Postgres/RLS 不校验它、担不起鉴权职责）;
           对函数 API 而言它是真实凭证（函数每次验签, 密钥仅服务端持有）。
Neon:
 ├─ 6 张表 + 种子（沿用 PostgreSQL schema，去掉 Supabase 特有二段）
 └─ 角色: nav_read（LOGIN, RLS 过滤, 凭据在 bundle=受 RLS 约束, 等同现行 anon key）
          nav_admin（LOGIN, 全权, 凭据仅存 Makers 项目环境变量）
```

安全边界（按用户要求明确表述）：

1. **JWT 定位**：自签 JWT 仅为"会话状态标记"，非数据库层安全凭证——密钥不进入 bundle（代理先行下由函数服务端持有）、数据库侧（Postgres/RLS）也不校验它。真正的数据安全边界是 **RLS 策略 + nav\_read/nav\_admin 双角色**。
2. **凭据去向**：`nav_read` 连接串进 bundle 可接受（RLS 约束，等价 Supabase anon key）；`nav_admin` 连接串与 `JWT_SECRET` **只进 Makers 项目环境变量**（函数经 `context.env` 读取），从 bundle 彻底移除 —— 原"admin 连接串进 bundle 列为已知并接受风险"的条款在代理先行下**不再适用**；若未来回退纯前端直连，则该条款重新生效（§7 回退说明）。
3. **性能说明**：Neon 免费档 compute 空闲缩容，冷启动约 200\~500ms 属正常；首次访问/首次后台操作会有一次冷启动延迟，之后回到毫秒级。函数亦可能有小冷启动，均不影响功能。

## 4. 实施步骤

### 第 0 步：安装官方 Neon Skills（执行者必读，CLI/SQL 细节以之为准）

在项目根目录执行用户指定命令：

```bash
npx neon@latest skills -s neon -s neon-postgres -y
```

### 第 1 步：准备 Neon 项目与角色

1. 在 [console.neon.tech](https://console.neon.tech) 创建项目（免费档即可，区域就近）；记下 compute host（形如 `ep-xxx-xxxx.region.aws.neon.tech`）。
2. 用 **Neon CLI**（`neonctl`/`npx neon@latest ...`，以第 0 步技能为准）或控制台创建两个登录角色并设强随机密码：

   - `nav_read`：公开读 + apply/click\_stats 插入（RLS 过滤可见性）

   - `nav_admin`：public schema 全表 ALL + 序列权限
3. 组装两条连接串（**直连**，非 -pooler；`sslmode=require`）：

   - `postgresql://nav_read:<pwd>@ep-xxx....neon.tech/neondb?sslmode=require`（进 VITE\_，内联 bundle）

   - `postgresql://nav_admin:<pwd>@ep-xxx....neon.tech/neondb?sslmode=require`（**只进函数环境变量**）
     （HTTP 驱动会将其重写为 `https://<host>/sql` 请求；两条连接串均勿提交仓库/勿写进 `.env.example` 的真实密码。）

### 第 2 步：迁移 Schema / 种子数据 / RLS

新增 [database/neon\_schema.sql](file:///workspace/database/neon_schema.sql)（由 supabase\_schema.sql 衍生），在 Neon SQL Editor（或 psql，以拥有 `CREATEROLE` 的项目主角色执行）一次性执行：

1. **DDL（保持不变）**：`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` + 6 表 + 索引 + 种子数据（原样拷贝，本就是 PostgreSQL，无需改类型）。
2. **RLS 重写**（删除所有 `auth.role()` 策略，改按角色授权）：

   - 每表 `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`

   - `nav_read`（公开）：

     ```sql
     CREATE POLICY rd_visible ON categories FOR SELECT TO nav_read USING (is_visible = true);
     CREATE POLICY rd_visible ON links      FOR SELECT TO nav_read USING (is_visible = true);
     CREATE POLICY rd_config   ON config    FOR SELECT TO nav_read USING (key NOT IN ('admin_pwd'));
     CREATE POLICY rd_active   ON search_engines FOR SELECT TO nav_read USING (is_active = true);
     CREATE POLICY rd_insert   ON apply      FOR INSERT TO nav_read WITH CHECK (true);
     CREATE POLICY rd_insert   ON click_stats FOR INSERT TO nav_read WITH CHECK (true);
     -- 要点: rd_config 显示排除 admin_pwd（密码哈希绝不对匿名可见）;
     --       apply 不再对匿名开放 SELECT（修掉原疏漏）; click_stats 仅插入（统计走函数/nav_admin）
     ```

   - `nav_admin`（全行可见，含 is\_visible=false 的软删行，保持后台可恢复）：

     ```sql
     CREATE POLICY ad_all ON categories FOR ALL TO nav_admin USING (true) WITH CHECK (true);
     CREATE POLICY ad_all ON links      FOR ALL TO nav_admin USING (true) WITH CHECK (true);
     CREATE POLICY ad_all ON config     FOR ALL TO nav_admin USING (true) WITH CHECK (true);
     CREATE POLICY ad_all ON apply      FOR ALL TO nav_admin USING (true) WITH CHECK (true);
     CREATE POLICY ad_all ON search_engines FOR ALL TO nav_admin USING (true) WITH CHECK (true);
     CREATE POLICY ad_all ON click_stats FOR SELECT, INSERT TO nav_admin USING (true);
     ```
3. **GRANT**：

   ```sql
   GRANT USAGE ON SCHEMA public TO nav_read, nav_admin;
   GRANT SELECT ON categories, links, config, search_engines TO nav_read;
   GRANT INSERT ON apply, click_stats TO nav_read;
   GRANT ALL  ON categories, links, config, apply, search_engines TO nav_admin;
   GRANT SELECT, INSERT ON click_stats TO nav_admin;
   GRANT USAGE, SELECT ON SEQUENCE click_stats_id_seq TO nav_read, nav_admin;
   ```
4. **管理员凭据初始化**：将种子里 `config('admin_pwd','', ...)` 的 value 替换为 bcrypt hash（cost 10\~12），并执行初始化 SQL：

   ```sql
   UPDATE config SET value='<bcrypt-hash>' WHERE key='admin_pwd';  -- hash 生成见下方命令
   ```

   - 生成命令：`node -e "console.log(require('bcryptjs').hashSync('<16+位强随机密码>', 10))"`

   - 管理员密码强制 16 位以上随机强密码（与"哈希只在函数内比对"叠加，杜绝离线爆破面）。

   - `admin_user` 保持 `admin`（登录用户名）；种子里 `config.admin_pwd` 的描述字段改为"管理员密码 bcrypt 哈希（仅服务端校验，客户端无法读取）"。

> 若项目主角色不可 `CREATE ROLE`，则先由 **Neon CLI**/控制台创建两个角色，再执行本 SQL。

### 第 3 步：前端依赖与 Neon 服务实现（公开直连 + 后台走函数）

1. [package.json](file:///workspace/package.json#L11-L18)：

   - 移除 `@supabase/supabase-js`

   - 新增 `@neondatabase/serverless`（公开直连 HTTP 驱动）

2. 新增 [src/services/neon/index.ts](file:///workspace/src/services/neon/index.ts)，**完全实现** **[contracts.ts](file:///workspace/src/services/contracts.ts)** **的** **`Services`** **接口**，每个方法按"公开/后台"属性选择数据源：

   - **公开（直连 nav\_read）**：`readSql = neon(VITE_NEON_DATABASE_URL)`；方法：`links.getAll/getByCategory/getById`、`categories.getAll/getById`、`config.getAll/get`、`apply.create`、`searchEngines.getAll`、`stats.recordClick`、`links.checkDeadLinks`（浏览器侧检测，仅需公开链接列表）。

   - **后台（走函数 API）**：`apiFetch(path, options)`——以 `VITE_API_BASE_URL` 拼接路径，带 `Authorization: Bearer <auth_token>`；401 时清 token 并跳登录（照抄 [rest/index.ts](file:///workspace/src/services/rest/index.ts#L16-L32) 的 `request()` 范式）；方法：`links.create/update/remove/reorder`、`categories.create/update/remove/reorder`、`config.set`、`apply.getAll/getByStatus/approve/reject`、`searchEngines.create/update/remove`、`stats.getOverview/getTopLinks/getTrend`。

   - 函数返回统一 `{ data }` / `{ message }`，前端解包后返回裸数据（契约要求）。

3. 直连 SQL 要点（nav\_read 侧，与函数侧同构，函数侧见第 4 步）：

   | 方法                           | SQL                                                                                    |
   | ---------------------------- | -------------------------------------------------------------------------------------- |
   | links.getAll / getByCategory | `SELECT * FROM links WHERE is_visible = true [AND category_id=$1] ORDER BY sort_order` |
   | links.getById                | `SELECT * FROM links WHERE id=$1 LIMIT 1` → 无则 null                                    |
   | config.getAll                | `SELECT key,value FROM config`（RLS 已排除 admin\_pwd）                                     |
   | config.get                   | `SELECT value FROM config WHERE key=$1`                                                |
   | apply.create                 | `INSERT INTO apply (name,url,category_id,icon,description) VALUES (...) RETURNING *`   |
   | stats.recordClick            | `INSERT INTO click_stats(link_id,user_agent) VALUES($1,$2)`                            |
   | searchEngines.getAll         | `SELECT * FROM search_engines WHERE is_active = true ORDER BY sort_order`              |

4. [src/services/index.ts](file:///workspace/src/services/index.ts)：分支改为 `rest` / `neon`，**默认（未设置或非 rest）走 neon**；删除 supabase import。

5. [vite.config.ts](file:///workspace/vite.config.ts#L21)：manualChunks 的 `@supabase/supabase-js → @neondatabase/serverless`。

### 第 4 步：EdgeOne Makers 函数代理（登录 + 后台写，本期核心）

按 Makers 文件系统路由约定组织：新增 `edge-functions/api/[[default]].js`（承载全部 `/api/**`），入口为平台约定的 `export default function onRequest(context)`，`context.request` 为标准 Request、`context.env` 为 Makers 项目环境变量。运行时基于 V8 + Web Service Worker API（无 Node 内建），依赖由 `edge-functions/package.json` 声明（Makers 构建时安装）。函数逻辑层仍是标准 Web Request/Response（jose/bcryptjs/@neondatabase/serverless 均为纯 JS）：

1. **依赖与初始化（关键：按值缓存, 连接池全局单例）**：

   ```js
   import { neon } from '@neondatabase/serverless'
   import { SignJWT, jwtVerify } from 'jose'
   import bcrypt from 'bcryptjs'
   const runtimeCache = new Map()
   function getRuntime(env) {
     const dbUrl = env?.DATABASE_URL_ADMIN || process.env?.DATABASE_URL_ADMIN
     const jwtSecret = env?.JWT_SECRET || process.env?.JWT_SECRET
     const cacheKey = `${dbUrl}::${jwtSecret}`
     if (!runtimeCache.has(cacheKey)) {
       if (!dbUrl || !jwtSecret) throw new Error('缺少环境变量 DATABASE_URL_ADMIN / JWT_SECRET')
       runtimeCache.set(cacheKey, { sql: neon(dbUrl), secret: new TextEncoder().encode(jwtSecret) }) // neon() 连接池单例
     }
     return runtimeCache.get(cacheKey)
   }
   ```
   注意：缓存键不可用 `env` 对象本身（`context.env` 每请求新建对象, 会永远 miss → 每请求新建连接池 → 内存溢出）。
2. **`POST /auth/login`**：参数 `{ username, password }`

   - `SELECT key,value FROM config WHERE key IN ('admin_user','admin_pwd')`（nav\_admin 执行）

   - `username === admin_user` 且 `await bcrypt.compare(password, admin_pwd)`（**用异步 compare，勿用同步 compareSync 以免阻塞边缘函数事件循环**）；失败统一返回 401 `{ message:'用户名或密码错误' }`

   - 成功：`new SignJWT({ role:'admin', sub:'admin' }).setExpirationTime('7d').sign(secret)` → `{ data:{ token } }`
3. **其余路由**（全部先验签）：取 `Authorization: Bearer <t>` → `jwtVerify(t, secret)`，失败返回 401；通过后按路由执行 SQL（nav\_admin）：

   - `GET /links`、`GET /categories`、`GET /config`、`GET /config/:key`、`GET /search-engines`、`GET /apply[?status=]`
     - 语义须知：这些是**后台读接口**，以 nav_admin 执行，**不加 `is_visible=true`/`is_active=true` 过滤（后台需看到隐藏/停用行）**；与前台直连 `links.getAll`（nav_read，仅可见行）语义不同——代码注释必须写明"后台读 = 不含可见性过滤，勿复用前台 SQL"，避免后续开发误用。

   - `POST /links`、`PUT /links/:id`、`DELETE /links/:id`（软删 is\_visible=false）、`POST /links/reorder`（**整体包进** **`sql.transaction([...])`**）

   - links.create 先算 sort\_order：`SELECT COALESCE(MAX(sort_order),0)+10 FROM links WHERE category_id=$1`

   - `POST /categories`、`PUT /categories/:id`、`DELETE /categories/:id`、`POST /categories/reorder`（同样事务）

   - `PUT /config/:key`（`INSERT ... ON CONFLICT (key) DO UPDATE SET value=excluded.value`）

   - `POST /apply/:id/approve`：**事务** `sql.transaction([...])`：读申请 → 算 sort\_order → INSERT links → UPDATE apply status='approved'

   - `POST /apply/:id/reject`：`UPDATE apply SET status='rejected' WHERE id=$1`

   - `POST /search-engines`、`PUT /search-engines/:id`、`DELETE /search-engines/:id`

   - `GET /stats/overview`、`GET /stats/top-links?limit=`、`GET /stats/trend?days=`：

     - overview：`SELECT count(*) FILTER (WHERE is_visible) FROM links` + 三条 click\_stats COUNT

     - top-links：`SELECT cs.link_id, l.title, count(*) c FROM click_stats cs JOIN links l ON l.id=cs.link_id GROUP BY 1,2 ORDER BY c DESC LIMIT $1`

     - trend：`SELECT to_char(clicked_at,'YYYY-MM-DD') d, count(*) FROM click_stats WHERE clicked_at>=$1 GROUP BY 1 ORDER BY 1`（前端补 0 逻辑保留）
4. **响应与 CORS**：统一 `{ data }`/`{ message }` + 状态码；所有响应带 `Access-Control-Allow-Origin: *`（或配置的域名）与 `Access-Control-Allow-Headers: Authorization, Content-Type`；`OPTIONS` 预检直接 204。CORS 头由函数代码保证（必要时也按 EdgeOne 控制台/边缘函数配置放行）。
5. **函数环境变量**（服务端，不内联 bundle）：`DATABASE_URL_ADMIN`（nav\_admin 连接串）、`JWT_SECRET`（≥32 字符随机串）。
6. **部署**：按「EdgeOne Makers 一体化部署」执行——`npm run build`（产物 `dist/` 自包含 `edge-functions/` 与 `edge-functions/package.json`）→ `edgeone makers deploy ./dist`；无需单独部署边缘函数/绑定域名（同域 `/api` 文件系统路由）。

### 第 5 步：前端 auth 服务与自建 JWT 会话

[src/services/neon/index.ts](file:///workspace/src/services/neon/index.ts) 的 `auth` 服务：

1. `login(username, password)`：`apiFetch('/auth/login', { method:'POST', body: JSON.stringify({ username, password }) })` → 得 `{ token }` → `localStorage.setItem('auth_token', token)` → 返回 token。
2. `logout()`：`localStorage.removeItem('auth_token')`（服务端无状态，无需吊销接口）。
3. `getToken()` / `isAuthenticated()`：沿用现有 localStorage 语义。
4. 复用说明：路由守卫与 [auth.ts](file:///workspace/src/stores/auth.ts) 仅依赖 `exp` 载荷与 `auth_token` 键，**无需改动**；[LoginView.vue](file:///workspace/src/views/admin/LoginView.vue) 文案"用户名"/"密码"语义不变（管理员用户名 = `config.admin_user`）。
5. JWT 定位（用户要求，写入代码注释要点）：该令牌对数据库层仅是会话语义标记（Postgres/RLS 不校验）；它是函数 API 的真实凭证（函数每次 `jwtVerify`）。密钥只存在于函数环境变量。

### 第 6 步：环境变量（两类，分治）

新增根目录 [.env.example](file:///workspace/.env.example)（当前不存在，需创建，仅示例值）：

```env
# 后端模式: neon | rest（默认 neon）
VITE_BACKEND=neon
# 浏览器直连 Neon HTTP /sql 的连接串（角色 nav_read，RLS 过滤公开数据; 进 bundle, 安全边界=RLS）
VITE_NEON_DATABASE_URL=postgresql://nav_read:xxx@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
# EdgeOne Makers 同站函数路由（edge-functions/api/**）; 默认相对路径同域调用, 自定义域名再覆盖
VITE_API_BASE_URL=/api
```

> 注意：`nav_admin` 连接串与 `JWT_SECRET` **不写入** **`.env.example`**，配置在 EdgeOne Makers 控制台项目环境变量（函数经 `context.env` 读取）。

**EdgeOne Makers 项目环境变量：** 构建变量（进 bundle）`VITE_BACKEND=neon`、`VITE_NEON_DATABASE_URL`、`VITE_API_BASE_URL=/api`；函数变量（不进 bundle）`DATABASE_URL_ADMIN`、`JWT_SECRET`；删除旧 `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`。
部署：`npm run build`（产物 `dist/` 自包含 `edge-functions/` 与函数依赖清单）→ `edgeone makers deploy ./dist`；输出目录 `dist`、无需 SPA fallback（Hash 路由）。本地调试 `edgeone makers dev`（函数与前端同端口, `VITE_API_BASE_URL=/api` 同域无跨域）。

### 第 7 步：验证（详见 §6）

## 5. 行为差异与决策记录

| 项         | 原 Supabase                             | 迁移后（Neon）                                             | 说明                       |
| --------- | -------------------------------------- | ----------------------------------------------------- | ------------------------ |
| 公开页面数据源   | anon key → PostgREST                   | 浏览器 → HTTP /sql（nav\_read + RLS）                      | 行为一致，仅传输方式变化             |
| 登录        | Supabase Auth（服务端签发）                   | 函数 `/auth/login`（bcrypt 校验 + 服务端 HS256 签发）            | 移除对 Supabase Auth 依赖     |
| 后台写       | authenticated JWT 直连 PostgREST         | 函数 `/api/*`（验签后 nav\_admin 执行 SQL）                    | admin 凭据不出服务端环境          |
| 登录标识      | username 实为邮箱                          | 用户名（config.admin\_user）                               | —                        |
| 管理员密码     | Supabase Auth 账户密码                     | config.admin\_pwd 存 bcrypt hash（cost 10\~12，仅函数内校验比对） | 哈希对匿名不可见（RLS 排除 + 不经浏览器） |
| 申请列表匿名读   | `anon_select_apply USING(true)`（推荐删疏漏） | 匿名不可读，仅 nav\_admin/函数                                 | 安全改进；前台页面无感知             |
| 隐藏行（软删）可见 | authenticated 可见全部                     | 仅 nav\_admin（函数）可见                                    | 后台恢复功能保留                 |
| 数据一致性     | —                                      | 种子重新初始化                                               | 用户已确认                    |

## 6. 验证步骤

### 6.1 数据库层（psql / Neon SQL Editor）

1. `\dt`：6 张表齐全；`SELECT count(*)` 校验种子：categories=6、search\_engines=5、links≈种子 60 条、config≈14 行。
2. RLS 负向验证（以 nav\_read 连接）：

   - `SELECT` links 只见 `is_visible=true`；`SELECT` config **不含 admin_pwd 行**（重点：`WHERE key='admin_pwd'` 返回空）；

   - `INSERT INTO links` 报权限错误；`SELECT` apply 被拒；`INSERT INTO click_stats` 成功。

   - nav\_admin：可见任意行（含隐藏行）、可写、可查统计。
3. `config.admin_pwd` 为有效 bcrypt hash（长度 60、`$2a$10$` 前缀）。

### 6.2 前端功能层（本地 `npm run dev`）

1. 首页：分组/链接/搜索引擎/配置文案正常渲染；新建 `is_visible=false` 链接后前台不显示。
2. 前台：提交申请后 apply 表 +1；点击链接后 click\_stats +1（控制台无 CORS 报错——确认直连 `/sql` 与函数 API 的 CORS 均放行）。
3. 后台：`#/admin/login` 以 admin\_user + 强密码登录成功进入 dashboard（错密码返回 401 并提示）；链接/分组/配置/搜索引擎 CRUD 与拖拽排序（reorder 事务）生效；软删后列表仍可见（可恢复）；申请审核通过后自动生成链接；统计面板数字与 6.1 一致。
4. 令牌：localStorage 出现 `auth_token`（JWT 三段式）；篡改/伪造 token 后进入后台的写请求被函数 401 拦截（观察 Network 面板），刷新被路由守卫拦回登录页。

### 6.3 构建与线上

1. `npm run build` 通过（vue-tsc 无类型错误；build 脚本已完成「纯构建 + 产物自包含」，不再清空重装依赖）。
2. `dist/`（含 `edge-functions/`）整包作为单个 Makers 项目部署；项目环境变量按 §5 配置后触发部署。
3. 线上复测 6.2 全流程；**抽查产物**：在 `dist/assets/*.js` 中 `grep` 确认不含 `nav_admin` 连接串特征与 `JWT_SECRET` 值。

## 7. 风险与说明

1. **CORS**：浏览器直连 `https://ep-xxx...neon.tech/sql` 需 Neon 允许跨域（§6.2 前置门禁）；函数侧 CORS 由函数代码 + EdgeOne 配置共同保证。若 /sql 意外不放行，回退为函数代理公开读（函数内以 nav\_read 执行同样 SQL），前端侧仅改数据源指针，不改变其余设计。
2. **冷启动**：Neon 免费档空闲缩容，首次请求约 200\~500ms，属正常；可用 Neon 控制台调低自动休眠或忽略。
3. **JWT 安全**：密钥仅服务端持有；函数每次验签；客户端只用 `exp` 做路由守卫（非安全判定）。`JWT_SECRET` 轮换=旧 token 全失效，操作前知会。
4. **事务**：HTTP/边缘场景无交互式事务；`apply/approve` 与 `links.reorder`、`categories.reorder` 一律用 `sql.transaction([...])` 非交互事务保证原子性。
5. **回退与运维**：若未来停用 Makers 函数（Edge Functions）：回退纯前端直连时，admin 连接串与 JWT 密钥必须进入 VITE\_\*（即重新接受"已知风险条款"，且 `rd_config` 需改回允许读 admin\_pwd 或登录改走 admin 连接串）。当前代理先行下该项风险已消除。
6. **Makers 函数限制**：Edge Functions 单次执行 CPU 200ms（不含 I/O 等待）、代码包 ≤5MB、请求 body ≤1MB。本方案已适配：bcrypt 成本因子固定 10、函数按值缓存连接池单例、`await bcrypt.compare` 异步化；登录/后台接口均为轻量 SQL。若后续复杂化，留意 CPU 预算。

## 8. 明示假设

- 线上无必须保留数据（用户已选择种子重新初始化）；若后续需保留，改走 `pg_dump -h <supabase-host> --data-only -t categories -t links ...` 管道导入 Neon（owner 级恢复不受 RLS 影响）。

- Neon 项目主角色具备创建角色/执行 GRANT 的权限（Neon 默认角色通常满足；否则角色改由 **Neon CLI**/控制台创建）。

- `@neondatabase/serverless` 浏览器直连 `/sql` 的 CORS 默认放行（§6.2 第 2 项验证；被拦则按 §7-1 回退）。

- EdgeOne Makers Edge Functions 运行时基于 V8 + Web Service Worker API（无 Node 内建；环境变量经 `context.env` 读取）；jose/bcryptjs/@neondatabase/serverless 均为纯 JS，可由 `edge-functions/package.json` 声明安装。

- [backend-reference/](file:///workspace/backend-reference)（MySQL 参考后端）与 `rest` 服务保持不动；本次仅替换 `supabase` 实现。

