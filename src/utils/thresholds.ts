import type { ThresholdConfig } from "../types/config";
import type { PerformanceMetrics, ThresholdResult } from "../types/metrics";

export function evaluateThresholds(
  metrics: PerformanceMetrics,
  thresholds: ThresholdConfig | undefined,
): ThresholdResult[] {
  if (!thresholds) {
    return [];
  }

  const mappings: Array<{ key: keyof ThresholdConfig; actual: number | null }> = [
    { key: "lcp", actual: metrics.lcp },
    { key: "cls", actual: metrics.cls },
    { key: "inp", actual: metrics.inp },
    { key: "fcp", actual: metrics.fcp },
    { key: "ttfb", actual: metrics.ttfb },
    { key: "domContentLoaded", actual: metrics.domContentLoaded },
    { key: "loadEvent", actual: metrics.loadEvent },
    { key: "totalBlockingTime", actual: metrics.totalBlockingTime },
    { key: "memoryUsedJSHeapSize", actual: metrics.memoryUsedJSHeapSize },
    { key: "resourceCount", actual: metrics.resourceSummary.count },
  ];

  return mappings
    .filter((item) => typeof thresholds[item.key] === "number")
    .map((item) => {
      const threshold = thresholds[item.key] as number;
      const actual = item.actual;
      return {
        metric: item.key,
        threshold,
        actual,
        passed: actual !== null && actual <= threshold,
      };
    });
}

export function isThresholdPass(results: ThresholdResult[]): boolean {
  return results.every((result) => result.passed);
}
