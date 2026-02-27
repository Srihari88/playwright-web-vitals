#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  runWebVitals,
  ConsoleReporter,
  JsonReporter,
  HtmlReporter,
  GrafanaJsonReporter,
  type Reporter,
  type RunConfig,
  type ThresholdConfig,
} from "./index";
import { parsePositiveIntFlag } from "./utils/cli-args";

function getFlagValues(flag: string, args: string[]): string[] {
  const values: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === flag && args[i + 1]) {
      values.push(args[i + 1]);
      i += 1;
    }
  }
  return values;
}

function hasFlag(flag: string, args: string[]): boolean {
  return args.includes(flag);
}

function getSingleFlagValue(flag: string, args: string[]): string | undefined {
  return getFlagValues(flag, args)[0];
}

async function parseThresholds(path?: string): Promise<ThresholdConfig | undefined> {
  if (!path) {
    return undefined;
  }

  const content = await readFile(resolve(path), "utf8");
  return JSON.parse(content) as ThresholdConfig;
}

function help(): string {
  return `playwright-web-vitals CLI

Usage:
  playwright-web-vitals --url <url> [--url <url2>] [options]

Options:
  --url <url>                 URL to run (repeatable)
  --headed                    Run in headed mode
  --browser <name>            chromium|firefox|webkit
  --parallel <n>              Number of URLs to run in parallel
  --timeout <ms>              Navigation timeout in ms
  --settle <ms>               Additional post-networkidle wait
  --device <name>             Playwright device name (e.g. iPhone 13)
  --thresholds <path>         Path to threshold JSON file
  --json-out <path>           Write JSON report to file
  --html-out <path>           Write HTML report to file
  --grafana-out <path>        Write Grafana-compatible JSON to file
  --no-fail-on-threshold      Return exit code 0 even when thresholds fail
  --help                      Show this message
`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (hasFlag("--help", args) || args.length === 0) {
    // eslint-disable-next-line no-console
    console.log(help());
    process.exit(0);
  }

  const urls = getFlagValues("--url", args);
  if (urls.length === 0) {
    throw new Error("At least one --url is required");
  }

  const reporters: Reporter[] = [new ConsoleReporter()];
  const jsonOut = getSingleFlagValue("--json-out", args);
  const htmlOut = getSingleFlagValue("--html-out", args);
  const grafanaOut = getSingleFlagValue("--grafana-out", args);

  if (jsonOut) reporters.push(new JsonReporter({ outputPath: resolve(jsonOut) }));
  if (htmlOut) reporters.push(new HtmlReporter({ outputPath: resolve(htmlOut) }));
  if (grafanaOut) reporters.push(new GrafanaJsonReporter({ outputPath: resolve(grafanaOut) }));

  const thresholds = await parseThresholds(getSingleFlagValue("--thresholds", args));
  const browserName = (getSingleFlagValue("--browser", args) as RunConfig["browserName"]) ?? "chromium";
  const parallelism = parsePositiveIntFlag(getSingleFlagValue("--parallel", args), "--parallel", 3);
  const timeoutMs = parsePositiveIntFlag(getSingleFlagValue("--timeout", args), "--timeout", 45000);
  const settleTimeMs = parsePositiveIntFlag(getSingleFlagValue("--settle", args), "--settle", 2000);

  const config: RunConfig = {
    urls,
    browserName,
    headless: !hasFlag("--headed", args),
    parallelism,
    timeoutMs,
    settleTimeMs,
    emulateDevice: getSingleFlagValue("--device", args) as RunConfig["emulateDevice"],
    failOnThresholdError: !hasFlag("--no-fail-on-threshold", args),
    thresholds,
    reporters,
    ci: process.env.CI === "true",
    logLevel: "info",
  };

  await runWebVitals(config);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(`[playwright-web-vitals] ${error.message}`);
  process.exit(1);
});
