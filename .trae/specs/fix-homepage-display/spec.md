# 修复首页展示问题 Spec

## Why
当前首页存在两个问题：1) 收录公告（`apply_gg`）错误地显示在首页，该公告仅应在收录申请页面展示；2) 链接图标 URL 加载失败时，会回退到显示原始图标 URL 文本，应改为显示首字母占位符。

## What Changes
- 从首页移除收录公告区域（`HomeView.vue` 公告区块 + `home.ts` 中 `announcement` 状态）
- 修复 `LinkCard.vue` 图标加载失败时的回退策略：当 URL 图标加载失败，回退到首字母头像而非渲染原始 URL

## Impact
- Affected specs: `nav-site-spa` - 站点信息展示需求中的首页公告行为变更
- Affected code: `src/views/frontend/HomeView.vue`, `src/stores/home.ts`, `src/components/frontend/LinkCard.vue`

## MODIFIED Requirements

### Requirement: 站点信息展示
系统 SHALL 提供关于页面和公告区域，展示站点介绍和最新公告。

#### Scenario: 关于页面
- **WHEN** 用户访问关于页面
- **THEN** 系统展示管理员配置的站点介绍内容（支持 HTML 富文本）

#### Scenario: 收录公告
- **WHEN** 管理员在后台配置了收录公告内容
- **THEN** 收录申请页面展示公告区域，首页不展示收录公告

## REMOVED Requirements

### Requirement: 首页公告
**Reason**: 收录公告（`apply_gg`）仅应在收录申请页面展示，不应在首页展示。首页公告为误用收录公告配置。
**Migration**: 无需迁移，首页不再展示公告区域。