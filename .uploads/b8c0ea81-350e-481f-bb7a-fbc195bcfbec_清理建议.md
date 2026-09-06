# 项目结构审查与清理建议清单

> 审查时间：2026-09-03
> 技术栈前提：Vue 3 + Vite SPA，部署于腾讯云 EdgeOne Pages（Makers），数据层为 Neon Postgres（前台直连 `nav_read` + Edge Functions 代理后台 `nav_admin`）
> 审查方法：全量文件枚举 → 逐个追踪 import/引用 → 区分「构建链路依赖」「运行时依赖」「文档/IDE 残留」

---

## 一、目录结构逐项说明

### 1. 根目录文件

| 文件 | 用途 | 是否被引用 | 结论 |
|------|------|-----------|------|
| `package.json` | 项目清单。**构建脚本第 8 行是关键**：`vite build` 后自动把 `edge-functions/` 拷进 `dist/`，用 esbuild 打包函数入口，再删 `node_modules` | 构建入口 | **必须保留** |
| `package-lock.json` | 锁版本。构建脚本首步是 `npm ci`，严格执行此文件 | CI/构建 | **必须保留** |
| `vite.config.ts` | Vite 配置：`base: './'`（相对路径，适配 Pages）、`@` 别名、manualChunks 把 neon/chart/vuedraggable 拆包 | 构建 | **必须保留** |
| `index.html` | Vite 入口 HTML。含 `<link rel="icon" href="/vite.svg">` | 构建 | **保留**（见问题 ④） |
| `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json` | TS 项目引用配置，`vue-tsc -b` 类型检查依赖 | 构建 | **必须保留** |
| `env.d.ts` | Vite 客户端类型 + `*.vue` 模块声明 | 类型检查 | **必须保留** |
| `.env.example` | 环境变量模板：`VITE_BACKEND` / `VITE_NEON_DATABASE_URL` / `VITE_API_BASE_URL` | 文档 | **保留** |
| `.gitignore` | 忽略 `node_modules/`、`dist/`、`.env` 等 | Git | **保留**（见问题 ⑤） |
| `README.md` | 部署/架构/API 文档，质量较高 | 文档 | **保留**（见问题 ①②③） |
| `.edgeone/project.json` | Makers 项目绑定：`{"Name":"daohang2","ProjectId":"makers-whxtlsb9jkb3"}` | `edgeone` CLI 据此识别部署目标项目 | **必须保留，切勿删除** |

### 2. `src/` — 应用源码（208K，全部在用）

已逐个验证引用链，**无孤立文件**：

- **`main.ts`** — 创建 App、注册 Pinia/Router，挂载前 `useThemeStore(pinia).init()` 避免主题闪白
- **`App.vue`** — 仅 `<router-view />`
- **`router/index.ts`** — Hash 模式路由（故 Pages 无需 SPA fallback）+ JWT 过期守卫
- **`services/contracts.ts`** — 服务层接口契约（126 行）
- **`services/index.ts`** — **工厂**：按 `VITE_BACKEND` 动态 `import('./neon')` 或 `import('./rest')`
- **`services/neon/index.ts`**（355 行）— 默认通道：前台直连 Neon，后台走 `/api`
- **`services/rest/index.ts`**（225 行）— MySQL REST 备用通道，仅 `VITE_BACKEND=rest` 时加载
- **`stores/`** — `auth.ts`（AdminLayout/LoginView 用）、`home.ts`（HomeView 用）、`theme.ts`（main.ts/FrontendLayout/ThemeManageView 用），三者均有引用
- **`components/frontend/`** — 5 个组件全部被引用：`BackgroundImage`→FrontendLayout，`BackToTop`/`DateTimeDisplay`/`LinkCard`/`SearchBox`→HomeView
- **`composables/useDateTime.ts`** — DateTimeDisplay + HomeView 引用
- **`views/frontend/`** — HomeView、AboutView、ApplyView、FrontendLayout、NotFoundView（全在路由中）
- **`views/admin/`** — 8 个页面全部在路由中注册（含 ThemeManageView）
- **`style.css`** — 全局样式（Tailwind 4）

### 3. `edge-functions/` — 后端 API（24K）**核心，不可删**

- **`api/[[default]].js`**（387 行）— EdgeOne 文件系统路由的通配入口，承载全部 `/api/**`：登录签发 JWT、链接/分类/配置/搜索引擎 CRUD、收录审核、统计
- **`package.json`** — **函数依赖唯一声明**（`@neondatabase/serverless` + `jose`）。看似与根 `package.json` 重复，实为平台安装函数依赖的依据，**必须保留**

> 关键实现细节：密码校验已迁移到**数据库侧 `pgcrypto.crypt`**（`$2b$`→`$2a$` 归一化后交由 crypt 校验），以规避 Edge Functions 单次 200ms CPU 限制导致的 545 错误。这意味着 **edge 端已不再使用 bcryptjs**。

### 4. `database/`

