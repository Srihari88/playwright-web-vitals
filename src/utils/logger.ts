import type { LogLevel } from "../types/config";

const priority: Record<LogLevel, number> = {
  silent: 100,
  error: 40,
  warn: 30,
  info: 20,
  debug: 10,
};

export class Logger {
  constructor(private readonly level: LogLevel = "info") {}

  debug(message: string, data?: unknown): void {
    this.log("debug", message, data);
  }

  info(message: string, data?: unknown): void {
    this.log("info", message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log("warn", message, data);
  }

  error(message: string, data?: unknown): void {
    this.log("error", message, data);
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (priority[level] < priority[this.level]) {
      return;
    }
    const prefix = `[playwright-web-vitals] [${level.toUpperCase()}]`;
    if (data === undefined) {
      // eslint-disable-next-line no-console
      console.log(`${prefix} ${message}`);
      return;
    }
    // eslint-disable-next-line no-console
    console.log(`${prefix} ${message}`, data);
  }
}
