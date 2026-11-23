---
name: voice-editorial-review
description: >
  Adjudicate a `voice-*` finding — read the flagged passage as a reader of
  THAT genre would and decide whether the register is wrong, the criterion is
  out of scope, or the block is a stated exception. The human/agent half of
  the voice QA axis; the mechanical half runs in `qa-checkers-voice.ts`.
allowed-tools: Read Edit Bash Grep Glob
graph-typologies:
  - voices
---

# Voice editorial review

## The axis you are adjudicating

Six criteria in `pipeline/qa-criteria-registry.ts` describe one house
voice:

| criterion | what it matches | severity |
|---|---|---|
| `voice-status-leak` | status markers and derivation-status speech in body prose | critical |
| `voice-scholarly-default` | second-person address, lecturer-cadence openers, paper-past-tense narration | major |
| `voice-author-notes-pollution` | status banners, PR/commit refs, agent names, ISO dates | major |
| `voice-emoji-content` | emoji as content outside tables | major |
| `voice-first-person-work` | first-person work tone — "we'll add", "let me", "needs more work" | major |
| `voice-editorializing` | "surprisingly", "it is worth noting that", "rather than merely …" | minor |

They are **heuristics over phrase lists**. A match is a question, not a
verdict; a reviewer entry on the same sidecar confirms or overrules it.

## The scoping question comes first, and it is usually the answer

Every criterion above was written for a **paper**: a scholarly artefact in
third person, where a status marker really is a leak of the work tracker into
the published text.

A criterion without `profiles` scoping also runs over documentation, whose
register addresses the reader: *"you need `bun`, `latexmk` and Lean"* is a
correct sentence in a prerequisites page and a `voice-scholarly-default`
match.

**Ask which is true before touching the prose:**

1. **The register is wrong for this genre.** Fix the passage.
2. **The criterion does not belong in this genre.** Add `profiles: ["paper"]`
   to it in the registry. One edit clears the finding for every document folio
   and records why.
3. **The criterion belongs and this block is an exception.** Record a reviewer
   entry on the sidecar saying why. It leads the criterion, so the block reads
   `pass` with the reasoning attached, and nothing is silently rewritten.

Many instances of one criterion across many guide pages is evidence about the
criterion's scope, not about the authors.

## What the criterion cannot know

The checkers match text. They do not know what the page is *about*. Typical
false positives:

- `voice-status-leak` on a page that is a deliberate inventory of gaps
  (`**Not yet implemented:**` is its subject, not a leak).
- `voice-status-leak` on prose about a work-plan lane: prose about a to-do
  store contains the words of a to-do store.
- `voice-emoji-content` inside a transcript of an agent session, quoted as
  data.

Each is a criterion reading a quotation as an assertion, and the reviewer
entry says so in those words.

## Adjudicating one finding

1. **Open the block, not just the evidence line.** The sidecar quotes one line;
   the register is a property of the passage around it.
2. **Name the genre.** Paper, guide, reference, transcript. That decides which
   of the three outcomes applies before you read another word.
3. **Record the outcome where the next reader will find it** — a prose edit, a
   registry edit with `profiles`, or a reviewer entry. A finding left open
   comes back on the next sweep.
4. **Re-run the sweep** — `bun run pipeline/qa-sweep.ts --root
   docs/source` — so the sidecar, the icon and the panel agree with what you
   decided.

## Where the open findings are

Tracked in the work plan, one item per criterion, each carrying its blocks with
file, line and the matched text:

```sh
beans list | grep "Voice axis"
```

The evidence itself lives in `<block>.qa.json` beside each block, and is
published per block on the docs site: the `QA` icon opens the criterion, and
the criterion opens the witness that ruled on it — which checker, at which
`script_hash`, and whether the verdict still matches the file on disk.

## Do not

- **Do not edit prose to silence a criterion you believe is out of scope.**
  That hides the scoping defect and costs the next folio the same argument.
- **Do not mass-apply one finding's resolution across its siblings** without
  reading them; one criterion can fire for different causes.
- **Do not treat `critical` as "fix first".** Severity ranks the criterion's
  authors' concern, not the confidence of this match.
- **Do not delete a finding from a sidecar.** The sweep rewrites its own
  entries; a hand-removed one comes back with no record that anyone looked.
