import type { Reporter } from "../types/reporter";
import type { RunResult } from "../types/metrics";
import { writeJsonFile } from "../utils/file";

export interface JsonReporterOptions {
  outputPath: string;
}

export class JsonReporter implements Reporter {
  name = "json";

  constructor(private readonly options: JsonReporterOptions) {}

  async onRunComplete(result: RunResult): Promise<void> {
    await writeJsonFile(this.options.outputPath, result);
  }
}
