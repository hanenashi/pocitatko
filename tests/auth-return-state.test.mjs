import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTH_RETURN_STORAGE_KEY,
  consumeAuthReturnState,
  saveAuthReturnState,
} from "../src/ui/auth-return-state.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

test("restores a round once on the same page", () => {
  const storage = memoryStorage();
  const pageUrl = "https://www.okoun.cz/boards/vymysli_vtipny_textik";
  assert.equal(saveAuthReturnState(storage, {
    pageUrl,
    view: "round",
    sourceId: 1074685846,
    endId: 1074689000,
    endManuallyChanged: true,
    manualWinnerId: 1074687000,
    excludedReactionIds: new Set([1074688000]),
    loadedPageCount: 3,
    scrollTop: 420,
  }, 1_000), true);

  const restored = consumeAuthReturnState(storage, pageUrl, 2_000);
  assert.deepEqual(restored, {
    view: "round",
    sourceId: 1074685846,
    endId: 1074689000,
    endManuallyChanged: true,
    manualWinnerId: 1074687000,
    excludedReactionIds: new Set([1074688000]),
    loadedPageCount: 3,
    scrollTop: 420,
  });
  assert.equal(storage.getItem(AUTH_RETURN_STORAGE_KEY), null);
  assert.equal(consumeAuthReturnState(storage, pageUrl, 2_000), null);
});

test("rejects an expired snapshot or a different page", () => {
  const storage = memoryStorage();
  const pageUrl = "https://www.okoun.cz/boards/vymysli_vtipny_textik";
  saveAuthReturnState(storage, { pageUrl, view: "round", sourceId: 1 }, 1_000);
  assert.equal(consumeAuthReturnState(storage, `${pageUrl}?page=2`, 2_000), null);

  saveAuthReturnState(storage, { pageUrl, view: "round", sourceId: 1 }, 1_000);
  assert.equal(consumeAuthReturnState(storage, pageUrl, 1_000 + 16 * 60 * 1_000), null);
});
