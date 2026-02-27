import type { Reporter } from "../types/reporter";
import type { RunResult, UrlRunResult } from "../types/metrics";

function printMetric(label: string, value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return `${label}: n/a`;
  }
  return `${label}: ${value.toFixed(2)}`;
}

export class ConsoleReporter implements Reporter {
  name = "console";

  onUrlResult(result: UrlRunResult): void {
    const status = result.passed ? "PASS" : "FAIL";
    // eslint-disable-next-line no-console
    console.log(`\n[${status}] ${result.url}`);
    // eslint-disable-next-line no-console
    console.log(
      [
        printMetric("LCP(ms)", result.metrics.lcp),
        printMetric("CLS", result.metrics.cls),
        printMetric("INP(ms)", result.metrics.inp),
        printMetric("FCP(ms)", result.metrics.fcp),
        printMetric("TTFB(ms)", result.metrics.ttfb),
        printMetric("TBT(ms)", result.metrics.totalBlockingTime),
      ].join(" | "),
    );

    if (result.thresholds.length > 0) {
      const failedThresholds = result.thresholds.filter((item) => !item.passed);
      if (failedThresholds.length > 0) {
        // eslint-disable-next-line no-console
        console.log("Threshold failures:");
        for (const threshold of failedThresholds) {
          const actual =
            threshold.actual === null || Number.isNaN(threshold.actual)
              ? "n/a"
              : threshold.actual.toFixed(2);
          // eslint-disable-next-line no-console
          console.log(` - ${threshold.metric}: actual=${actual} threshold<=${threshold.threshold}`);
        }
      }
    }

    if (result.errors.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`Errors: ${result.errors.join("; ")}`);
    }
  }

  onRunComplete(result: RunResult): void {
    // eslint-disable-next-line no-console
    console.log(
      `\nRun completed. Total=${result.summary.total} Passed=${result.summary.passed} Failed=${result.summary.failed}`,
    );
  }
}
