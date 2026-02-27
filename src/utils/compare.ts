import type { RunResult, UrlRunResult } from "../types/metrics";

export interface ComparedMetric {
  metric: string;
  baseline: number | null;
  current: number | null;
  delta: number | null;
  deltaPct: number | null;
}

export interface UrlComparison {
  url: string;
  metrics: ComparedMetric[];
}

export interface RunComparison {
  comparisons: UrlComparison[];
}

function toComparable(result: UrlRunResult): Record<string, number | null> {
  return {
    lcp: result.metrics.lcp,
    cls: result.metrics.cls,
    inp: result.metrics.inp,
    fcp: result.metrics.fcp,
    ttfb: result.metrics.ttfb,
    domContentLoaded: result.metrics.domContentLoaded,
    loadEvent: result.metrics.loadEvent,
    totalBlockingTime: result.metrics.totalBlockingTime,
  };
}

export function compareRuns(baseline: RunResult, current: RunResult): RunComparison {
  const baselineMap = new Map(baseline.results.map((item) => [item.url, item]));

  return {
    comparisons: current.results.map((currentItem) => {
      const baselineItem = baselineMap.get(currentItem.url);
      const base = baselineItem ? toComparable(baselineItem) : {};
      const curr = toComparable(currentItem);
      const metricNames = Object.keys(curr);

      return {
        url: currentItem.url,
        metrics: metricNames.map((metric) => {
          const baselineValue = (base as Record<string, number | null>)[metric] ?? null;
          const currentValue = curr[metric] ?? null;
          const delta = baselineValue !== null && currentValue !== null ? currentValue - baselineValue : null;
          const deltaPct =
            baselineValue !== null && currentValue !== null && baselineValue !== 0
              ? (delta as number) / baselineValue
              : null;

          return {
            metric,
            baseline: baselineValue,
            current: currentValue,
            delta,
            deltaPct,
          };
        }),
      };
    }),
  };
}
