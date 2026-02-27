import {
  chromium,
  firefox,
  webkit,
  devices,
  type Browser,
  type BrowserContextOptions,
} from "playwright";
import type { RunConfig } from "../types/config";

export interface BrowserBootstrap {
  browser: Browser;
  contextOptions: BrowserContextOptions;
}

export async function launchBrowser(config: RunConfig): Promise<BrowserBootstrap> {
  const browserName = config.browserName ?? "chromium";
  const headless = config.headless ?? true;

  const launchOptions = {
    headless,
    args: config.ci ? ["--no-sandbox", "--disable-setuid-sandbox"] : undefined,
  };

  const browser =
    browserName === "firefox"
      ? await firefox.launch(launchOptions)
      : browserName === "webkit"
        ? await webkit.launch(launchOptions)
        : await chromium.launch(launchOptions);

  let contextOptions: BrowserContextOptions = {};

  if (config.emulateDevice) {
    const descriptor = devices[config.emulateDevice];
    if (!descriptor) {
      throw new Error(`Unknown Playwright device: ${config.emulateDevice}`);
    }
    contextOptions = { ...descriptor };
  }

  if (config.mobile) {
    contextOptions = {
      ...contextOptions,
      viewport: config.mobile.viewport ?? contextOptions.viewport,
      userAgent: config.mobile.userAgent ?? contextOptions.userAgent,
      isMobile: config.mobile.isMobile ?? true,
      hasTouch: config.mobile.hasTouch ?? true,
    };

    if (config.mobile.deviceName) {
      const descriptor = devices[config.mobile.deviceName];
      if (descriptor) {
        contextOptions = { ...descriptor, ...contextOptions };
      }
    }
  }

  return { browser, contextOptions };
}
