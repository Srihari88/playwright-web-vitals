import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePositiveIntFlag } from "../src/utils/cli-args";

test("parsePositiveIntFlag returns default when undefined", () => {
  assert.equal(parsePositiveIntFlag(undefined, "--parallel", 3), 3);
});

test("parsePositiveIntFlag rejects invalid values", () => {
  assert.throws(() => parsePositiveIntFlag("abc", "--parallel", 3), /positive integer/);
  assert.throws(() => parsePositiveIntFlag("0", "--parallel", 3), /positive integer/);
  assert.throws(() => parsePositiveIntFlag("-1", "--parallel", 3), /positive integer/);
  assert.throws(() => parsePositiveIntFlag("1.2", "--parallel", 3), /positive integer/);
});
