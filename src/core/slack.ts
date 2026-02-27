import { request } from "node:https";
import type { RunResult } from "../types/metrics";

export interface SlackNotificationConfig {
  webhookUrl: string;
  title?: string;
}

export async function sendSlackNotification(
  runResult: RunResult,
  config: SlackNotificationConfig,
): Promise<void> {
  const text = [
    config.title ?? "Playwright Web Vitals Report",
    `Total: ${runResult.summary.total}`,
    `Passed: ${runResult.summary.passed}`,
    `Failed: ${runResult.summary.failed}`,
  ].join("\n");

  const payload = JSON.stringify({ text });

  await new Promise<void>((resolve, reject) => {
    const req = request(config.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    });

    req.on("response", (res) => {
      if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
        resolve();
        return;
      }
      reject(new Error(`Slack webhook failed with status ${res.statusCode}`));
    });

    req.on("error", (error) => reject(error));
    req.write(payload);
    req.end();
  });
}
