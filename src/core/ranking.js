export function resolveWinner(ranked, manualWinnerId = null) {
  const first = ranked[0] || null;
  const topPoints = first?.stats.points ?? null;
  const leaders = first
    ? ranked.filter((entry) => entry.stats.points === topPoints)
    : [];
  const isTie = leaders.length > 1;
  const manualWinner = ranked.find(
    ({ candidate }) => candidate.id === manualWinnerId,
  )?.candidate || null;
  const suggestedWinner = isTie ? null : first?.candidate || null;

  return {
    topPoints,
    leaders,
    isTie,
    manualWinner,
    suggestedWinner,
    selectedWinner: manualWinner || suggestedWinner,
  };
}
