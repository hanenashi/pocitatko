import { olderUrlFrom, parseDocument, safeBoardUrl } from "../core/okoun.js";
import { createRoundSnapshot } from "../core/snapshots.js";

export function createOverlay({ plugin, ids, version, schemaVersion, addStyles, database }) {
  const state = {
    posts: [],
    sourceId: null,
    endId: null,
    endManuallyChanged: false,
    manualWinnerId: null,
    excludedReactionIds: new Set(),
    olderUrl: "",
    loadedUrls: new Set(),
    loading: false,
    error: "",
    detachViewport: null,
    roundSnapshot: null,
    databaseBusy: false,
    databaseMessage: "",
    view: "closed",
  };

  database?.subscribe(() => {
    if (document.getElementById(ids.overlay) && state.view === "round" && !state.databaseBusy) {
      const body = overlayParts().body;
      renderRound({ scrollTop: body?.scrollTop || 0 });
    }
  });

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
      state.error = `Starší stránku se nepodařilo načíst: ${error.message}`;
    } finally {
      state.loading = false;
      renderSourceChooser();
    }
  }

  const imagePosts = () => plugin.sourcePosts(state.posts);
  const winnerAnnouncementsAfter = (sourceId) => plugin.roundEndsAfter(state.posts, sourceId);
  const suggestedEndId = (sourceId) => plugin.suggestedEndId(state.posts, sourceId);
  const buildRound = (sourceId = state.sourceId) =>
    plugin.buildRound({ posts: state.posts, sourceId, endId: state.endId });
  const rankedCandidates = (round) =>
    plugin.rankCandidates(round, { excludedReactionIds: state.excludedReactionIds });

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
      body: overlay?.querySelector("[data-pocitatko-body]"),
    };
  }

  function closeOverlay() {
    state.detachViewport?.();
    state.detachViewport = null;
    state.view = "closed";
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
    title.textContent = `Pociťátko · ${plugin.name} · v${version}`;
    const meta = document.createElement("span");
    meta.textContent = status;
    header.append(title, meta, ...buttons);
  }

  function selectSource(postId) {
    state.sourceId = postId;
    state.endId = suggestedEndId(postId);
    state.endManuallyChanged = false;
    state.manualWinnerId = null;
    state.excludedReactionIds = new Set();
    state.roundSnapshot = null;
    renderSourceChooser();
  }

  function makeEndSelector(source) {
    const wrapper = document.createElement("label");
    wrapper.dataset.pocitatkoBoundary = "";
    const label = document.createElement("strong");
    label.textContent = "2. Potvrď konec kola";
    const select = document.createElement("select");
    const current = document.createElement("option");
    current.value = "";
    current.textContent = "Aktuální stav — bez koncového oznámení";
    select.append(current);
    winnerAnnouncementsAfter(source.id).forEach((announcement, index) => {
      const option = document.createElement("option");
      option.value = String(announcement.id);
      option.textContent = `${index === 0 ? "Návrh: " : ""}${announcement.timestamp} — ${announcement.text}`;
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
    state.view = "chooser";
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
      confirm.append(
        summary,
        makeEndSelector(selected),
        makeButton("Potvrdit a spočítat", renderRound, "primary"),
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

  function databaseErrorMessage(error) {
    if (error?.code === "auth/unauthorized-domain") {
      return "DB: doména www.okoun.cz není povolená ve Firebase Authentication";
    }
    if (error?.code === "auth/popup-closed-by-user") return "DB: přihlášení zrušeno";
    if (error?.code === "auth/operation-not-allowed") {
      return "DB: anonymní přihlášení ještě není povolené ve Firebase Authentication";
    }
    if (error?.code === "auth/credential-already-in-use") {
      return "DB: tento Google účet už patří jinému Firebase UID";
    }
    if (error?.code === "auth/link-requires-anonymous") {
      return "DB: anonymní UID už není aktivní — přihlaste se přes Google";
    }
    if (error?.code === "permission-denied") {
      return "DB: zápis odmítnut — UID ještě není v kolekci admins nebo nejsou nasazená pravidla";
    }
    return `DB: ${error?.message || "neznámá chyba"}`;
  }

  function databaseUserMessage(user) {
    if (!user) return "DB: nepřihlášeno — nic se neodesílá";
    if (user.isAnonymous) return `DB: UID tohoto prohlížeče ${user.uid}`;
    return `DB: přihlášeno ${user.email || user.displayName} · UID ${user.uid}`;
  }

  async function signInDatabase(method) {
    state.databaseBusy = true;
    state.databaseMessage = "DB: přihlašování…";
    const request = method === "anonymous"
      ? database.signInAnonymously()
      : database.signInWithGoogle();
    renderRound();
    try {
      const user = await request;
      state.databaseMessage = user
        ? databaseUserMessage(user)
        : "DB: pokračujte přihlášením na stránce Google…";
    } catch (error) {
      state.databaseMessage = databaseErrorMessage(error);
    } finally {
      state.databaseBusy = false;
      renderRound();
    }
  }

  async function signOutDatabase() {
    state.databaseBusy = true;
    try {
      await database.signOut();
      state.databaseMessage = "DB: odhlášeno";
    } catch (error) {
      state.databaseMessage = databaseErrorMessage(error);
    } finally {
      state.databaseBusy = false;
      renderRound();
    }
  }

  async function makeDatabasePermanent() {
    state.databaseBusy = true;
    state.databaseMessage = "DB: propojuji UID s Google…";
    renderRound();
    try {
      await database.makePermanentWithGoogle();
      state.databaseMessage = "DB: pokračujte propojením na stránce Google…";
    } catch (error) {
      state.databaseMessage = databaseErrorMessage(error);
    } finally {
      state.databaseBusy = false;
      renderRound();
    }
  }

  async function saveRoundToDatabase() {
    const snapshot = state.roundSnapshot;
    if (!snapshot) return;
    state.databaseBusy = true;
    state.databaseMessage = "DB: ukládání…";
    renderRound();
    try {
      const result = await database.saveRound(snapshot, plugin.name);
      state.databaseMessage = `DB: uloženo ${result.path}`;
    } catch (error) {
      state.databaseMessage = databaseErrorMessage(error);
    } finally {
      state.databaseBusy = false;
      renderRound();
    }
  }

  function renderRound(options = {}) {
    const { body, overlay } = overlayParts();
    if (!body || !overlay) return;
    const round = buildRound();
    if (!round.source) {
      renderSourceChooser();
      return;
    }
    state.view = "round";
    const ranked = rankedCandidates(round);
    const suggestedWinner = ranked[0]?.candidate || null;
    const selectedWinner =
      round.candidates.find((candidate) => candidate.id === state.manualWinnerId) ||
      suggestedWinner;
    state.roundSnapshot = createRoundSnapshot({
      schemaVersion,
      plugin,
      round,
      ranked,
      selectedWinner,
      state,
    });
    const includedReactionCount = ranked.reduce((sum, entry) => sum + entry.stats.reactionPosts, 0);
    const excludedReactionCount = ranked.reduce((sum, entry) => sum + entry.stats.excludedPosts, 0);

    const copyButton = makeButton(
      "Kopírovat výsledek",
      () => selectedWinner && copyText(plugin.formatResult(selectedWinner)),
      "primary",
    );
    copyButton.disabled = !selectedWinner;
    const user = database?.currentUser();
    const databaseButtons = !database
      ? []
      : user
        ? [
            makeButton(state.databaseBusy ? "DB pracuje…" : "Uložit do DB", saveRoundToDatabase),
            makeButton("Kopírovat UID", () => copyText(user.uid)),
            ...(user.isAnonymous
              ? [makeButton("Zachovat UID přes Google", makeDatabasePermanent)]
              : []),
            makeButton(user.isAnonymous ? "Odhlásit (UID nepůjde obnovit)" : "Odhlásit DB", signOutDatabase),
          ]
        : [
            makeButton(
              state.databaseBusy ? "DB pracuje…" : "Přihlásit přes Google",
              () => signInDatabase("google"),
            ),
            makeButton(
              "Použít UID tohoto prohlížeče",
              () => signInDatabase("anonymous"),
            ),
          ];
    databaseButtons.forEach((button) => { button.disabled = state.databaseBusy; });
    const buttons = [
      makeButton("Změnit hranice", renderSourceChooser),
      ...(state.manualWinnerId
        ? [makeButton("Použít návrh", () => { state.manualWinnerId = null; renderRound(); })]
        : []),
      ...databaseButtons,
      copyButton,
      makeButton("Zavřít", closeOverlay),
    ];
    setHeader(
      `${round.candidates.length} soutěžících · ${includedReactionCount} hlasů${excludedReactionCount ? ` · ${excludedReactionCount} vyřazeno` : ""}`,
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
    const endMeta = document.createElement("p");
    endMeta.dataset.pocitatkoMuted = "";
    endMeta.textContent = round.end
      ? `Konec ${state.endManuallyChanged ? "(ručně)" : "(návrh)"}: ${round.end.timestamp} — ${round.end.text}`
      : "Konec: aktuální stav bez vítězného oznámení";
    prompt.append(endMeta);
    if (database) {
      const databaseStatus = document.createElement("p");
      databaseStatus.dataset.pocitatkoMuted = "";
      databaseStatus.textContent = state.databaseMessage || (database.authError?.()
        ? databaseErrorMessage(database.authError())
        : databaseUserMessage(user));
      prompt.append(databaseStatus);
    }
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
      if (candidate.id === selectedWinner?.id) card.classList.add("winner");
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
        `${stats.points} hlasů`,
        `${stats.uniqueReactors} lidí`,
        `${stats.reactionPosts} reakcí`,
        stats.excludedPosts ? `${stats.excludedPosts} vyřazeno` : "",
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
          candidate.id === selectedWinner?.id
            ? state.manualWinnerId ? "Ruční vítěz" : "Navržený vítěz"
            : "Vybrat ručně",
          () => { state.manualWinnerId = candidate.id; renderRound(); },
          candidate.id === selectedWinner?.id ? "primary" : "",
        ),
        document.createTextNode(" "),
        makePostLink(candidate),
      );
      card.append(controls);

      const details = document.createElement("details");
      details.open = true;
      const summary = document.createElement("summary");
      summary.textContent = `Všechny reakce (${candidate.reactions.length})`;
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
        const toggle = makeButton(excluded ? "Vrátit hlas" : "Nezapočítat", () => {
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
    addStyles(ids);
    Object.assign(state, {
      posts: [], sourceId: null, endId: null, endManuallyChanged: false,
      manualWinnerId: null, excludedReactionIds: new Set(), olderUrl: "",
      loadedUrls: new Set(), error: "", roundSnapshot: null,
      databaseMessage: "",
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
