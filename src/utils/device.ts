/**
 * 低配置环境探测（用于 PC 低配下静态降级毛玻璃等重视觉效果）。
 * 判定：逻辑核数 ≤4，或 deviceMemory ≤4GB（deviceMemory 仅 Chromium，探测不到时忽略）。
 */
export function detectLowEnd(): boolean {
  try {
    const cores = navigator.hardwareConcurrency
    const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory
    return (cores > 0 && cores <= 4) || (mem !== undefined && mem > 0 && mem <= 4)
  } catch {
    return false
  }
}