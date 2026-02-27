import { test } from "node:test";
import assert from "node:assert/strict";
import { runWithConcurrency } from "../src/utils/async-pool";

test("runWithConcurrency rejects invalid concurrency values", async () => {
  await assert.rejects(() => runWithConcurrency([1], 0, async () => {}), /parallelism/);
  await assert.rejects(() => runWithConcurrency([1], Number.NaN, async () => {}), /parallelism/);
  await assert.rejects(() => runWithConcurrency([1], 1.5, async () => {}), /parallelism/);
});
