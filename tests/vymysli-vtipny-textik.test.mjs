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

  const roundWithReplyImages = plugin.buildRound({
    posts,
    sourceId: 101,
    endId: 105,
    includeReplyImages: true,
  });
  assert.deepEqual(roundWithReplyImages.candidates.map((post) => post.id), [102, 104]);
  assert.deepEqual(
    roundWithReplyImages.candidates[0].reactions.map((post) => post.id),
    [103],
  );
});

test("can include a misposted image reply as a contestant", () => {
  const posts = [
    { id: 100, parentId: null, imageUrls: ["assignment.jpg"], text: "" },
    { id: 101, parentId: null, imageUrls: [], text: "discussion" },
    { id: 102, parentId: 101, imageUrls: ["misposted-entry.jpg"], text: "" },
    { id: 103, parentId: 102, imageUrls: [], text: "!" },
  ];

  assert.deepEqual(
    plugin.buildRound({ posts, sourceId: 100, endId: null }).candidates,
    [],
  );
  const round = plugin.buildRound({
    posts,
    sourceId: 100,
    endId: null,
    includeReplyImages: true,
  });
  assert.deepEqual(round.candidates.map((post) => post.id), [102]);
  assert.deepEqual(round.candidates[0].reactions.map((post) => post.id), [103]);
  assert.deepEqual(round.unassigned.map((post) => post.id), []);
});

test("offers native reactions only on Kapybara", () => {
  assert.deepEqual(plugin.countingModes([{ platform: "classic" }]), [
    { id: "replyPosts", label: "Příspěvky !" },
  ]);
  assert.deepEqual(plugin.countingModes([{ platform: "kapybara" }]).map((mode) => mode.id), [
    "replyPosts",
    "nativeReactions",
  ]);
});

test("keeps reply-post and native-reaction counting mutually exclusive", () => {
  const candidate = {
    reactions: [
      { id: 1, author: "Ada", authorKey: "ada" },
      { id: 2, author: "ADA", authorKey: "ada" },
      { id: 3, author: "Bára", authorKey: "bára" },
    ],
    nativeReactions: [
      { key: "fish", label: "Dát rybu", count: 3 },
      { key: "bang", label: "Zaujalo mě", count: 1 },
    ],
  };
  const excludedReactionIds = new Set();

  const replyStats = plugin.scoreCandidate(candidate, {
    excludedReactionIds,
    countingMode: "replyPosts",
  });
  assert.equal(replyStats.points, 2);
  assert.equal(replyStats.uniqueReactors, 2);
  assert.equal(replyStats.nativeReactionCount, 4);
  assert.equal(replyStats.ignoredReplyPosts, 0);

  const nativeStats = plugin.scoreCandidate(candidate, {
    excludedReactionIds,
    countingMode: "nativeReactions",
  });
  assert.equal(nativeStats.points, 4);
  assert.equal(nativeStats.uniqueReactors, null);
  assert.equal(nativeStats.reactionPosts, 0);
  assert.equal(nativeStats.ignoredReplyPosts, 3);
});
