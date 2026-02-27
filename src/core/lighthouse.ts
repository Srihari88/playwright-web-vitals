export interface LighthouseSummary {
  performanceScore: number | null;
  largestContentfulPaint: number | null;
  cumulativeLayoutShift: number | null;
  interactionToNextPaint: number | null;
}

export interface LighthouseOptions {
  url: string;
  chromePort?: number;
}

export async function runOptionalLighthouse(
  options: LighthouseOptions,
): Promise<LighthouseSummary> {
  let lighthouseModule: unknown;
  let chromeLauncherModule: unknown;
  const dynamicImport = new Function("modulePath", "return import(modulePath);") as (
    modulePath: string,
  ) => Promise<unknown>;

  try {
    lighthouseModule = await dynamicImport("lighthouse");
    chromeLauncherModule = await dynamicImport("chrome-launcher");
  } catch (error) {
    throw new Error(
      `Lighthouse integration requires optional dependencies 'lighthouse' and 'chrome-launcher'. ${(error as Error).message}`,
    );
  }

  const lighthouse = (lighthouseModule as { default: Function }).default;
  const chromeLauncher = chromeLauncherModule as {
    launch: (opts: { chromeFlags: string[]; port?: number }) => Promise<{ port: number; kill: () => Promise<void> }>;
  };

  const chrome = await chromeLauncher.launch({
    chromeFlags: ["--headless", "--disable-gpu", "--no-sandbox"],
    port: options.chromePort,
  });

  try {
    const runnerResult = await lighthouse(options.url, {
      port: chrome.port,
      output: "json",
      logLevel: "error",
    });

    const categories = runnerResult?.lhr?.categories ?? {};
    const audits = runnerResult?.lhr?.audits ?? {};

    return {
      performanceScore:
        typeof categories.performance?.score === "number"
          ? Math.round(categories.performance.score * 100)
          : null,
      largestContentfulPaint: audits["largest-contentful-paint"]?.numericValue ?? null,
      cumulativeLayoutShift: audits["cumulative-layout-shift"]?.numericValue ?? null,
      interactionToNextPaint: audits["interaction-to-next-paint"]?.numericValue ?? null,
    };
  } finally {
    await chrome.kill();
  }
}
