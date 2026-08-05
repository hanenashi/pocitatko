# Pociťátko battle plan

## Mission

Build a browser userscript that helps Leknin moderate **vymysli vtipný textík**.
It should turn a long, messy board history into a reviewable set of rounds:

```text
source image -> caption competitors -> reactions/evidence -> suggested winner
```

The tool is decision support, not an automatic judge. It must make the evidence
easy to inspect, allow corrections when Okoun's reply structure is ambiguous,
and produce a result that can be copied into the board by hand.

It must never post, edit, delete, vote, or announce a winner automatically.

## What the first version should help with

1. Load the current board and older pages through normal Okoun navigation.
2. Identify likely rounds and their main/source image posts.
3. Show every candidate caption in a visual review overlay.
4. Attach reactions and discussion to the correct image or candidate.
5. Mark uncertain parsing instead of silently making a confident-looking guess.
6. Suggest a winner with visible reasons and confidence.
7. Let Leknin override any classification, exclude noise, resolve ties, and copy
   a Czech result announcement.

## Board rules the UI should keep visible

The board header currently says, in substance:

- Caption the supplied image; do not Photoshop or otherwise montage it.
- Text below the image is preferred. Bubbles are allowed only when they do not
  change the source image's identity.
- Do not create parallel lines or nest an image-caption post as a reply to
  another caption.
- A round lasts 48 hours.
- The community chooses a winner; the winner normally supplies the next image.
- If the winner has not supplied a prompt within 12 hours, the right passes to
  the group. After 24 hours without a prompt, use the oldest unused Theme Pool
  proposal.
- A prompt image must not be changed during its round.

These are review hints, not an attempt to replace human judgment. A card can
flag a possible rule issue, but it should never disqualify a user automatically.

## The key discovery: model the reply graph, not just punctuation

The tempting implementation is “count posts containing `!`.” That is too weak:

- `!`, `!!`, and emojis can be a caption, an endorsement, or a joke in context.
- One person can post several reactions.
- A reply may point to the image prompt, a candidate, or a side discussion.
- Winner announcements and handoff chatter are evidence about the round, not
  competitors.
- Images, Markdown, links, and empty-text posts need to remain inspectable.

Store a normalized post record while retaining the original DOM/HTML reference:

```js
{
  id, author, timestamp, pageUrl,
  parentId, parentAuthor, parentTimestamp,
  text, html, imageUrls,
  isImagePost, isLikelyPrompt, isLikelyCandidate,
  classification: "candidate" | "reaction" | "discussion" | "announcement" | "unknown",
  confidence,
  excluded: false,
  notes: ""
}
```

Use the visible “Reakce na … / Vlákno” relation and post IDs as the primary
edges. Text heuristics are secondary and must be explainable in the UI.

### Candidate and reaction heuristics

Start with several signals rather than one rule:

- A likely prompt is a root-level post with the round's main image and no
  parent, followed by replies.
- A likely caption is a reply in that prompt's branch whose body is not merely
  moderation chatter.
- A likely reaction is a short reply, emoji, exclamation sequence, explicit
  praise, or a reaction attached to a candidate rather than the prompt.
- `Vyhrál`, `Gratulace`, `zadává`, `zada`, `plén`, and similar language is an
  announcement/handoff signal, not a candidate.
- A post with an image may be a new prompt, a caption mock-up, or a nested
  image violation. Show it and let the reviewer decide.

The classifier should output reasons such as:

```text
candidate: direct reply to prompt; contains non-reaction text
reaction: short reply; parent is candidate; reaction marker detected
uncertain: image reply; could be prompt or altered caption
```

## Round detection

Represent a round as:

```js
{
  id,
  promptPostId,
  promptImageUrls,
  startedAt,
  endedAt,
  promptAuthor,
  candidates: [],
  announcements: [],
  unassignedPosts: [],
  parseWarnings: []
}
```

Prefer explicit structure in this order:

1. Root image post and its reply/thread links.
2. Explicit winner announcement and next prompt.
3. Board chronology and the 48-hour rule.
4. A manual round boundary selected in the overlay.

Never make “20 pages” a semantic assumption. Pages are only a retrieval window;
rounds may cross page boundaries.

## Overlay concept

Open the tool with a small `Pociťátko` button in the board header. The overlay
should be a resizable, dismissible review workspace rather than a separate
site.

### Round header

- Large source image with open-original and board-post links.
- Prompt author, timestamp, round age, and inferred end time.
- Current parser confidence and warning count.
- Buttons: `Previous round`, `Next round`, `Re-scan`, `Copy result`.

### Candidate cards

Each candidate gets a clear card containing:

- author and timestamp;
- the exact submitted text, rendered safely as Markdown/HTML;
- any submitted image or image URL, with a thumbnail and open-original link;
- a link/anchor that jumps to the original Okoun post;
- all attached reactions and discussion, grouped by author;
- counts for unique supporters, total reaction posts, and manually excluded replies;
- included/excluded/uncertain status;
- a manual winner toggle.

The source image should remain visible while candidates are compared. On wide
screens use a two-column layout (image/context plus candidate ledger); on a
phone use a sticky source-image strip and one candidate card at a time.

### Reaction ledger

