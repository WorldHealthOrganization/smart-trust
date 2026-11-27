---
# folio-assistant-tfo1
$schema: bean/1.0.0
title: 'INGESTION: a skill that takes 3 avatar/theme layouts, checks them, and says why it refused'
status: completed
type: feature
priority: normal
created_at: 2026-09-20T06:31:08Z
updated_at: 2026-10-07T17:30:00Z
parent: folio-assistant-o3xy
blocking:
    - folio-assistant-d3yq
---

## The ask, owner 2026-09-20 (verbatim)

> want stickys to be if all harnesses fired and that is their sticky to get to
> folio-assistnat. each has own avatar. make skills for avatar theme ingestion
> (need 3 meeting certain formatting constraints), return sucches or explnation
> of falire...

and, minutes later:

> avatar for testing, engineering, architecture
> https://github.com/litlfred/folio-assistant/commit/1b62b57773dafaeaa05f9c7247ac65db00af92d1

## Three things, and the third is the one worth building first

1. **The board records which harnesses FIRED.** A sticky per harness that ran
   during initiation, each linking onward to folio-assistant. That makes the
   landing page a *receipt* of initiation rather than a fixed set of cards —
   and it is the sharpened form of `bp4x`.
2. **Each harness has its own avatar.** Avatars are already per-kind
   (`schemas/avatars.ts`, 19 kinds incl. `bootstrap`, `cat-harness`,
   `folio-assist-core`), so this rides the existing mechanism.
3. **An ingestion skill for avatar/theme art**: takes 3 layouts, checks them
   against formatting constraints, and **returns success or an explanation of
   the failure**.

## Why (3) should be built first — it is the fix for a failure already paid for

This session hit exactly the problem it describes, twice:

- Commit `0301fbd2` put 3 PNGs at the **repository root**, undeclared, with
  spaces and commas in the filenames. No gate saw them: `check-declared-assets`
  walks declared->disk only, and the root is not an instance.
- Two of them were **1px wider** than the layout they matched, so declaring them
  under the existing role would have falsified `images[].width`.
- They were **PNG at ~1.6 MB** where the siblings are ~100 KB webp.
- An automated read then misidentified the subject and recommended overwriting
  three declared files; only opening the image caught it.
- Commit `1b62b57` repeats the pattern: 3 files at the root, and **two of them
  are byte-identical** — `sha256` `30dad51dfc691587...` for both
  `ChatGPT Image Sep 20, 2026, 08_26_47 AM.png` and
  `d1a26515-9bde-455d-84bc-2e5fc196b004.png`, both 1,606,269 bytes. So that
  commit supplies **2 distinct images for 3 named avatars**
  (testing, engineering, architecture). Whether the third is missing or the
  duplicate was an upload slip is a question for the owner, not a thing to
  guess.

Every one of those is a constraint the ingestion skill would have reported
instead of a person finding it. That is the argument for building it before the
next batch of art arrives.

## Constraints it should check (proposed — confirm before building)

Derived from what actually went wrong, not invented:

- **exactly three layouts**, `laptop` / `mobile` / `card` — `theme.ts` refuses a
  theme missing one, so fewer than three cannot be declared anyway
- **distinct content** — reject byte-identical files presented as different
  layouts (the `1b62b57` case)
- **orientation per layout** — laptop landscape, mobile portrait, card square;
  a portrait crop is not a landscape crop scaled down
- **dimensions recorded from the file**, never retyped (the 1px drift)
- **format and weight** — webp preferred, with the PNG-vs-webp 16x size gap
  reported rather than silently accepted
- **a destination inside a declared directory**, and a declaration written in
  the same step, so the art is never a file nothing names
- **returns success or a NAMED failure** — the ask's own words, and the same
  contract the repo already uses for `--check` gates and the kg-audit sidecars:
  a refusal that says "invalid" teaches nobody what to fix

## Relation to existing beans

- `bp4x` — per-initiator stickies. Item (1) here sharpens it: the set is the
  harnesses that *fired*.
- `7deg` — the librarian avatar + Dublin Core. Item (2) is the same mechanism.
- `ll11` — carries the "nothing checks for undeclared files on disk" gap, which
  is the passive half of what this skill does actively.
- `d3yq` — the testing/engineering theme, which was waiting on exactly this art.

## Done when

