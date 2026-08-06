# Pociťátko architecture

Pociťátko is distributed as one userscript, but its behavior is divided into
three boundaries:

```text
Okoun core -> club plugin -> normalized round snapshot -> future data adapter
```

## Okoun core

The core parses Okoun posts and reply links, loads board pages, renders the
review overlay, tracks manual exclusions and winner overrides, and manages
userscript settings. It should not contain assumptions about a club's scoring
or round workflow.

## Club plugin contract

Each entry in `CLUB_PLUGINS` supplies:

- `id`, `name`, `boardPath`, and `matchesBoardUrl` for routing;
- `sourcePosts`, `isRoundEnd`, `roundEndsAfter`, and `suggestedEndId` for the
  club's workflow;
- `buildRound` for assigning normalized Okoun posts to entries and reactions;
- `scoreCandidate` and `rankCandidates` for the club's voting rules;
- `formatResult` and `sourceExplanation` for club-specific output and guidance.

The current `vymysli_vtipny_textik` plugin is the compatibility baseline. A
new plugin should be tested against recorded rounds from its own club before
its URL is added to the userscript metadata.

## Normalized round snapshots

`createRoundSnapshot` converts the reviewed plugin result into schema version
1. Stable document identity is:

```text
clubId: plugin ID
roundId: {clubId}:{source Okoun post ID}
entry/reaction identity: Okoun post ID
user identity: normalized Okoun username (`authorKey`)
```

The snapshot includes source and end posts, ranked entries, reaction evidence,
manual exclusions, unassigned post IDs, and both suggested and selected
winners. Posts also retain their currently visible avatar URL for future live
badge rendering. The snapshot deliberately contains no Firestore code.

## Future Firestore adapter

Persistence should be opt-in and consume only normalized snapshots. The
adapter will own authentication, consent, retries, schema migration, and
Firestore paths. Parsing plugins must not import Firebase or write remotely.

Derived views—historical winners, guessed counts, hit rates, and avatar overlay
badges—should read normalized records or server-generated aggregates. Raw
review evidence should remain available so corrected classifications can be
recomputed instead of silently overwriting history.
