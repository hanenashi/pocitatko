// ==UserScript==
// @name         Pociťátko
// @namespace    https://github.com/hanenashi/pocitatko
// @version      0.3.0
// @description  Read-only visual review helper for Okoun club rounds.
// @author       hanenashi
// @match        https://www.okoun.cz/boards/vymysli_vtipny_textik*
// @updateURL    https://raw.githubusercontent.com/hanenashi/pocitatko/main/pocitatko.user.js
// @downloadURL  https://raw.githubusercontent.com/hanenashi/pocitatko/main/pocitatko.user.js
// @grant        GM_deleteValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @grant        GM_setValue
// ==/UserScript==

(() => {
  // src/constants.js
  var VERSION = "0.3.0";
  var DATA_SCHEMA_VERSION = 1;
  var IDS = {
    launcher: "pocitatko-launcher",
    overlay: "pocitatko-overlay",
    style: "pocitatko-style"
  };

  // src/plugins/vymysli-vtipny-textik.js
  var vymysliVtipnyTextik = {
    id: "vymysli_vtipny_textik",
    name: "Vymysli vtipn\xFD text\xEDk",
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
      return posts.filter((post) => post.id > sourceId && this.isRoundEnd(post)).sort((a, b) => a.id - b.id);
    },
    suggestedEndId(posts, sourceId) {
      return this.roundEndsAfter(posts, sourceId)[0]?.id || null;
    },
    buildRound({ posts, sourceId, endId }) {
      const source = posts.find((post) => post.id === sourceId) || null;
      if (!source) return { source: null, end: null, candidates: [], unassigned: [] };
      const end = posts.find((post) => post.id === endId) || null;
      const beforeEnd = (post) => !end || post.id < end.id;
      const candidates = posts.filter(
        (post) => post.id > source.id && beforeEnd(post) && !post.parentId && post.imageUrls.length
      ).map((candidate) => ({
        ...candidate,
        reactions: posts.filter(
          (post) => post.id > candidate.id && beforeEnd(post) && post.parentId === candidate.id && !this.isRoundEnd(post)
        ).sort((a, b) => a.id - b.id)
      })).sort((a, b) => a.id - b.id);
      const candidateIds = new Set(candidates.map((candidate) => candidate.id));
      const unassigned = posts.filter(
        (post) => post.id > source.id && beforeEnd(post) && post.parentId && !candidateIds.has(post.parentId)
      );
      return { source, end, candidates, unassigned };
    },
    scoreCandidate(candidate, { excludedReactionIds }) {
      const includedReactions = candidate.reactions.filter(
        (reaction) => !excludedReactionIds.has(reaction.id)
      );
      const reactingAuthors = new Set(includedReactions.map((reaction) => reaction.author));
      return {
        uniqueReactors: reactingAuthors.size,
        reactionPosts: includedReactions.length,
        excludedPosts: candidate.reactions.length - includedReactions.length,
        points: reactingAuthors.size
      };
    },
    rankCandidates(round, context) {
      return round.candidates.map((candidate) => ({ candidate, stats: this.scoreCandidate(candidate, context) })).sort(
        (a, b) => b.stats.points - a.stats.points || b.stats.uniqueReactors - a.stats.uniqueReactors || a.candidate.id - b.candidate.id
      );
    },
    formatResult(winner) {
      return `Vyhr\xE1l/a ${winner.author}. Gratulace!`;
    },
    sourceExplanation: "Klikni na zdrojov\xFD obr\xE1zek. Po potvrzen\xED se v\u0161echny pozd\u011Bj\u0161\xED samostatn\xE9 obr\xE1zkov\xE9 p\u0159\xEDsp\u011Bvky vezmou jako sout\u011B\u017En\xED n\xE1vrhy a jejich vl\xE1knov\xE9 odpov\u011Bdi jako reakce."
  };
  var clubPlugins = [vymysliVtipnyTextik];

  // src/core/settings.js
  var STORAGE_PREFIX = "pocitatko:";
  var SETTINGS = {
    launcherHidden: "launcherHidden",
    launcherPosition: "launcherPosition"
  };
  function getSetting(key, fallback) {
    if (typeof GM_getValue === "function") return GM_getValue(key, fallback);
    try {
      const value = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
      return value === null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  function setSetting(key, value) {
    if (typeof GM_setValue === "function") GM_setValue(key, value);
    else {
      try {
        localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
      } catch {
      }
    }
  }
  function deleteSetting(key) {
    if (typeof GM_deleteValue === "function") GM_deleteValue(key);
    else {
      try {
        localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
      } catch {
      }
    }
  }

  // src/ui/launcher.js
  var clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
  function installLauncherControls({ ids, version, addStyles: addStyles2, openOverlay }) {
    let detachLauncherViewport = null;
    let ignoreLauncherClickUntil = 0;
    function launcherViewportBounds(launcher) {
      const viewport = window.visualViewport;
      const viewportLeft = viewport?.offsetLeft || 0;
      const viewportTop = viewport?.offsetTop || 0;
      const viewportWidth = viewport?.width || window.innerWidth;
      const viewportHeight = viewport?.height || window.innerHeight;
      const availableWidth = Math.max(0, viewportWidth - launcher.offsetWidth);
      const availableHeight = Math.max(0, viewportHeight - launcher.offsetHeight);
      const insetX = Math.min(12, availableWidth / 2);
      const insetY = Math.min(12, availableHeight / 2);
      return {
        minLeft: viewportLeft + insetX,
        maxLeft: viewportLeft + availableWidth - insetX,
        minTop: viewportTop + insetY,
        maxTop: viewportTop + availableHeight - insetY
      };
    }
    function normalizedLauncherPosition() {
      const saved = getSetting(SETTINGS.launcherPosition, { x: 1, y: 1 });
      return {
        x: Number.isFinite(saved?.x) ? clamp(saved.x, 0, 1) : 1,
        y: Number.isFinite(saved?.y) ? clamp(saved.y, 0, 1) : 1
      };
    }
    function placeLauncher(launcher, position = normalizedLauncherPosition()) {
      if (!launcher?.isConnected) return;
      const bounds = launcherViewportBounds(launcher);
      launcher.style.right = "auto";
      launcher.style.bottom = "auto";
      launcher.style.left = `${bounds.minLeft + position.x * (bounds.maxLeft - bounds.minLeft)}px`;
      launcher.style.top = `${bounds.minTop + position.y * (bounds.maxTop - bounds.minTop)}px`;
    }
    function persistLauncherPosition(launcher) {
      const bounds = launcherViewportBounds(launcher);
      const left = clamp(parseFloat(launcher.style.left) || bounds.minLeft, bounds.minLeft, bounds.maxLeft);
      const top = clamp(parseFloat(launcher.style.top) || bounds.minTop, bounds.minTop, bounds.maxTop);
      const width = bounds.maxLeft - bounds.minLeft;
      const height = bounds.maxTop - bounds.minTop;
      setSetting(SETTINGS.launcherPosition, {
        x: width ? (left - bounds.minLeft) / width : 0,
        y: height ? (top - bounds.minTop) / height : 0
      });
    }
    function attachLauncherDragging(launcher) {
      let drag = null;
      launcher.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        drag = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startLeft: parseFloat(launcher.style.left) || 0,
          startTop: parseFloat(launcher.style.top) || 0,
          moved: false
        };
        launcher.classList.add("dragging");
        launcher.setPointerCapture?.(event.pointerId);
        event.preventDefault();
      });
      launcher.addEventListener("pointermove", (event) => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        const deltaX = event.clientX - drag.startX;
        const deltaY = event.clientY - drag.startY;
        if (Math.hypot(deltaX, deltaY) > 5) drag.moved = true;
        const bounds = launcherViewportBounds(launcher);
        launcher.style.left = `${clamp(drag.startLeft + deltaX, bounds.minLeft, bounds.maxLeft)}px`;
        launcher.style.top = `${clamp(drag.startTop + deltaY, bounds.minTop, bounds.maxTop)}px`;
      });
      const finishDrag = (event) => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        if (drag.moved) {
          persistLauncherPosition(launcher);
          ignoreLauncherClickUntil = performance.now() + 600;
        }
        drag = null;
        launcher.classList.remove("dragging");
        launcher.releasePointerCapture?.(event.pointerId);
      };
      launcher.addEventListener("pointerup", finishDrag);
      launcher.addEventListener("pointercancel", finishDrag);
    }
    function removeLauncher() {
      detachLauncherViewport?.();
      detachLauncherViewport = null;
      document.getElementById(ids.launcher)?.remove();
    }
    function installLauncher() {
      if (getSetting(SETTINGS.launcherHidden, false)) return;
      if (document.getElementById(ids.launcher)) return;
      addStyles2(ids);
      const launcher = document.createElement("button");
      launcher.id = ids.launcher;
      launcher.type = "button";
      launcher.textContent = "Poci\u0165\xE1tko";
      launcher.title = `Vybrat zdroj a zkontrolovat kolo; tla\u010D\xEDtko lze p\u0159et\xE1hnout (v${version})`;
      launcher.addEventListener("click", (event) => {
        if (performance.now() < ignoreLauncherClickUntil) {
          event.preventDefault();
          return;
        }
        openOverlay();
      });
      document.body.appendChild(launcher);
      placeLauncher(launcher);
      attachLauncherDragging(launcher);
      const sync = () => placeLauncher(launcher);
      window.addEventListener("resize", sync);
      window.visualViewport?.addEventListener("resize", sync);
      window.visualViewport?.addEventListener("scroll", sync);
      detachLauncherViewport = () => {
        window.removeEventListener("resize", sync);
        window.visualViewport?.removeEventListener("resize", sync);
        window.visualViewport?.removeEventListener("scroll", sync);
      };
    }
    if (typeof GM_registerMenuCommand === "function") {
      GM_registerMenuCommand("Skr\xFDt tla\u010D\xEDtko Poci\u0165\xE1tko", () => {
        setSetting(SETTINGS.launcherHidden, true);
        removeLauncher();
      });
      GM_registerMenuCommand("Zobrazit tla\u010D\xEDtko Poci\u0165\xE1tko", () => {
        setSetting(SETTINGS.launcherHidden, false);
        installLauncher();
      });
      GM_registerMenuCommand("Resetovat polohu a zobrazit Poci\u0165\xE1tko", () => {
        deleteSetting(SETTINGS.launcherPosition);
        setSetting(SETTINGS.launcherHidden, false);
        removeLauncher();
        installLauncher();
      });
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", installLauncher, { once: true });
    } else {
      installLauncher();
    }
  }

  // src/core/okoun.js
  var textOf = (node) => (node?.innerText || node?.textContent || "").replace(/\s+/g, " ").trim();
  function postIdFrom(value) {
    const match = String(value || "").match(/(?:article-|contextId=)(\d+)/i) || String(value || "").match(/\b(\d{6,})\b/);
    return match ? Number(match[1]) : null;
  }
  function absoluteUrl(value, base = location.href) {
    try {
      return new URL(value, base).href;
    } catch {
      return "";
    }
  }
  function safeBoardUrl(value, plugin) {
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
  function parseDocument(doc, pageUrl, plugin) {
    return Array.from(doc.querySelectorAll("div.item[id^='article-']")).map((item) => {
      const content = item.querySelector(".content") || item;
      const parentLink = item.querySelector(".actions a.prev");
      const permalink = item.querySelector(".meta a.date.link");
      const id = postIdFrom(item.id);
      const author = textOf(item.querySelector(".meta .user")) || "nezn\xE1m\xFD u\u017Eivatel";
      const imageUrls = Array.from(content.querySelectorAll("img")).map((image) => safeImageUrl(image.getAttribute("src") || image.src, pageUrl)).filter(Boolean);
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
        url: safeBoardUrl(absoluteUrl(permalink?.getAttribute("href"), pageUrl), plugin) || `${location.origin}${plugin.boardPath}#article-${id}`,
        pageUrl
      };
    }).filter((post) => post.id);
  }
  function olderUrlFrom(doc, pageUrl, plugin) {
    const href = doc.querySelector("li.older a, a.older")?.getAttribute("href");
    return safeBoardUrl(absoluteUrl(href, pageUrl), plugin);
  }

  // src/core/snapshots.js
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
      url: post.url
    };
  }
  function createRoundSnapshot({ schemaVersion, plugin, round, ranked, selectedWinner, state }) {
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
          included: !state.excludedReactionIds.has(reaction.id)
        }))
      })),
      unassignedPostIds: round.unassigned.map((post) => post.id),
      result: {
        suggestedWinnerPostId: suggestedWinner?.id || null,
        selectedWinnerPostId: selectedWinner?.id || null,
        selection: state.manualWinnerId ? "manual" : "suggested"
      }
    };
  }

  // src/ui/overlay.js
  function createOverlay({ plugin, ids, version, schemaVersion, addStyles: addStyles2 }) {
    const state = {
      posts: [],
      sourceId: null,
      endId: null,
      endManuallyChanged: false,
      manualWinnerId: null,
      excludedReactionIds: /* @__PURE__ */ new Set(),
      olderUrl: "",
      loadedUrls: /* @__PURE__ */ new Set(),
      loading: false,
      error: "",
      detachViewport: null,
      roundSnapshot: null
    };
    function mergePosts(posts) {
      const byId = new Map(state.posts.map((post) => [post.id, post]));
      for (const post of posts) byId.set(post.id, post);
      state.posts = Array.from(byId.values()).sort((a, b) => b.id - a.id);
    }
    function scanCurrentDocument() {
      const pageUrl = location.href;
      mergePosts(parseDocument(document, pageUrl, plugin));
      state.loadedUrls.add(pageUrl.split("#")[0]);
      state.olderUrl = olderUrlFrom(document, pageUrl, plugin);
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
        mergePosts(parseDocument(doc, requestedUrl, plugin));
        state.loadedUrls.add(requestedUrl);
        state.olderUrl = olderUrlFrom(doc, requestedUrl, plugin);
        if (state.sourceId && !state.endManuallyChanged) {
          state.endId = suggestedEndId(state.sourceId);
        }
      } catch (error) {
        state.error = `Star\u0161\xED str\xE1nku se nepoda\u0159ilo na\u010D\xEDst: ${error.message}`;
      } finally {
        state.loading = false;
        renderSourceChooser();
      }
    }
    const imagePosts = () => plugin.sourcePosts(state.posts);
    const winnerAnnouncementsAfter = (sourceId) => plugin.roundEndsAfter(state.posts, sourceId);
    const suggestedEndId = (sourceId) => plugin.suggestedEndId(state.posts, sourceId);
    const buildRound = (sourceId = state.sourceId) => plugin.buildRound({ posts: state.posts, sourceId, endId: state.endId });
    const rankedCandidates = (round) => plugin.rankCandidates(round, { excludedReactionIds: state.excludedReactionIds });
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
    function makePostLink(post, label = "P\u016Fvodn\xED p\u0159\xEDsp\u011Bvek") {
      const link = document.createElement("a");
      link.href = safeBoardUrl(post.url, plugin);
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = label;
      return link;
    }
    function overlayParts() {
      const overlay = document.getElementById(ids.overlay);
      return {
        overlay,
        header: overlay?.querySelector("[data-pocitatko-header]"),
        body: overlay?.querySelector("[data-pocitatko-body]")
      };
    }
    function closeOverlay() {
      state.detachViewport?.();
      state.detachViewport = null;
      document.getElementById(ids.overlay)?.remove();
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
      title.textContent = `Poci\u0165\xE1tko \xB7 ${plugin.name} \xB7 v${version}`;
      const meta = document.createElement("span");
      meta.textContent = status;
      header.append(title, meta, ...buttons);
    }
    function selectSource(postId) {
      state.sourceId = postId;
      state.endId = suggestedEndId(postId);
      state.endManuallyChanged = false;
      state.manualWinnerId = null;
      state.excludedReactionIds = /* @__PURE__ */ new Set();
      state.roundSnapshot = null;
      renderSourceChooser();
    }
    function makeEndSelector(source) {
      const wrapper = document.createElement("label");
      wrapper.dataset.pocitatkoBoundary = "";
      const label = document.createElement("strong");
      label.textContent = "2. Potvr\u010F konec kola";
      const select = document.createElement("select");
      const current = document.createElement("option");
      current.value = "";
      current.textContent = "Aktu\xE1ln\xED stav \u2014 bez koncov\xE9ho ozn\xE1men\xED";
      select.append(current);
      winnerAnnouncementsAfter(source.id).forEach((announcement, index) => {
        const option = document.createElement("option");
        option.value = String(announcement.id);
        option.textContent = `${index === 0 ? "N\xE1vrh: " : ""}${announcement.timestamp} \u2014 ${announcement.text}`;
        select.append(option);
      });
      select.value = state.endId ? String(state.endId) : "";
      select.addEventListener("change", () => {
        state.endId = Number(select.value) || null;
        state.endManuallyChanged = true;
        state.manualWinnerId = null;
        renderSourceChooser();
      });
      wrapper.append(label, select);
      return wrapper;
    }
    function renderSourceChooser() {
      const { body, overlay } = overlayParts();
      if (!body || !overlay) return;
      const images = imagePosts();
      setHeader(
        `${state.posts.length} p\u0159\xEDsp\u011Bvk\u016F \xB7 ${images.length} obr\xE1zk\u016F \xB7 ${state.loadedUrls.size} str.`,
        [
          makeButton(
            state.loading ? "Na\u010D\xEDt\xE1m\u2026" : state.olderUrl ? "Na\u010D\xEDst star\u0161\xED str\xE1nku" : "Bez dal\u0161\xEDch str\xE1nek",
            loadOneOlderPage
          ),
          makeButton("Zav\u0159\xEDt", closeOverlay)
        ]
      );
      headerButtonDisabled(state.loading || !state.olderUrl);
      body.replaceChildren();
      const intro = document.createElement("div");
      intro.dataset.pocitatkoIntro = "";
      const heading = document.createElement("strong");
      heading.textContent = "1. Vyber p\u016Fvodn\xED obr\xE1zek kola";
      const explanation = document.createElement("p");
      explanation.textContent = plugin.sourceExplanation;
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
        card.append(makeImage(post.imageUrls[0], `Obr\xE1zek od ${post.author}`));
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
        confirm.append(makeImage(selected.imageUrls[0], "Vybran\xFD zdrojov\xFD obr\xE1zek"));
        const summary = document.createElement("div");
        const label = document.createElement("strong");
        label.textContent = `Za\u010D\xE1tek: ${selected.author}`;
        const counts = document.createElement("div");
        counts.textContent = `${selected.timestamp} \xB7 nalezeno ${round.candidates.length} sout\u011B\u017En\xEDch obr\xE1zk\u016F`;
        summary.append(label, counts);
        confirm.append(
          summary,
          makeEndSelector(selected),
          makeButton("Potvrdit a spo\u010D\xEDtat", renderRound, "primary")
        );
        body.append(confirm);
      }
      body.scrollTop = 0;
    }
    function headerButtonDisabled(disabled) {
      const { header } = overlayParts();
      const button = header?.querySelector("button");
      if (button) button.disabled = disabled;
    }
    function renderRound(options = {}) {
      const { body, overlay } = overlayParts();
      if (!body || !overlay) return;
      const round = buildRound();
      if (!round.source) {
        renderSourceChooser();
        return;
      }
      const ranked = rankedCandidates(round);
      const suggestedWinner = ranked[0]?.candidate || null;
      const selectedWinner = round.candidates.find((candidate) => candidate.id === state.manualWinnerId) || suggestedWinner;
      state.roundSnapshot = createRoundSnapshot({
        schemaVersion,
        plugin,
        round,
        ranked,
        selectedWinner,
        state
      });
      const includedReactionCount = ranked.reduce((sum, entry) => sum + entry.stats.reactionPosts, 0);
      const excludedReactionCount = ranked.reduce((sum, entry) => sum + entry.stats.excludedPosts, 0);
      const buttons = [
        makeButton("Zm\u011Bnit hranice", renderSourceChooser),
        ...state.manualWinnerId ? [makeButton("Pou\u017E\xEDt n\xE1vrh", () => {
          state.manualWinnerId = null;
          renderRound();
        })] : [],
        makeButton(
          "Kop\xEDrovat v\xFDsledek",
          () => selectedWinner && copyText(plugin.formatResult(selectedWinner)),
          "primary"
        ),
        makeButton("Zav\u0159\xEDt", closeOverlay)
      ];
      buttons[buttons.length - 2].disabled = !selectedWinner;
      setHeader(
        `${round.candidates.length} sout\u011B\u017E\xEDc\xEDch \xB7 ${includedReactionCount} hlas\u016F${excludedReactionCount ? ` \xB7 ${excludedReactionCount} vy\u0159azeno` : ""}`,
        buttons
      );
      body.replaceChildren();
      const layout = document.createElement("div");
      layout.dataset.pocitatkoRound = "";
      const prompt = document.createElement("section");
      prompt.dataset.pocitatkoPrompt = "";
      const promptTitle = document.createElement("h3");
      promptTitle.textContent = "Potvrzen\xFD zdroj";
      prompt.append(promptTitle, makeImage(round.source.imageUrls[0], "Zdrojov\xFD obr\xE1zek"));
      const promptMeta = document.createElement("p");
      promptMeta.textContent = `${round.source.author} \xB7 ${round.source.timestamp}`;
      prompt.append(promptMeta, makePostLink(round.source));
      const endMeta = document.createElement("p");
      endMeta.dataset.pocitatkoMuted = "";
      endMeta.textContent = round.end ? `Konec ${state.endManuallyChanged ? "(ru\u010Dn\u011B)" : "(n\xE1vrh)"}: ${round.end.timestamp} \u2014 ${round.end.text}` : "Konec: aktu\xE1ln\xED stav bez v\xEDt\u011Bzn\xE9ho ozn\xE1men\xED";
      prompt.append(endMeta);
      if (round.unassigned.length) {
        const warning = document.createElement("p");
        warning.dataset.pocitatkoMuted = "";
        warning.textContent = `${round.unassigned.length} odpov\u011Bd\xED m\xED\u0159\xED na p\u0159\xEDsp\u011Bvky mimo na\u010Dten\xFD v\xFDb\u011Br; nejsou potichu zapo\u010D\xEDtan\xE9.`;
        prompt.append(warning);
      }
      const candidates = document.createElement("section");
      candidates.dataset.pocitatkoCandidates = "";
      const title = document.createElement("h3");
      title.textContent = ranked.length ? `Sout\u011B\u017En\xED obr\xE1zky (${ranked.length})` : "Zat\xEDm nebyly nalezeny pozd\u011Bj\u0161\xED sout\u011B\u017En\xED obr\xE1zky";
      candidates.append(title);
      ranked.forEach(({ candidate, stats }, index) => {
        const card = document.createElement("article");
        card.dataset.pocitatkoCandidate = "";
        card.dataset.postId = String(candidate.id);
        if (index === 0) card.classList.add("suggested");
        if (candidate.id === selectedWinner?.id) card.classList.add("winner");
        const header = document.createElement("header");
        const author = document.createElement("strong");
        author.textContent = candidate.author;
        const time = document.createElement("small");
        time.textContent = candidate.timestamp;
        header.append(author, time);
        card.append(header);
        candidate.imageUrls.forEach(
          (src) => card.append(makeImage(src, `Sout\u011B\u017En\xED obr\xE1zek od ${candidate.author}`))
        );
        if (candidate.text) {
          const caption = document.createElement("p");
          caption.textContent = candidate.text;
          card.append(caption);
        }
        const score = document.createElement("div");
        score.dataset.pocitatkoScore = "";
        [
          `${stats.points} hlas\u016F`,
          `${stats.uniqueReactors} lid\xED`,
          `${stats.reactionPosts} reakc\xED`,
          stats.excludedPosts ? `${stats.excludedPosts} vy\u0159azeno` : "",
          index === 0 ? "n\xE1vrh Poci\u0165\xE1tka" : ""
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
            candidate.id === selectedWinner?.id ? state.manualWinnerId ? "Ru\u010Dn\xED v\xEDt\u011Bz" : "Navr\u017Een\xFD v\xEDt\u011Bz" : "Vybrat ru\u010Dn\u011B",
            () => {
              state.manualWinnerId = candidate.id;
              renderRound();
            },
            candidate.id === selectedWinner?.id ? "primary" : ""
          ),
          document.createTextNode(" "),
          makePostLink(candidate)
        );
        card.append(controls);
        const details = document.createElement("details");
        details.open = true;
        const summary = document.createElement("summary");
        summary.textContent = `V\u0161echny reakce (${candidate.reactions.length})`;
        const list = document.createElement("ul");
        list.dataset.pocitatkoReactions = "";
        candidate.reactions.forEach((reaction) => {
          const item = document.createElement("li");
          const excluded = state.excludedReactionIds.has(reaction.id);
          if (excluded) item.classList.add("excluded");
          const text = document.createElement("span");
          const who = document.createElement("strong");
          who.textContent = `${reaction.author}: `;
          text.append(who, document.createTextNode(reaction.text || "(bez textu)"));
          const toggle = makeButton(excluded ? "Vr\xE1tit hlas" : "Nezapo\u010D\xEDtat", () => {
            const scrollTop = body.scrollTop;
            if (excluded) state.excludedReactionIds.delete(reaction.id);
            else state.excludedReactionIds.add(reaction.id);
            renderRound({ scrollTop });
          });
          item.append(text, toggle);
          list.append(item);
        });
        details.append(summary, list);
        card.append(details);
        candidates.append(card);
      });
      layout.append(prompt, candidates);
      body.append(layout);
      body.scrollTop = options.scrollTop || 0;
    }
    function copyText(value) {
      if (typeof GM_setClipboard === "function") GM_setClipboard(value, "text");
      else navigator.clipboard?.writeText(value);
    }
    async function openOverlay() {
      closeOverlay();
      addStyles2(ids);
      Object.assign(state, {
        posts: [],
        sourceId: null,
        endId: null,
        endManuallyChanged: false,
        manualWinnerId: null,
        excludedReactionIds: /* @__PURE__ */ new Set(),
        olderUrl: "",
        loadedUrls: /* @__PURE__ */ new Set(),
        error: "",
        roundSnapshot: null
      });
      const overlay = document.createElement("div");
      overlay.id = ids.overlay;
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
    return { openOverlay, closeOverlay };
  }

  // src/ui/styles.js
  function addStyles(ids) {
    if (document.getElementById(ids.style)) return;
    const style = document.createElement("style");
    style.id = ids.style;
    style.textContent = `
    #${ids.launcher} { position: fixed; z-index: 2147483000; border: 0; border-radius: 999px; padding: 10px 15px; background: #26231f; color: #fff; box-shadow: 0 5px 20px #0004; cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; font: 700 14px system-ui, sans-serif; }
    #${ids.launcher}.dragging { cursor: grabbing; }
    #${ids.overlay} { box-sizing: border-box; position: fixed; z-index: 2147483001; inset: 2vh 2vw; display: flex; flex-direction: column; overflow: hidden; color: #28241e; background: #f5f1e8; border: 1px solid #9f9789; border-radius: 16px; box-shadow: 0 18px 70px #0008; font: 14px/1.45 system-ui, sans-serif; }
    #${ids.overlay} * { box-sizing: border-box; }
    #${ids.overlay} [data-pocitatko-header] { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 12px 14px; background: #fffdf8; border-bottom: 1px solid #d7d0c5; }
    #${ids.overlay} [data-pocitatko-header] h2 { margin: 0 auto 0 0; font-size: 18px; }
    #${ids.overlay} button { border: 1px solid #aaa093; border-radius: 8px; padding: 8px 11px; background: #fffdf8; color: inherit; cursor: pointer; font: inherit; }
    #${ids.overlay} button.primary { border-color: #725914; background: #f0c957; font-weight: 700; }
    #${ids.overlay} button:disabled { opacity: .55; cursor: wait; }
    #${ids.overlay} [data-pocitatko-body] { min-height: 0; flex: 1; overflow: auto; padding: 16px; }
    #${ids.overlay} [data-pocitatko-intro] { max-width: 900px; margin: 0 auto 14px; padding: 12px 14px; border-radius: 10px; background: #fffdf8; }
    #${ids.overlay} [data-pocitatko-error] { max-width: 900px; margin: 0 auto 14px; padding: 10px 12px; border-radius: 8px; background: #ffd9d3; color: #70251b; }
    #${ids.overlay} [data-pocitatko-grid] { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
    #${ids.overlay} [data-pocitatko-source-card] { display: flex; flex-direction: column; min-width: 0; padding: 9px; border: 2px solid transparent; border-radius: 12px; background: #fffdf8; cursor: pointer; }
    #${ids.overlay} [data-pocitatko-source-card].selected { border-color: #a87900; box-shadow: 0 0 0 3px #f0c95755; }
    #${ids.overlay} [data-pocitatko-source-card] img { width: 100%; aspect-ratio: 1/1; border-radius: 8px; object-fit: contain; background: #e8e2d8; }
    #${ids.overlay} [data-pocitatko-source-card] strong { margin-top: 7px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #${ids.overlay} [data-pocitatko-source-card] small { color: #6d665d; }
    #${ids.overlay} [data-pocitatko-confirm] { position: sticky; bottom: 0; display: grid; grid-template-columns: 92px 1fr auto; align-items: center; gap: 12px; max-width: 900px; margin: 16px auto 0; padding: 10px; border: 1px solid #bfa34f; border-radius: 12px; background: #fff8d9; box-shadow: 0 6px 24px #0003; }
    #${ids.overlay} [data-pocitatko-confirm] img { width: 92px; height: 72px; border-radius: 7px; object-fit: contain; background: #e8e2d8; }
    #${ids.overlay} [data-pocitatko-boundary] { grid-column: 2 / -1; display: grid; gap: 4px; }
    #${ids.overlay} [data-pocitatko-boundary] select { max-width: 100%; padding: 7px; border: 1px solid #aaa093; border-radius: 7px; background: #fffdf8; font: inherit; }
    #${ids.overlay} [data-pocitatko-round] { display: grid; grid-template-columns: minmax(220px, .6fr) minmax(340px, 1.4fr); min-height: 100%; }
    #${ids.overlay} [data-pocitatko-prompt] { position: sticky; top: 0; align-self: start; padding: 14px; }
    #${ids.overlay} [data-pocitatko-prompt] > img { display: block; max-width: 100%; max-height: 56vh; margin: 10px auto; border-radius: 9px; object-fit: contain; background: #e8e2d8; }
    #${ids.overlay} [data-pocitatko-candidates] { padding: 14px; border-left: 1px solid #d7d0c5; }
    #${ids.overlay} [data-pocitatko-candidate] { margin: 0 0 14px; padding: 12px; border: 2px solid transparent; border-radius: 12px; background: #fffdf8; }
    #${ids.overlay} [data-pocitatko-candidate].suggested { border-color: #d0a51d; }
    #${ids.overlay} [data-pocitatko-candidate].winner { border-color: #23804b; box-shadow: 0 0 0 3px #23804b22; }
    #${ids.overlay} [data-pocitatko-candidate] header { display: flex; align-items: baseline; flex-wrap: wrap; gap: 7px; }
    #${ids.overlay} [data-pocitatko-candidate] header small, #${ids.overlay} [data-pocitatko-muted] { color: #6d665d; }
    #${ids.overlay} [data-pocitatko-candidate] img { display: block; max-width: 100%; max-height: 520px; margin: 10px auto; border-radius: 8px; object-fit: contain; background: #e8e2d8; }
    #${ids.overlay} [data-pocitatko-score] { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
    #${ids.overlay} [data-pocitatko-chip] { padding: 3px 8px; border-radius: 999px; background: #eee8dc; font-size: 12px; }
    #${ids.overlay} details { margin-top: 8px; }
    #${ids.overlay} [data-pocitatko-reactions] { margin: 7px 0 0; padding-left: 21px; }
    #${ids.overlay} [data-pocitatko-reactions] li { display: grid; grid-template-columns: 1fr auto; align-items: start; gap: 8px; margin: 5px 0; }
    #${ids.overlay} [data-pocitatko-reactions] li.excluded { opacity: .55; text-decoration: line-through; }
    #${ids.overlay} [data-pocitatko-reactions] button { padding: 3px 7px; font-size: 12px; text-decoration: none; }
    #${ids.overlay} a { color: #755800; }
    @media (max-width: 900px) {
      #${ids.overlay} { inset: 0; border-radius: 0; }
      #${ids.overlay} [data-pocitatko-body] { padding: 10px; }
      #${ids.overlay} [data-pocitatko-grid] { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      #${ids.overlay} [data-pocitatko-confirm] { grid-template-columns: 72px 1fr; }
      #${ids.overlay} [data-pocitatko-confirm] img { width: 72px; height: 62px; }
      #${ids.overlay} [data-pocitatko-boundary] { grid-column: 1 / -1; }
      #${ids.overlay} [data-pocitatko-confirm] button { grid-column: 1 / -1; }
      #${ids.overlay} [data-pocitatko-round] { display: block; }
      #${ids.overlay} [data-pocitatko-prompt] { position: static; }
      #${ids.overlay} [data-pocitatko-prompt] > img { max-height: 34vh; }
      #${ids.overlay} [data-pocitatko-candidates] { padding: 10px 0; border: 0; }
      #${ids.overlay} [data-pocitatko-candidate] img { max-height: 42vh; }
    }
  `;
    document.head.appendChild(style);
  }

  // src/main.js
  var activePlugin = clubPlugins.find((plugin) => {
    try {
      return plugin.matchesBoardUrl(new URL(location.href));
    } catch {
      return false;
    }
  });
  if (activePlugin) {
    const { openOverlay } = createOverlay({
      plugin: activePlugin,
      ids: IDS,
      version: VERSION,
      schemaVersion: DATA_SCHEMA_VERSION,
      addStyles
    });
    installLauncherControls({ ids: IDS, version: VERSION, addStyles, openOverlay });
  }
})();
