export const AUTH_RETURN_STORAGE_KEY = "pocitatko.ui.authReturn";

const AUTH_RETURN_VERSION = 1;
const AUTH_RETURN_MAX_AGE_MS = 15 * 60 * 1000;

function finiteId(value) {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function saveAuthReturnState(storage, snapshot, now = Date.now()) {
  try {
    storage.setItem(AUTH_RETURN_STORAGE_KEY, JSON.stringify({
      version: AUTH_RETURN_VERSION,
      createdAt: now,
      pageUrl: snapshot.pageUrl,
      view: snapshot.view === "round" ? "round" : "chooser",
      sourceId: finiteId(snapshot.sourceId),
      endId: finiteId(snapshot.endId),
      endManuallyChanged: Boolean(snapshot.endManuallyChanged),
      manualWinnerId: finiteId(snapshot.manualWinnerId),
      excludedReactionIds: Array.from(snapshot.excludedReactionIds || [], finiteId).filter(Boolean),
      loadedPageCount: Math.max(1, Math.min(10, Number(snapshot.loadedPageCount) || 1)),
      scrollTop: Math.max(0, Number(snapshot.scrollTop) || 0),
    }));
    return true;
  } catch {
    return false;
  }
}

export function consumeAuthReturnState(storage, pageUrl, now = Date.now()) {
  let raw = null;
  try {
    raw = storage.getItem(AUTH_RETURN_STORAGE_KEY);
    storage.removeItem(AUTH_RETURN_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const snapshot = JSON.parse(raw);
    const age = now - Number(snapshot.createdAt);
    if (
      snapshot.version !== AUTH_RETURN_VERSION
      || snapshot.pageUrl !== pageUrl
      || !Number.isFinite(age)
      || age < 0
      || age > AUTH_RETURN_MAX_AGE_MS
    ) return null;

    return {
      view: snapshot.view === "round" ? "round" : "chooser",
      sourceId: finiteId(snapshot.sourceId),
      endId: finiteId(snapshot.endId),
      endManuallyChanged: Boolean(snapshot.endManuallyChanged),
      manualWinnerId: finiteId(snapshot.manualWinnerId),
      excludedReactionIds: new Set(
        Array.isArray(snapshot.excludedReactionIds)
          ? snapshot.excludedReactionIds.map(finiteId).filter(Boolean)
          : [],
      ),
      loadedPageCount: Math.max(1, Math.min(10, Number(snapshot.loadedPageCount) || 1)),
      scrollTop: Math.max(0, Number(snapshot.scrollTop) || 0),
    };
  } catch {
    return null;
  }
}
