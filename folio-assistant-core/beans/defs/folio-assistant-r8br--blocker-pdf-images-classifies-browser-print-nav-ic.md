---
# folio-assistant-r8br
$schema: bean/1.0.0
title: 'BLOCKER: pdf-images classifies browser-print nav icons as figures, so 7 documents cannot be promoted'
status: completed
type: task
priority: high
created_at: 2026-09-20T16:36:29Z
updated_at: 2026-09-25T16:36:33Z
parent: folio-assistant-slw1
---


Seven of the nine agent-skill documents are staged and cannot be promoted.
They fail exactly one requirement — `image-descriptions` — and the images in
question are not figures.

## Measured 2026-09-20

`Agent Skills — Google Antigravity Docs`, a **four-page** browser print:

- **104 images, all classified `figure`**
- page 1 alone carries 26
- coverage of the first three: **0.000183, 0.000183, 0.000856** — hundredths of
  one percent of the page

Those are navigation icons, a copy button, a search glyph, a cookie-banner
control. The two arXiv papers, which are typeset PDFs rather than printed web
pages, produced 1 and 0 describable images and promoted cleanly — so this is
specific to the capture method, not to the corpus.

## Where it comes from

`pdf-images.py` classifies by GEOMETRY, and its rule separates a PAGE SCAN
(coverage near 1.0) from everything else. There is no verdict between "this
image IS the page" and "this image is a figure", so a favicon is a figure by
construction. That was sound while the corpus was scanned WHO publications;
a browser print is a new shape and it arrived with this branch.

## The decision, and why an agent should not take it

The obvious move — give the classifier a lower bound and call sub-threshold
images decorative — is **lowering a gate to unblock my own work**, which is
the one move the rules here forbid without being asked. It is also arguable
on the merits, in both directions:

- **For:** WCAG treats a decorative image as one that takes empty `alt`. An
  image covering 0.018% of a page carries nothing a reader needs described,
  and `image-descriptions` exists to serve readers.
- **Against:** a threshold is a number somebody picked. A small image can be
  load-bearing — a status glyph in a table, an inline equation. Coverage is a
  proxy for "decorative", not a definition of it, and the repository's own
  rule is that a determined empty must be determined, not assumed.

## Three ways out, and they differ in what they cost

1. **A `decorative` verdict in `pdf-images.py`**, by coverage, with the basis
   recorded per image as `role: "decorative"` alongside the existing
   `basis: {method, coverage, ...}`. Cheapest, and it changes what "figure"
   means for every future ingest.
2. **Describe them.** ~200 alt texts for nav chrome across seven documents.
   Honest, useless to a reader, and it teaches the next agent that the way
   past this gate is bulk narration.
3. **Treat a browser print as its own INGEST RUNG.** The provenance is already
   captured — `Producer: Skia/PDF m152` on all four vendor captures — so the
   pipeline can know it is looking at a printed web page and classify
   accordingly. Most work, and the only one that fixes the cause rather than
   the symptom.

My reading is (3) with (1) as its mechanism, because the producer string is
EVIDENCE already in hand rather than a threshold somebody chose. But this is
the owner's call, not mine.

## Done when

- [x] The owner picks, and the reason is recorded where the classifier is.
- [x] Whatever is chosen, the verdict is CHECKABLE per image, not a silent
      reclassification — `images.json` already carries `basis`, and this must
      go there too.
- [x] The seven staged documents promote, and `check:l1-complete` passes over
      all nine.
- [x] A fixture proves the classifier still calls a real figure a figure; a
      change that makes everything decorative would pass the promotion gate
      and be worse than the bug.

## Where they are now

Staged under `cat-harness/ingest-staging/` (gitignored), NOT promoted. That is
the pipeline working: nothing crosses into `library/` until every requirement
is met, and nothing reads as ingested while it waits.


---

## Resolved 2026-09-21 — issue #722

Owner picked **a browser print as its own ingest rung** (option 3), then, once
the mechanism turned out not to exist, picked **a new `chrome` role on a new
capture basis**.

### The mechanism this bean proposed cannot be built

Option 1 — `role: "decorative"` on the existing geometry basis — fails twice,
verified against the schema rather than argued:

```
decorative on a GEOMETRY basis parses?  false
  "`logo` and `decorative` can only be assigned by looking —
   a geometry basis cannot support either"
is `decorative` describable?             true
```

`DocumentImageSchema` refuses it by an explicit refinement, and `decorative`
is in `DESCRIBABLE_ROLES` anyway, so even if it parsed it would still carry a
narrative slot and still block `image-descriptions`. The rung was right; the
verdict it assigns had to be a new thing.

### Two of this bean's own claims were wrong

| claim | measured 2026-09-21 |
|---|---|
| the producer string is on **four** vendor captures | **11** of the 18 PDFs here carry `Skia/PDF` **and** a `Mozilla/` creator |
| *"the two arXiv papers … promoted cleanly — so this is specific to the capture method"* | true of two of **three**. `2602.12670v4` is also unpromoted, has 7 images at 0.000395–0.006840, and is **not** a browser print |
| implied: all 7 blocked documents are browser prints | **6 browser prints + 1 arXiv paper** |
| implied: all 104-ish images are chrome | **two of the six prints hold real figures** — Anthropic 6 at 0.139–0.308, Claude Platform Docs 3 at 0.314–0.361 |

