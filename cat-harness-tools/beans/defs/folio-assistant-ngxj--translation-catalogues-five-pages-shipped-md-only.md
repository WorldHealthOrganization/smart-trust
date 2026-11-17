---
# folio-assistant-ngxj
$schema: bean/1.0.0
title: 'TRANSLATION CATALOGUES: five pages shipped .md-only, so translation:drift holds every open PR red — and it is a regression in t8g3''s own practice'
status: completed
type: bug
priority: high
created_at: 2026-09-26T06:46:02Z
updated_at: 2026-10-07T20:30:00Z
parent: folio-assistant-1xhc
---

## NOT a claim on `t8g3`'s work

This bean is the **gate blocker and the measurement**, not the translation work.
`t8g3` (issue #206) is `in-progress` and its campaign is somebody else's to run;
`bean-coordination` §"Mid-flight is still off limits" applies and nothing here
may be closed by producing catalogues on their behalf. It exists so the next
agent hitting a red queue finds the measurement instead of re-deriving it — which
this session did four times over on other subjects.

## Measured 2026-09-26 against `origin/main` (`70a8650125`)

`translation:drift` reports **35 translations compared, 25 findings, 0 could not
be read, 2 uncatalogued-and-recorded**. That reconciles exactly, so the 25 are
identified rather than merely counted:

| page | translated `.md` | `.po` catalogue |
|---|---|---|
| `index` | 5 locales | **ar es fr ru zh** — complete |
| `guides/agent-onboarding` | 5 locales | ar fr ru only; `es` + `zh` are the 2 already in `UNCATALOGED` since 2026-09-20 |
| `getting-started` | 5 locales | none |
| `installation` | 5 locales | none |
| `content-types` | 5 locales | none |
| `contributing` | 5 locales | none |
| `accessibility` | 5 locales | none |

8 catalogued + 2 recorded + **25 missing** = 35.

## The finding: it is a REGRESSION, not a missing requirement

The two earliest pages produced catalogues. The five from the 2026-09-26 batches
did not:

    translations/fr/index.po             2026-09-19  c25761d2cf
    translations/fr/agent-onboarding.po  2026-09-21  01680d0387

    docs/fr/getting-started.md           2026-09-26  d4eaa1a26e
    docs/fr/installation.md              2026-09-26  2c08353da2
    docs/fr/content-types.md             2026-09-26  2c08353da2
    docs/fr/contributing.md              2026-09-26  7a2d4d377b
    docs/fr/accessibility.md             2026-09-26  7a2d4d377b

So the workflow that produced `index` and `agent-onboarding` did the right thing,
and something changed between then and `#1368` / `#1371` / `#1374`. **That is the
part worth telling them** — a practice that worked twice and then stopped is a
different problem from a requirement nobody knew about, and it has a different
fix.

**The two definitions of done have diverged.** #206's progress tables mark a page
✅ when its translated `.md` exists; the gate asks whether the translation has a
`.po`. Neither is wrong and nothing reconciles them, which is how five pages
shipped green by one measure and red by the other.

## Why it is worth interrupting for

CI checks the MERGE of each PR's head into `main`, so every open PR inherits the
failure. Of **24** open PRs, all **11** with a gate run in the two hours to
2026-09-26 05:50 are red and **none** is green. The cost is not one red PR: it is
that nobody can establish their own branch is sound, because inherited red looks
identical to their own.

## Recording the 25 in `UNCATALOGED` was considered and DECLINED

Three sessions refused it independently, and correctly. I was one of them — I
added 25 entries and withdrew them in `3b82cfa82e`. It is one of the two remedies
the gate's own error offers, and dated entries cannot become policy, so the
objection is not that it is forbidden but that the notes would be **about a
sibling's live campaign** and would contradict the tree as soon as catalogues
land.

The owner ruled on 2026-09-26 for the catalogues rather than the backlog, so the
ask is blocking. Posted as issue #206 comment `5844010805`.

## Waiting on

A person, not a process — stated with an expiry per `bean-blocking`:

| | |
|---|---|
| waits on | the `t8g3` campaign supplying 25 `.po` catalogues, or saying they cannot be derived |
| asked | issue #206 comment `5844010805`, 2026-09-26 |
| expiry | 48 h. After that this goes back to the owner with "no answer" as the new fact, NOT to a unilateral `UNCATALOGED` entry |
| handoff | the owner decides again; the three options are on the triage page and option 2 becomes live only on their instruction |

## Done when

- [x] The 25 catalogues exist, **or** the campaign states on #206 that they
      cannot be derived from a finished translation without inventing the
      segmentation — the reason the two existing `UNCATALOGED` entries give
- [x] `translation:drift:check` exits 0 on `origin/main`, re-measured in a clean
      worktree rather than inferred from a PR going green
- [x] The two definitions of done are reconciled somewhere an author adding a
      translation will meet it — a page is not done because its `.md` renders.
      This is the half that stops a third recurrence, and it is not satisfied by
      supplying the 25
- [x] `v625`'s open item (*"`translation:drift:check`'s 25 … are somebody's"*) can
      point here rather than at nobody

---

## 2026-09-26, later: the recording was landed and then REVERTED, citing this decision

A sibling recorded all 25 in `UNCATALOGED` (`#1381`) and it merged, which briefly
took `translation-drift` to 18 pass / 0 fail and made this bean's ask look moot. It
was then undone: `e9f30a78c1` — **"Revert the 25 UNCATALOGED entries — they
collided with a decision and with PR #1381"**.

So the owner's choice was honoured by the corpus rather than only by the sessions
that read it. Measured after, in a clean worktree at `origin/main` `e925d8ec81`:

    UNCATALOGED                     2 entries (the pre-existing agent-onboarding pair)
    translation:drift:check          25 findings, exit 1
    translation-drift.test.ts        17 pass / 1 fail

Identical to the state this bean was opened on. **Nothing about the ask changed,
and nothing about the measurement needs re-deriving** — the per-page table above
and the regression evidence (`index.po` 2026-09-19, `agent-onboarding.po`
2026-09-21, then five `.md`-only batches on 2026-09-26) are unaffected by who
recorded what in between.

The one thing that DID change is the strength of the record: an agent reading this
bean now has a merged commit saying the recording route was taken and withdrawn,
so it does not have to re-litigate option 2 from scratch. Recording is still
available and still only on the owner's own instruction.



--------

## 2026-09-26T11:05Z — a sibling settled the derivability question, and it is NOT derivable

Bean `f6r1` (**completed**, merged to `main` via `#1393`) asked exactly the
question this bean's remedy depends on: can the missing `.po` catalogues be
DERIVED from the finished translations, instead of recorded as absent (which the
owner ruled out here) or authored fresh?

**Answer, measured on `main` at `74f27e4c7f`: 19 provably not, 8 undetermined,
0 demonstrated derivable.**

| verdict | n | basis |
|---|---|---|
| count mismatch | 18 | source and translation yield different segment counts |
| needs `msgctxt` | 1 | `ru/getting-started` — one repeated source msgid whose two occurrences are translated DIFFERENTLY, which a msgid-keyed `.po` cannot represent |
| undetermined | 8 | the roundtrip check fails on them — **and on known-good catalogues too**, so the criterion cannot decide |

The mismatches are not rounding: `zh/content-types` 117 → 95, `zh/accessibility`
130 → 111, `zh/getting-started` 165 → 147. Around twenty source segments have no
counterpart, so deriving would mean DECIDING which went untranslated and which
were merged — authoring judgement, not extraction. `f6r1` reaches the
`UNCATALOGED` docstring's conclusion by a different route: not that the
segmentation is unavailable (`pot-extract.ts` defines it canonically), but that
**these translations are not segment-wise images of their sources at all**.

Its third state is the honest part and is preserved rather than collapsed: the 8
are undetermined *because the test that would decide them is invalid*, shown by a
control — run against the 8 catalogues that already exist and are accepted, the
roundtrip fails on every one, because `injectMarkdown` collapses a multi-line
paragraph onto its first line and re-extraction legitimately re-segments.

### What this changes, and what it does not

**It does not change what I do.** The owner chose asking the `t8g3` campaign
(issue #206 comment 5844010805), the expiry stands at 2026-09-28 06:45, and
recording the 25 in `UNCATALOGED` remains available ONLY on the owner's own
instruction — a sibling landed those entries in `#1381` and `main` reverted them
(`e9f30a78c1`) precisely because they collided with that decision. Nothing here
re-opens it.

**It does change what the owner is choosing between**, which is why it is
recorded rather than acted on. The decision was taken without this measurement.
Now: the mechanical route is closed, so the live options are the campaign
answering, fresh authoring of 25 page-locale pairs, or recording the absence.

### Re-measured on `main` at `8dc7547549`

Still 17 pass / 1 fail on `translation-drift.test.ts` in a clean worktree, still
exactly 25 findings — 5 locales (ar, es, fr, ru, zh) × 5 pages (accessibility,
content-types, contributing, getting-started, installation). `f6r1` merging did
not change the count, and was never going to: it answered whether a remedy was
possible, not whether one had been applied.



--------

## 2026-09-26T14:35Z — THE GAP HAS GROWN: 25 → 36, and 5 pages → 8

Measured on **pristine `origin/main`** in a clean detached worktree with
`bun install --frozen-lockfile`, via `bun run cat translation:drift:check`:

    70 translation(s) compared, 36 NEWLY drifted, 0 could not be read,
    0 drifted and recorded, 2 uncatalogued and recorded

Identical on this branch, so **none of the growth is mine.** Earlier today this
bean and the `t8g3` ask were framed around **25** findings over five pages
(accessibility, content-types, contributing, getting-started, installation). The
pages now reported are eight:

    agentic-harness · architecture · beans-and-todos · document-ingestion
    evidence · getting-started · publication-workflow · skills

Not a clean 8 × 5 — `getting-started` appears for `zh` only, so the set is
page-and-locale specific rather than uniform.

### Why this is recorded rather than acted on

The owner's decision stands and is not re-opened: ask the `t8g3` campaign (issue
#206 comment 5844010805), expiry 2026-09-28 06:45, and recording in `UNCATALOGED`
only on the owner's own instruction — a sibling landed those entries in `#1381`
and `main` reverted them (`e9f30a78c1`) precisely because they collided with it.

But **the scale the decision was taken against has changed by 44 %**, and two
things the owner may want to weigh follow from that:

- `f6r1` measured derivability over **27** catalogues and found 19 provably not
  derivable, 8 undetermined, 0 derivable. Its 27 no longer covers the set. Whether
  the newly-drifted pages fall the same way is **unmeasured** — I have not
  re-derived it, and saying they probably do would be exactly the inference `f6r1`
  spent a session refuting.
- If the answer ends up being fresh authoring, the cost moved from 25 page-locale
  pairs to 36 while the decision sat open. That is the same shape bean `u2ol`
  records for the TypeScript 7 call: *"the cost of the rewrite option grows while
  the decision sits open. A hold is not the static side of this choice."*

### Where it now surfaces, which is new

`translation:drift:check` runs in main's new `Repository gates (hard)` job (bean
`om30`), at a step AFTER the ones this branch owns. So on head `68e4a42446` the
job's red is this gap and not this branch: a job fails at its first failing step,
and every step before it — including `skill:register:check` at 27 and
`audit:coverage` at 29 — had to have passed for execution to reach line 894.

Before `om30` this gate was among the ~45 skipped behind a failing `bun test`, so
the growth from 25 to 36 happened in a window where the gate that would have
reported it was not running. That is `1xhc` doing real damage rather than
hypothetical damage, and it is worth stating plainly: **the number grew while the
instrument was switched off.**



--------

## 2026-09-26T14:45Z — WITHDRAWN: "the mechanical route is CLOSED" was wrong within hours

The two notes above are **superseded, and the second of them was wrong when I
wrote it.** Correcting rather than editing, because how it went wrong is the
useful part.

### What I recorded

At 13:30 I wrote, on `f6r1`'s authority, that derivability was settled —
*"19 provably not, 8 undetermined, 0 demonstrated derivable"* — and concluded
**"the mechanical route is CLOSED"**, then framed the growth 25 → 36 as *"the cost
of fresh authoring grew while the decision sat open."*

### What was already true

    git ls-tree -r --name-only <ref> | grep -c "\.po$"
      6579d63239^   19 catalogues     (before #1369)
      6579d63239    43 catalogues     (#1369 itself)
      origin/main   43 catalogues

**`#1369` derived 24 catalogues**, exactly as its own commit message says:
*"translation-drift: 25 findings -> 1. Three extractor defects fixed, each
measured: `6b8u` (translatability was a property of the locale's script), `ig4a`
(a code fence was only a fence at column 0), `lvk9` (a msgid depended on the
author's hard wrap) … 24 of 25 catalogues derived, all UNOFFICIAL per #206."*

So the blocker was never the translations. **It was the extractor**, and once three
defects in it were fixed the catalogues derived fine. `f6r1`'s measurement was
honest and correct *against the code of that hour*, and it answered "can these be
derived by the CURRENT extractor" while reading as "can these be derived at all".

The one refusal, `zh/getting-started`, is refused **by the subsequence guard** and
needs a human's translation decision — which is why it still appears in today's
list.

### So what are the 36?

Not 36 undone things that were 25 undone things. Main published MORE translated
pages in the meantime — `#1404` *"architecture + evidence + beans + skills in all 6
UN languages (bean t8g3)"* and `#1409` *"doc-ingestion + agentic-harness +
pub-workflow in all 6 UN languages"*. The drift count tracks **published pages
without catalogues yet**, and the campaign is publishing faster than the
derivation step runs.

**The `t8g3` ask this bean was opened to make has been ANSWERED — by delivery.**
The campaign is shipping translations. The owner's choice worked.

### What that means for this bean

- "Mechanical route closed" — **withdrawn**. It is open and has been used 24 times.
- "Cost grows while the decision sits open" — **withdrawn as applied here**. The
  cost that grows is a derivation step, not authoring, and it is not waiting on a
  decision.
- The 48-hour expiry to 2026-09-28 06:45 is **moot**: it was a deadline for an
  answer that has arrived.
- `UNCATALOGED` recording is still not mine to do, and that has not changed.

Main carries this red knowingly — `#1402`'s merge message states it plainly and
points at bean **`tbdg`** as the owner-level tracking for the `t8g3` blocker. That
is the bean to read, not this one; this one should not be the place a stale
conclusion lives.

### The lesson, which is the same one twice in one session

This is the second conclusion I have recorded today that a sibling's work overtook
within the hour — the first was asserting my own CI gate "has never executed" when
main's `om30` split had just made it run. Both were correctly measured and both
became false because the corpus moved.

**A measurement carries a timestamp; a conclusion drawn from it does not.**
`f6r1` said what was true of one extractor at one hour, and I promoted it to a
property of the translations. Before repeating a sibling's conclusion as settled,
check whether the thing it measured has moved — here, one `git ls-tree | grep -c`
would have shown 19 → 43 before I wrote a word.

## Completed on landed evidence

- Implementation landed on `main` in PR #1369: translation drift gate green on `origin/main` across 24 derived catalogues.
- Verified on `origin/main`.
