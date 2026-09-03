# PC 低配置环境首页滚动卡顿优化（参考 lylme_spage 做法）

## 概述（Summary）

分析参考项目 LyLme/lylme_spage 的 default 主题后确认：他们首页滚动不卡的核心是**刻意回避高成本视觉效果**——玻璃卡片用 `rgba(255,255,255,0.9)` 高不透明度底色而**不使用 backdrop-filter**（源码中该属性被注释），卡片 hover 仅变色、无 transform scale，也无大面积大 radius 模糊元素。

我们的首页正好相反：所有滚动元素（搜索框 / 引擎胶囊 / 按钮 / 分组卡片 / 页脚）都依赖 `backdrop-filter: blur(20~30px)`，背景还有两个 `blur(90/100px)` 大色块；且上一轮"滚动中降级毛玻璃"只对 `hover: none`（触摸设备）生效，**低配 PC 滚动时完全不降级**——这正是 PC 端卡顿主因。

本方案：① 把"滚动中关闭毛玻璃"扩展到 PC（静止时外观不变）；② 增加低配置环境探测（`html[data-low-end]`），低配设备上静态也改用参考项目式的"高不透明度半透明底 + 无/小模糊"，高性能 PC 保持完整玻璃效果。

## 现状分析（Current State）

| 来源 | 我们的现状 | lylme_spage 的做法 |
|------|-----------|-------------------|
| 滚动元素毛玻璃 | `.glass*`/`.glass-chip`/`.btn-glass`/`.search-glass`：`backdrop-filter: blur(20~30px)`（[style.css](file:///workspace/src/style.css#L66-L167)），滚动时逐帧重算 | 注释掉 backdrop-filter，底色 `#ffffffe6`（90% 白） |
| 滚动降级开关 | `@media (hover: none)` 才降级（[style.css](file:///workspace/src/style.css#L204-L227)），PC 不降级 | 无降级需求（本就无 blur） |
| 大面积模糊 | `BackgroundImage` 两个 46rem/42rem 色块 `blur(90/100px)`（即使提层，弱 iGPU 栅格成本高） | 无此类元素 |
| 状态标记 | `useScroll` 已有 `html[data-scrolling]` 机制（150ms 防抖 + scrollend） | — |

低配 PC（2~4 核 / ≤4GB 内存 / 无独显）在滚动时逐帧重算 blur + 大色块模糊，主线程/合成器忙 → 不跟手、延迟高。

## 变更方案（Proposed Changes）

### 1. 滚动降级扩展到所有设备（静止外观零变化，收益最大）

`src/style.css`：删除 `@media (hover: none) { … }` 外层包裹，使 `html[data-scrolling]` 规则对 **PC 同样生效**（滚动中关闭 backdrop-filter + 提升底色 + `transition: none`；停止 150ms 或 `scrollend` 后由 `useScroll` 自动恢复完整毛玻璃）。桌面低配机的滚动过程与高配一致，弱 GPU 不再逐帧重算模糊。

保留 `@media (hover: none)` 无意义后，块级注释同步更新说明。

### 2. 新增低配置探测 → `html[data-low-end]`

新增 `src/utils/device.ts`：

```ts
/** 低配置环境探测：核数 ≤4 或内存 ≤4GB（deviceMemory 仅 Chromium，探测不到时忽略） */
export function detectLowEnd(): boolean {
  try {
    const cores = navigator.hardwareConcurrency
    const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory
    return (cores > 0 && cores <= 4) || (mem !== undefined && mem > 0 && mem <= 4)
  } catch {
    return false
  }
}
```

`src/main.ts`：Vue 挂载前同步执行 `if (detectLowEnd()) document.documentElement.setAttribute('data-low-end', 'true')`（一次性同步判断，无感知开销）。

### 3. 低配环境静态降级样式（仅 `data-low-end` 生效，高性能 PC 无变化）

`src/style.css` 新增 `html[data-low-end]` 规则（参考项目式"半透明白底 + 无/小模糊"）：

- 全局变量：`--glass-blur: 20px → 10px`、`--glass-bg` 提至约 `rgba(255,255,255,0.45)`（dark 主题 `rgba(15,20,45,0.6)`）、`--glass-bg-strong` 相应提升、`--glass-shadow` 减半；
- `.glass / .glass-card / .glass-strong / .glass-strip / .glass-chip / .btn-glass / .search-glass`：`backdrop-filter: none`，其中 `.glass-chip`/`.btn-glass` 底色提至 `rgba(255,255,255,0.32)`、`.search-glass` 提至 `rgba(255,255,255,0.45)`（保持"磨砂白"观感但零 blur 成本）；
- `.glass-card` hover 的 `transform: scale(1.04)` 在低配下改为纯变色（`html[data-low-end] .glass-card:hover { transform: none }`），避免 hover 触发额外合成（瞄准 lylme_spage 的做法）。

### 4. 背景极光模糊低配缩放

`src/components/frontend/BackgroundImage.vue`：把两个极光色块的 `blur-[90px]`/`blur-[100px]` 改为自定义类 `.aurora-blur`（scoped style 中定义 `filter: blur(90px)`），并新增 `html[data-low-end] :deep()` 场景——直接用组件内 scoped 规则 `html[data-low-end] .aurora-blur { filter: blur(40px); opacity: 0.3 }`，低配下大幅缩减大色块栅格成本；高性能 PC 保持原样。

### 5. 保持不变

- `content-visibility: auto` 分组分区、图标 `loading="lazy"`/`decoding="async"`、背景层 `translateZ(0)` 提层、`useScroll` 单监听 rAF 节流——全部保留。
- 高性能设备（多核大内存）上所有静态视觉效果与现版本**完全一致**。

## 假设与决策（Assumptions & Decisions）

- 参考 lylme_spage 的核心取舍：**滚动中 blur 关闭**在运动过程中几乎不可感知，静止后恢复；低配设备静态效果仅"微调半透明度"，设计语言不变（仍是毛玻璃风格，只是更接近参考项目的实底白）。
- 低配阈值 `核数≤4 或 deviceMemory≤4GB`：覆盖主流低配办公 PC；`hardwareConcurrency` 全平台可用，`deviceMemory` 仅 Chromium，取"任一命中"。
- `data-scrolling` 降级不区分设备类型——高配 PC 也只是滚动中暂时去 blur，成本可忽略，换来的是实现最简、覆盖最全。
- 不全局改默认玻璃观感（避免未经确认的大范围视觉变更），所有静态外观差异仅存在于 `data-low-end`。

## 验证（Verification）

1. `npm run build`（vue-tsc + vite + edge-functions）通过。
2. `npm run dev` 冒烟：首页各模块编译正常。
3. PC 低配模拟：DevTools → CPU 降速 4~6x（模拟无独显）+ 启用低配设备（`Device Memory` 覆盖或临时在 main.ts 强制 `data-low-end`），录制滚动 Performance：
   - 滚动期间无连续 blur 重算、主线程长任务显著减少；
   - 停止滚动后毛玻璃/阴影完整恢复；
   - 低配模式下卡片呈半透明白底、无模糊，观感接近参考项目，滚动 60fps。
4. 高配 PC（默认环境）滚动：滚动中短暂去 blur、静止恢复，整体观感与优化前一致。