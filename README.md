# playwright-web-vitals

Measure Core Web Vitals and advanced web performance metrics using Playwright.
![Performance](https://img.shields.io/badge/Performance-Web_Testing-blue?style=flat-square)
![JavaScript](https://img.shields.io/badge/JavaScript-Performance-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Web Vitals](https://img.shields.io/badge/Web_Vitals-Metrics-green?style=flat-square)
![Browser Performance](https://img.shields.io/badge/Browser_Performance-Optimization-blue?style=flat-square)
![LCP](https://img.shields.io/badge/LCP-Core_Web_Vitals-success?style=flat-square)

## 30-second setup

```bash
npm install playwright-web-vitals playwright
npx playwright install --with-deps chromium
npx playwright-web-vitals \
  --url https://example.com \
  --json-out ./reports/web-vitals.json \
  --html-out ./reports/web-vitals.html
```

You will get:

- `./reports/web-vitals.json`
- `./reports/web-vitals.html`

## What this package does

`playwright-web-vitals` runs real browser sessions and returns structured JSON metrics for each URL.

Metrics captured:

- LCP
- CLS
- INP
- FCP
- TTFB
- DOMContentLoaded
- Load Event
- Resource timing summary
- Total Blocking Time (TBT)
- JS heap memory (when available)

It also supports:

- Threshold budgets (fail builds if exceeded)
- Multiple URLs in parallel
- Headless/headed mode
- Mobile emulation
- Pluggable reporters (console, JSON, HTML, Grafana JSON)

## Installation

### 1. Install package

```bash
npm install playwright-web-vitals playwright
```

### 2. Install Playwright browser

```bash
npx playwright install --with-deps chromium
```

## Quick start (3 steps)

### Step 1: Create `web-vitals.config.ts`

```ts
import {
  ConsoleReporter,
  HtmlReporter,
  JsonReporter,
  type RunConfig,
} from "playwright-web-vitals";

export const config: RunConfig = {
  urls: ["https://example.com"],
  browserName: "chromium",
  headless: true,
  parallelism: 1,
  thresholds: {
    lcp: 3000,
    cls: 0.1,
    inp: 250,
    totalBlockingTime: 250,
  },
  reporters: [
    new ConsoleReporter(),
    new JsonReporter({ outputPath: "./reports/web-vitals.json" }),
    new HtmlReporter({ outputPath: "./reports/web-vitals.html" }),
  ],
  failOnThresholdError: true,
};
```

### Step 2: Create `run-web-vitals.ts`

```ts
import { runWebVitals } from "playwright-web-vitals";
import { config } from "./web-vitals.config";

async function main(): Promise<void> {
  const result = await runWebVitals(config);
  console.log("Summary:", result.summary);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

### Step 3: Run it

```bash
npx tsx run-web-vitals.ts
```

Reports will be written to:

- `./reports/web-vitals.json`
- `./reports/web-vitals.html`

## CLI usage

You can also run without writing code.

```bash
npx playwright-web-vitals \
  --url https://example.com \
  --thresholds ./thresholds.json \
  --json-out ./reports/web-vitals.json \
  --html-out ./reports/web-vitals.html
```

## Threshold file example

Create `thresholds.json`:

```json
{
  "lcp": 3000,
  "cls": 0.1,
  "inp": 250,
  "fcp": 2000,
  "ttfb": 1200,
  "domContentLoaded": 2500,
  "loadEvent": 5000,
  "totalBlockingTime": 250,
  "resourceCount": 120
}
```

## Integration plan (human-readable)

1. Install package and Playwright browser.
2. Start with one URL and `ConsoleReporter` only.
3. Add `JsonReporter` + `HtmlReporter` for artifacts.
4. Add thresholds for your performance budget.
5. Enable `failOnThresholdError: true` to gate CI.
6. Add more URLs and increase `parallelism` carefully.
7. Add mobile emulation if your app is mobile-heavy.

## Playwright test integration

```ts
import { test, expect } from "@playwright/test";
import { runWebVitals } from "playwright-web-vitals";

test("performance budget", async () => {
  const result = await runWebVitals({
    urls: ["https://example.com"],
    thresholds: {
      lcp: 3000,
      cls: 0.1,
      inp: 250,
    },
    failOnThresholdError: false,
  });

  expect(result.summary.failed).toBe(0);
});
```

## GitHub Actions example

```yaml
name: Web Vitals

on:
  pull_request:

jobs:
  perf:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run build
      - run: |
          node dist/cli.js \
            --url https://example.com \
            --thresholds ./thresholds.json \
            --json-out ./reports/web-vitals.json \
            --html-out ./reports/web-vitals.html
```

## Common issues

- `INP` can be `null` if no interaction happens on the page.
- Memory values are browser-dependent (usually Chromium).
- For stable CI numbers, keep infra and test URLs consistent.

## API surface

Main exports:

- `runWebVitals(config)`
- `PlaywrightWebVitals`
- `ConsoleReporter`
- `JsonReporter`
- `HtmlReporter`
- `GrafanaJsonReporter`
- `compareRuns`
- `runOptionalLighthouse`
- `sendSlackNotification`
