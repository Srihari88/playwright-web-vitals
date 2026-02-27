import type { Reporter } from "../types/reporter";
import type { RunResult, UrlRunResult } from "../types/metrics";
import { writeTextFile } from "../utils/file";

export interface HtmlReporterOptions {
  outputPath: string;
  title?: string;
}

type MetricKey =
  | "lcp"
  | "cls"
  | "inp"
  | "fcp"
  | "ttfb"
  | "domContentLoaded"
  | "loadEvent"
  | "totalBlockingTime";

type Tone = "good" | "warn" | "bad" | "na";

const metricLimits: Record<MetricKey, { good: number; warn: number }> = {
  lcp: { good: 2500, warn: 4000 },
  cls: { good: 0.1, warn: 0.25 },
  inp: { good: 200, warn: 500 },
  fcp: { good: 1800, warn: 3000 },
  ttfb: { good: 800, warn: 1800 },
  domContentLoaded: { good: 1500, warn: 3000 },
  loadEvent: { good: 3000, warn: 6000 },
  totalBlockingTime: { good: 200, warn: 600 },
};

function formatNumber(value: number | null, fractionDigits = 2): string {
  return value === null ? "n/a" : value.toFixed(fractionDigits);
}

function formatMetricValue(metric: MetricKey, value: number | null): string {
  if (value === null) return "n/a";
  if (metric === "cls") return value.toFixed(3);
  return `${value.toFixed(2)} ms`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function averageOf(results: UrlRunResult[], metric: MetricKey): number | null {
  const values = results
    .map((item) => item.metrics[metric])
    .filter((value): value is number => typeof value === "number");
  if (values.length === 0) return null;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return sum / values.length;
}

function getMetricTone(metric: MetricKey, value: number | null): Tone {
  if (value === null) return "na";
  if (value <= metricLimits[metric].good) return "good";
  if (value <= metricLimits[metric].warn) return "warn";
  return "bad";
}

function toneLabel(tone: Tone): string {
  if (tone === "good") return "Good";
  if (tone === "warn") return "Needs Improvement";
  if (tone === "bad") return "Poor";
  return "Unavailable";
}

function metricProgress(metric: MetricKey, value: number | null): number {
  if (value === null) return 0;
  const warn = metricLimits[metric].warn;
  const raw = (value / warn) * 100;
  return Math.max(0, Math.min(100, raw));
}

function renderMetricPill(label: string, metric: MetricKey, value: number | null): string {
  const tone = getMetricTone(metric, value);
  const progress = metricProgress(metric, value).toFixed(0);
  return `<div class="metric metric-${tone}">
    <div class="metric-label">${escapeHtml(label)}</div>
    <div class="metric-value">${escapeHtml(formatMetricValue(metric, value))}</div>
    <div class="metric-bar">
      <span class="metric-fill" style="width:${progress}%"></span>
    </div>
    <div class="metric-tone">${toneLabel(tone)}</div>
  </div>`;
}

function renderResources(item: UrlRunResult): string {
  const entries = Object.entries(item.metrics.resourceSummary.byInitiatorType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(
      ([key, value]) => `<div class="tag"><span>${escapeHtml(key)}</span><strong>${value}</strong></div>`,
    )
    .join("");

  return entries || `<div class="tag"><span>none</span><strong>0</strong></div>`;
}

function renderThresholdSummary(item: UrlRunResult): string {
  if (item.thresholds.length === 0) {
    return `<div class="threshold-note">No thresholds configured for this URL</div>`;
  }

  const failed = item.thresholds.filter((threshold) => !threshold.passed);
  if (failed.length === 0) {
    return `<div class="threshold-pass">All configured thresholds passed</div>`;
  }

  const lines = failed
    .map((threshold) => {
      const actual = threshold.actual === null ? "n/a" : threshold.actual.toFixed(2);
      return `<li>${escapeHtml(threshold.metric)}: actual ${actual}, budget <= ${threshold.threshold}</li>`;
    })
    .join("");

  return `<div class="threshold-fail">Threshold failures</div><ul class="threshold-list">${lines}</ul>`;
}

function generateHtml(result: RunResult, title: string): string {
  const safeTitle = escapeHtml(title);

  const avgLcp = averageOf(result.results, "lcp");
  const avgCls = averageOf(result.results, "cls");
  const avgInp = averageOf(result.results, "inp");
  const avgTbt = averageOf(result.results, "totalBlockingTime");
  const hasFailures = result.summary.failed > 0;

  const cards = result.results
    .map((item) => {
      const statusClass = item.passed ? "status-pass" : "status-fail";
      const statusText = item.passed ? "PASS" : "FAIL";

      return `<section class="url-card">
        <header class="url-head">
          <div>
            <div class="url-label">URL</div>
            <h2>${escapeHtml(item.url)}</h2>
          </div>
          <span class="status-pill ${statusClass}">${statusText}</span>
        </header>

        <div class="metrics-grid">
          ${renderMetricPill("Largest Contentful Paint", "lcp", item.metrics.lcp)}
          ${renderMetricPill("Cumulative Layout Shift", "cls", item.metrics.cls)}
          ${renderMetricPill("Interaction to Next Paint", "inp", item.metrics.inp)}
          ${renderMetricPill("First Contentful Paint", "fcp", item.metrics.fcp)}
          ${renderMetricPill("Time to First Byte", "ttfb", item.metrics.ttfb)}
          ${renderMetricPill("Total Blocking Time", "totalBlockingTime", item.metrics.totalBlockingTime)}
          ${renderMetricPill("DOMContentLoaded", "domContentLoaded", item.metrics.domContentLoaded)}
          ${renderMetricPill("Load Event", "loadEvent", item.metrics.loadEvent)}
        </div>

        <div class="resources">
          <div class="resources-title">Resource Summary</div>
          <div class="resource-stats">
            <div><span>Count</span><strong>${item.metrics.resourceSummary.count}</strong></div>
            <div><span>Total Duration</span><strong>${formatNumber(item.metrics.resourceSummary.totalDuration)} ms</strong></div>
            <div><span>Transfer Size</span><strong>${item.metrics.resourceSummary.totalTransferSize}</strong></div>
          </div>
          <div class="tag-wrap">${renderResources(item)}</div>
        </div>

        <div class="threshold-panel">${renderThresholdSummary(item)}</div>
      </section>`;
    })
    .join("\n");

  const tableRows = result.results
    .map((item) => {
      return `<tr>
        <td>${escapeHtml(item.url)}</td>
        <td><span class="mini-status ${item.passed ? "status-pass" : "status-fail"}">${item.passed ? "PASS" : "FAIL"}</span></td>
        <td>${formatMetricValue("lcp", item.metrics.lcp)}</td>
        <td>${formatMetricValue("cls", item.metrics.cls)}</td>
        <td>${formatMetricValue("inp", item.metrics.inp)}</td>
        <td>${formatMetricValue("ttfb", item.metrics.ttfb)}</td>
        <td>${formatMetricValue("totalBlockingTime", item.metrics.totalBlockingTime)}</td>
      </tr>`;
    })
    .join("\n");

  const kpiCards = `
      <div class="kpi">
        <div class="kpi-label">Average LCP</div>
        <div class="kpi-value">${formatMetricValue("lcp", avgLcp)}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Average CLS</div>
        <div class="kpi-value">${formatMetricValue("cls", avgCls)}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Average INP</div>
        <div class="kpi-value">${formatMetricValue("inp", avgInp)}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Average TBT</div>
        <div class="kpi-value">${formatMetricValue("totalBlockingTime", avgTbt)}</div>
      </div>
      <div class="kpi kpi-pass">
        <div class="kpi-label">Pass Count</div>
        <div class="kpi-value">${result.summary.passed}</div>
      </div>
      <div class="kpi ${hasFailures ? "kpi-fail" : "kpi-neutral"}">
        <div class="kpi-label">Fail Count</div>
        <div class="kpi-value">${result.summary.failed}</div>
      </div>
  `;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <style>
    :root {
      --bg: #f4f8ff;
      --ink: #172554;
      --muted: #4b5f8f;
      --card: #ffffff;
      --border: #c7d7f5;
      --accent: #ff7a18;
      --accent2: #0ea5a4;
      --good: #0cce6b;
      --warn: #ffa400;
      --bad: #ff4e42;
      --na: #475569;
      --pass-bg: #dcfce7;
      --pass-fg: #166534;
      --fail-bg: #fee2e2;
      --fail-fg: #991b1b;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      color: var(--ink);
      font-family: "Space Grotesk", "Avenir Next", "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at 8% 5%, rgba(147, 197, 253, 0.32) 0%, transparent 42%),
        radial-gradient(circle at 92% 12%, rgba(186, 230, 253, 0.36) 0%, transparent 36%),
        radial-gradient(circle at 50% 100%, rgba(191, 219, 254, 0.35) 0%, transparent 45%),
        var(--bg);
      padding: 28px;
    }

    .container {
      max-width: 1180px;
      margin: 0 auto;
      display: grid;
      gap: 20px;
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .btn {
      appearance: none;
      border: 1px solid #0f172a22;
      background: #ffffff;
      color: #111827;
      border-radius: 10px;
      padding: 10px 14px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }

    .btn:hover {
      background: #f8fafc;
    }

    .hero {
      background:
        radial-gradient(circle at 88% 15%, rgba(191, 219, 254, 0.45) 0%, transparent 35%),
        linear-gradient(120deg, rgba(219, 234, 254, 0.98) 0%, rgba(191, 219, 254, 0.95) 52%, rgba(186, 230, 253, 0.92) 120%);
      color: #0f2a68;
      border-radius: 20px;
      padding: 24px;
      border: 1px solid rgba(147, 197, 253, 0.65);
      box-shadow:
        inset 0 0 0 1px rgba(255, 255, 255, 0.55),
        0 16px 34px rgba(96, 165, 250, 0.2);
    }

    .hero h1 {
      margin: 0;
      font-size: 30px;
      letter-spacing: 0.2px;
    }

    .hero p {
      margin: 10px 0 0;
      color: rgba(30, 58, 138, 0.85);
      font-size: 14px;
    }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 12px;
    }

    .kpi {
      background:
        radial-gradient(circle at 85% 10%, rgba(219, 234, 254, 0.7) 0%, transparent 38%),
        linear-gradient(150deg, rgba(239, 246, 255, 0.98) 0%, rgba(219, 234, 254, 0.96) 55%, rgba(191, 219, 254, 0.94) 130%);
      border: 1px solid rgba(147, 197, 253, 0.55);
      border-radius: 14px;
      padding: 14px;
      box-shadow:
        inset 0 0 0 1px rgba(255, 255, 255, 0.6),
        0 10px 20px rgba(96, 165, 250, 0.16);
    }

    .kpi-label {
      color: rgba(30, 58, 138, 0.78);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }

    .kpi-value {
      margin-top: 8px;
      font-size: 22px;
      font-weight: 700;
      color: #0f2a68;
      text-shadow: none;
    }

    .kpi-pass .kpi-value {
      color: #166534;
    }

    .kpi-fail .kpi-value {
      color: #b91c1c;
    }

    .kpi-neutral .kpi-value {
      color: #0f2a68;
    }

    .url-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 18px;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
      display: grid;
      gap: 14px;
    }

    .url-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .url-head h2 {
      margin: 2px 0 0;
      font-size: 18px;
      word-break: break-all;
    }

    .url-label {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }

    .status-pill,
    .mini-status {
      font-weight: 700;
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 12px;
      display: inline-block;
    }

    .status-pass {
      color: var(--pass-fg);
      background: var(--pass-bg);
    }

    .status-fail {
      color: var(--fail-fg);
      background: var(--fail-bg);
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }

    .metric {
      border-radius: 12px;
      border: 1px solid var(--border);
      padding: 10px;
      background: #fff;
      position: relative;
      overflow: hidden;
    }

    .metric::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(140deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.08) 55%, transparent 100%);
      pointer-events: none;
    }

    .metric-label {
      color: var(--muted);
      font-size: 12px;
      min-height: 30px;
    }

    .metric-value {
      font-size: 18px;
      font-weight: 700;
      margin-top: 4px;
    }

    .metric-tone {
      margin-top: 6px;
      font-size: 12px;
      font-weight: 600;
    }

    .metric-bar {
      margin-top: 8px;
      height: 8px;
      background: #eef2f1;
      border-radius: 999px;
      overflow: hidden;
      border: 1px solid #e5e7eb;
    }

    .metric-fill {
      display: block;
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, #0cce6b 0%, #ffa400 60%, #ff4e42 100%);
      transition: width 500ms ease;
    }

    .metric-good .metric-value,
    .metric-good .metric-tone { color: var(--good); }
    .metric-warn .metric-value,
    .metric-warn .metric-tone { color: var(--warn); }
    .metric-bad .metric-value,
    .metric-bad .metric-tone { color: var(--bad); }
    .metric-na .metric-value,
    .metric-na .metric-tone { color: var(--na); }

    .metric-good {
      border-color: #86efac;
      background:
        radial-gradient(circle at 85% 12%, rgba(12, 206, 107, 0.22) 0%, transparent 38%),
        linear-gradient(165deg, #e9fff2 0%, #d6ffe8 42%, #ffffff 100%);
      box-shadow: inset 0 0 0 1px #bbf7d0, 0 10px 18px rgba(12, 206, 107, 0.1);
    }

    .metric-warn {
      border-color: #fcd34d;
      background:
        radial-gradient(circle at 85% 12%, rgba(255, 164, 0, 0.26) 0%, transparent 40%),
        linear-gradient(165deg, #fff8e1 0%, #ffefc2 42%, #ffffff 100%);
      box-shadow: inset 0 0 0 1px #fde68a, 0 10px 18px rgba(255, 164, 0, 0.12);
    }

    .metric-bad {
      border-color: #fca5a5;
      background:
        radial-gradient(circle at 85% 12%, rgba(255, 78, 66, 0.22) 0%, transparent 40%),
        linear-gradient(165deg, #fff0ef 0%, #ffd9d6 42%, #ffffff 100%);
      box-shadow: inset 0 0 0 1px #fecaca, 0 10px 18px rgba(255, 78, 66, 0.12);
    }

    .metric-na {
      border-color: #cbd5e1;
      background:
        radial-gradient(circle at 85% 12%, rgba(100, 116, 139, 0.2) 0%, transparent 40%),
        linear-gradient(165deg, #f1f5f9 0%, #e7edf5 42%, #ffffff 100%);
      box-shadow: inset 0 0 0 1px #cbd5e1, 0 10px 18px rgba(100, 116, 139, 0.1);
    }

    .resources {
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px;
      background: #fcfcfb;
    }

    .resources-title {
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .resource-stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 10px;
    }

    .resource-stats span {
      display: block;
      font-size: 12px;
      color: var(--muted);
    }

    .resource-stats strong {
      font-size: 16px;
    }

    .tag-wrap {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .tag {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 5px 10px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: #fff;
      font-size: 12px;
    }

    .threshold-panel {
      border-radius: 12px;
      border: 1px dashed var(--border);
      padding: 10px;
      background: #fff;
    }

    .threshold-pass { color: var(--good); font-weight: 700; }
    .threshold-fail { color: var(--bad); font-weight: 700; }
    .threshold-note { color: var(--muted); font-weight: 600; }

    .threshold-list {
      margin: 8px 0 0;
      padding-left: 18px;
      color: var(--bad);
      font-size: 13px;
      display: grid;
      gap: 4px;
    }

    .table-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      overflow: hidden;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    th, td {
      text-align: left;
      padding: 12px;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
    }

    th {
      background: #f5f5f4;
      color: #334155;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      font-size: 11px;
    }

    @media (max-width: 1080px) {
      .kpi-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .metrics-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }

    @media (max-width: 700px) {
      body { padding: 16px; }
      .kpi-grid,
      .metrics-grid,
      .resource-stats { grid-template-columns: 1fr; }
      .hero h1 { font-size: 24px; }
      table { font-size: 12px; }
      th, td { padding: 9px; }
    }

    body.print-mode {
      background: #fff !important;
      padding: 8mm;
    }

    body.print-mode .hero {
      background: #fff;
      color: #111827;
      border: 1px solid #d1d5db;
      box-shadow: none;
    }

    body.print-mode .hero p {
      color: #374151;
    }

    body.print-mode .url-card,
    body.print-mode .kpi,
    body.print-mode .table-card {
      box-shadow: none;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    @media print {
      @page {
        size: A4;
        margin: 10mm;
      }

      body {
        background: #fff !important;
        padding: 0;
      }

      .container {
        gap: 10px;
      }

      .hero {
        background: #fff !important;
        color: #111827 !important;
        border: 1px solid #d1d5db;
        box-shadow: none;
      }

      .hero p {
        color: #374151 !important;
      }

      .url-card,
      .kpi,
      .table-card {
        box-shadow: none !important;
        page-break-inside: avoid;
        break-inside: avoid;
      }
    }

    @media print {
      .actions {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <main class="container">
    <section class="actions">
      <button type="button" class="btn" id="printReportBtn">Print Report</button>
    </section>

    <section class="hero">
      <h1>${safeTitle}</h1>
      <p>Run window: ${escapeHtml(result.startedAt)} to ${escapeHtml(result.endedAt)} | URLs: ${result.summary.total} | Passed: ${result.summary.passed} | Failed: ${result.summary.failed}</p>
    </section>

    <section class="kpi-grid">
      ${kpiCards}
    </section>

    ${cards}

    <section class="table-card">
      <table>
        <thead>
          <tr>
            <th>URL</th>
            <th>Status</th>
            <th>LCP</th>
            <th>CLS</th>
            <th>INP</th>
            <th>TTFB</th>
            <th>TBT</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </section>
  </main>
  <script>
    (function () {
      var params = new URLSearchParams(window.location.search);
      if (params.get("print") === "1") {
        document.body.classList.add("print-mode");
      }

      var printBtn = document.getElementById("printReportBtn");
      if (printBtn) {
        printBtn.addEventListener("click", function () {
          document.body.classList.add("print-mode");
          window.print();
        });
      }
    })();
  </script>
</body>
</html>`;
}

export class HtmlReporter implements Reporter {
  name = "html";

  constructor(private readonly options: HtmlReporterOptions) {}

  async onRunComplete(result: RunResult): Promise<void> {
    const html = generateHtml(result, this.options.title ?? "Playwright Web Vitals Dashboard");
    await writeTextFile(this.options.outputPath, html);
  }
}
