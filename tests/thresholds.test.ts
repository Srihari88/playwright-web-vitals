import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateThresholds, isThresholdPass } from "../src/utils/thresholds";
import type { PerformanceMetrics } from "../src/types/metrics";

function createMetrics(): PerformanceMetrics {
  return {
    lcp: 1200,
    cls: 0.05,
    inp: null,
    fcp: 800,
    ttfb: 300,
    domContentLoaded: 600,
    loadEvent: 1000,
    totalBlockingTime: 10,
    memoryUsedJSHeapSize: null,
    memoryTotalJSHeapSize: null,
    resourceSummary: {
      count: 5,
      totalDuration: 100,
      totalTransferSize: 1000,
      byInitiatorType: { script: 2 },
    },
    custom: {},
  };
}

test("threshold should fail when configured metric is missing", () => {
  const results = evaluateThresholds(createMetrics(), { inp: 200 });
  assert.equal(results.length, 1);
  assert.equal(results[0].metric, "inp");
  assert.equal(results[0].actual, null);
  assert.equal(results[0].passed, false);
  assert.equal(isThresholdPass(results), false);
});
