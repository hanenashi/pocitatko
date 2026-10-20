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

test("allows an image reply as the source without treating later image replies as entries", () => {
  const posts = [
    { id: 100, author: "Moderator", parentId: null, imageUrls: [], text: "Vyhrál Hetero. Gratulace!" },
    { id: 101, author: "Hetero", parentId: 100, imageUrls: ["assignment.jpg"], text: "Z poolu:" },
    { id: 102, author: "Hetero", parentId: null, imageUrls: ["entry.jpg"], text: "" },
    { id: 103, author: "Voter", parentId: 102, imageUrls: [], text: "!" },
    { id: 104, author: "Commenter", parentId: 102, imageUrls: ["reply.jpg"], text: "" },
    { id: 105, author: "Moderator", parentId: 102, imageUrls: [], text: "Vyhrál Hetero. Gratulace!" },
  ];

  assert.deepEqual(
    plugin.sourcePosts(posts).map((post) => post.id),
    [101, 102, 104],
  );

  const round = plugin.buildRound({ posts, sourceId: 101, endId: 105 });
  assert.equal(round.source.id, 101);
  assert.deepEqual(round.candidates.map((post) => post.id), [102]);
  assert.deepEqual(round.candidates[0].reactions.map((post) => post.id), [103, 104]);
});
