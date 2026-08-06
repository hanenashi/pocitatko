const STORAGE_PREFIX = "pocitatko:";

export const SETTINGS = {
  launcherHidden: "launcherHidden",
  launcherPosition: "launcherPosition",
};

export function getSetting(key, fallback) {
  if (typeof GM_getValue === "function") return GM_getValue(key, fallback);
  try {
    const value = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function setSetting(key, value) {
  if (typeof GM_setValue === "function") GM_setValue(key, value);
  else {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
    } catch {
      // Storage is optional; the launcher still works for this page load.
    }
  }
}

export function deleteSetting(key) {
  if (typeof GM_deleteValue === "function") GM_deleteValue(key);
  else {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    } catch {
      // Storage is optional.
    }
  }
}
