# 三项功能优化方案：管理员凭据安全存储 / 抓取 API 配置化 / 首页图标风格统一

## 一、Summary（目标）

1. **管理员账号密码安全存储**：`admin_user` / `admin_pwd` 目前经后台「站点配置」页保存时会以明文存入数据库 `config` 表。改为统一存储 bcrypt 哈希（成本因子固定 10），并保留现有读取、登录校验逻辑（Neon 模式数据库侧 `pgcrypto.crypt`、参考后端 `bcrypt.compare`）不受影响。
2. **「添加链接」抓取 API 地址可配置**：把 `LinksView.vue` 自动获取名称 / 图标时硬编码的两个地址（`https://lianjie.hjke.cn/api/title` 与 `https://a.favicon.im/{hostname}`）扩展为「站点配置」里可单独设置的两个配置项。
3. **首页链接图标统一手机 App 风格**：在 `LinkCard.vue` 的图片图标（及 HTML/SVG 图标）下方增加白色圆角底衬，形成类似手机 App 图标的白底展示。

## 二、Current State Analysis（现状分析）

### 数据层双后端

- **Neon 模式（默认 / 生产）**：前端公开读直连 Neon（`nav_read`，RLS 已排除 `admin_pwd`，见 [neon\_schema.sql](file:///workspace/database/neon_schema.sql#L125)）；后台读写走 EdgeOne Edge Function：[`edge-functions/api/[[default]].js`](file:///workspace/edge-functions/api/\[\[default]].js)。

- **REST 参考后端（可选）**：`backend-reference/`（Express + MySQL），模式由 `VITE_BACKEND` 切换。

- 两端都要改，以保证两种模式行为一致。

### 1. 明文存储问题

- 前端 [ConfigView.vue](file:///workspace/src/views/admin/ConfigView.vue#L155-L166) 的 `saveAll()` 会把页面所有配置项（含 `admin_pwd` 输入框明文）逐个 `PUT /api/config/:key`，原样写入 DB：

  - Edge Function `PUT /config/:key`（[L211-L218](file:///workspace/edge-functions/api/\[\[default]].js#L211-L218)）无差别 upsert，明文密码直接入库 → 与已实现的数据库侧 `pgcrypto.crypt` 校验不匹配，**登录反而会失败**。

  - 参考后端 [config.js](file:///workspace/backend-reference/src/routes/config.js#L36-L55) 同样明文入库；而 [auth.js](file:///workspace/backend-reference/src/routes/auth.js#L29-L36) 登录已用 `bcrypt.compare`，明文密码必然比对失败。

- `GET /api/config` 会返回 `admin_pwd`（参考后端明文/哈希原样返回；Edge Function 的 `GET /config` 返回哈希）——虽然仅认证后可读，仍属凭据泄露面，应屏蔽。

- 前端密码框 placeholder 已是「留空则不修改」，但当前实现空值也会被写库覆盖，语义未落地。

### 2. 抓取 API 硬编码

- [LinksView.vue](file:///workspace/src/views/admin/LinksView.vue#L308-L342) [`autoFetch()`](file:///workspace/src/views/admin/LinksView.vue#L308-L342)：

  - 图标：`https://a.favicon.im/${hostname}` 纯前端拼串（无需网络）。

  - 名称：`https://lianjie.hjke.cn/api/title?url=...` 网络请求，解析 `json.data.title`。

- 站点配置表为通用 key-value（`config` 表），新增两个配置项**无需改表结构**。

### 3. 首页图标无底衬

- [LinkCard.vue](file:///workspace/src/components/frontend/LinkCard.vue#L9-L32)：图片图标直接 `w-8 h-8 object-contain`，无背景，透明背景图标与毛玻璃卡片混色；HTML/SVG 图标也无底衬。首字母兜底已有圆角底但样式与图片分支不一致。

## 三、Proposed Changes（具体改动）

### 任务 1：管理员凭据安全存储

#### 1.1 Edge Function `edge-functions/api/[[default]].js`

1. **新增工具函数**（文件顶部附近）：

   ```js
   // bcrypt 哈希识别：$2a/$2b/$2y + 成本 + 53 位盐密文（共 60 字符）
   const isBcryptHash = (v) => typeof v === 'string' && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(v)
   const maskConfigKey = (key, value) => (key === 'admin_pwd' ? '' : value ?? '')
   ```
2. **`GET /config`（列表）**（[L201-L204](file:///workspace/edge-functions/api/\[\[default]].js#L201-L204)）：返回前对每行做 `maskConfigKey(row.key, row.value)`，`admin_pwd` 屏蔽为 `''`。
3. **`GET /config/:key`**（[L206-L209](file:///workspace/edge-functions/api/\[\[default]].js#L206-L209)）：`segments[1] === 'admin_pwd'` 时返回 `null`。
4. **`PUT /config/:key`**（[L211-L218](file:///workspace/edge-functions/api/\[\[default]].js#L211-L218)）写入前特判 `admin_pwd`：

   - 空串 / 空白 → **不修改**，直接返回 `ok({ key, value: null })`（落实「留空则不修改」）。

   - 已是 bcrypt 哈希（`isBcryptHash`）→ 原样保存（防止前端/接口把已哈希值二次哈希）。

   - 其余明文 → 改由**数据库侧 pgcrypto 哈希**（沿用登录同款方案，Neon 独立 CPU，规避边缘函数单次 200ms CPU 限制，README 已说明 cost≥11 有超限风险，固定 cost=10）：

     ```js
     await sql`
       INSERT INTO config (key, value) VALUES ('admin_pwd', crypt(${trimmed}, gen_salt('bf', 10)))
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
     `
     return ok({ key, value: null })
     ```

   - 其余配置键路径不变。登录逻辑（数据库侧 crypt 校验）不动 → 校验逻辑可用性保留。

#### 1.2 参考后端 `backend-reference/src/routes/config.js`

1. 顶部引入 `const bcrypt = require('bcryptjs');`；声明 `isBcryptHash` 与 `BCRYPT_COST = 10`。
2. **`GET /`**（[L7-L18](file:///workspace/backend-reference/src/routes/config.js#L7-L18)）：`admin_pwd` 返回 `''`。
3. **`GET /:key`**（[L21-L33](file:///workspace/backend-reference/src/routes/config.js#L21-L33)）：`key === 'admin_pwd'` 返回 `{ value: null }`。
4. **`PUT /:key`**（[L36-L55](file:///workspace/backend-reference/src/routes/config.js#L36-L55)）特判 `key === 'admin_pwd'`：

   - 空白 → 不写库，返回 `{ message: '密码未修改' }`；

   - `isBcryptHash(value)` → 原样写；

   - 否则 `bcrypt.hash(value, 10)` 后写。

   - `auth.js` 登录（`bcrypt.compare`）不动。

#### 1.3 前端 `src/views/admin/ConfigView.vue`

1. `saveAll()`：遍历时跳过 `admin_pwd` 为空/空白的情况（先 `trim`）——落实「留空则不修改」；非空才 PUT（后端负责哈希）。
2. 密码输入框下补充说明文案：`<p class="text-xs text-gray-400 mt-1">新密码将以加密哈希形式存储；留空表示不修改</p>`。
3. `admin_user` 维持明文存储不变（用户名非机密，且登录直接比对用户名）。

> 说明：Neon 模式下 `GET /api/config` 前端走 `nav_read` 直连，RLS 已排除 `admin_pwd`；REST 模式下由 1.2 的 GET 屏蔽兜底。两端屏蔽后密码永远不回显，输入框保持为空 + 占位符，语义自洽。

### 任务 2：抓取名称 / 图标 API 可配置

#### 2.1 站点配置新增两个 key（通用 key-value，免改表结构）

| 配置 key           | 含义                                                                                                         | 默认值                                           |
| ---------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `fetch_name_api` | 自动获取 **名称** 的 API 地址（URL 模板，支持 `{url}` / `{hostname}` 占位，无占位符则自动追加 `?url=`）                                | `https://lianjie.hjke.cn/api/title?url={url}` |
| `fetch_icon_api` | 自动获取 **图标 URL** 的 API 地址（URL 模板，支持 `{hostname}` / `{url}` 占位；**无占位符**时视为 JSON 接口，请求后解析 `data.icon`/`icon`） | `https://a.favicon.im/{hostname}`             |

#### 2.2 `src/views/admin/ConfigView.vue`

- `config` 响应式对象新增两项（初始值即上述默认值，`onMounted` 仅覆盖 DB 中已存在的 key → 老站点未配置时行为与现在一致，保存时自动落库显式持久化）。

- 新增「抓取设置」卡片区块（排在「管理员设置」之前），两个输入框 + placeholder 提示占位符语法：

  - 名称抓取 API：`fetch_name_api`

  - 图标抓取 API：`fetch_icon_api`

#### 2.3 `src/views/admin/LinksView.vue` 的 `autoFetch()`

1. 顶部定义默认常量（当前硬编码值）+ 类型如 `Record<string, string>` 引用。
2. `onMounted` 时额外读取 `services.config.getAll()`，取 `fetch_name_api` / `fetch_icon_api`（回退默认常量）。
3. 抽取小工具函数（组件内私有）：

   ```ts
   // 渲染 URL 模板：{url}=encodeURIComponent(原始URL), {hostname}=hostname；无占位符则追加 ?url=
   function resolveFetchUrl(template: string, url: string, hostname: string): string
   // 宽容解析名称/图标：json.data?.title ?? json.title ?? json.name / json.data?.icon ?? json.icon
   ```
4. `autoFetch` 改造：

   - **图标**：

     - `fetch_icon_api` 含占位符（`{hostname}` 或 `{url}`）→ 与现在一致纯前端拼串立即填充（无需网络）；

     - 不含占位符 → 视为 JSON API，`fetch(resolveFetchUrl(...))` 解析 `data.icon`/`icon` 填充；失败则回退默认模板 `https://a.favicon.im/${hostname}`（图标失败不中断，仍有兜底）。

   - **名称**：`fetch(resolveFetchUrl(fetch_name_api, raw, hostname))`，解析 `data.title`（宽容解析），`!form.title || force` 时覆盖。失败静默（沿用现状，允许手填）。

   - 保持「仅添加模式生效」「force 强制覆盖」等现状逻辑不变。

### 任务 3：首页图标白底统一风格

#### 3.1 `src/components/frontend/LinkCard.vue`

- **图片图标**分支（`v-if="isImageIcon && !imageError"`）：外包一层白色圆角容器：

  ```html
  <div class="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center overflow-hidden">
    <img :src="link.icon!" :alt="link.title" class="w-6 h-6 object-contain" loading="lazy" decoding="async" @error="imageError = true" />
  </div>
  ```

- **HTML/SVG 图标**分支（`v-else-if`）：同样包白底圆角容器（保持 `group-hover:scale-110` 动画）：

  ```html
  <div class="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-2xl group-hover:scale-110 transition-transform" v-html="link.icon"></div>
  ```

- **首字母兜底**分支：维持现有圆角块（与白底圆角视觉统一，无需改动）。

- 图标尺寸内缩（图片 `w-6 h-6`）留出白边，呈现类手机 App 图标的白底方块观感；不改变外层 `w-10 h-10` 容器与卡片布局。

## 四、Assumptions & Decisions（假设与决策）

1. **Neon 为默认/生产后端**，`backend-reference` 为参考模式，两端同步修改以保持一致（改动量小、行为等价）。
2. **`admin_pwd`** **永不回显**（GET 屏蔽为空/`null`），前端密码框永远为空 + 「留空则不修改」；设置新密码由后端哈希（Neon 用数据库侧 `pgcrypto.crypt(…, gen_salt('bf',10))`，参考后端用 `bcrypt.hashSync(v,10)`）。已存在的 bcrypt 哈希保存时原样入库，避免二次哈希。bcrypt 成本因子固定 10（遵循 README/schema 中对 EdgeOne 200ms CPU 限制的既有约束）。
3. **用户名** **`admin_user`** **保持明文**（非机密凭据，登录按用户名比对）。
4. **抓取接口继续由浏览器前端直接调用**（现状如此，不新增后端代理路由）；`fetch_icon_api` 同时支持「URL 模板」与「JSON API」两种形态：含 `{hostname}`/`{url}` 占位符走拼串，无占位符走请求解析——兼容现有 favicon 服务用法，也满足"API 地址"语义。
5. **新增配置项仅作用于后台「添加链接」弹窗的** **`autoFetch`**；前台申请收录页（`ApplyView.vue`）的自动获取走的是另一套 favicon 推断逻辑，不在本次需求范围内，不动。
6. **无数据库结构变更**（`config` 为通用 key-value；RLS 策略已排除 `admin_pwd` 对 `nav_read` 的可见性，无需改 schema）。

## 五、Verification（验证步骤）

1. **类型检查与构建**：在项目根目录执行 `npm run build`（含 `vue-tsc` 类型检查）与 `node --check`（对改动过的 JS 文件）确认无编译错误。
2. **前端人工验证**（`npm run dev`）：

   - 后台「站点配置」：能看到新增「抓取设置」区（两个 API 输入框已带默认值）；管理员密码留空保存 → 配置保存成功且密码不变；输入新密码保存 → 管理端退出后可用新密码登录；旧密码失效；刷新页面密码框为空。

   - 后台「链接管理」→ 添加链接：输入 URL 失焦/点「自动获取」→ 名称、图标按配置的 API 填充；把配置里的两个 API 地址改为自建/占位模板后行为随之变化。

   - 首页：有图标的链接呈现白色圆角底衬 + 居中图标（App 风格）；无图标/纯 HTML 图标兜底样式正常、无布局偏移。
3. **后端逻辑复查**：

   - Neon：确认 `PUT /config/admin_pwd` 明文被哈希写入（可由 `GET /config` 不再返回 `admin_pwd` 及登录校验通过佐证）；`GET /config` 不含 `admin_pwd`；`admin_pwd` 为 bcrypt 形状时原样保存。

   - REST：`PUT /api/config/admin_pwd` 同上；`GET /api/config` 不再返回 `admin_pwd`；`POST /api/auth/login` 用新密码可登录。
4. 若环境可用，`curl` 直接抽查 Edge Function / REST 接口的上述行为。

