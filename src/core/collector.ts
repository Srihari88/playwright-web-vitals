import type { Browser, BrowserContextOptions, Page } from "playwright";
import type { RunConfig } from "../types/config";
import type { MetricPlugin } from "../types/plugin";
import type { PerformanceMetrics } from "../types/metrics";
import { Logger } from "../utils/logger";

interface RawVitalsState {
  lcp: number | null;
  cls: number;
  inp: number | null;
  fcp: number | null;
  longTasks: Array<{ startTime: number; duration: number }>;
}

function baseInitScript(): string {
  return `(() => {
    const state = {
      lcp: null,
      cls: 0,
      inp: null,
      fcp: null,
      longTasks: []
    };
    window.__PWVITALS__ = state;

    try {
      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const last = entries[entries.length - 1];
        if (last && typeof last.startTime === 'number') {
          state.lcp = last.startTime;
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          lcpObserver.takeRecords();
          lcpObserver.disconnect();
        }
      });
    } catch (_) {}

    try {
      const clsObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (!entry.hadRecentInput && typeof entry.value === 'number') {
            state.cls += entry.value;
          }
        }
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
    } catch (_) {}

    try {
      const inpObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (typeof entry.duration === 'number') {
            state.inp = Math.max(state.inp || 0, entry.duration);
          }
        }
      });
      inpObserver.observe({ type: 'event', buffered: true, durationThreshold: 40 });
    } catch (_) {}

    try {
      const paintObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            state.fcp = entry.startTime;
          }
        }
      });
      paintObserver.observe({ type: 'paint', buffered: true });
    } catch (_) {}

    try {
      const longTaskObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          state.longTasks.push({ startTime: entry.startTime, duration: entry.duration });
        }
      });
      longTaskObserver.observe({ type: 'longtask', buffered: true });
    } catch (_) {}
  })();`;
}

async function injectObservers(page: Page, plugins: MetricPlugin[]): Promise<void> {
  await page.addInitScript({ content: baseInitScript() });

  for (const plugin of plugins) {
    if (!plugin.setupInitScript) {
      continue;
    }
    const script = plugin.setupInitScript();
    if (script.trim()) {
      await page.addInitScript({ content: script });
    }
  }
}

async function extractMetrics(page: Page): Promise<PerformanceMetrics> {
  return page.evaluate(() => {
    const state = ((window as unknown as { __PWVITALS__?: RawVitalsState }).__PWVITALS__ ?? {
      lcp: null,
      cls: 0,
      inp: null,
      fcp: null,
      longTasks: [],
    }) as RawVitalsState;

    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];

    const byInitiatorType: Record<string, number> = {};
    let totalDuration = 0;
    let totalTransferSize = 0;

    for (const resource of resources) {
      const key = resource.initiatorType || "other";
      byInitiatorType[key] = (byInitiatorType[key] || 0) + 1;
      totalDuration += resource.duration || 0;
      totalTransferSize += resource.transferSize || 0;
    }

    const fcp =
      state.fcp ??
      ((performance.getEntriesByName("first-contentful-paint")[0] as PerformanceEntry | undefined)?.startTime ??
        null);

    const ttfb = nav ? nav.responseStart - nav.startTime : null;
    const domContentLoaded = nav ? nav.domContentLoadedEventEnd - nav.startTime : null;
    const loadEvent = nav ? nav.loadEventEnd - nav.startTime : null;

    const tbtWindowStart = fcp ?? 0;
    const tbtWindowEnd = loadEvent ?? performance.now();

    const totalBlockingTime = state.longTasks
      .filter((task) => task.startTime >= tbtWindowStart && task.startTime <= tbtWindowEnd)
      .reduce((acc, task) => acc + Math.max(0, task.duration - 50), 0);

    const perfWithMemory = performance as Performance & {
      memory?: {
        usedJSHeapSize: number;
        totalJSHeapSize: number;
      };
    };

    return {
      lcp: state.lcp,
      cls: state.cls,
      inp: state.inp,
      fcp,
      ttfb,
      domContentLoaded,
      loadEvent,
      totalBlockingTime,
      memoryUsedJSHeapSize: perfWithMemory.memory?.usedJSHeapSize ?? null,
      memoryTotalJSHeapSize: perfWithMemory.memory?.totalJSHeapSize ?? null,
      resourceSummary: {
        count: resources.length,
        totalDuration,
        totalTransferSize,
        byInitiatorType,
      },
      custom: {},
    } as PerformanceMetrics;
  });
}

export async function collectMetricsForUrl(
  browser: Browser,
  contextOptions: BrowserContextOptions,
  url: string,
  config: RunConfig,
  logger: Logger,
): Promise<PerformanceMetrics> {
  const timeoutMs = config.timeoutMs ?? 45_000;
  const settleTimeMs = config.settleTimeMs ?? 2_000;
  const plugins = config.plugins ?? [];

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  try {
    await injectObservers(page, plugins);
    await page.goto(url, {
      waitUntil: config.waitUntil ?? "networkidle",
      timeout: timeoutMs,
    });

    await page.waitForLoadState("networkidle", { timeout: timeoutMs }).catch(() => {
      logger.warn(`networkidle not reached in time for ${url}; continuing with current timings`);
    });

    if (settleTimeMs > 0) {
      await page.waitForTimeout(settleTimeMs);
    }

    const metrics = await extractMetrics(page);

    for (const plugin of plugins) {
      if (!plugin.collect) {
        continue;
      }
      try {
        const customValues = await plugin.collect(page, metrics);
        if (customValues) {
          metrics.custom[plugin.name] = customValues;
        }
      } catch (error) {
        logger.warn(`Plugin '${plugin.name}' failed for ${url}`, (error as Error).message);
      }
    }

    return metrics;
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
  }
}
