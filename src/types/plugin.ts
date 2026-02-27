import type { Page } from "playwright";
import type { PerformanceMetrics } from "./metrics";

export interface MetricPlugin {
  name: string;
  setupInitScript?: () => string;
  collect?: (page: Page, metrics: PerformanceMetrics) => Promise<Record<string, unknown> | undefined>;
}
