function snapshotPost(post) {
  if (!post) return null;
  return {
    postId: post.id,
    author: post.author,
    authorKey: post.authorKey,
    avatarUrl: post.avatarUrl,
    timestamp: post.timestamp,
    text: post.text,
    imageUrls: [...post.imageUrls],
    url: post.url,
  };
}

export function createRoundSnapshot({ schemaVersion, plugin, round, ranked, selectedWinner, state }) {
  const suggestedWinner = ranked[0]?.candidate || null;
  return {
    schemaVersion,
    clubId: plugin.id,
    roundId: `${plugin.id}:${round.source.id}`,
    source: snapshotPost(round.source),
    end: snapshotPost(round.end),
    entries: ranked.map(({ candidate, stats }) => ({
      ...snapshotPost(candidate),
      stats: { ...stats },
      reactions: candidate.reactions.map((reaction) => ({
        ...snapshotPost(reaction),
        included: !state.excludedReactionIds.has(reaction.id),
      })),
    })),
    unassignedPostIds: round.unassigned.map((post) => post.id),
    result: {
      suggestedWinnerPostId: suggestedWinner?.id || null,
      selectedWinnerPostId: selectedWinner?.id || null,
      selection: state.manualWinnerId ? "manual" : "suggested",
    },
  };
}
