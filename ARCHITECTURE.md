# Pociťátko architecture

Pociťátko is distributed as one userscript, but its behavior is divided into
three boundaries:

```text
Okoun parser -> club plugin -> local review overlay
```

## Okoun core

The core parses Okoun posts and reply links, loads an older page only when the
reviewer asks for it, renders the review overlay, tracks manual exclusions and
winner overrides, and manages userscript settings. It should not contain
assumptions about a club's scoring or round workflow.

## Club plugin contract

Each entry exported from `src/plugins/` supplies:

- `id`, `name`, `boardPath`, and `matchesBoardUrl` for routing;
- `sourcePosts`, `isRoundEnd`, `roundEndsAfter`, and `suggestedEndId` for the
  club's workflow;
- `buildRound` for assigning normalized Okoun posts to entries and reactions;
- `scoreCandidate` and `rankCandidates` for the club's voting rules;
- `formatResult` and `sourceExplanation` for club-specific output and guidance.

The current `vymysli_vtipny_textik` plugin is the compatibility baseline. A
new plugin should be tested against recorded rounds from its own club before
its URL is added to the userscript metadata.

## Source and distribution

The project uses ES modules under `src/`. `src/main.js` selects a club plugin
and composes the core, overlay, styles, launcher, and settings modules. The
build script bundles them into the committed `pocitatko.user.js`; users install
only that generated file and never depend on runtime module downloads.

## Local-only boundary

Parsed posts, selected boundaries, exclusions and winner overrides exist only
in the overlay's in-memory state. Closing or reloading the page discards the
review. The only persistent userscript values are launcher preferences such as
visibility and safe screen position.

The bundle contains no network client beyond same-origin Okoun page loading.
It never posts to Okoun, signs into another service, uploads results, or runs a
background collector. The reviewer can copy formatted result text and decide
separately where to paste it.
