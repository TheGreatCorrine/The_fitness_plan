import { test } from "node:test";
import assert from "node:assert/strict";
import { reward, items } from "../lib/rules.ts";
test("weekly economies match the design book", () => {
  for (const [count, total] of [
    [0, 256],
    [1, 320],
    [3, 348],
    [5, 393],
    [6, 423],
  ]) {
    const bag = items.slice(0, count).map((i) => i.id);
    assert.equal(
      [3, 7, 7, 1].reduce((sum, n, i) => sum + n * reward(i, bag), 0),
      total,
    );
  }
  assert.equal(reward(0, ["sports_bottle"]), 44);
});
