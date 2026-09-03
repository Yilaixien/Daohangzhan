# 放大首页链接卡片图标

## 摘要

首页链接卡片（LinkCard）当前图标底衬为 32px、图标内容仅 24px，视觉上偏小。本次将图标整体放大一档（适中放大）：底衬 32px → 40px，图标内容 24px → 32px，同时同步放大 emoji/字符图标与无图标时的首字符占位，并让首页加载骨架屏与放大后的图标尺寸保持一致。

## 现状分析

文件：[LinkCard.vue](/workspace/src/components/frontend/LinkCard.vue)

- 外包装容器 `w-10 h-10`（40px），内部图标底衬 `w-8 h-8`（32px）。

- 图片图标 `<img>` 为 `w-6 h-6`（24px）；emoji/HTML 图标 `text-2xl`（24px）；无图标兜底为首字符 `w-8 h-8 text-sm`。

- 卡片网格：首页 [HomeView.vue](/workspace/src/views/frontend/HomeView.vue#L58-L65) 中 `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3`，桌面端每张卡片内容区约 110px 宽，放大到 48px 外框（40px 底衬）仍留有足够余量。

- 加载骨架屏 [HomeView.vue](/workspace/src/views/frontend/HomeView.vue#L37) 占位块为 `w-10 h-10 rounded-lg mb-2`，与当前图标尺寸一致，需同步调整。

## 变更方案

### 1. `src/components/frontend/LinkCard.vue` — 图标整体放大（适中档）

| 区域              | 当前类                           | 改为                                                | 说明                       |
| --------------- | ----------------------------- | ------------------------------------------------- | ------------------------ |
| 外包装容器           | `w-10 h-10 mb-2`              | `w-12 h-12 mb-3 flex items-center justify-center` | 外框 40px → 48px，容纳更大底衬    |
| 图片底衬容器          | `w-8 h-8 rounded-lg`          | `w-10 h-10 rounded-xl`                            | 底衬 32px → 40px，圆角同步加大    |
| 图片 `<img>`      | `w-6 h-6 object-contain`      | `w-8 h-8 object-contain`                          | 图标内容 24px → 32px         |
| emoji/HTML 图标容器 | `w-8 h-8 rounded-lg text-2xl` | `w-10 h-10 rounded-xl text-3xl`                   | 底衬同步 40px，字符 24px → 30px |
| 无图标首字符兜底        | `w-8 h-8 rounded-lg text-sm`  | `w-10 h-10 rounded-xl text-base`                  | 底衬 40px，字符 14px → 16px   |

改动均为模板内 class 值替换，不涉及脚本逻辑。

### 2. `src/views/frontend/HomeView.vue` — 加载骨架屏对齐

第 37 行占位块 `w-10 h-10 rounded-lg mb-2` → `w-12 h-12 rounded-xl mb-3`，使加载态与实际图标尺寸一致，避免布局跳动。

## 假设与决策

- 采用用户确认的「适中放大」档位：底衬 40px、内容 32px。

- 仅调整首页链接卡片图标，不改动后台列表、搜索框等小尺寸缩略图标（属常规列表缩略图，缩放无必要）。

- 画廊式布局下 48px 图标不会挤压标题/描述（标题仍为单行 `line-clamp-1`）。

## 验证步骤

1. `npm run dev` 启动前端。
2. 浏览器打开首页，检查普通模式：图片图标底衬明显增大、图片清晰不变形（`object-contain`）；含 emoji/HTML 图标的链接显示正常；无图标链接首字符占位完整居中。
3. 检查加载骨架屏占位块与卡片图标尺寸一致，无闪烁跳动。
4. 切换不同响应式宽度（2 列移动端 / 6 列桌面端），确认图标不溢出、卡片不换行。
5. 可选：`npm run build` 通过 vue-tsc 类型检查。