### The bound was derived, not picked

Over all **219** placed images in the six browser prints: nav chrome tops out
at **0.005804**, the smallest real figure is **0.139632**, and the largest
ratio gap anywhere in the sorted series is the **24.1×** between exactly those
two. `CAPTURE_CHROME_THRESHOLD = 0.02` sits in that empty band, placed low on
purpose — ~3.4× above the largest chrome, ~7× below the smallest figure —
because being wrong HIGH files a real figure as chrome and drops it silently
from every description pass, and being wrong low merely keeps blocking.

### Result on the real corpus

| rung | document | before | after |
|---|---|---|---|
| capture | Antigravity Docs ×2 | 104 figure | **104 chrome** |
| capture | Gemini CLI / OpenAI | 1 figure | **1 chrome** |
| capture | Anthropic | 6 figure | **6 figure** — unchanged |
| capture | Claude Platform Docs | 3 figure | **3 figure** — unchanged |
| capture | IRIS Home | 8 figure | **7 chrome + 1 figure** |
| geometry | `WHO_PUB_TPS_93.1` | 121 page-scan | unchanged |
| geometry | `milnorlink` | 19 scan + 1 figure | unchanged |
| geometry | `2602.12670v4` | 7 figure | unchanged — not a capture |

`IRIS Home` is the sharpest evidence: the rule separates chrome from a real
figure **inside a single capture**.

### A defect this change would have introduced one tool downstream

`apply-image-verdicts.ts` read `if (img.role !== "page-scan") unjudged.push(...)`.
That literal was correct while geometry was the only computable basis; adding
`chrome` to the enum without touching it would have reported 104 navigation
icons as awaiting inspection — this bean's own gate, re-appearing one tool
along. Now asked as `SETTLED_BY_COMPUTATION.includes(img.role)`.

`check-l1-complete.ts` needed no change: `chrome` is not in `DESCRIBABLE_ROLES`
and is not `undetermined`, so it passes by construction.

### Falsified three ways

Reverting each half independently, each caught by its own test:

| reverted | failures |
|---|---|
| detector → Skia-only | 2 |
| chrome bound → 0.5 | 5, incl. the e2e arm: `Equipping agents… got {'chrome': 6}` |
| `extract` never passes the rung | 2 — **caught only by the e2e arm** |

The third is why that arm exists: every `role_for` case still passed.

### Why the promotion box stays OPEN

This unblocks **4 of the 7**. The other three are not this change's to fix and
should not be implied by ticking it:

- **Anthropic** (6 real figures) and **Claude Platform Docs** (3) need genuine
  descriptions. Nine, which is tractable — and nothing like the ~200 this bean
  feared, because 210 of the 219 were chrome.
- **`2602.12670v4`** is an arXiv paper with 7 sub-threshold images. Same shape,
  different rung; no browser-print detection reaches it. Worth its own bean.

## Closed on evidence — 2026-09-25

**Re-derived from the REMOTE**, not from a checkout, and in a separate command
from the fetch: a worktree at `origin/main` = `c11e16651f5`.

    bun run cat check:l1-complete
    EXIT=0 — 23 document(s) ✓, 0 ✗

All eleven `agent-skills/library/` documents pass, the seven this bean blocked
among them — `agent-skill-best-practices---gemini-cli`,
`agent-skills---google-antigravity-docs`,
`best-practices---google-antigravity-docs`,
`equipping-agents-for-the-real-world-with-agent-skills-anthro`,
`skill-authoring-best-practices---claude-platform-docs`,
`skills-in-openai-api`, and the two RFC documents. `image-descriptions` passes
on each, which is the requirement this bean was named for.

The one thing the run still reports as NOT a pass is `audio-transcripts`, "not
derivable by any arm yet" (bean `1r0p`) — a different requirement, and it is
printed as a third state rather than counted as green, which is the behaviour
this bean's second box asked for.

**Closed by a session that did not open it**, under
[`bean-coordination`](../../../cat-harness/work-plan/skills/work-plan/bean-coordination.md)
§"Closing a bean whose work has already landed": a bean closes on EVIDENCE, not
on authorship, once the measurement has been re-run rather than quoted. Not
mid-flight — no claim naming a branch, no note since 2026-09-21, no open PR
mentions it. The remaining box was a measurement, not something only a person
could satisfy, so it was mine to discharge.

**This turn got that wrong first.** An hour earlier it recorded the same
evidence and left the bean open, citing *"never resolve a sibling's bean"* —
the rule as it stood before `0pes`. That is exactly the failure `0pes` measured:
six beans carrying *"verified resolved — NOT closing it, not my bean"*, and
**zero** of them ever reaching `completed`. A bean verified done and left open
costs the next agent the work over again.
