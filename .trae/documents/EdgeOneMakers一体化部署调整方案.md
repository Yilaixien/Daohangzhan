# 项目部署形态调整：EdgeOne Pages + 独立边缘函数 → EdgeOne Makers 单项目一体化部署

## 1. 概述

背景：腾讯云已将 **EdgeOne Pages 升级为 EdgeOne Makers**，平台本身内置函数（Edge Functions / Cloud Functions）能力。当前项目把「前端静态站点」与「后台代理边缘函数」拆成两个部署单元（旧方案：EdgeOne Pages 上传 `dist/` + 另行部署 EdgeOne Functions 边缘函数），需要调整为**整个项目作为一个 Makers 项目部署**，函数随项目一同构建/部署，不再单独部署边缘函数。

依据官方文档核实的关键机制（EdgeOne Makers / Edge Functions，2026-06\~08 文档）：

- 函数以 `项目根/edge-functions` 目录提供，**文件系统即路由**：`edge-functions/api/[[default]].js` → `example.com/api/**`（多级匹配）；静态资源路由优先于函数路由。

- 函数入口：`export default function onRequest(context)`（Web 标准 `Response`）；`context.request` 为 `Request`；**`context.env`** **为 Makers 环境变量**；运行时基于 V8 + Web Service Worker API（无 Node 内建，不依赖 `process.env`）。

- 使用限制：代码包 ≤5MB、请求 body ≤1MB、**单次执行 CPU 时间 200ms（不含 I/O 等待）** —— 影响 bcrypt 成本因子选择。

- 部署：`npm install -g edgeone` → `edgeone login` → `edgeone makers init/dev/link/deploy [<dir|zip>]`；手动构建时需将 `edge-functions` 文件夹与 `package.json` 放入输出目录（如 `dist/`）后 `edgeone makers deploy ./dist`。

- 环境变量：在 Makers 控制台配置项目环境变量（`VITE_*` 供构建期注入前端，`DATABASE_URL_ADMIN`/`JWT_SECRET` 供函数经 `context.env` 读取）；`edgeone makers link` 可将控制台变量同步到本地调试。

## 2. 现状分析（与本调整相关的文件）

