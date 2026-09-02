# Supabase → Neon 迁移实施方案（前端直连 + 自建极简 JWT 鉴权）

## 1. 概述

将本导航站（Vue 3 SPA，部署于腾讯云 EdgeOne Pages）的数据库从 Supabase 迁移到 Neon (PostgreSQL)。

用户已确认的关键决策：

1. **数据迁移**：不迁移现有生产数据，直接用 [supabase\_schema.sql](file:///workspace/database/supabase_schema.sql) 的种子数据在 Neon 上重新初始化。
2. **认证方案**：不使用任何外部 Auth 服务（含 Neon Managed Better Auth），改为**自建极简 JWT 鉴权**，仅 1 个超级管理员账号，无多用户注册、无 OAuth。
3. **连接模式**：**前端直连**（延续当前 `VITE_BACKEND=supabase` 的架构形态），环境变量配置在腾讯云 EdgeOne Pages 后台。

> 重要架构发现（依据 Neon 官方文档）：Neon Data API（`@neondatabase/neon-js`，PostgREST 兼容）只接受**自定义 JWT 提供方经 JWKS URL 的非对称签名校验**，且匿名访问也需要 Auth 提供方签发匿名令牌——纯前端自签 HS256 JWT 无法通过其校验，因此本方案**不使用 Data API**，而是采用更贴近「直连 PostgreSQL」的 `@neondatabase/serverless` HTTP 驱动（浏览器内 `fetch` 到 `https://<compute-host>/sql`，请求内基本认证用连接串角色），RLS 在数据库层强制行级过滤，自建 JWT 仅作为前端会话令牌。

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

现有 RLS：anon 只读可见行 + apply/click\_stats 插入；`auth.role()='authenticated'` 全表 ALL。其中两处可改进：`anon_select_apply ... USING (true)` 使**匿名可读全部申请**（疑似原始疏漏）；`auth_all_*` 允许任意 authenticated 用户全权管理（多用户场景危险，本站单管理员无碍）。

### 2.2 前端架构

- [src/services/index.ts](file:///workspace/src/services/index.ts)：按 `VITE_BACKEND`（`supabase` | `rest`）动态 import 服务实现。

- [src/services/supabase/index.ts](file:///workspace/src/services/supabase/index.ts)：Supabase JS SDK v2 实现全部 7 个服务（links / categories / config / apply / auth / searchEngines / stats），用 `.from().select()...` PostgREST 链式 API；登录为 `supabase.auth.signInWithPassword({ email: username, password })`（**username 字段实际被当作邮箱**），令牌存 `localStorage.auth_token`。

- [src/services/rest/index.ts](file:///workspace/src/services/rest/index.ts)：备选 REST 实现（指向自建后端，当前未使用，**保持不动**）。

- [src/services/contracts.ts](file:///workspace/src/services/contracts.ts)：统一 `Services` 接口，是替换实现的边界，**不需要改动**。

- [src/stores/auth.ts](file:///workspace/src/stores/auth.ts) + [src/router/index.ts](file:///workspace/src/router/index.ts#L88-L112)：基于 `localStorage.auth_token` + JWT 载荷 `exp` 过期判断做路由守卫——**继续复用**，只要新登录流程产出带 `exp` 的 JWT 即可。

- [vite.config.ts](file:///workspace/vite.config.ts#L17-L27)：manualChunks 包含 `@supabase/supabase-js`，需替换。

### 2.3 部署现状

- 纯静态构建产物（`base: './'` + Hash 路由），上传 EdgeOne Pages，无 SPA fallback 需求。

- 环境变量为 VITE\_\* 前缀，在 EdgeOne Pages 后台按构建变量注入（`import.meta.env` 构建期内联进 bundle）。

- [backend-reference/](file:///workspace/backend-reference) 是 MySQL 参考后端（当前未部署），不在本次迁移范围。

## 3. 目标架构

```
Browser (EdgeOne Pages 静态站)
   ├── 公开访问（匿名）: @neondatabase/serverless HTTP 驱动 (neon())
   │     连接串: VITE_NEON_DATABASE_URL   → 角色 nav_read（RLS 过滤:仅可见行;配置可读;apply/click_stats 可插入）
   ├── 后台管理（登录后）: 同一驱动，切换连接串 VITE_NEON_ADMIN_DATABASE_URL → 角色 nav_admin（RLS:全表 ALL，可见隐藏行）
   └── 登录: 匿名查询 config 取 admin_user/admin_pwd(bcrypt hash) → bcryptjs 浏览器校验 →
            WebCrypto HS256 自签 JWT({sub:'admin', role:'admin', exp:7d}, VITE_NEON_JWT_SECRET)
            → 存 localStorage.auth_token（路由守卫/过期检查复用现有逻辑）
Neon:
   ├── 6 张表 + 种子数据（沿用 PostgreSQL schema，去掉 Supabase 特有二段）
   └── 角色: nav_read（LOGIN, RLS 过滤）、nav_admin（LOGIN, 全权）；RLS + GRANT 均在 DB 层强制
```

安全权衡（必须知晓）：前端直连下，`VITE_NEON_DATABASE_URL` 与 `VITE_NEON_ADMIN_DATABASE_URL` 均会被内联进构建产物，任何人可从 bundle 提取。行为边界：

- `nav_read` 凭据泄露 ≈ 现行 Supabase anon key（受 RLS 约束，仅可见数据 + 可提交申请/记点击），风险等同当前；

- **`nav_admin`** **凭据泄露可使攻击者获得完整管理能力**（现行 Supabase 下 anon key 无法做到）。RLS 仍强制行过滤，但"管理员身份"在前端直连模式下无法被数据库侧真正鉴别的根本限制是**本次架构的固有代价**。

- 可选加固（见 §7.5）：用 EdgeOne Functions 代理注册/写操作签发真实令牌，可消除该风险，属后续增强。

## 4. 实施步骤

### 第 0 步：安装官方 Neon Skills（执行者必读，保证文档与 CLI 用法最准）

在项目根目录执行用户指定命令：

```bash
npx neon@latest skills -s neon -s neon-postgres -y
```

该命令会在项目内安装 `neon` 与 `neon-postgres` 技能（含权威文档）。后续所有 Neon 控制台/CLI/SQL 细节以其校验为准，本方案与之一致。

### 第 1 步：准备 Neon 项目与角色

1. 在 [console.neon.tech](https://console.neon.tech) 创建项目（免费档即可；区域建议就近可选）；记下 compute host（形如 `ep-xxx-xxxx.region.aws.neon.tech`）。
2. 用 Neon CLI（`neonctl`/`npx neon@latest ...`，技能内有命令）或控制台创建两个登录角色并设强密码：

   - `nav_read`：`SELECT` 公开表权限 + `apply`/`click_stats` 的插入权限（RLS 过滤可见性）

   - `nav_admin`：`public` schema 全表 `ALL` + 序列权限
3. 组装两条连接串（**直连**，非 -pooler；`sslmode=require`）：

   - `postgresql://nav_read:<pwd>@ep-xxx....neon.tech/neondb?sslmode=require`

   - `postgresql://nav_admin:<pwd>@ep-xxx....neon.tech/neondb?sslmode=require`
     （HTTP 驱动会将其重写为 `https://<host>/sql` 请求；此二条仅用于环境变量与本地验证，勿提交仓库。）

### 第 2 步：迁移 Schema / 种子数据 / RLS

新增 [database/neon\_schema.sql](file:///workspace/database/neon_schema.sql)（由 supabase\_schema.sql 衍生），并在 Neon SQL Editor（或 psql，以拥有 `CREATEROLE` 的项目主角色执行）一次性执行：

1. **DDL（保持不变）**：`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` + 6 表 + 索引 + 种子数据（原样拷贝，无需改类型——本就是 PostgreSQL）。
2. **RLS 重写**（删除所有 `auth.role()` 策略，改按角色授权）：

   - 每表 `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`

   - `nav_read`（公开只读 + 匿名提交）：

     ```sql
     CREATE POLICY rd_visible ON categories FOR SELECT TO nav_read USING (is_visible = true);
     CREATE POLICY rd_visible ON links      FOR SELECT TO nav_read USING (is_visible = true);
     CREATE POLICY rd_config   ON config    FOR SELECT TO nav_read USING (true);
     CREATE POLICY rd_active   ON search_engines FOR SELECT TO nav_read USING (is_active = true);
     CREATE POLICY rd_insert   ON apply      FOR INSERT TO nav_read WITH CHECK (true);
     CREATE POLICY rd_insert   ON click_stats FOR INSERT TO nav_read WITH CHECK (true);
     -- 注意: apply 默认不再对匿名开放 SELECT（改进原 anon_select_apply 疏漏）;
     -- click_stats 仅插入, 统计查询走 nav_admin
     ```

   - `nav_admin`（超级管理员，全行可见，含 is\_visible=false 的软删行，保持后台可恢复）：

     ```sql
     CREATE POLICY ad_all ON categories FOR ALL TO nav_admin USING (true) WITH CHECK (true);
     CREATE POLICY ad_all ON links      FOR ALL TO nav_admin USING (true) WITH CHECK (true);
     CREATE POLICY ad_all ON config     FOR ALL TO nav_admin USING (true) WITH CHECK (true);
     CREATE POLICY ad_all ON apply      FOR ALL TO nav_admin USING (true) WITH CHECK (true);
     CREATE POLICY ad_all ON search_engines FOR ALL TO nav_admin USING (true) WITH CHECK (true);
     CREATE POLICY ad_all ON click_stats FOR SELECT TO nav_admin USING (true); -- 统计只读
     ```
3. **GRANT**（角色为 LOGIN 且无表权限时靠 GRANT 放行）：

   ```sql
   GRANT USAGE ON SCHEMA public TO nav_read, nav_admin;
   -- nav_read: SELECT 公开表 + apply/click_stats INSERT
   GRANT SELECT ON categories, links, config, search_engines TO nav_read;
   GRANT INSERT ON apply, click_stats TO nav_read;
   -- nav_admin: 全表 ALL（click_stats 用 SELECT/INSERT）
   GRANT ALL  ON categories, links, config, apply, search_engines TO nav_admin;
   GRANT SELECT, INSERT ON click_stats TO nav_admin;
   GRANT USAGE, SELECT ON SEQUENCE click_stats_id_seq TO nav_read, nav_admin;
   ```
4. **管理员凭据初始化**：将种子里 `config('admin_pwd',''...行)`替换为 bcrypt hash（`node -e "console.log(require('bcryptjs').hashSync('你的密码',10))"` 生成），执行 `UPDATE config SET value='<hash>' WHERE key='admin_pwd';`；`admin_user` 保持 `admin`（登录用户名）。

> 若项目主角色不可 `CREATE ROLE`，则改由 Neon CLI/控制台创建两个角色后再执行本 SQL（NNEW CLI 用法以第 0 步技能为准）。

### 第 3 步：前端依赖与数据库访问层改造

1. [package.json](file:///workspace/package.json#L11-L18)：

   - 移除 `@supabase/supabase-js`

   - 新增 `@neondatabase/serverless`（HTTP 驱动）、`bcryptjs`
2. 新增 [src/services/neon/index.ts](file:///workspace/src/services/neon/index.ts)，**完全实现** **[contracts.ts](file:///workspace/src/services/contracts.ts)** **的** **`Services`** **接口**：

   - 双客户端：`readSql = neon(VITE_NEON_DATABASE_URL)`；`adminSql` 惰性构造（仅登录后，`VITE_NEON_ADMIN_DATABASE_URL`）。每个方法内按 `isAuthenticated()`（localStorage 有有效 `auth_token`）选择 `adminSql`/`readSql`，与现行后台自动使用管理员能力的体验一致。

   - 逐方法 SQL 映射（要点）：

     | 方法                           | SQL                                                                                                                                          |
     | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
     | links.getAll / getByCategory | `SELECT * FROM links WHERE is_visible = true [AND category_id=$1] ORDER BY sort_order`                                                       |
     | links.getById                | `SELECT * FROM links WHERE id=$1 LIMIT 1` → 无则 null                                                                                          |
     | links.create                 | 先 `SELECT COALESCE(MAX(sort_order),0)+10 FROM links WHERE category_id=$1`，再 `INSERT ... RETURNING *`                                         |
     | links.update                 | `UPDATE links SET ..., updated_at=now() WHERE id=$1 RETURNING *`                                                                             |
     | links.remove                 | `UPDATE links SET is_visible=false WHERE id=$1`（软删除，行为不变）                                                                                    |
     | links.reorder                | 逐条 `UPDATE links SET sort_order=$1 WHERE id=$2`（可包在事务里）                                                                                      |
     | categories.\*                | 与 links 同构                                                                                                                                   |
     | config.getAll/get            | `SELECT key,value FROM config` / `... WHERE key=$1`                                                                                          |
     | config.set                   | `INSERT ... ON CONFLICT (key) DO UPDATE SET value=excluded.value`                                                                            |
     | apply.getAll/getByStatus     | `SELECT * FROM apply [WHERE status=$1] ORDER BY created_at DESC`（走后端管理走 nav\_admin）                                                          |
     | apply.create                 | `INSERT INTO apply (...) VALUES (...RETURNING *)`（readSql，匿名提交）                                                                              |
     | apply.approve                | 事务：读申请 → 计算 sort\_order → `INSERT INTO links` → `UPDATE apply SET status='approved'`（`sql.transaction([...])`）                               |
     | apply.reject                 | `UPDATE apply SET status='rejected' WHERE id=$1`                                                                                             |
     | searchEngines.\*             | 与 links 同构（过滤 `is_active`）                                                                                                                   |
     | stats.getOverview            | `SELECT count(*) FILTER (WHERE is_visible) ...` 或四条 COUNT 查询                                                                                 |
     | stats.getTopLinks            | `SELECT cs.link_id, l.title, count(*) c FROM click_stats cs JOIN links l ON l.id=cs.link_id GROUP BY 1,2 ORDER BY c DESC LIMIT $1`（替代原客户端聚合） |
     | stats.getTrend               | `SELECT to_char(clicked_at,'YYYY-MM-DD') d, count(*) FROM click_stats WHERE clicked_at>=$1 GROUP BY 1 ORDER BY 1`（前 N 天空缺日补 0 逻辑保留）          |
     | stats.recordClick            | `INSERT INTO click_stats(link_id,user_agent) VALUES($1,$2)`（readSql）                                                                         |

   - 所有调用包 `try/catch`：`(e as any).message` 含 PG 错误信息直接抛出；返回值为裸数据（契约要求）。
3. [src/services/index.ts](file:///workspace/src/services/index.ts)：分支改为 `rest` / `neon`，**默认（未设置或非 rest）走 neon**；删除 supabase import。
4. [vite.config.ts](file:///workspace/vite.config.ts#L21)：manualChunks 的 `@supabase/supabase-js → @neondatabase/serverless`。

### 第 4 步：自建极简 JWT 鉴权

在 [src/services/neon](file:///workspace/src/services/neon/index.ts) 的 `auth` 服务内实现：

1. `login(username, password)`：

   - `readSql` 查 `SELECT value FROM config WHERE key IN ('admin_user','admin_pwd')`；

   - 校验 `username === admin_user`，且 `bcrypt.compareSync(password, admin_pwd_hash)`（不变量为空时报错）；

   - 通过后使用 WebCrypto `crypto.subtle.importKey('raw', enc.encode(VITE_NEON_JWT_SECRET), {name:'HMAC',hash:'SHA-256'}, false, ['sign'])` + `sign()`，自签 HS256 JWT：
     `header {alg:HS256,typ:JWT}`；`payload {sub:'admin', role:'admin', iat, exp: iat+7*86400}`；base64url 拼接。

   - `localStorage.setItem('auth_token', token)`；返回 token（维持契约）。
2. `logout()`：`localStorage.removeItem('auth_token')`。
3. `getToken()` / `isAuthenticated()`：沿用现有 localStorage 语义。
4. 说明：路由守卫与 [auth.ts](file:///workspace/src/stores/auth.ts) 仅依赖 `exp` 载荷与 `auth_token` 键，**无需改动**；[LoginView.vue](file:///workspace/src/views/admin/LoginView.vue) 文案"用户名"/“密码”语义不变（管理员用户名来自 `config.admin_user`）。

### 第 5 步：环境变量与 EdgeOne Pages 配置

新增根目录 [.env.example](file:///workspace/.env.example)（当前不存在，需创建）：

```env
# 后端模式: neon | rest（默认 neon）
VITE_BACKEND=neon
# 浏览器直连 Neon HTTP /sql 的连接串（角色 nav_read，RLS 过滤公开数据）
VITE_NEON_DATABASE_URL=postgresql://nav_read:xxx@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
# 登录后后台写操作使用的连接串（角色 nav_admin，勿泄露）
VITE_NEON_ADMIN_DATABASE_URL=postgresql://nav_admin:xxx@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
# 自签 JWT 的 HS256 密钥（≥32 字符随机串；与 bundle 同存，见 §7.4 风险说明）
VITE_NEON_JWT_SECRET=change-me-随机字符串
```

EdgeOne Pages 后台 → 环境变量（构建变量）新增上述 4 项（VITE\_ 前缀构建期内联）；删除或保留旧 `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` 均可（不再被引用）——建议删除避免混淆。部署方式沿用：构建命令 `npm run build`、输出目录 `dist`、无需 SPA fallback。

### 第 6 步：验证（详见 §6）

## 5. 行为差异与决策记录

| 项         | 原 Supabase                                     | 迁移后（Neon）                        | 说明                    |
| --------- | ---------------------------------------------- | -------------------------------- | --------------------- |
| 公开页面数据源   | anon key → PostgREST                           | 浏览器 → HTTP /sql（nav\_read + RLS） | 行为一致，仅传输方式变化          |
| 后台写       | authenticated JWT（服务端签发）                       | nav\_admin 连接串 + 客户端自签 JWT       | 见 §7.4 安全说明           |
| 登录标识      | username 实为邮箱（Supabase Auth）                   | 用户名（config.admin\_user）          | 移除对 Supabase Auth 的依赖 |
| 管理员密码     | Supabase Auth 账户密码                             | config.admin\_pwd 存 bcrypt hash  | 浏览器 bcryptjs 校验       |
| 申请列表匿名读   | `anon_select_apply USING(true)`（可匿名读全部申请，疑似疏漏） | 匿名不可读，仅 nav\_admin               | 安全改进；前台页面无感知          |
| 隐藏行（软删）可见 | authenticated 可见全部                             | 仅 nav\_admin 可见                  | 后台恢复功能保留              |
| 数据一致性     | —                                              | 种子重新初始化                          | 用户已确认                 |

## 6. 验证步骤

### 6.1 数据库层（psql / Neon SQL Editor）

1. `\dt`：6 张表齐全；`SELECT count(*)` 校验种子：categories=6、search\_engines=5、links=按种子约 60 条、config 约 14 行。
2. RLS 负向验证：

   - `SET ROLE nav_read;`（或直接用 nav\_read 连接）：`SELECT` links 只见 `is_visible=true`；`INSERT INTO links` 报权限错误；`SELECT` apply 禁止；`INSERT INTO click_stats` 成功。

   - nav\_admin：可见任意行、可写、可查统计。
3. `config.admin_pwd` 为有效 bcrypt hash（长度 60，`$2a$10$` 前缀）。

### 6.2 功能层（本地 `npm run dev`）

1. 首页：分组/链接/搜索引擎/配置文案正常渲染；新建一个 `is_visible=false` 链接后前台不显示。
2. 前台申请：提交后 apply 表 +1；点击任一链接后 click\_stats +1（浏览器控制台无 CORS 报错——首次直连即确认 `https://<host>/sql` 的 CORS 放行）。
3. 后台：`#/admin/login` 用 admin\_user + 密码登录成功进入 dashboard；链接/分组/配置/搜索引擎 CRUD 与拖拽排序生效；软删后列表仍可见（可恢复）；申请审核通过后自动生成链接；统计面板数字与 6.1 一致。
4. 令牌：localStorage 出现 `auth_token`（JWT 三段式）；伪造/篡改 token 后刷新被路由守卫拦截回登录页。

### 6.3 构建与线上

1. `npm run build` 通过（vue-tsc 无类型错误；注意本仓库 build 脚本先 `rm -rf node_modules && npm install`，耗时长属正常）。
2. 产物 `dist/` 上传 EdgeOne Pages，后台配好 §5 环境变量后触发部署。
3. 线上复测 6.2 全流程；确认 `VITE_NEON_*` 已内联构建（页面可正常读写即证明）。

## 7. 风险与可选加固

1. **CORS**：浏览器直连 `https://ep-xxx...neon.tech/sql` 需 Neon 允许跨域。第 6.2 步第 2 项为前置门禁；若被拦，排查 Neon 侧 HTTP 端点 CORS 配置（本方案未用 Data API，若确认 /sql 默认不放行，则需改用 §7.5 代理方案并回到 Data API 或改用 WebSocket 驱动）。
2. **凭据内联**：`VITE_NEON_ADMIN_DATABASE_URL` 出现在 bundle 中，等于公开泄露管理凭据（可在 EdgeOne 环境变量中通过“不同值+构建后无法读取”缓解程度有限）。本站数据敏感度低，可接受；否则见 §7.5。
3. **密钥轮换**：`VITE_NEON_JWT_SECRET` 变更会使旧 token 失效（本地 exp 校验在客户端，无服务端吊销——自签方案的固有局限）。
4. **事务**：HTTP 驱动无交互式事务；`apply.approve` 用 `sql.transaction([...])` 非交互事务保证原子性（若版本不支持则接受两步执行的轻微非原子风险并在代码注释说明）。
5. **可选加固（后续）**：在 EdgeOne Functions 部署极薄一层 `/api/auth/login`（bcrypt 校验 + 服务端持 `JWT_SECRET` 签发）与 `/api/*` 写代理；数据库读仍可保持前端直连（nav\_read）。届时 `VITE_NEON_ADMIN_DATABASE_URL` 与 `VITE_NEON_JWT_SECRET` 不再进 bundle，安全模型升级为等效 Supabase Auth；工作量外加一个 Functions 工程，本方案预留该演进路径（auth 服务接口已抽象，替换实现即可）。

## 8. 明示假设

- 线上无必须保留数据（用户已选择种子重新初始化）；若后续发现需保留，改走 `pg_dump -h <supabase-host> --data-only -t categories -t links ...` 管道导入 Neon（角色权限与 RLS 不影响 owner 级数据恢复）。

- Neon 项目主角色具备创建角色/执行 GRANT 的权限（Neon 默认角色通常满足；否则角色改由 CLI/控制台创建）。

- `@neondatabase/serverless` 浏览器直连到 `/sql` 的 CORS 默认放行（§6.2 第 2 项验证）。

- `backend-reference`（MySQL 参考后端）与 `rest` 服务保持不动；本次仅替换 `supabase` 实现。

