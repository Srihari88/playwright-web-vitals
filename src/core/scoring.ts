import type { PerformanceMetrics } from "../types/metrics";

export interface ScoreBreakdown {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  reasons: string[];
}

function scoreMetric(actual: number | null, good: number, poor: number): number {
  if (actual === null) {
    return 0.5;
  }
  if (actual <= good) {
    return 1;
  }
  if (actual >= poor) {
    return 0;
  }
  return 1 - (actual - good) / (poor - good);
}

export function calculatePerformanceScore(metrics: PerformanceMetrics): ScoreBreakdown {
  const weighted = [
    { value: scoreMetric(metrics.lcp, 2500, 4000), weight: 0.25, name: "LCP" },
    { value: scoreMetric(metrics.cls, 0.1, 0.25), weight: 0.15, name: "CLS" },
    { value: scoreMetric(metrics.inp, 200, 500), weight: 0.2, name: "INP" },
    { value: scoreMetric(metrics.fcp, 1800, 3000), weight: 0.1, name: "FCP" },
    { value: scoreMetric(metrics.ttfb, 800, 1800), weight: 0.1, name: "TTFB" },
    { value: scoreMetric(metrics.totalBlockingTime, 200, 600), weight: 0.2, name: "TBT" },
  ];

  const score = Math.round(
    weighted.reduce((acc, item) => acc + item.value * item.weight, 0) * 100,
  );

  const reasons = weighted
    .filter((item) => item.value < 0.6)
    .map((item) => `${item.name} is below target`);

  let grade: ScoreBreakdown["grade"] = "A";
  if (score < 90) grade = "B";
  if (score < 75) grade = "C";
  if (score < 60) grade = "D";
  if (score < 45) grade = "F";

  return { score, grade, reasons };
}