| 文件 | 用途 | 结论 |
|------|------|------|
| `neon_schema.sql`（277 行） | Neon 建表 + 种子 + RLS 策略 + GRANT（双角色 nav_read/nav_admin） | **必须保留** |
| `mysql_schema.sql`（203 行） | MySQL 版 schema，仅服务 `rest` 模式 | **随套餐 B 决定** |

### 5. `backend-reference/`（48K）— Express + MySQL 参考后端

独立 Express 服务：`src/index.js` + `middleware/auth.js` + `routes/`（apply/auth/categories/config/links/searchEngines/stats），自带 `package.json` 与 `.env.example`。

**零项目内引用**——构建、部署、前端代码均未引用此目录（`grep` 全项目仅命中 README 与自身）。它只能靠人工 `cd backend-reference && npm start` 启动。

### 6. 工具链残留目录

| 目录 | 来源 | 体积 | 说明 |
|------|------|------|------|
| `.agents/skills/neon/` | 从 `neondatabase/agent-skills` 拉取 | 32K + 7.7K references | Neon 总览/路由型 skill |
| `.agents/skills/neon-postgres/` | 同上 | 9.0K | Neon Postgres 实践指南（与上一项内容重叠，前者会路由到后者） |
| `skills-lock.json` | 上述技能的来源与哈希锁 | — | 记录 source/computedHash，用于校验更新 |
| `.trae/specs/fix-homepage-display/` | Trae IDE 规格文档 | 6.0K | spec/tasks/checklist，5 项检查项与 2 个任务**均已完成 `[x]`** |
| `.trae-html-share-packages/index.html.zip` | Trae 的 HTML 分享导出 | 702B | 仅含 `index.html` + `src/main.ts` 两个文件 |

### 7. 构建产物残留

**`nav-site-dist.zip`（207K，38 个文件）** — 某次构建产物的打包快照，内容为 `index.html` + `assets/` + `edge-functions/`。

- 未被任何脚本引用；部署走的是 `edgeone makers deploy ./dist`，读的是 `dist/` 而非此 zip
- `.gitignore` 忽略了 `dist/`，却**没有忽略这个 zip**，导致它会被提交进仓库
- **已核查凭据安全**：内含的 `postgresql://user:password@host.tld` 为驱动内置占位符，`JWT_SECRET` 仅出现于 package.json 描述文字。**未发现真实 Neon 主机（`ep-*.neon.tech`）与真实凭据，无泄露风险**

---

## 二、清理清单（按优先级）

### 🟢 A 级：可立即安全删除

| # | 目标 | 体积 | 删除理由 | 删除前确认 |
|---|------|------|---------|-----------|
| A1 | `nav-site-dist.zip` | 207K | 陈旧的构建产物快照；部署只读 `dist/`，完全不读它；会污染仓库 | 确认当前线上版本不是从这个 zip 部署的（正常流程不会）。**建议先重命名观察一天再删** |
| A2 | `.trae-html-share-packages/index.html.zip` | 702B | Trae 的临时分享导出，内容只有两个文件的快照，无保留价值 | 无依赖 |
| A3 | `.trae/specs/fix-homepage-display/` | 6.0K | 该需求已 100% 闭环（5 项 checkbox + 2 个任务全 `[x]`，且已验证 `src/` 中 `announcement` 无残留） | 若 Trae 的 spec 面板仍需回看历史，可先归档 |

**执行后预期**：仓库瘦身约 214K，且消除一个「构建产物入库」的隐患。

### 🟡 B 级：建议删除（需先做一个决策）

这一组是**同生共死**的 `rest` 模式遗留，必须整体取舍，不能只删一部分：

- `backend-reference/`（48K）
- `database/mysql_schema.sql`
- `src/services/rest/index.ts`
- `src/services/index.ts` 中的 `rest` 分支（第 7-9 行）

**删除理由**：项目已确定部署在 EdgeOne Pages——这是**静态托管 + 边缘函数**环境，**没有任何常驻 Node 进程可供 Express 运行**。因此 `rest` 模式在目标部署形态下是一条**永远走不到的死路径**。保留它带来三重成本：① 48K 需持续维护的死代码；② 两套 schema 需同步演进，易产生漂移；③ 让新人误以为有两种等价后端可选。

**删除前必须确认**：
1. 确认线上 `VITE_BACKEND` 为 `neon`（默认即为 `neon`，若未显式设置过则必然是 `neon`）
2. 确认没有另外的服务器在跑 `backend-reference` 并指向同一个 MySQL
3. 若未来可能迁移到自建服务器，请**只删除本地副本、保留 Git 历史**即可（当前仓库非 Git 仓库，见风险提示）

**若暂不删除**：至少在 README 显著位置标注 `rest` 模式为「已冻结 / 不再维护」。

### 🟡 C 级：可选删除（价值判断）