- [x] the duplicate-vs-missing question on `1b62b57` is answered — MISSING: the owner supplied the portrait crop 2026-09-24
- [ ] the constraint list is confirmed or corrected
- [ ] a skill (and a Tool, if it should be callable) ingests 3 layouts, declares
      them, and returns success or a named failure
- [ ] it refuses every failure above, each proved by a test that can fire
- [ ] avatars exist for testing, engineering and architecture
- [ ] the board reflects which harnesses fired, each with its avatar



_2026-09-20_ — SCOPING CORRECTION from the owner, verbatim: **"make as part of docuemtn ingestion skill...."**

So this is **not a new standalone skill**. It belongs to the existing document-ingestion process, which already exists here — `adapters/document/`, and the committed witnesses under `test/results/witnesses/document-ingestion/` (`extract-structure`, `derive-content`, `the-pipeline`, `the-l1-completeness-gate`).

That is the better home and it is worth saying why, because "ingestion" was about to be built twice. Document ingestion already answers the same question this bean poses — *something unstructured has arrived; is it acceptable, and if not, why not* — and it already has the shape of the answer: a pipeline with a completeness gate. An avatar/theme arriving as three PNGs is the same event with a different payload. A parallel "avatar ingestion" skill would be a second answer to one question, free to disagree with the first, which is the drift `AGENTS.md` opens by warning about.

CONSEQUENCE: the constraint list in this bean becomes a set of checks WITHIN document ingestion keyed on the payload being theme art, not a new process. The `return success or explanation of failure` contract should be whatever that pipeline's gate already returns, rather than a new result type.

STILL OPEN and unchanged by this: whether the third avatar in `1b62b57` is missing or the duplicate was an upload slip (two of the three files are byte-identical, sha256 `30dad51dfc691587`, both 1,606,269 bytes), and the constraint list itself.


_2026-09-20_ — **BUILT**, as a step in document ingestion rather than beside it.

| | where |
|---|---|
| the check | `schemas/theme-art-intake.ts` — pure, no I/O, no clock |
| the CLI face | `scripts/check-theme-art.ts`, `bun run cat check:theme-art` |
| the skill | `skills/folio-core/theme-art-intake.md` (registered; 101 skills) |

Against the `## Done when`:

- [x] **ingests 3 layouts, declares them, returns success or a NAMED failure** —
      every `ThemeArtFailure` carries a required `remedy`, and all failures are
      collected rather than thrown one at a time, because art arrives as a batch
      and three round trips to learn three things is not a report.
- [x] **refuses every failure above, each proved by a test that can fire** — 29
      tests. The refusals are `missing-layout`, `duplicate-layout`,
      `identical-content`, `unreadable`, `wrong-orientation` and
      `undeclared-destination`; weight and format are **warnings**, because
      heavy art renders correctly and refusing it would block work over a
      bandwidth judgement.
- [x] the duplicate-vs-missing question on `1b62b57` — answered 2026-09-24: the third crop was missing, and the owner supplied it
- [ ] the constraint list confirmed — **built from the incidents rather than
      waiting**, so this is now a correction rather than a blocker
- [ ] avatars for testing / engineering / architecture; the board reflecting
      which harnesses fired — not this change

## Dimensions are emitted, never accepted

The 1px drift (`landing-engineer` declared 1672×941 where its siblings are
1671×941) happens when a declaration is composed by copying a neighbour's
numbers. `measureImage` parses the PNG IHDR and all three WebP sub-formats
(`VP8 `, `VP8L`, `VP8X`) directly — no image dependency for a header parse —
and intake **emits** the declaration. The caller is never asked for a width and
therefore cannot supply a wrong one.

Checked against the files the site actually ships, not only against fixtures the
reader was written beside: every declared width and height matches its file's
own header. "Could not read" is reported separately from "matched", because
folding them lets an unreadable file read as clean.

## FINDINGS from running it over this instance

`bun run cat check:theme-art` — 5 backdrop roles, **1 refused**:

- **`landing-architecture` is missing its mobile crop.** Declared with laptop
  and card only, and both files on disk. `resolveThemeBackdrop` refuses an
  incomplete backdrop **wholesale**, so the theme would render with NO art
  rather than two thirds of it. No theme references the role yet, so nothing is
  visibly broken today — it is art that cannot be used. `landing-architecture-
  laptop.png` is **1,606,269 bytes**, which is the size the bean records for the
  byte-identical pair in `1b62b57`; so this is very likely the same incident,
  and whether the third crop is missing or the duplicate was an upload slip is
  still the owner's question.
