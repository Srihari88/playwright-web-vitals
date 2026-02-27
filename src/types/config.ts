import type { MetricPlugin } from "./plugin";
import type { Reporter } from "./reporter";

export type LogLevel = "silent" | "error" | "warn" | "info" | "debug";

export interface ThresholdConfig {
  lcp?: number;
  cls?: number;
  inp?: number;
  fcp?: number;
  ttfb?: number;
  domContentLoaded?: number;
  loadEvent?: number;
  totalBlockingTime?: number;
  memoryUsedJSHeapSize?: number;
  resourceCount?: number;
}

export interface MobileEmulationConfig {
  deviceName?: string;
  viewport?: { width: number; height: number };
  userAgent?: string;
  isMobile?: boolean;
  hasTouch?: boolean;
}

export interface RunConfig {
  urls: string[];
  browserName?: "chromium" | "firefox" | "webkit";
  headless?: boolean;
  timeoutMs?: number;
  settleTimeMs?: number;
  waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
  parallelism?: number;
  failOnThresholdError?: boolean;
  thresholds?: ThresholdConfig;
  reporters?: Reporter[];
  mobile?: MobileEmulationConfig;
  emulateDevice?: string;
  ci?: boolean;
  logLevel?: LogLevel;
  plugins?: MetricPlugin[];
  metadata?: Record<string, string>;
}
