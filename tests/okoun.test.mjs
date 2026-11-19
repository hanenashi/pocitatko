import assert from "node:assert/strict";
import test from "node:test";

import { kapybaraParent, parseNativeReactions } from "../src/core/okoun.js";

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

function kapybaraPost({ threadId, parentHref = "", parentLabel = "" }) {
  const parentLink = parentHref ? {
    getAttribute: (name) => name === "href" ? parentHref : "",
    textContent: parentLabel,
  } : null;
  return {
    getAttribute: (name) => name === "data-thread-id" ? threadId : "",
    querySelector: () => parentLink,
  };
}

test("prefers Kapybara's explicit direct parent link", () => {
  assert.deepEqual(
    kapybaraParent(kapybaraPost({
      threadId: "100000",
      parentHref: "/boards/demo/c/100004#p100004",
      parentLabel: "Reakce na Ada",
    }), 100005),
    { id: 100004, label: "Reakce na Ada", inferredFromThread: false },
  );
});

test("falls back to Kapybara's thread root when compact layouts omit reply links", () => {
  assert.deepEqual(
    kapybaraParent(kapybaraPost({ threadId: "100000" }), 100005),
    { id: 100000, label: "Vlákno #100000", inferredFromThread: true },
  );
  assert.deepEqual(
    kapybaraParent(kapybaraPost({ threadId: "100005" }), 100005),
    { id: null, label: "", inferredFromThread: false },
  );
});
