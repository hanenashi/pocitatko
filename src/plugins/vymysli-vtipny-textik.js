export const vymysliVtipnyTextik = {
  id: "vymysli_vtipny_textik",
  name: "Vymysli vtipný textík",
  boardPath: "/boards/vymysli_vtipny_textik",
  matchesBoardUrl(url) {
    return (
      ["https://www.okoun.cz", "https://kapybara.okoun.cz"].includes(url.origin) &&
      (url.pathname === this.boardPath || url.pathname.startsWith(`${this.boardPath}/`))
    );
  },
  countingModes(posts) {
    const modes = [
      { id: "replyPosts", label: "Příspěvky !" },
    ];
    if (posts.some((post) => post.platform === "kapybara")) {
      modes.push({ id: "nativeReactions", label: "Nativní reakce Kapybary" });
    }
    return modes;
  },
  sourcePosts(posts) {
    // A winner may reply to the previous result when posting the next assignment.
    // Source selection is manual, so keep image replies available here while
    // buildRound continues to accept only top-level images as competition entries.
    return posts.filter((post) => post.imageUrls.length);
  },
  isRoundEnd(post) {
    return /^(?:vyhr[aá]l(?:\/a|a|i)?|rem[ií]za)\b.*\bgratul/i.test(post.text);
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
  scoreCandidate(candidate, { excludedReactionIds, countingMode = "replyPosts" }) {
    const nativeReactions = candidate.nativeReactions || [];
    const nativeReactionCount = nativeReactions.reduce(
      (sum, reaction) => sum + reaction.count,
      0,
    );
    if (countingMode === "nativeReactions") {
      return {
        uniqueReactors: null,
        reactionPosts: 0,
        excludedPosts: 0,
        ignoredReplyPosts: candidate.reactions.length,
        nativeReactionCount,
        nativeReactions,
        voteSource: "nativeReactions",
        points: nativeReactionCount,
      };
    }

    const includedReactions = candidate.reactions.filter(
      (reaction) => !excludedReactionIds.has(reaction.id),
    );
    const reactingAuthors = new Set(
      includedReactions.map((reaction) => reaction.authorKey || reaction.author.toLowerCase()),
    );
    return {
      uniqueReactors: reactingAuthors.size,
      reactionPosts: includedReactions.length,
      excludedPosts: candidate.reactions.length - includedReactions.length,
      ignoredReplyPosts: 0,
      nativeReactionCount,
      nativeReactions,
      voteSource: "replyPosts",
      points: reactingAuthors.size,
    };
  },
  rankCandidates(round, context) {
    return round.candidates
      .map((candidate) => ({ candidate, stats: this.scoreCandidate(candidate, context) }))
      .sort(
        (a, b) =>
          b.stats.points - a.stats.points ||
          (b.stats.uniqueReactors ?? 0) - (a.stats.uniqueReactors ?? 0) ||
          a.candidate.id - b.candidate.id,
      );
  },
  formatResult(winner) {
    return `Vyhrál/a ${winner.author}. Gratulace!`;
  },
  formatTie(winners) {
    const authors = winners.map((winner) => winner.author);
    const last = authors.pop();
    const names = authors.length ? `${authors.join(", ")} a ${last}` : last;
    return `Remíza mezi ${names}. Gratulace!`;
  },
  sourceExplanation:
    "Klikni na zdrojový obrázek (může být i v odpovědi). Po potvrzení se všechny pozdější samostatné obrázkové příspěvky vezmou jako soutěžní návrhy. Na Kapybaře si pak zvolíš buď odpovědi !, nebo nativní reakce; oba způsoby se nikdy nesčítají dohromady.",
};

export const clubPlugins = [vymysliVtipnyTextik];
