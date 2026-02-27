import { test, expect } from "@playwright/test";
import { runWebVitals, ConsoleReporter } from "../src";

test("web vitals budget", async () => {
  const result = await runWebVitals({
    urls: ["https://example.com"],
    headless: true,
    thresholds: {
      lcp: 3000,
      cls: 0.1,
      inp: 250,
      totalBlockingTime: 250,
    },
    reporters: [new ConsoleReporter()],
    failOnThresholdError: false,
    logLevel: "warn",
  });

  expect(result.summary.failed).toBe(0);
});
