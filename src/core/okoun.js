const textOf = (node) =>
  (node?.innerText || node?.textContent || "").replace(/\s+/g, " ").trim();

function postIdFrom(value) {
  const match =
    String(value || "").match(/(?:article-|contextId=)(\d+)/i) ||
    String(value || "").match(/\b(\d{6,})\b/);
  return match ? Number(match[1]) : null;
}

function pageOrigin(pageUrl) {
  try {
    return new URL(pageUrl, location.href).origin;
  } catch {
    return location.origin;
  }
}

function absoluteUrl(value, base = location.href) {
  try {
    return new URL(value, base).href;
  } catch {
    return "";
  }
}

export function safeBoardUrl(value, plugin) {
  try {
    const url = new URL(value, location.href);
    return plugin.matchesBoardUrl(url) ? url.href : "";
  } catch {
    return "";
  }
}

function safeImageUrl(value, base = location.href) {
  try {
    const url = new URL(value, base);
    return /^https?:$/.test(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function parseClassicDocument(doc, pageUrl, plugin) {
  return Array.from(doc.querySelectorAll("div.item[id^='article-']")).map((item) => {
    const content = item.querySelector(".content") || item;
    const parentLink = item.querySelector(".actions a.prev");
    const permalink = item.querySelector(".meta a.date.link");
    const id = postIdFrom(item.id);
    const author = textOf(item.querySelector(".meta .user")) || "neznámý uživatel";
    const imageUrls = Array.from(content.querySelectorAll("img"))
      .map((image) => safeImageUrl(image.getAttribute("src") || image.src, pageUrl))
      .filter(Boolean);

    return {
      id,
      author,
      authorKey: author.toLowerCase(),
      avatarUrl: safeImageUrl(item.querySelector(".ico.user img")?.src, pageUrl),
      timestamp: textOf(permalink),
      parentId: postIdFrom(parentLink?.getAttribute("href")),
      parentLabel: textOf(parentLink),
      text: textOf(content),
      imageUrls,
      nativeReactions: [],
      platform: "classic",
      url:
        safeBoardUrl(absoluteUrl(permalink?.getAttribute("href"), pageUrl), plugin) ||
        `${location.origin}${plugin.boardPath}#article-${id}`,
      pageUrl,
    };
  }).filter((post) => post.id);
}

const REACTION_KEYS = {
  FISH: "fish",
  PLUS1: "plus1",
  BANG: "bang",
  BANG3: "bang3",
  PALM: "facepalm",
};

const REACTION_TITLES = {
  "Dát rybu": "fish",
  "Bažedyťžejo": "plus1",
  "Zaujalo mě": "bang",
  "Paráda": "bang3",
  Facepalm: "facepalm",
};

export function parseNativeReactions(item) {
  const group = item.querySelector("[role='group'][aria-label='Počty reakcí']");
  if (!group) return [];

  return Array.from(group.querySelectorAll("button")).map((button) => {
    const label = button.getAttribute("title") || "Reakce";
    const glyph = button.querySelector("svg[data-glyph]")?.getAttribute("data-glyph") || "";
    const ariaLabel = button.getAttribute("aria-label") || "";
    const countMatch = ariaLabel.match(/,\s*(\d+)\s*$/);
    const count = countMatch ? Number(countMatch[1]) : 0;
    return {
      key: REACTION_KEYS[glyph] || REACTION_TITLES[label] || "other",
      label,
      glyph,
      count,
    };
  }).filter((reaction) => reaction.count > 0);
}

function parseKapybaraDocument(doc, pageUrl, plugin) {
  const origin = pageOrigin(pageUrl);
  return Array.from(doc.querySelectorAll("article.post[data-post-id]")).map((item) => {
    const content = item.querySelector(".body") || item;
    const parentLink = item.querySelector(".reply-ref a.reply-link, .reply-ref a[href*='/c/']");
    const date = item.querySelector(".meta button.date, .meta time");
    const id = postIdFrom(item.getAttribute("data-post-id") || item.id);
    const author = textOf(item.querySelector(".author")) || "neznámý uživatel";
    const imageUrls = Array.from(content.querySelectorAll("img[src]"))
      .map((image) => safeImageUrl(image.getAttribute("src") || image.src, pageUrl))
      .filter(Boolean);

    return {
      id,
      author,
      authorKey: author.toLowerCase(),
      avatarUrl: safeImageUrl(item.querySelector(".avatar img")?.src, pageUrl),
      timestamp:
        date?.getAttribute("aria-label") ||
        date?.getAttribute("title") ||
        date?.getAttribute("datetime") ||
        textOf(date),
      parentId: postIdFrom(parentLink?.getAttribute("href")),
      parentLabel: textOf(parentLink),
      text: textOf(content),
      imageUrls,
      nativeReactions: parseNativeReactions(item),
      platform: "kapybara",
      url: safeBoardUrl(`${origin}${plugin.boardPath}/c/${id}#p${id}`, plugin),
      pageUrl,
    };
  }).filter((post) => post.id);
}

function isKapybaraPage(pageUrl) {
  try {
    return new URL(pageUrl, location.href).hostname === "kapybara.okoun.cz";
  } catch {
    return false;
  }
}

export function parseDocument(doc, pageUrl, plugin) {
  return isKapybaraPage(pageUrl)
    ? parseKapybaraDocument(doc, pageUrl, plugin)
    : parseClassicDocument(doc, pageUrl, plugin);
}

export function olderUrlFrom(doc, pageUrl, plugin) {
  if (isKapybaraPage(pageUrl)) {
    const href = doc
      .querySelector("nav.pager[aria-label='Stránkování příspěvků'] a[aria-label^='Starší příspěvky']")
      ?.getAttribute("href");
    return safeBoardUrl(absoluteUrl(href, pageUrl), plugin);
  }
  const href = doc.querySelector("li.older a, a.older")?.getAttribute("href");
  return safeBoardUrl(absoluteUrl(href, pageUrl), plugin);
}
