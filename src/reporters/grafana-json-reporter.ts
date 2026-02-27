import type { Reporter } from "../types/reporter";
import type { RunResult } from "../types/metrics";
import { writeJsonFile } from "../utils/file";

export interface GrafanaJsonReporterOptions {
  outputPath: string;
}

export class GrafanaJsonReporter implements Reporter {
  name = "grafana-json";

  constructor(private readonly options: GrafanaJsonReporterOptions) {}

  async onRunComplete(result: RunResult): Promise<void> {
    const payload = result.results.flatMap((urlResult) => {
      const timestamp = new Date(urlResult.timestamp).getTime();
      return [
        { metric: "lcp", url: urlResult.url, value: urlResult.metrics.lcp, timestamp },
        { metric: "cls", url: urlResult.url, value: urlResult.metrics.cls, timestamp },
        { metric: "inp", url: urlResult.url, value: urlResult.metrics.inp, timestamp },
        { metric: "fcp", url: urlResult.url, value: urlResult.metrics.fcp, timestamp },
        { metric: "ttfb", url: urlResult.url, value: urlResult.metrics.ttfb, timestamp },
        { metric: "tbt", url: urlResult.url, value: urlResult.metrics.totalBlockingTime, timestamp },
      ];
    });

    await writeJsonFile(this.options.outputPath, payload);
  }
}
