# Checklist

- [x] 首页不再显示收录公告区域
- [x] `home.ts` 中不再包含 `announcement` 状态及相关代码
- [x] 链接图标 URL 加载失败时，不显示原始 URL 文本，而是显示首字母占位符
- [x] 链接图标为非 URL 类型（如 SVG/emoji）时，仍正常渲染
- [x] 链接无图标时，正常显示首字母占位符