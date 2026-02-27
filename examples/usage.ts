import {
  runWebVitals,
  ConsoleReporter,
  JsonReporter,
  HtmlReporter,
  type RunConfig,
} from "../src";

async function run(): Promise<void> {
  const config: RunConfig = {
    urls: ["https://example.com", "https://www.wikipedia.org"],
    browserName: "chromium",
    headless: true,
    parallelism: 2,
    emulateDevice: "iPhone 13",
    thresholds: {
      lcp: 3000,
      cls: 0.1,
      inp: 250,
      ttfb: 1200,
      totalBlockingTime: 250,
    },
    reporters: [
      new ConsoleReporter(),
      new JsonReporter({ outputPath: "./reports/web-vitals.json" }),
      new HtmlReporter({ outputPath: "./reports/web-vitals.html" }),
    ],
    failOnThresholdError: true,
    logLevel: "info",
  };

  const result = await runWebVitals(config);
  // eslint-disable-next-line no-console
  console.log(`Finished. Failed URLs: ${result.summary.failed}`);
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
