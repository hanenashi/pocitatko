# Pociťátko handoff

## Current direction

Pociťátko `v0.7.3` is a local, read-only counting and visual-review tool for
classic Okoun competition rounds with experimental Kapybara support. It does
not retain reviewed rounds remotely, collect history in the background, or
contain account-management controls.

The previous experimental persistence-capable state is preserved only by the
Git tag `v0.5.7-db-capable`. Current development should stay on the local-only
line unless the project owner explicitly changes direction.

## Repository shape

- `src/core/okoun.js`: normalized classic Okoun/Kapybara post, reply, image,
  paging, and native-reaction parsing;
- `src/core/settings.js`: launcher visibility and safe-position preferences;
- `src/plugins/`: club-specific boundaries, entries, scoring and output;
- `src/ui/overlay.js`: source selection, visual evidence and overrides;
- `src/ui/launcher.js`: draggable/hideable launcher;
- `pocitatko.user.js`: generated installable bundle.

The first plugin supports `vymysli_vtipny_textik`. The shared core remains
ready for other clubs with independently defined rules.

## Preserved behaviour

- visual source-image confirmation;
- suggested and manually adjustable round end;
- candidate images, captions and direct reactions shown together;
- one included vote per reacting user regardless of repeated punctuation;
- round-wide Kapybara counting-mode choice: either deduplicated reply posts or
  aggregate native reactions, never both at once;
- visible native reaction breakdown with an explicit warning that Kapybara
  does not expose voter identities;
- optional inclusion of image replies as visibly marked competition entries;
- expandable evidence for replies whose targets are outside the selected entries;
- manual reaction exclusion/restoration and winner override;
- explicit tie warning with either one manual winner or preserved co-winners;
- compact two-column mobile header actions and candidate cards;
- copyable result text;
- same-origin loading of older pages on reviewer request;
- draggable launcher with hide/show/reset settings.

## Development

```sh
npm install
npm run build
npm run check
```

Keep `VERSION`, `package.json`, `src/constants.js`, `src/metadata.txt`, and the
README version synchronized. Commit the generated userscript with source
changes. Check `git status` first and preserve unrelated local files.