| 文件                                                                                               | 现状                                                                                                | 问题                                                               | <br />          | <br />                              |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | :-------------- | :---------------------------------- |
| [edge-functions/index.js](file:///workspace/edge-functions/index.js)                             | 单一入口，`handleRequest(request)`（Web Request/Response），模块顶层读 `process.env`，部署说明为「单独部署到 EdgeOne 边缘函数」 | ①不合 Makers 文件系统路由约定；②顶层 `process.env` 无法读取 `context.env`；③部署说明过时 | <br />          | <br />                              |
| [edge-functions/package.json](file:///workspace/edge-functions/package.json)                     | 独立依赖声明（jose / bcryptjs / @neondatabase/serverless）                                                | 依赖需随产物进入部署目录，平台打包方式需实测                                           | <br />          | <br />                              |
| [package.json](file:///workspace/package.json)                                                   | `build` 脚本仅 `vue-tsc -b && vite build`，产物不含函数目录与函数依赖                                              | 构建脚本需并入函数目录/依赖，满足 Makers「输出目录自包含」要求                              | <br />          | <br />                              |
| [src/services/neon/index.ts](file:///workspace/src/services/neon/index.ts#L16-L18)               | \`apiBase = VITE\_API\_BASE\_URL                                                                  | <br />                                                           | ''\`（空串时相对路径失效） | 同域部署下应默认 `/api`（Makers 同站函数路由），消除跨域 |
| [.env.example](file:///workspace/.env.example)                                                   | `VITE_API_BASE_URL` 示例为独立函数域名                                                                     | 需改为 `/api` 并说明 Makers 一体化                                        | <br />          | <br />                              |
| [README.md](file:///workspace/README.md)                                                         | 「EdgeOne Pages 部署」+「EdgeOne Functions 部署（后台代理，Neon 模式必需）」两节；路由表/环境变量/项目结构树按两段式描述                  | 需重构为单一 Makers 项目部署                                               | <br />          | <br />                              |
| [.trae/documents/Supabase迁移Neon实施方案.md](file:///workspace/.trae/documents/Supabase迁移Neon实施方案.md) | 设计文档中部署/验证/风险章节为「独立部署边缘函数」                                                                        | 需同步为 Makers 一体化表述（作为架构设计文档保持与实现一致）                               | <br />          | <br />                              |
| [database/neon\_schema.sql](file:///workspace/database/neon_schema.sql)、README 管理后台节             | bcrypt 成本因子提示「10\~12」                                                                             | Edge Functions CPU 200ms 限制下 cost=12 有超限风险，统一为 10 并注明原因          | <br />          | <br />                              |

## 3. 改动方案（逐文件）

### 3.1 函数入口：迁入 Makers 路由约定（核心）

**[edge-functions/index.js](file:///workspace/edge-functions/index.js)** **→ 新增** **[edge-functions/api/\[\[default\]\].js](file:///workspace/edge-functions/api/\[\[default]].js)**

- 将现有 `index.js` 全部逻辑（`neon()` SQL、jose 签发/验签、bcrypt、CORS、`handleApi` 全路由、`handleRequest`）平移至新入口，路由语义不变（前端 `/api/**` 仍命中）。

- 平台适配层改为 Makers 约定：

```js
export default function onRequest(context) {
  return handleRequest(context.request, context.env)
}
```

- **环境变量注入改造（关键）**：模块顶层不再读 `process.env`（边缘运行时无 `process`）。改为按请求惰性初始化、**按值缓存**，兼容 `context.env`（线上）与 `process.env`（本地/工具调试）：

```js
const runtimeCache = new Map()
function getRuntime(env) {
  const dbUrl = env?.DATABASE_URL_ADMIN || process.env?.DATABASE_URL_ADMIN
  const jwtSecret = env?.JWT_SECRET || process.env?.JWT_SECRET
  const cacheKey = `${dbUrl}::${jwtSecret}`
  if (!runtimeCache.has(cacheKey)) {
    if (!dbUrl || !jwtSecret) throw new Error('缺少环境变量 DATABASE_URL_ADMIN / JWT_SECRET')
    runtimeCache.set(cacheKey, {
      sql: neon(dbUrl), // neon() 返回连接池 → 必须全局单例，按 cacheKey 只创建一次
      secret: new TextEncoder().encode(jwtSecret),
    })
  }
  return runtimeCache.get(cacheKey)
}
```

> 注意：缓存键不可用 `env` 对象本身——`context.env` 每次请求都由平台新建对象，用对象做键会永远 miss，导致每个请求都 `neon()` 新建连接池，最终内存溢出。按 `dbUrl::jwtSecret` 字符串缓存为唯一正确做法。

- 顶部注释同步更新：路由约定、`context.env`、一键部署说明。

- **删除**旧 `edge-functions/index.js`（避免平台为容器外的 `index.js` 生成根路由 `example.com/` 干扰静态首页）。

### 3.2 函数依赖与构建产物
**[edge-functions/package.json](file:///workspace/edge-functions/package.json)**：声明函数依赖（jose / bcryptjs / @neondatabase/serverless）。
**[package.json](file:///workspace/package.json)**（根）：
- `dependencies` **同时**声明 `jose` / `bcryptjs`（与 edge-functions/package.json 一致）。原因（线上构建实测）：Makers 平台以**仓库根 node_modules** 打包函数，并不会为 `edge-functions/` 子目录单独安装依赖；若只写在函数目录，打包报 `Could not resolve "jose"/"bcryptjs"` 并回退为纯静态站点（无函数路由）。这两包不被前端 import，Vite 不会打入前端产物，不影响前端体积与构建。
- `build` 脚本：纯构建 + 产物自包含：

```json
"build": "vue-tsc -b && vite build && cp -r edge-functions dist/edge-functions && cp edge-functions/package.json dist/edge-functions/package.json"
```

（`cp -r edge-functions dist/edge-functions` 已含 `package.json`；末句为显式声明，幂等无害。）产物 `dist/` 内函数目录自包含，`edgeone makers deploy ./dist` 即可被平台识别并按其 `edge-functions/package.json` 安装函数依赖。

### 3.3 前端同域 API 基地址

**[src/services/neon/index.ts](file:///workspace/src/services/neon/index.ts#L16-L18)**：

```ts
const apiBase = (import.meta.env.VITE_API_BASE_URL as string) || '/api'
```

原因：Makers 同域部署后函数路由即 `example.com/api/**`，默认相对路径 `/api` 消除跨域；仍保留 `VITE_API_BASE_URL` 覆盖能力（如本地自定义/迁移期）。

### 3.4 环境变量示例

**[.env.example](file:///workspace/.env.example)**：`VITE_API_BASE_URL` 示例值与注释改为：

```env
# EdgeOne Makers 同站函数路由（edge-functions/api/**）; 如需自定义域名再覆盖
VITE_API_BASE_URL=/api
```

并补充说明：`DATABASE_URL_ADMIN` / `JWT_SECRET` 配置在 Makers 控制台环境变量（函数经 `context.env` 读取），不写此文件。

### 3.5 文档同步

**[README.md](file:///workspace/README.md)**：

- 「EdgeOne Pages 部署」「EdgeOne Functions 部署」两节合并重构为「**EdgeOne Makers 一体化部署**」：创建/克隆 Makers 项目 → `edgeone login` → 控制台配置环境变量（VITE\_\* 与 DATABASE\_URL\_ADMIN/JWT\_SECRET）→ 构建（`npm run build`，产物自包含函数）→ `edgeone makers deploy ./dist`（或控制台上传 dist）；本地调试 `edgeone makers dev`（函数与前端同端口，`VITE_API_BASE_URL=/api` 同域调用）。

- 路由表前补充一句：函数路由即文件系统路由（`edge-functions/api/[[default]].js` 承载全部 `/api/**`）。

- `env.example` 段落、环境变量表、项目结构树同步（`edge-functions/api/[[default]].js`）。

- 保留「宝塔 Nginx + PM2（参考 REST 后端）」小节并标注与 Makers 部署无关（rest 模式仍可用）。

- 技术栈表「EdgeOne Functions」行改为「EdgeOne Makers Edge Functions（项目内 `/edge-functions`）」。

- bcrypt 成本因子统一描述为 10（配合 Edge Functions CPU 200ms 限制，见 3.6）。

**[.trae/documents/Supabase迁移Neon实施方案.md](file:///workspace/.trae/documents/Supabase迁移Neon实施方案.md)**（作为架构设计文档与实现保持一致）：同步 §3 架构图、§4 第 4 步（函数部署）、§5 表格、§6 验证、§7-6（EdgeOne Functions 依赖风险）中「单独部署边缘函数」的表述为「单 Makers 项目一体化部署」。

### 3.6 bcrypt 成本因子一致性修正（小改）

- [database/neon\_schema.sql](file:///workspace/database/neon_schema.sql)：注释与 [README.md](file:///workspace/README.md) 中「成本因子 10~~12」统一为~~ **~~10~~**~~，注明：Edge Functions 单次 CPU 200ms 限制下 cost≥11 有超限风险，10 为安全取值（bcryptjs 纯 JS，cost=10 单次约 50~~150ms）。

## 4. 假设与决策

- 前端 `apiFetch` 路径与函数路由天然对齐（`/auth/login`、`/links` 等均在 `edge-functions/api/[[default]].js` 分发逻辑内），**业务契约与路由表不变**。

- Makers 平台以**仓库根 node_modules** 打包函数（实测修正）：`jose`/`bcryptjs` 需同时声明在根 package.json 与 edge-functions/package.json；执行期仍以 `edgeone makers dev`/`deploy` 实测复核。

- `rest`（MySQL 参考后端）模式不受影响；`VITE_BACKEND`/`VITE_NEON_DATABASE_URL` 构建期用法不变。

- 不手工生成 `edgeone.json`/示例函数：由执行者运行 `edgeone makers init`/`dev` 时按 CLI 实际提示生成/确认，避免臆造配置格式。

- 环境变量在 Makers 控制台统一管理：构建变量（VITE\_\*）与函数变量（DATABASE\_URL\_ADMIN/JWT\_SECRET）同一处配置；`edgeone makers link` 可同步本地调试。

## 5. 验证步骤

1. **语法/静态**：`node --check 'edge-functions/api/[[default]].js'`（方括号路径需引号）通过；确认旧 `edge-functions/index.js` 已删除。
2. **构建产物**：`npm install`（根，一次即可）→ `npm run build` 通过（不再清空重装 node\_modules）；检查 `dist/` 内含 `edge-functions/api/[[default]].js` 与 `edge-functions/package.json`（含 jose/bcryptjs/@neondatabase/serverless 声明）；确认根 package.json 不含 jose/bcryptjs、产物 JS 中无 `DATABASE_URL_ADMIN`/`JWT_SECRET` 字样（grep 抽查）。
3. **本地函数调试（执行期实测项，需用户环境）**：`npm i -g edgeone` → `edgeone login`（选 China）→ `edgeone makers dev`：验证 ①函数依赖能否解析（jose/bcryptjs/@neondatabase/serverless）；②`context.env` 读取到控制台同步的环境变量；③`POST /api/auth/login` 正确签发/401；④同域 `VITE_API_BASE_URL=/api` 下浏览器无 CORS 报错。
4. **部署（用户侧）**：控制台创建 Makers 项目并配置环境变量 → `edgeone makers deploy ./dist`（或控制台上传）→ 线上复测：首页渲染、申请提交、点击统计、后台登录/CRUD/审核/统计、伪造 token 被函数 401 拦截。
5. **文档一致性**：README 部署章节与实施文档表述与现状一致（单 Makers 项目，无「单独部署边缘函数」残留表述）。

## 6. 变更记录清单（供最终汇报复用）

| 文件                                                                                               | 变更                                                                             | 原因/影响                                                    |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------- |
| [edge-functions/api/\[\[default\]\].js](file:///workspace/edge-functions/api/\[\[default]].js)   | 新增（函数逻辑 + `onRequest(context)` 适配 + `context.env` 惰性注入）                        | 符合 Makers 文件系统路由，函数随项目部署                                 |
| [edge-functions/index.js](file:///workspace/edge-functions/index.js)                             | 删除                                                                             | 避免生成干扰静态首页的根路由；逻辑迁入新入口                                   |
| [edge-functions/package.json](file:///workspace/edge-functions/package.json)                     | 保留，声明函数依赖（jose / bcryptjs / @neondatabase/serverless）                      | 函数目录内自描述，供本地/平台参考 |
| [package.json](file:///workspace/package.json)                                                   | build 脚本去掉 `rm -rf node_modules && npm install`，追加复制函数目录进 dist；`dependencies` 增加 `jose`/`bcryptjs` | 消除重装隐患，产物自包含；函数打包依赖可被平台解析（前端不 import 这两包，不影响前端体积） |
| [src/services/neon/index.ts](file:///workspace/src/services/neon/index.ts#L16-L18)               | `apiBase` 默认 `/api`                                                            | Makers 同域路由，消除跨域；保留环境变量覆盖                                |
| [.env.example](file:///workspace/.env.example)                                                   | `VITE_API_BASE_URL=/api` + 说明                                                  | 同域部署示例                                                   |
| [README.md](file:///workspace/README.md)                                                         | 部署指南重构为单 Makers 项目；路由/环境变量/结构树同步                                               | 使用指南与现状一致                                                |
| [.trae/documents/Supabase迁移Neon实施方案.md](file:///workspace/.trae/documents/Supabase迁移Neon实施方案.md) | 同步部署/验证/风险章节                                                                   | 架构设计文档与实现一致                                              |
| [database/neon\_schema.sql](file:///workspace/database/neon_schema.sql)                          | bcrypt cost 统一为 10 的注释                                                         | 规避 Edge Functions CPU 200ms 限制                           |

无需修改：`src/services/contracts.ts`（契约不变）、`src/services/rest/index.ts`（rest 参考模式不受影响）、`backend-reference/`（MySQL 参考后端不变）、`.trae/specs/` 与历史 `/.trae/documents/` 其余方案（历史记录）。
