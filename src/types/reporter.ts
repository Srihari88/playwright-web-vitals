import type { RunConfig } from "./config";
import type { RunResult, UrlRunResult } from "./metrics";

export interface Reporter {
  name: string;
  onRunStart?(config: RunConfig): Promise<void> | void;
  onUrlResult?(result: UrlRunResult): Promise<void> | void;
  onRunComplete?(result: RunResult): Promise<void> | void;
}
