import type { LogLevel, RunConfig, ThresholdConfig } from "../types/config";
import type { RunResult, UrlRunResult } from "../types/metrics";
import type { MetricPlugin } from "../types/plugin";
import type { Reporter } from "../types/reporter";
import { launchBrowser } from "./browser";
import { collectMetricsForUrl } from "./collector";
import { runWithConcurrency } from "../utils/async-pool";
import { Logger } from "../utils/logger";
import { evaluateThresholds, isThresholdPass } from "../utils/thresholds";
import { calculatePerformanceScore } from "./scoring";

const defaultConfig = {
  browserName: "chromium",
  headless: true,
  timeoutMs: 45_000,
  settleTimeMs: 2_000,
  waitUntil: "networkidle",
  parallelism: 3,
  failOnThresholdError: true,
  emulateDevice: undefined,
  ci: false,
  logLevel: "info",
} satisfies Omit<RunConfig, "urls" | "thresholds" | "reporters" | "mobile" | "plugins" | "metadata">;

async function runReporterHook(
  reporters: Reporter[],
  hook: "onRunStart" | "onUrlResult" | "onRunComplete",
  payload: unknown,
  logger?: Logger,
): Promise<void> {
  for (const reporter of reporters) {
    const fn = reporter[hook];
    if (!fn) {
      continue;
    }
    try {
      await fn.call(reporter, payload as never);
    } catch (error) {
      if (logger) {
        logger.warn(`Reporter '${reporter.name}' failed in ${hook}`, (error as Error).message);
      }
    }
  }
}

type NormalizedRunConfig = RunConfig & {
  browserName: "chromium" | "firefox" | "webkit";
  headless: boolean;
  timeoutMs: number;
  settleTimeMs: number;
  waitUntil: "load" | "domcontentloaded" | "networkidle" | "commit";
  parallelism: number;
  failOnThresholdError: boolean;
  thresholds: ThresholdConfig;
  reporters: Reporter[];
  ci: boolean;
  logLevel: LogLevel;
  plugins: MetricPlugin[];
  metadata: Record<string, string>;
};

function normalizeConfig(config: RunConfig): NormalizedRunConfig {
  return {
    ...defaultConfig,
    ...config,
    urls: config.urls,
    thresholds: config.thresholds ?? {},
    reporters: config.reporters ?? [],
    mobile: config.mobile,
    plugins: config.plugins ?? [],
    metadata: config.metadata ?? {},
  };
}

export class PlaywrightWebVitals {
  async run(inputConfig: RunConfig): Promise<RunResult> {
    if (!inputConfig.urls || inputConfig.urls.length === 0) {
      throw new Error("At least one URL is required");
    }

    const config = normalizeConfig(inputConfig);
    const logger = new Logger(config.logLevel);

    const startedAt = new Date().toISOString();
    await runReporterHook(config.reporters, "onRunStart", config, logger);

    const { browser, contextOptions } = await launchBrowser(config);
    const orderedResults: UrlRunResult[] = new Array(config.urls.length);

    try {
      await runWithConcurrency(config.urls, config.parallelism, async (url, index) => {
        const errors: string[] = [];

        try {
          logger.info(`Collecting vitals for ${url}`);
          const metrics = await collectMetricsForUrl(browser, contextOptions, url, config, logger);
          const thresholds = evaluateThresholds(metrics, config.thresholds);
          const score = calculatePerformanceScore(metrics);
          metrics.custom.aiScore = score;

          const result: UrlRunResult = {
            url,
            metrics,
            thresholds,
            passed: isThresholdPass(thresholds),
            errors,
            timestamp: new Date().toISOString(),
          };

          orderedResults[index] = result;
          await runReporterHook(config.reporters, "onUrlResult", result, logger);
        } catch (error) {
          errors.push((error as Error).message);

          const failedResult: UrlRunResult = {
            url,
            metrics: {
              lcp: null,
              cls: null,
              inp: null,
              fcp: null,
              ttfb: null,
              domContentLoaded: null,
              loadEvent: null,
              totalBlockingTime: null,
              memoryUsedJSHeapSize: null,
              memoryTotalJSHeapSize: null,
              resourceSummary: {
                count: 0,
                totalDuration: 0,
                totalTransferSize: 0,
                byInitiatorType: {},
              },
              custom: {},
            },
            thresholds: [],
            passed: false,
            errors,
            timestamp: new Date().toISOString(),
          };

          orderedResults[index] = failedResult;
          await runReporterHook(config.reporters, "onUrlResult", failedResult, logger);
          logger.error(`Failed to collect vitals for ${url}`, (error as Error).message);
        }
      });
    } finally {
      await browser.close().catch(() => undefined);
    }

    const results = orderedResults.filter((item): item is UrlRunResult => Boolean(item));
    const summary = {
      total: results.length,
      passed: results.filter((item) => item.passed).length,
      failed: results.filter((item) => !item.passed).length,
    };

    const runResult: RunResult = {
      results,
      summary,
      startedAt,
      endedAt: new Date().toISOString(),
    };

    await runReporterHook(config.reporters, "onRunComplete", runResult, logger);

    if (config.failOnThresholdError && summary.failed > 0) {
      throw new Error(`Threshold check failed for ${summary.failed} URL(s)`);
    }

    return runResult;
  }
}

export async function runWebVitals(config: RunConfig): Promise<RunResult> {
  const runner = new PlaywrightWebVitals();
  return runner.run(config);
}
