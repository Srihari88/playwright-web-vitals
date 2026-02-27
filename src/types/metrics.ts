export interface ResourceTimingSummary {
  count: number;
  totalDuration: number;
  totalTransferSize: number;
  byInitiatorType: Record<string, number>;
}

export interface PerformanceMetrics {
  lcp: number | null;
  cls: number | null;
  inp: number | null;
  fcp: number | null;
  ttfb: number | null;
  domContentLoaded: number | null;
  loadEvent: number | null;
  totalBlockingTime: number | null;
  memoryUsedJSHeapSize: number | null;
  memoryTotalJSHeapSize: number | null;
  resourceSummary: ResourceTimingSummary;
  custom: Record<string, unknown>;
}

export interface ThresholdResult {
  metric: string;
  threshold: number;
  actual: number | null;
  passed: boolean;
}

export interface UrlRunResult {
  url: string;
  metrics: PerformanceMetrics;
  thresholds: ThresholdResult[];
  passed: boolean;
  errors: string[];
  timestamp: string;
}

export interface RunSummary {
  total: number;
  passed: number;
  failed: number;
}

export interface RunResult {
  results: UrlRunResult[];
  summary: RunSummary;
  startedAt: string;
  endedAt: string;
}
