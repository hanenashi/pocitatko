// ==UserScript==
// @name         Pociťátko
// @namespace    https://github.com/hanenashi/pocitatko
// @version      0.1.0
// @description  Read-only visual review helper for Okoun image-caption rounds.
// @author       hanenashi
// @match        https://www.okoun.cz/boards/vymysli_vtipny_textik*
// @updateURL    https://raw.githubusercontent.com/hanenashi/pocitatko/main/pocitatko.user.js
// @downloadURL  https://raw.githubusercontent.com/hanenashi/pocitatko/main/pocitatko.user.js
// @grant        GM_setClipboard
// ==/UserScript==

(function () {
  "use strict";

  const VERSION = "0.1.0";
  const IDS = {
    launcher: "pocitatko-launcher",
    overlay: "pocitatko-overlay",
    style: "pocitatko-style",
  };

  const state = {
    posts: [],
    groups: [],
    selectedCandidateId: null,
  };

  const textOf = (node) => (node?.innerText || node?.textContent || "").replace(/\s+/g, " ").trim();

  function firstMatching(root, selectors) {
    for (const selector of selectors) {
      const node = root.querySelector(selector);
      if (node) return node;
    }
    return null;
  }

  function postIdFrom(value) {
    const match = String(value || "").match(/(?:article-|post-)(\d+)/i) || String(value || "").match(/\b(\d{6,})\b/);
    return match ? Number(match[1]) : null;
  }

  function safeBoardUrl(value) {
    try {
      const url = new URL(value, location.href);
      return url.origin === "https://www.okoun.cz" ? url.href : "";
    } catch {
      return "";
    }
  }

  function getAuthor(item) {
    const node = firstMatching(item, [
      ".author",
      ".user",
      "[class*='author']",
      "[class*='user']",
      "header a[href*='user']",
    ]);
    return textOf(node) || "neznámý uživatel";
  }

  function getBody(item) {
    return firstMatching(item, [
      ".article-body",
      ".post-body",
      ".content",
      ".body",
      "[class*='content']",
    ]) || item;
  }

  function getParent(item) {
    const relation = Array.from(item.querySelectorAll("a")).find((link) => /reakce na|vlákno/i.test(textOf(link)));
    if (!relation) return null;
    return postIdFrom(relation.href) || postIdFrom(relation.closest("[id]")) || postIdFrom(relation.dataset?.id);
  }

  function getTimestamp(item) {
    const time = firstMatching(item, ["time", "[datetime]"]);
    return time?.dateTime || textOf(time) || "";
  }

  function getImages(body) {
    return Array.from(body.querySelectorAll("img"))
      .map((img) => img.currentSrc || img.src)
      .filter((src) => /^https?:\/\//i.test(src));
  }

  function classify(post) {
    const text = post.text.toLocaleLowerCase("cs-CZ");
    const announcement = /vyhr[aá]l|gratul|zad[aá]v|pl[eé]n|theme pool|použito|vzd[aá]v|unbook/i.test(text);
    const shortReaction = post.text.length <= 18 && /^[!?.:;,) (\-_*+<>=\/\\\p{Extended_Pictographic}]+$/u.test(post.text);

    if (announcement) return { type: "announcement", confidence: "high", reason: "winner or handoff language" };
    if (!post.parentId) return { type: post.imageUrls.length ? "prompt" : "unknown", confidence: post.imageUrls.length ? "medium" : "low", reason: post.imageUrls.length ? "root post contains an image" : "root post without an image" };
    if (shortReaction) return { type: "reaction", confidence: "medium", reason: "short reaction-like text" };
    return { type: "candidate", confidence: post.text || post.imageUrls.length ? "medium" : "low", reason: "reply with caption text or an image" };
  }

  function parsePosts() {
    const items = Array.from(document.querySelectorAll("div.item[id^='article-'], article[id^='article-'], [data-post-id]"));
    const posts = items.map((item) => {
      const body = getBody(item);
      const id = postIdFrom(item.id || item.dataset?.postId);
      const post = {
        id,
        author: getAuthor(item),
        timestamp: getTimestamp(item),
        parentId: getParent(item),
        text: textOf(body),
        html: body.innerHTML,
        imageUrls: getImages(body),
        url: id ? `${location.origin}${location.pathname}#article-${id}` : location.href,
        element: item,
      };
      return { ...post, ...classify(post) };
    }).filter((post) => post.id);

    const byId = new Map(posts.map((post) => [post.id, post]));
    for (const post of posts) {
      let parent = byId.get(post.parentId);
      const visited = new Set();
      while (parent && !visited.has(parent.id)) {
        visited.add(parent.id);
        if (parent.type === "prompt") {
          post.promptId = parent.id;
          break;
        }
        parent = byId.get(parent.parentId);
      }
    }

    return posts;
  }

  function buildGroups(posts) {
    const prompts = posts.filter((post) => post.type === "prompt");
    const groups = prompts.map((prompt) => ({
      prompt,
      candidates: posts.filter((post) => post.promptId === prompt.id && post.type === "candidate"),
      reactions: posts.filter((post) => post.promptId === prompt.id && post.type === "reaction"),
      announcements: posts.filter((post) => post.promptId === prompt.id && post.type === "announcement"),
    }));

    if (!groups.length) {
      return [{
        prompt: posts.find((post) => post.imageUrls.length) || posts[0] || null,
        candidates: posts.filter((post) => post.type === "candidate"),
        reactions: posts.filter((post) => post.type === "reaction"),
        announcements: posts.filter((post) => post.type === "announcement"),
      }];
    }
    return groups;
  }

  function scoreCandidate(candidate, group) {
    const reactions = group.reactions.filter((reaction) => reaction.parentId === candidate.id || reaction.promptId === candidate.id);
    const uniqueAuthors = new Set(reactions.map((reaction) => reaction.author)).size;
    const explicit = reactions.filter((reaction) => /vyhr[aá]l|nejlep|super|geni[aá]l|tohle/i.test(reaction.text)).length;
    return uniqueAuthors + explicit + Math.min(2, reactions.length / 5);
  }

  function suggestedWinner(group) {
    const ranked = group.candidates
      .map((candidate) => ({ candidate, score: scoreCandidate(candidate, group) }))
      .sort((a, b) => b.score - a.score);
    return ranked[0] || null;
  }

  function addStyles() {
    if (document.getElementById(IDS.style)) return;
    const style = document.createElement("style");
    style.id = IDS.style;
    style.textContent = `
      #${IDS.launcher} { position: fixed; z-index: 2147483000; right: 18px; bottom: 18px; border: 0; border-radius: 999px; padding: 10px 15px; background: #222; color: #fff; box-shadow: 0 5px 20px #0004; cursor: pointer; font: 600 14px system-ui, sans-serif; }
      #${IDS.overlay} { position: fixed; z-index: 2147483001; inset: 3vh 3vw; display: flex; flex-direction: column; overflow: hidden; color: #242424; background: #f5f3ef; border: 1px solid #aaa; border-radius: 16px; box-shadow: 0 18px 70px #0008; font: 14px/1.4 system-ui, sans-serif; }
      #${IDS.overlay} [data-pocitatko-header] { display: flex; align-items: center; gap: 10px; padding: 13px 16px; background: #fff; border-bottom: 1px solid #ddd; }
      #${IDS.overlay} [data-pocitatko-header] h2 { margin: 0 auto 0 0; font-size: 18px; }
      #${IDS.overlay} button { border: 1px solid #bbb; border-radius: 8px; padding: 7px 10px; background: #fff; color: inherit; cursor: pointer; }
      #${IDS.overlay} [data-pocitatko-body] { display: grid; grid-template-columns: minmax(220px, .75fr) minmax(360px, 1.25fr); min-height: 0; flex: 1; }
      #${IDS.overlay} [data-pocitatko-prompt] { overflow: auto; padding: 18px; border-right: 1px solid #ddd; }
      #${IDS.overlay} [data-pocitatko-prompt] img { display: block; max-width: 100%; max-height: 55vh; margin: 12px auto; border-radius: 8px; object-fit: contain; }
      #${IDS.overlay} [data-pocitatko-candidates] { overflow: auto; padding: 18px; }
      #${IDS.overlay} [data-pocitatko-card] { margin: 0 0 12px; padding: 12px; background: #fff; border: 1px solid #ddd; border-radius: 10px; }
      #${IDS.overlay} [data-pocitatko-card].suggested { border-color: #b27b00; box-shadow: 0 0 0 2px #f2c96b66; }
      #${IDS.overlay} [data-pocitatko-card] header { display: flex; align-items: baseline; gap: 8px; }
      #${IDS.overlay} [data-pocitatko-card] header strong { font-size: 15px; }
      #${IDS.overlay} [data-pocitatko-card] header small, #${IDS.overlay} [data-pocitatko-meta] { color: #666; }
      #${IDS.overlay} [data-pocitatko-card] p { white-space: pre-wrap; }
      #${IDS.overlay} [data-pocitatko-card] img { max-width: min(100%, 420px); max-height: 260px; object-fit: contain; }
      #${IDS.overlay} [data-pocitatko-chip] { display: inline-block; margin: 4px 4px 0 0; padding: 2px 7px; border-radius: 999px; background: #eee; color: #555; font-size: 12px; }
      #${IDS.overlay} [data-pocitatko-warning] { padding: 10px; border-radius: 8px; background: #fff3cd; }
      @media (max-width: 760px) { #${IDS.overlay} { inset: 0; border-radius: 0; } #${IDS.overlay} [data-pocitatko-body] { display: block; } #${IDS.overlay} [data-pocitatko-prompt] { max-height: 35vh; border-right: 0; border-bottom: 1px solid #ddd; } }
    `;
    document.head.appendChild(style);
  }

  function button(label, onClick) {
    const node = document.createElement("button");
    node.type = "button";
    node.textContent = label;
    node.addEventListener("click", onClick);
    return node;
  }

  function copyText(value) {
    if (typeof GM_setClipboard === "function") GM_setClipboard(value, "text");
    else navigator.clipboard?.writeText(value);
  }

  function renderGroup(group, index, total) {
    const root = document.createElement("div");
    const prompt = group.prompt;
    const suggestion = suggestedWinner(group);
    const promptPane = document.createElement("section");
    promptPane.setAttribute("data-pocitatko-prompt", "");
    const candidatesPane = document.createElement("section");
    candidatesPane.setAttribute("data-pocitatko-candidates", "");

    const promptTitle = document.createElement("h3");
    promptTitle.textContent = `Kolo ${index + 1} / ${total}`;
    promptPane.append(promptTitle);
    if (prompt) {
      const meta = document.createElement("div");
      meta.dataset.pocitatkoMeta = "";
      meta.textContent = `${prompt.author} · ${prompt.timestamp || "čas neuveden"}`;
      promptPane.append(meta);
      for (const src of prompt.imageUrls.slice(0, 4)) {
        const image = document.createElement("img");
        image.src = src;
        image.alt = "Zdrojový obrázek kola";
        promptPane.append(image);
      }
      const link = document.createElement("a");
      link.href = safeBoardUrl(prompt.url);
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "Otevřít původní příspěvek";
      promptPane.append(link);
    } else {
      const warning = document.createElement("div");
      warning.dataset.pocitatkoWarning = "";
      warning.textContent = "Zdrojový příspěvek se nepodařilo určit.";
      promptPane.append(warning);
    }

    const title = document.createElement("h3");
    title.textContent = `Možní soutěžící (${group.candidates.length})`;
    candidatesPane.append(title);
    if (suggestion) {
      const suggested = document.createElement("div");
      suggested.dataset.pocitatkoWarning = "";
      suggested.textContent = `Návrh: ${suggestion.candidate.author} · skóre ${suggestion.score.toFixed(1)} (zkontrolujte ručně)`;
      candidatesPane.append(suggested);
    }

    for (const candidate of group.candidates) {
      const card = document.createElement("article");
      card.dataset.pocitatkoCard = "";
      if (suggestion?.candidate.id === candidate.id) card.classList.add("suggested");
      const header = document.createElement("header");
      const author = document.createElement("strong");
      author.textContent = candidate.author;
      const time = document.createElement("small");
      time.textContent = candidate.timestamp;
      header.append(author, time);
      card.append(header);
      const body = document.createElement("p");
      body.textContent = candidate.text || "(bez textu)";
      card.append(body);
      for (const src of candidate.imageUrls.slice(0, 4)) {
        const image = document.createElement("img");
        image.src = src;
        image.alt = "Obrázek v příspěvku";
        card.append(image);
      }
      const reactions = group.reactions.filter((reaction) => reaction.parentId === candidate.id || reaction.promptId === candidate.id);
      const chip = document.createElement("span");
      chip.dataset.pocitatkoChip = "";
      chip.textContent = `${new Set(reactions.map((reaction) => reaction.author)).size} unikátních reakcí · ${reactions.length} příspěvků`;
      card.append(chip);
      const link = document.createElement("a");
      link.href = safeBoardUrl(candidate.url);
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "Původní příspěvek";
      card.append(document.createTextNode(" "), link);
      candidatesPane.append(card);
    }

    if (group.announcements.length) {
      const note = document.createElement("p");
      note.dataset.pocitatkoMeta = "";
      note.textContent = `Oznámení: ${group.announcements.map((post) => post.text).join(" · ")}`;
      candidatesPane.append(note);
    }

    root.append(promptPane, candidatesPane);
    return { root, suggestion };
  }

  function openOverlay() {
    document.getElementById(IDS.overlay)?.remove();
    addStyles();
    state.posts = parsePosts();
    state.groups = buildGroups(state.posts);
    const overlay = document.createElement("div");
    overlay.id = IDS.overlay;
    const header = document.createElement("div");
    header.dataset.pocitatkoHeader = "";
    const title = document.createElement("h2");
    title.textContent = `Pociťátko v${VERSION}`;
    const status = document.createElement("span");
    status.textContent = `${state.posts.length} příspěvků · ${state.groups.length} kol`;
    const first = state.groups[0];
    const suggestion = first && suggestedWinner(first);
    header.append(title, status);
    if (suggestion) {
      header.append(button("Kopírovat návrh", () => copyText(`Vyhrál/a ${suggestion.candidate.author}. Gratulace!`)));
    }
    header.append(button("Zavřít", () => overlay.remove()));
    const body = document.createElement("div");
    body.dataset.pocitatkoBody = "";
    const rendered = renderGroup(first || { prompt: null, candidates: [], reactions: [], announcements: [] }, 0, state.groups.length);
    body.append(rendered.root);
    overlay.append(header, body);
    document.body.appendChild(overlay);
  }

  function installLauncher() {
    if (document.getElementById(IDS.launcher)) return;
    addStyles();
    const launcher = document.createElement("button");
    launcher.id = IDS.launcher;
    launcher.type = "button";
    launcher.textContent = "Pociťátko";
    launcher.title = `Otevřít read-only přehled (v${VERSION})`;
    launcher.addEventListener("click", openOverlay);
    document.body.appendChild(launcher);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installLauncher, { once: true });
  else installLauncher();
})();
