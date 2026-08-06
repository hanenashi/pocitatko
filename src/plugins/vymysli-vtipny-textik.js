export const vymysliVtipnyTextik = {
  id: "vymysli_vtipny_textik",
  name: "Vymysli vtipný textík",
  boardPath: "/boards/vymysli_vtipny_textik",
  matchesBoardUrl(url) {
    return url.origin === location.origin && url.pathname === this.boardPath;
  },
  sourcePosts(posts) {
    return posts.filter((post) => !post.parentId && post.imageUrls.length);
  },
  isRoundEnd(post) {
    return /^vyhr[aá]l\b.*\bgratul/i.test(post.text);
  },
  roundEndsAfter(posts, sourceId) {
    return posts
      .filter((post) => post.id > sourceId && this.isRoundEnd(post))
      .sort((a, b) => a.id - b.id);
  },
  suggestedEndId(posts, sourceId) {
    return this.roundEndsAfter(posts, sourceId)[0]?.id || null;
  },
  buildRound({ posts, sourceId, endId }) {
    const source = posts.find((post) => post.id === sourceId) || null;
    if (!source) return { source: null, end: null, candidates: [], unassigned: [] };
    const end = posts.find((post) => post.id === endId) || null;
    const beforeEnd = (post) => !end || post.id < end.id;
    const candidates = posts
      .filter(
        (post) =>
          post.id > source.id && beforeEnd(post) && !post.parentId && post.imageUrls.length,
      )
      .map((candidate) => ({
        ...candidate,
        reactions: posts
          .filter(
            (post) =>
              post.id > candidate.id &&
              beforeEnd(post) &&
              post.parentId === candidate.id &&
              !this.isRoundEnd(post),
          )
          .sort((a, b) => a.id - b.id),
      }))
      .sort((a, b) => a.id - b.id);
    const candidateIds = new Set(candidates.map((candidate) => candidate.id));
    const unassigned = posts.filter(
      (post) =>
        post.id > source.id &&
        beforeEnd(post) &&
        post.parentId &&
        !candidateIds.has(post.parentId),
    );
    return { source, end, candidates, unassigned };
  },
  scoreCandidate(candidate, { excludedReactionIds }) {
    const includedReactions = candidate.reactions.filter(
      (reaction) => !excludedReactionIds.has(reaction.id),
    );
    const reactingAuthors = new Set(includedReactions.map((reaction) => reaction.author));
    return {
      uniqueReactors: reactingAuthors.size,
      reactionPosts: includedReactions.length,
      excludedPosts: candidate.reactions.length - includedReactions.length,
      points: reactingAuthors.size,
    };
  },
  rankCandidates(round, context) {
    return round.candidates
      .map((candidate) => ({ candidate, stats: this.scoreCandidate(candidate, context) }))
      .sort(
        (a, b) =>
          b.stats.points - a.stats.points ||
          b.stats.uniqueReactors - a.stats.uniqueReactors ||
          a.candidate.id - b.candidate.id,
      );
  },
  formatResult(winner) {
    return `Vyhrál/a ${winner.author}. Gratulace!`;
  },
  sourceExplanation:
    "Klikni na zdrojový obrázek. Po potvrzení se všechny pozdější samostatné obrázkové příspěvky vezmou jako soutěžní návrhy a jejich vláknové odpovědi jako reakce.",
};

export const clubPlugins = [vymysliVtipnyTextik];
