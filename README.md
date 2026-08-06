# Pociťátko

[Install Pociťátko](https://raw.githubusercontent.com/hanenashi/pocitatko/main/pocitatko.user.js) · Current version: **0.4.2**

Pociťátko is a read-only browser userscript concept for helping moderate
image-caption contests on Okoun.

## Why

Finding a winner by hand becomes difficult when a round has many captions,
short reactions, nested replies, and several pages of history. Counting only
`!` posts is fast, but it loses context and can mistake captions, jokes,
discussion, and votes for one another.

Pociťátko aims to make the evidence easy to inspect without taking the human
decision away from the moderator.

## Club plugins

Pociťátko has a shared Okoun core and separate rule plugins for individual
clubs. The core owns page loading, normalized posts, the review overlay,
manual corrections, settings, and safety. A plugin decides how its club finds
round boundaries and entries, counts points, selects a suggested winner, and
formats copied results.

The first plugin preserves the existing `vymysli_vtipny_textik` workflow. New
clubs can use different rules without adding club-specific guesses to the
shared core. Plugins are bundled into the same installable userscript for now.

Reviewed rounds are also normalized behind a versioned data boundary using a
stable club ID, source-post-based round ID, post IDs, entries, reactions,
tallies, exclusions, winner selection, author keys, and avatar URLs. This data
can be sent through an explicit opt-in Firestore save for historical results
and live club statistics without coupling the database to parsing rules.

Version 0.4.2 includes the first Firestore adapter. A moderator can sign in
with Google and explicitly save the currently reviewed round; opening or
counting a round never uploads anything automatically. Google sign-in uses a
full-page redirect on mobile browsers and a popup on desktop. See
[`FIREBASE.md`](FIREBASE.md) for authentication, admin allowlist, rules, and
collection setup.

## Development

The maintainable source lives in `src/`: shared parsing and snapshots under
`src/core/`, club behavior under `src/plugins/`, and browser UI under
`src/ui/`. The root `pocitatko.user.js` is a generated, committed bundle so the
direct install link remains simple and reliable.

```sh
npm install
cp .env.example .env # then fill in the Firebase Web configuration
npm run build
npm run check
```

`npm run check` fails when the published userscript no longer matches its
modules. Update `src/metadata.txt`, `src/constants.js`, `VERSION`, this README,
and `package.json` together when bumping a release.

## How

The userscript would:

- read the board's visible posts and reply relationships;
- load older board pages when the source image is no longer on the newest page;
- let the reviewer visually choose and confirm the round's original image;
- suggest a round end from the first later winner announcement and allow a
  manual end override;
- identify likely rounds, source images, captions, reactions, and announcements;
- display each round in a visual review overlay;
- show every candidate alongside its image, text, reactions, authors, and links
  back to the original posts;
- flag uncertain classifications instead of hiding them;
- suggest a winner using one included vote per reacting user; `!`, `!!`,
  `!!!!!`, and mixed punctuation such as `!@&$+` have equal weight;
- allow manual corrections, exclusions, tie handling, and winner selection;
- let the reviewer exclude and restore replies that are discussion rather than
  votes, recalculating the suggestion immediately;
- provide copyable result text without posting it automatically.

The floating Pociťátko button can be dragged with a mouse or finger. Its
position is remembered and kept inside the visible browser area. The
userscript manager's settings menu can hide it, show it again, or reset a
troublesome saved position and restore the button to its safe default.

The tool should remain strictly read-only. It must not post, edit, delete, or
vote on behalf of anyone.

## Design direction

The central idea is to model the board as a reply graph:

```text
source image -> caption candidates -> reactions and discussion -> review result
```

Punctuation and reaction counts are useful clues, but not the whole decision.
Every suggestion should show its supporting evidence and remain easy to
override.

## Project notes

See [battleplan.md](battleplan.md) for the detailed product, parsing, overlay,
scoring, safety, and testing plan.

## Versioning

The userscript version is recorded in both [`VERSION`](VERSION) and the
userscript metadata. Every coding update should bump the patch version, update
the README version, commit the change, and push it so the install link always
points at the latest published script.
