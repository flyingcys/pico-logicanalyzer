/**
 * Chrome 系浏览器暴露的非标准内存统计接口。
 */
export interface BrowserPerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  externalMemory?: number;
}

export function getPerformanceMemory(): BrowserPerformanceMemory | undefined {
  return (performance as Performance & { memory?: BrowserPerformanceMemory }).memory;
}
