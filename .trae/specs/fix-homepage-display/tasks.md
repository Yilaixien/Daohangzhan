# Tasks

- [x] Task 1: 从首页移除收录公告
  - [x] 从 `HomeView.vue` 移除公告区域模板代码（第 22-24 行）
  - [x] 从 `home.ts` 移除 `announcement` 状态及相关逻辑（第 13 行声明 + 第 40-41 行赋值）

- [x] Task 2: 修复图标加载失败回退显示
  - [x] 修改 `LinkCard.vue` 图标渲染逻辑：当 URL 图标加载失败（`imageError` 为 true）时，回退到显示首字母头像，而非渲染原始图标 URL 文本

# Task Dependencies
- Task 1 和 Task 2 相互独立，可并行执行