Do not collapse evidence into a single number. Show:

```text
unique supporters | total reactions | excluded replies | discussion flags
```

Expand a ledger row to see the exact reaction text, author, time, target post,
and original board link. Duplicate posts from the same author remain visible;
the suggested score may cap or discount them, but the human can inspect them.

### Ambiguity controls

Every post should be movable with simple controls:

- `Set as prompt`
- `Set as candidate for…`
- `Set as reaction to…`
- `Mark discussion`
- `Exclude from tally`
- `Include despite heuristic`
- `Edit note`

Also provide a manual `Add reaction` action for a reaction the parser cannot
associate, and an `Unassign` bucket for anything suspicious. Changes should be
local overlay state only until explicitly exported/copied.

## Winner suggestion

The score should be deliberately conservative and transparent:

```text
score = unique included reacting users
```

Do not pretend the formula is objective. Display the factors and label the
result `suggested winner`, `close call`, or `insufficient evidence`.

Useful signals:

- each reacting user contributes at most one vote to a candidate;
- `!`, `!!`, `!!!!!`, and mixed punctuation such as `!@&$+` all carry the same
  one-vote weight;
- reaction text remains visible as evidence but does not change vote strength;
- self-reactions and obvious author chatter should be visibly flagged and
  optionally excluded;
- a tie or near-tie should result in “human decision needed,” not a forced rank.

The reviewer can lock a winner manually. Once locked, the copied result must
say it was manually selected rather than imply that the algorithm decided it.

## Copyable output

Offer a preview before copying. Include a few board-native templates, for
example:

```text
Vyhrál/a {author}, {handoff phrase}. Gratulace!
```

```text
Vyhrál/a {author}. Zadává {author} — gratulace!
```

For a declined or unresolved handoff:

```text
{author} se zadání vzdává, prosím plénum o další postup.
```

The result should include the selected caption's board link and a compact
private evidence note for Leknin, but copying the public announcement and the
moderator note should be separate buttons. Never include all raw board text in
the public clipboard by accident.

## Data and caching

- Cache parsed pages in memory first; add `localStorage` only for explicit
  reviewer decisions and a short-lived page cache.
- Key cached posts by board ID + post ID, not by array position.
- Keep raw post HTML only as long as needed for safe re-rendering; sanitize it
  before inserting into the overlay.
- Store manual overrides as a small exportable JSON object so a re-scan does not
  erase human work.
- Make a “data age / re-scan” indicator prominent because live rounds change.

## Delivery phases

### Phase 0 — fixtures and DOM reconnaissance

- Save redacted HTML fixtures for: prompt, caption, reaction, winner
  announcement, nested image, pagination, and a cross-page round.
- Confirm the exact selectors and parent-link format on current Okoun.
- Decide whether a candidate is normally a direct reply to the prompt or whether
  Okoun exposes a second-level reaction pattern in the live DOM.

### Phase 1 — parser and round graph

- Parse posts, IDs, authors, timestamps, text, images, and parent links.
- Build rounds across pagination.
- Emit classifications with reasons and confidence.
- Add fixture tests for malformed/missing fields.

### Phase 2 — read-only overlay

- Add the board-header launcher.
- Render source image, candidate cards, reaction ledger, warnings, and links.
- Make the overlay keyboard accessible and usable on a narrow viewport.

### Phase 3 — human controls and suggestions

- Add reclassification, exclusions, notes, manual winner lock, tie state, and
  transparent scoring.
- Add visual highlighting for unresolved posts and possible rule violations.

### Phase 4 — copy workflow and polish

- Add Czech announcement templates and separate clipboard actions.
- Add export/import of review decisions.
- Verify that re-scanning preserves decisions where post IDs still exist.
- Test against a real historical 20-page window without any write capability.

## Test cases that matter

- Two rounds share one pagination boundary.
- A prompt has no image because the image failed to load.
- A candidate contains only `!`, only an emoji, or only an image.
- One author posts several reactions.
- A reaction points to a candidate by ID but the visible author text is stale.
- A winner announcement appears before the final reaction.
- Winner declines and the plénum/Theme Pool rules take over.
- A board post is edited or deleted after the first scan.
- A nested image should be flagged, not silently counted as a new round.
- HTML/Markdown contains links or formatting that must render safely.
- The user closes/reloads the overlay halfway through manual review.

## Open questions for the first live experiment

1. In the live DOM, what exactly distinguishes a caption candidate from a
   reaction? Are the `!` posts replies to the prompt, replies to a candidate,
   or simply the board's informal voting convention?
2. Is the “main image” always the first image in a root post, or do some rounds
   use multiple source images?
3. Should explicit winner announcements by Leknin be treated as authoritative
   evidence, or only as a handoff marker after manual confirmation?
4. How much historical context is useful before the overlay becomes slow? Start
   with the current round plus a selectable 5/10/20-page window.
5. Should the tool show raw reaction-post count beside the authoritative
   unique-user vote count?

## Definition of done for v1

Leknin can open the current board, see the source image and every plausible
competitor in one place, inspect each reaction with its target and author,
correct mistakes, get a clearly labelled suggestion, manually choose a winner,
and copy a clean Czech announcement — without the userscript ever posting or
silently changing the board.
