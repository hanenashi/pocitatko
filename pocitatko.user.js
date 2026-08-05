// ==UserScript==
// @name         Pociťátko
// @namespace    https://github.com/hanenashi/pocitatko
// @version      0.1.1
// @description  Read-only visual review helper for Okoun image-caption rounds.
// @author       hanenashi
// @match        https://www.okoun.cz/boards/vymysli_vtipny_textik*
// @updateURL    https://raw.githubusercontent.com/hanenashi/pocitatko/main/pocitatko.user.js
// @downloadURL  https://raw.githubusercontent.com/hanenashi/pocitatko/main/pocitatko.user.js
// @grant        GM_setClipboard
// ==/UserScript==

(function () {
  "use strict";

  const VERSION = "0.1.1";
  const BOARD_PATH = "/boards/vymysli_vtipny_textik";
  const IDS = {
    launcher: "pocitatko-launcher",
    overlay: "pocitatko-overlay",
    style: "pocitatko-style",
  };

  const state = {
    posts: [],
    sourceId: null,
    selectedWinnerId: null,
    olderUrl: "",
    loadedUrls: new Set(),
    loading: false,
    error: "",
    detachViewport: null,
  };

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

  function safeBoardUrl(value) {
    try {
      const url = new URL(value, location.href);
      return url.origin === location.origin && url.pathname === BOARD_PATH ? url.href : "";
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

  function parseDocument(doc, pageUrl) {
    return Array.from(doc.querySelectorAll("div.item[id^='article-']")).map((item) => {
      const content = item.querySelector(".content") || item;
      const parentLink = item.querySelector(".actions a.prev");
      const permalink = item.querySelector(".meta a.date.link");
      const id = postIdFrom(item.id);
      const imageUrls = Array.from(content.querySelectorAll("img"))
        .map((image) => safeImageUrl(image.getAttribute("src") || image.src, pageUrl))
        .filter(Boolean);

      return {
        id,
        author: textOf(item.querySelector(".meta .user")) || "neznámý uživatel",
        timestamp: textOf(permalink),
        parentId: postIdFrom(parentLink?.getAttribute("href")),
        parentLabel: textOf(parentLink),
        text: textOf(content),
        imageUrls,
        url:
          safeBoardUrl(absoluteUrl(permalink?.getAttribute("href"), pageUrl)) ||
          `${location.origin}${BOARD_PATH}#article-${id}`,
        pageUrl,
      };
    }).filter((post) => post.id);
  }

  function olderUrlFrom(doc, pageUrl) {
    const href = doc.querySelector("li.older a, a.older")?.getAttribute("href");
    const url = absoluteUrl(href, pageUrl);
    return safeBoardUrl(url);
  }

  function mergePosts(posts) {
    const byId = new Map(state.posts.map((post) => [post.id, post]));
    for (const post of posts) byId.set(post.id, post);
    state.posts = Array.from(byId.values()).sort((a, b) => b.id - a.id);
  }

  function scanCurrentDocument() {
    const pageUrl = location.href;
    mergePosts(parseDocument(document, pageUrl));
    state.loadedUrls.add(pageUrl.split("#")[0]);
    state.olderUrl = olderUrlFrom(document, pageUrl);
  }

  async function loadOneOlderPage() {
    if (state.loading || !state.olderUrl) return;
    state.loading = true;
    state.error = "";
    renderSourceChooser();

    try {
      const requestedUrl = state.olderUrl;
      const response = await fetch(requestedUrl, { credentials: "same-origin" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      mergePosts(parseDocument(doc, requestedUrl));
      state.loadedUrls.add(requestedUrl);
      state.olderUrl = olderUrlFrom(doc, requestedUrl);
    } catch (error) {
      state.error = `Starší stránku se nepodařilo načíst: ${error.message}`;
    } finally {
      state.loading = false;
      renderSourceChooser();
    }
  }

  function imagePosts() {
    return state.posts.filter((post) => !post.parentId && post.imageUrls.length);
  }

  function buildRound(sourceId = state.sourceId) {
    const source = state.posts.find((post) => post.id === sourceId) || null;
    if (!source) return { source: null, candidates: [], unassigned: [] };

    const candidates = state.posts
      .filter((post) => post.id > source.id && !post.parentId && post.imageUrls.length)
      .map((candidate) => ({
        ...candidate,
        reactions: state.posts
          .filter((post) => post.parentId === candidate.id)
          .sort((a, b) => a.id - b.id),
      }))
      .sort((a, b) => a.id - b.id);

    const candidateIds = new Set(candidates.map((candidate) => candidate.id));
    const unassigned = state.posts.filter(
      (post) => post.id > source.id && post.parentId && !candidateIds.has(post.parentId),
    );

    return { source, candidates, unassigned };
  }

  function reactionWeight(text) {
    const bangs = (text.match(/!/g) || []).length;
    if (bangs) return Math.min(3, bangs);
    if (/^[\s.:;,) (\-_*+<>=/\\\p{Extended_Pictographic}]+$/u.test(text)) return 1;
    if (/vyhr[aá]l|nejlep|super|geni[aá]l|par[aá]d|skv[eě]l/i.test(text)) return 2;
    return 1;
  }

  function candidateStats(candidate) {
    const strongestByAuthor = new Map();
    for (const reaction of candidate.reactions) {
      const weight = reactionWeight(reaction.text);
      strongestByAuthor.set(
        reaction.author,
        Math.max(strongestByAuthor.get(reaction.author) || 0, weight),
      );
    }
    return {
      uniqueReactors: strongestByAuthor.size,
      reactionPosts: candidate.reactions.length,
      points: Array.from(strongestByAuthor.values()).reduce((sum, value) => sum + value, 0),
    };
  }

  function rankedCandidates(round) {
    return round.candidates
      .map((candidate) => ({ candidate, stats: candidateStats(candidate) }))
      .sort(
        (a, b) =>
          b.stats.points - a.stats.points ||
          b.stats.uniqueReactors - a.stats.uniqueReactors ||
          a.candidate.id - b.candidate.id,
      );
  }

  function addStyles() {
    if (document.getElementById(IDS.style)) return;
    const style = document.createElement("style");
    style.id = IDS.style;
    style.textContent = `
      #${IDS.launcher} { position: fixed; z-index: 2147483000; right: 18px; bottom: 18px; border: 0; border-radius: 999px; padding: 10px 15px; background: #26231f; color: #fff; box-shadow: 0 5px 20px #0004; cursor: pointer; font: 700 14px system-ui, sans-serif; }
      #${IDS.overlay} { position: fixed; z-index: 2147483001; inset: 2vh 2vw; display: flex; flex-direction: column; overflow: hidden; color: #28241e; background: #f5f1e8; border: 1px solid #9f9789; border-radius: 16px; box-shadow: 0 18px 70px #0008; font: 14px/1.45 system-ui, sans-serif; }
      #${IDS.overlay} * { box-sizing: border-box; }
      #${IDS.overlay} [data-pocitatko-header] { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 12px 14px; background: #fffdf8; border-bottom: 1px solid #d7d0c5; }
      #${IDS.overlay} [data-pocitatko-header] h2 { margin: 0 auto 0 0; font-size: 18px; }
      #${IDS.overlay} button { border: 1px solid #aaa093; border-radius: 8px; padding: 8px 11px; background: #fffdf8; color: inherit; cursor: pointer; font: inherit; }
      #${IDS.overlay} button.primary { border-color: #725914; background: #f0c957; font-weight: 700; }
      #${IDS.overlay} button:disabled { opacity: .55; cursor: wait; }
      #${IDS.overlay} [data-pocitatko-body] { min-height: 0; flex: 1; overflow: auto; padding: 16px; }
      #${IDS.overlay} [data-pocitatko-intro] { max-width: 900px; margin: 0 auto 14px; padding: 12px 14px; border-radius: 10px; background: #fffdf8; }
      #${IDS.overlay} [data-pocitatko-error] { max-width: 900px; margin: 0 auto 14px; padding: 10px 12px; border-radius: 8px; background: #ffd9d3; color: #70251b; }
      #${IDS.overlay} [data-pocitatko-grid] { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
      #${IDS.overlay} [data-pocitatko-source-card] { display: flex; flex-direction: column; min-width: 0; padding: 9px; border: 2px solid transparent; border-radius: 12px; background: #fffdf8; cursor: pointer; }
      #${IDS.overlay} [data-pocitatko-source-card].selected { border-color: #a87900; box-shadow: 0 0 0 3px #f0c95755; }
      #${IDS.overlay} [data-pocitatko-source-card] img { width: 100%; aspect-ratio: 1/1; border-radius: 8px; object-fit: contain; background: #e8e2d8; }
      #${IDS.overlay} [data-pocitatko-source-card] strong { margin-top: 7px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      #${IDS.overlay} [data-pocitatko-source-card] small { color: #6d665d; }
      #${IDS.overlay} [data-pocitatko-confirm] { position: sticky; bottom: 0; display: grid; grid-template-columns: 92px 1fr auto; align-items: center; gap: 12px; max-width: 900px; margin: 16px auto 0; padding: 10px; border: 1px solid #bfa34f; border-radius: 12px; background: #fff8d9; box-shadow: 0 6px 24px #0003; }
      #${IDS.overlay} [data-pocitatko-confirm] img { width: 92px; height: 72px; border-radius: 7px; object-fit: contain; background: #e8e2d8; }
      #${IDS.overlay} [data-pocitatko-round] { display: grid; grid-template-columns: minmax(220px, .6fr) minmax(340px, 1.4fr); min-height: 100%; }
      #${IDS.overlay} [data-pocitatko-prompt] { position: sticky; top: 0; align-self: start; padding: 14px; }
      #${IDS.overlay} [data-pocitatko-prompt] > img { display: block; max-width: 100%; max-height: 56vh; margin: 10px auto; border-radius: 9px; object-fit: contain; background: #e8e2d8; }
      #${IDS.overlay} [data-pocitatko-candidates] { padding: 14px; border-left: 1px solid #d7d0c5; }
      #${IDS.overlay} [data-pocitatko-candidate] { margin: 0 0 14px; padding: 12px; border: 2px solid transparent; border-radius: 12px; background: #fffdf8; }
      #${IDS.overlay} [data-pocitatko-candidate].suggested { border-color: #d0a51d; }
      #${IDS.overlay} [data-pocitatko-candidate].winner { border-color: #23804b; box-shadow: 0 0 0 3px #23804b22; }
      #${IDS.overlay} [data-pocitatko-candidate] header { display: flex; align-items: baseline; flex-wrap: wrap; gap: 7px; }
      #${IDS.overlay} [data-pocitatko-candidate] header small, #${IDS.overlay} [data-pocitatko-muted] { color: #6d665d; }
      #${IDS.overlay} [data-pocitatko-candidate] img { display: block; max-width: 100%; max-height: 520px; margin: 10px auto; border-radius: 8px; object-fit: contain; background: #e8e2d8; }
      #${IDS.overlay} [data-pocitatko-score] { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
      #${IDS.overlay} [data-pocitatko-chip] { padding: 3px 8px; border-radius: 999px; background: #eee8dc; font-size: 12px; }
      #${IDS.overlay} details { margin-top: 8px; }
      #${IDS.overlay} [data-pocitatko-reactions] { margin: 7px 0 0; padding-left: 21px; }
      #${IDS.overlay} [data-pocitatko-reactions] li { margin: 4px 0; }
      #${IDS.overlay} a { color: #755800; }
      @media (max-width: 900px) {
        #${IDS.overlay} { inset: 0; border-radius: 0; }
        #${IDS.overlay} [data-pocitatko-body] { padding: 10px; }
        #${IDS.overlay} [data-pocitatko-grid] { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
        #${IDS.overlay} [data-pocitatko-confirm] { grid-template-columns: 72px 1fr; }
        #${IDS.overlay} [data-pocitatko-confirm] img { width: 72px; height: 62px; }
        #${IDS.overlay} [data-pocitatko-confirm] button { grid-column: 1 / -1; }
        #${IDS.overlay} [data-pocitatko-round] { display: block; }
        #${IDS.overlay} [data-pocitatko-prompt] { position: static; }
        #${IDS.overlay} [data-pocitatko-prompt] > img { max-height: 34vh; }
        #${IDS.overlay} [data-pocitatko-candidates] { padding: 10px 0; border: 0; }
        #${IDS.overlay} [data-pocitatko-candidate] img { max-height: 42vh; }
      }
    `;
    document.head.appendChild(style);
  }

  function makeButton(label, onClick, className = "") {
    const node = document.createElement("button");
    node.type = "button";
    node.textContent = label;
    node.className = className;
    node.addEventListener("click", onClick);
    return node;
  }

  function makeImage(src, alt) {
    const image = document.createElement("img");
    image.src = src;
    image.alt = alt;
    image.loading = "lazy";
    return image;
  }

  function makePostLink(post, label = "Původní příspěvek") {
    const link = document.createElement("a");
    link.href = safeBoardUrl(post.url);
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = label;
    return link;
  }

  function overlayParts() {
    const overlay = document.getElementById(IDS.overlay);
    return {
      overlay,
      header: overlay?.querySelector("[data-pocitatko-header]"),
      body: overlay?.querySelector("[data-pocitatko-body]"),
    };
  }

  function closeOverlay() {
    state.detachViewport?.();
    state.detachViewport = null;
    document.getElementById(IDS.overlay)?.remove();
  }

  function attachToVisualViewport(overlay) {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const sync = () => {
      if (!overlay.isConnected) return;
      const browserChromeInset = viewport.width < 500 ? 18 : 0;
      overlay.style.inset = "auto";
      overlay.style.left = `${viewport.offsetLeft}px`;
      overlay.style.top = `${viewport.offsetTop + browserChromeInset}px`;
      overlay.style.width = `${viewport.width}px`;
      overlay.style.height = `${viewport.height - browserChromeInset}px`;
      overlay.style.borderRadius = "0";
    };
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    state.detachViewport = () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
    };
    sync();
  }

  function setHeader(status, buttons = []) {
    const { header } = overlayParts();
    if (!header) return;
    header.replaceChildren();
    const title = document.createElement("h2");
    title.textContent = `Pociťátko v${VERSION}`;
    const meta = document.createElement("span");
    meta.textContent = status;
    header.append(title, meta, ...buttons);
  }

  function selectSource(postId) {
    state.sourceId = postId;
    state.selectedWinnerId = null;
    renderSourceChooser();
  }

  function renderSourceChooser() {
    const { body, overlay } = overlayParts();
    if (!body || !overlay) return;
    const images = imagePosts();
    setHeader(
      `${state.posts.length} příspěvků · ${images.length} obrázků · ${state.loadedUrls.size} str.`,
      [
        makeButton(
          state.loading ? "Načítám…" : state.olderUrl ? "Načíst starší stránku" : "Bez dalších stránek",
          loadOneOlderPage,
        ),
        makeButton("Zavřít", closeOverlay),
      ],
    );
    headerButtonDisabled(state.loading || !state.olderUrl);
    body.replaceChildren();

    const intro = document.createElement("div");
    intro.dataset.pocitatkoIntro = "";
    const heading = document.createElement("strong");
    heading.textContent = "1. Vyber původní obrázek kola";
    const explanation = document.createElement("p");
    explanation.textContent =
      "Klikni na zdrojový obrázek. Po potvrzení se všechny pozdější samostatné obrázkové příspěvky vezmou jako soutěžní návrhy a jejich vláknové odpovědi jako reakce.";
    intro.append(heading, explanation);
    body.append(intro);

    if (state.error) {
      const error = document.createElement("div");
      error.dataset.pocitatkoError = "";
      error.textContent = state.error;
      body.append(error);
    }

    const grid = document.createElement("div");
    grid.dataset.pocitatkoGrid = "";
    for (const post of images) {
      const card = document.createElement("article");
      card.dataset.pocitatkoSourceCard = "";
      card.dataset.postId = String(post.id);
      card.tabIndex = 0;
      if (post.id === state.sourceId) card.classList.add("selected");
      card.append(makeImage(post.imageUrls[0], `Obrázek od ${post.author}`));
      const author = document.createElement("strong");
      author.textContent = post.author;
      const date = document.createElement("small");
      date.textContent = post.timestamp || `#${post.id}`;
      card.append(author, date);
      card.addEventListener("click", () => selectSource(post.id));
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") selectSource(post.id);
      });
      grid.append(card);
    }
    body.append(grid);

    const selected = state.posts.find((post) => post.id === state.sourceId);
    if (selected) {
      const round = buildRound(selected.id);
      const confirm = document.createElement("div");
      confirm.dataset.pocitatkoConfirm = "";
      confirm.append(makeImage(selected.imageUrls[0], "Vybraný zdrojový obrázek"));
      const summary = document.createElement("div");
      const label = document.createElement("strong");
      label.textContent = `Začátek: ${selected.author}`;
      const counts = document.createElement("div");
      counts.textContent = `${selected.timestamp} · nalezeno ${round.candidates.length} soutěžních obrázků`;
      summary.append(label, counts);
      confirm.append(summary, makeButton("Potvrdit a spočítat", renderRound, "primary"));
      body.append(confirm);
    }
    body.scrollTop = 0;
  }

  function headerButtonDisabled(disabled) {
    const { header } = overlayParts();
    const button = header?.querySelector("button");
    if (button) button.disabled = disabled;
  }

  function renderRound() {
    const { body, overlay } = overlayParts();
    if (!body || !overlay) return;
    const round = buildRound();
    if (!round.source) {
      renderSourceChooser();
      return;
    }
    const ranked = rankedCandidates(round);
    if (!state.selectedWinnerId && ranked.length) state.selectedWinnerId = ranked[0].candidate.id;
    const selectedWinner = round.candidates.find(
      (candidate) => candidate.id === state.selectedWinnerId,
    );

    const buttons = [
      makeButton("Změnit začátek", renderSourceChooser),
      makeButton(
        "Kopírovat výsledek",
        () => selectedWinner && copyText(`Vyhrál/a ${selectedWinner.author}. Gratulace!`),
        "primary",
      ),
      makeButton("Zavřít", closeOverlay),
    ];
    buttons[1].disabled = !selectedWinner;
    setHeader(
      `${round.candidates.length} soutěžících · ${round.candidates.reduce((sum, candidate) => sum + candidate.reactions.length, 0)} reakcí`,
      buttons,
    );
    body.replaceChildren();

    const layout = document.createElement("div");
    layout.dataset.pocitatkoRound = "";
    const prompt = document.createElement("section");
    prompt.dataset.pocitatkoPrompt = "";
    const promptTitle = document.createElement("h3");
    promptTitle.textContent = "Potvrzený zdroj";
    prompt.append(promptTitle, makeImage(round.source.imageUrls[0], "Zdrojový obrázek"));
    const promptMeta = document.createElement("p");
    promptMeta.textContent = `${round.source.author} · ${round.source.timestamp}`;
    prompt.append(promptMeta, makePostLink(round.source));
    if (round.unassigned.length) {
      const warning = document.createElement("p");
      warning.dataset.pocitatkoMuted = "";
      warning.textContent = `${round.unassigned.length} odpovědí míří na příspěvky mimo načtený výběr; nejsou potichu započítané.`;
      prompt.append(warning);
    }

    const candidates = document.createElement("section");
    candidates.dataset.pocitatkoCandidates = "";
    const title = document.createElement("h3");
    title.textContent = ranked.length
      ? `Soutěžní obrázky (${ranked.length})`
      : "Zatím nebyly nalezeny pozdější soutěžní obrázky";
    candidates.append(title);

    ranked.forEach(({ candidate, stats }, index) => {
      const card = document.createElement("article");
      card.dataset.pocitatkoCandidate = "";
      card.dataset.postId = String(candidate.id);
      if (index === 0) card.classList.add("suggested");
      if (candidate.id === state.selectedWinnerId) card.classList.add("winner");
      const header = document.createElement("header");
      const author = document.createElement("strong");
      author.textContent = candidate.author;
      const time = document.createElement("small");
      time.textContent = candidate.timestamp;
      header.append(author, time);
      card.append(header);
      candidate.imageUrls.forEach((src) =>
        card.append(makeImage(src, `Soutěžní obrázek od ${candidate.author}`)),
      );
      if (candidate.text) {
        const caption = document.createElement("p");
        caption.textContent = candidate.text;
        card.append(caption);
      }

      const score = document.createElement("div");
      score.dataset.pocitatkoScore = "";
      [
        `${stats.points} bodů`,
        `${stats.uniqueReactors} lidí`,
        `${stats.reactionPosts} reakcí`,
        index === 0 ? "návrh Pociťátka" : "",
      ].filter(Boolean).forEach((label) => {
        const chip = document.createElement("span");
        chip.dataset.pocitatkoChip = "";
        chip.textContent = label;
        score.append(chip);
      });
      card.append(score);

      const controls = document.createElement("div");
      controls.append(
        makeButton(
          candidate.id === state.selectedWinnerId ? "Vybraný vítěz" : "Vybrat vítěze",
          () => {
            state.selectedWinnerId = candidate.id;
            renderRound();
          },
          candidate.id === state.selectedWinnerId ? "primary" : "",
        ),
        document.createTextNode(" "),
        makePostLink(candidate),
      );
      card.append(controls);

      const details = document.createElement("details");
      if (candidate.reactions.length <= 6) details.open = true;
      const summary = document.createElement("summary");
      summary.textContent = `Všechny reakce (${candidate.reactions.length})`;
      const list = document.createElement("ul");
      list.dataset.pocitatkoReactions = "";
      candidate.reactions.forEach((reaction) => {
        const item = document.createElement("li");
        const who = document.createElement("strong");
        who.textContent = `${reaction.author}: `;
        item.append(who, document.createTextNode(reaction.text || "(bez textu)"));
        list.append(item);
      });
      details.append(summary, list);
      card.append(details);
      candidates.append(card);
    });

    layout.append(prompt, candidates);
    body.append(layout);
    body.scrollTop = 0;
  }

  function copyText(value) {
    if (typeof GM_setClipboard === "function") GM_setClipboard(value, "text");
    else navigator.clipboard?.writeText(value);
  }

  async function openOverlay() {
    closeOverlay();
    addStyles();
    state.posts = [];
    state.sourceId = null;
    state.selectedWinnerId = null;
    state.olderUrl = "";
    state.loadedUrls = new Set();
    state.error = "";

    const overlay = document.createElement("div");
    overlay.id = IDS.overlay;
    const header = document.createElement("div");
    header.dataset.pocitatkoHeader = "";
    const body = document.createElement("div");
    body.dataset.pocitatkoBody = "";
    overlay.append(header, body);
    document.body.append(overlay);
    attachToVisualViewport(overlay);

    scanCurrentDocument();
    renderSourceChooser();
    if (state.olderUrl) await loadOneOlderPage();
  }

  function installLauncher() {
    if (document.getElementById(IDS.launcher)) return;
    addStyles();
    const launcher = document.createElement("button");
    launcher.id = IDS.launcher;
    launcher.type = "button";
    launcher.textContent = "Pociťátko";
    launcher.title = `Vybrat zdroj a zkontrolovat kolo (v${VERSION})`;
    launcher.addEventListener("click", openOverlay);
    document.body.appendChild(launcher);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installLauncher, { once: true });
  } else {
    installLauncher();
  }
})();
