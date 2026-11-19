import assert from "node:assert/strict";
import test from "node:test";

import { parseNativeReactions } from "../src/core/okoun.js";

function reactionButton({ title, ariaLabel, glyph = "" }) {
  return {
    getAttribute(name) {
      return { title, "aria-label": ariaLabel }[name] || "";
    },
    querySelector(selector) {
      if (selector !== "svg[data-glyph]" || !glyph) return null;
      return { getAttribute: (name) => name === "data-glyph" ? glyph : "" };
    },
  };
}

test("parses accessible Kapybara aggregate reaction counters", () => {
  const buttons = [
    reactionButton({ title: "Dát rybu", ariaLabel: "Dát rybu, 3", glyph: "FISH" }),
    reactionButton({ title: "Bažedyťžejo", ariaLabel: "Bažedyťžejo, 1" }),
    reactionButton({ title: "Facepalm", ariaLabel: "Facepalm, 2", glyph: "PALM" }),
  ];
  const group = { querySelectorAll: () => buttons };
  const item = { querySelector: () => group };

  assert.deepEqual(parseNativeReactions(item), [
    { key: "fish", label: "Dát rybu", glyph: "FISH", count: 3 },
    { key: "plus1", label: "Bažedyťžejo", glyph: "", count: 1 },
    { key: "facepalm", label: "Facepalm", glyph: "PALM", count: 2 },
  ]);
});

test("returns no native reactions when Kapybara has no aggregate group", () => {
  assert.deepEqual(parseNativeReactions({ querySelector: () => null }), []);
});