| 目标 | 体积 | 理由 | 反方理由 |
|------|------|------|---------|
| `.agents/skills/neon/`<br>`.agents/skills/neon-postgres/`<br>`skills-lock.json` | 52K | 本项目 IDE 环境（WorkBuddy）读取的是 `~/.workbuddy/skills/` 与项目 `.workbuddy/skills/`，**不读取 `.agents/skills/`**；两份 Neon 文档内容高度重叠（`neon` 为路由入口，`neon-postgres` 为细则）；属于会过期的第三方 vendor 文档 | 若你仍用 Trae/Cursor/Codex 打开本项目，`.agents/skills/` 正是它们的约定目录，删掉会失去 Neon 上下文 |

**建议**：若已完全迁到 WorkBuddy → 删除；若仍混用 Trae → 保留，但可只留 `neon-postgres` + 相应精简 `skills-lock.json`。

### 🔴 D 级：不要删除（易误判为冗余）

| 目标 | 看似冗余的原因 | 实际作用 |
|------|--------------|---------|
| `.edgeone/project.json` | 只有一行 JSON | 绑定 Makers `ProjectId`，`edgeone` CLI 据此决定部署到哪个项目。**删了会导致重新部署时项目错乱** |
| `edge-functions/package.json` | 与根 `package.json` 依赖重复 | Makers 平台依据此文件安装函数依赖；根 `package.json` 是前端依赖。两者职责不同 |
| `src/services/contracts.ts` | 只有类型 | 服务层契约，`services/index.ts` 的 `Services` 类型来源，删了会直接编译失败 |
| `package-lock.json` | 体积大 | 构建脚本首步 `npm ci` 强依赖，缺失会构建失败 |
| `database/neon_schema.sql` | 只用一次 | 建库/重建库/迁移的唯一依据 |

---

## 三、发现的问题（非删除项，但建议一并修正）

### ① `bcryptjs` 已成为僵尸依赖

`edge-functions` 的密码校验已改为数据库侧 `pgcrypto.crypt`，**edge 端不再 import bcryptjs**（`edge-functions/package.json` 中也确实未声明它）。但根 `package.json` 仍把它列为 `dependencies`。

- 当前**无害**：前端代码从未 import 它，不会进入 bundle
- 它唯一的实际用途是 README 中的一次性命令 `node -e "...require('bcryptjs').hashSync(...)"` 生成密码哈希
- **建议**：移到 `devDependencies`（它本质是开发工具而非运行时依赖），或改用 `npx bcryptjs` 后从 dependencies 移除

### ② README 有三处描述已过期

| 位置 | 现描述 | 实际情况 |
|------|--------|---------|
| 第 18 行 | `jose` + **`bcryptjs`（管理员密码校验）** | 已是数据库侧 `pgcrypto.crypt` |
| 第 110 行 | "jose / bcryptjs 同时声明在根 package.json 与 edge-functions/package.json" | `edge-functions/package.json` 中**没有** bcryptjs |
| 第 230 行 | 函数依赖声明为 "jose/**bcryptjs**/@neondatabase/serverless" | 实际只有 `jose` + `@neondatabase/serverless` |

> 这三处过期描述有实际危害：会让后来的维护者误以为改密码校验逻辑要动 edge 代码。

### ③ README 项目结构图缺失文件

结构图未包含 `views/admin/ThemeManageView.vue`（实际存在且已接入路由 `/admin/theme`），也未包含 `.edgeone/`。建议补全。

### ④ `index.html` 引用了不存在的图标

`<link rel="icon" type="image/svg+xml" href="/vite.svg" />`，但项目**没有 `public/` 目录**，该 favicon 会 404。建议补一个 `public/favicon.svg`（或直接删除该 link 标签）。

### ⑤ `.gitignore` 覆盖不足

当前未忽略以下，建议补充：

```gitignore
# 构建产物快照
*.zip
# IDE / 工具链残留
.trae/
.trae-html-share-packages/
.agents/
```

---

## 四、执行顺序建议

```
1. 备份        → 整个项目目录复制一份（当前非 Git 仓库，无版本兜底！）
2. A 级删除    → nav-site-dist.zip / .trae-html-share-packages/ / .trae/specs/
3. 补 .gitignore → 加入 *.zip 等规则，防止再次入库
4. 决策 B 级   → 确认 VITE_BACKEND=neon 且无自建服务器后，整组删除 rest 遗留
5. 决策 C 级   → 按是否仍用 Trae 决定 .agents/ 去留
6. 修正问题    → bcryptjs 归类 + README 三处过期描述 + favicon
7. 回归验证    → npm run build && edgeone makers deploy ./dist
```

### ⚠️ 风险提示

**当前目录不是 Git 仓库**（无 `.git`）。这意味着删除操作**没有版本历史可回滚**，请务必先手动备份整个项目目录再执行任何删除。

### 回归验证清单

删除后执行以下检查确认无破坏：

```bash
npm run build          # 必须通过：vue-tsc 类型检查 + vite build + edge-functions 拷贝与打包
ls dist/edge-functions # 必须存在且含 api/[[default]].js
edgeone makers deploy ./dist
```

`src/` 目录本次审查未发现任何孤立文件，**不建议对 `src/` 做任何删除**。
