const textOf = (node) =>
  (node?.innerText || node?.textContent || "").replace(/\s+/g, " ").trim();

function postIdFrom(value) {
  const match =
    String(value || "").match(/(?:article-|contextId=)(\d+)/i) ||
    String(value || "").match(/\b(\d{6,})\b/);
  return match ? Number(match[1]) : null;
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

export function parseDocument(doc, pageUrl, plugin) {
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
      url:
        safeBoardUrl(absoluteUrl(permalink?.getAttribute("href"), pageUrl), plugin) ||
        `${location.origin}${plugin.boardPath}#article-${id}`,
      pageUrl,
    };
  }).filter((post) => post.id);
}

export function olderUrlFrom(doc, pageUrl, plugin) {
  const href = doc.querySelector("li.older a, a.older")?.getAttribute("href");
  return safeBoardUrl(absoluteUrl(href, pageUrl), plugin);
}
