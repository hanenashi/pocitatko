import assert from "node:assert/strict";
import test from "node:test";

import { vymysliVtipnyTextik as plugin } from "../src/plugins/vymysli-vtipny-textik.js";

test("formats two and three-way ties", () => {
  assert.equal(
    plugin.formatTie([{ author: "Ada" }, { author: "Bára" }]),
    "Remíza mezi Ada a Bára. Gratulace!",
  );
  assert.equal(
    plugin.formatTie([{ author: "Ada" }, { author: "Bára" }, { author: "Cilka" }]),
    "Remíza mezi Ada, Bára a Cilka. Gratulace!",
  );
});

test("recognizes single-winner and tie announcements as round ends", () => {
  [
    "Vyhrál/a Ada. Gratulace!",
    "Vyhrála Ada. Gratulace!",
    "Vyhráli Ada a Bára. Gratulace!",
    "Remíza mezi Ada a Bára. Gratulace!",
  ].forEach((text) => assert.equal(plugin.isRoundEnd({ text }), true, text));
  assert.equal(plugin.isRoundEnd({ text: "Možná je to remíza." }), false);
});
