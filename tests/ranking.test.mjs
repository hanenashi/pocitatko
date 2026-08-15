import assert from "node:assert/strict";
import test from "node:test";

import { resolveWinner } from "../src/core/ranking.js";

const entry = (id, author, points) => ({
  candidate: { id, author },
  stats: { points },
});

test("suggests the sole highest-scoring candidate", () => {
  const ranked = [entry(1, "Ada", 3), entry(2, "Bára", 2)];
  const result = resolveWinner(ranked);

  assert.equal(result.isTie, false);
  assert.equal(result.suggestedWinner.id, 1);
  assert.equal(result.selectedWinner.id, 1);
  assert.deepEqual(result.leaders.map(({ candidate }) => candidate.id), [1]);
});

test("leaves a shared top score unresolved", () => {
  const ranked = [entry(1, "Ada", 3), entry(2, "Bára", 3), entry(3, "Cilka", 1)];
  const result = resolveWinner(ranked);

  assert.equal(result.isTie, true);
  assert.equal(result.topPoints, 3);
  assert.equal(result.suggestedWinner, null);
  assert.equal(result.selectedWinner, null);
  assert.deepEqual(result.leaders.map(({ candidate }) => candidate.id), [1, 2]);
});

test("treats multiple zero-vote candidates as a tie", () => {
  const result = resolveWinner([entry(1, "Ada", 0), entry(2, "Bára", 0)]);

  assert.equal(result.isTie, true);
  assert.equal(result.topPoints, 0);
  assert.equal(result.selectedWinner, null);
});

test("accepts an explicit manual winner for a tie", () => {
  const ranked = [entry(1, "Ada", 3), entry(2, "Bára", 3)];
  const result = resolveWinner(ranked, 2);

  assert.equal(result.isTie, true);
  assert.equal(result.manualWinner.id, 2);
  assert.equal(result.selectedWinner.id, 2);
  assert.equal(result.suggestedWinner, null);
});

test("returns an empty resolution when there are no candidates", () => {
  const result = resolveWinner([]);

  assert.equal(result.isTie, false);
  assert.equal(result.topPoints, null);
  assert.equal(result.selectedWinner, null);
});
