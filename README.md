# Pociťátko

Pociťátko is a read-only browser userscript concept for helping moderate
image-caption contests on Okoun.

## Why

Finding a winner by hand becomes difficult when a round has many captions,
short reactions, nested replies, and several pages of history. Counting only
`!` posts is fast, but it loses context and can mistake captions, jokes,
discussion, and votes for one another.

Pociťátko aims to make the evidence easy to inspect without taking the human
decision away from the moderator.

## How

The userscript would:

- read the board's visible posts and reply relationships;
- identify likely rounds, source images, captions, reactions, and announcements;
- display each round in a visual review overlay;
- show every candidate alongside its image, text, reactions, authors, and links
  back to the original posts;
- flag uncertain classifications instead of hiding them;
- suggest a winner using transparent signals such as unique supporters and
  explicit endorsements;
- allow manual corrections, exclusions, tie handling, and winner selection;
- provide copyable result text without posting it automatically.

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