- **Every PNG backdrop is heavy, and it is broader than `ll11` records.** Not
  just the engineer art: all twelve files across engineer, library, analyst and
  architecture run **1.5–2.3 MB** against the ~100 KB webp of the original
  `landing` set. 12 files, roughly 21 MB. Reported, not acted on.

## A constraint that was WRONG, and how it was caught

The first run refused **all five** roles for `undeclared-destination`, because
`docs/` is not a declared directory. It should not be: a declared entry names a
**graph**, and the site is the render **target**, resolved by `siteDirFor`. A
check that fires on every one of its subjects is a check that is wrong, not a
repository that is — so the allowed set is declared directories **plus the site
directory**, and the comment says why.

The constraint it came from stands: the incident was art at the REPOSITORY
ROOT, named by nothing at all.

## Why it is NOT yet a CI gate

`--check` exits 1 today, on `landing-architecture`. Adding the gate in the same
change as the check would make CI red over art that is **missing** rather than
over a regression somebody just introduced. The gate goes in when the art is
complete — and intake does not repair anybody's art on its own initiative, per
`deletion-requires-confirmation`.

_2026-09-20T11:15Z_ — **Note from `eq01`, not a change to this bean.** The
root-level uploads this bean cites as evidence were moved to
`cat-harness/uploads/` on the owner's instruction (*"move/leave root level
uplaods in uploads/"*). Eleven files, 17.2 MB, moved with `git mv` so history
follows. The paths above now read `cat-harness/uploads/<name>`.

The duplicate finding was independently confirmed in the process: `sha256
30dad51dfc691587…` for BOTH `ChatGPT Image Sep 20, 2026, 08_26_47 AM.png` and
`d1a26515-9bde-455d-84bc-2e5fc196b004.png`, matching what is recorded above.

Nothing else here is touched, and the status stays `todo` — the question of
whether the third avatar is missing or the duplicate was an upload slip is
still the owner's, and this bean is still the argument for the ingestion skill.

_2026-09-20_ — **MERGED** in [#481](https://github.com/litlfred/folio-assistant/pull/481)
(`5fe9b498`).

**Kept open on the two questions that were always the owner's**, both unchanged
by the merge: whether the third avatar in `1b62b57` is missing or the duplicate
was an upload slip, and the `landing-architecture` mobile crop that has never
been supplied. The second is the only thing standing between
`check:theme-art:check` and being a CI gate — the exemption in `gates.ts` names
it as the exact unblocking condition, so the gate arrives the moment the crop
does.


_2026-09-24_ — **The architecture set is COMPLETE, and the gate is in.** The owner
supplied the portrait crop (941×1672) and a matching new square (1254×1254),
which replaces the earlier square; that one stays in git history. So the answer to
this bean's standing question is *missing*, not *upload slip*.

- `landing-architecture-mobile` declared; every crop carries a `textRegion`, and
  the card's `avatarRegion` was re-measured. All were chosen by rendering boxes
  over the art and looking.
- The `architecture` theme now has its backdrop, with the scrim measured earlier
  (9.02:1 on pure black).
- `check:theme-art:check` is wired into CI (`@covers themes`); its `gates.ts`
  exemption is gone, as it said it would be.
- `check-image-roles`' `PERMITTED_ORPHANS` is empty — its one permit was this
  role. `failing`/`stalePermits` take the list as a parameter so their tests
  run on a fixture rather than on an empty real list.
- The intake test that asserted the defect was LIVE now asserts it is CLOSED.

Still open here: avatars for testing/engineering/architecture surfaces, and the
board reflecting which harnesses fired.



## Claim released 2026-09-29

Released `in-progress` → `todo` on the owner's instruction (review session https://claude.ai/code/session_014Qj8wncQhqV52QGN1yZDnj). No git change to this bean since before 2026-09-26, and no holder recorded; the sessions that held theme C (rendered site) work stopped on the 2026-09-25 weekly usage limit. Nothing in the body was changed: re-claim with `bun run cat beans:claim <id>`.

## Completed on landed evidence
Landed on main in PR #481 (5fe9b498); architecture theme set completed and check:theme-art:check CI gate wired.
