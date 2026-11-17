---
# folio-assistant-tuvg
$schema: bean/1.0.0
title: 'MAIN IS RED: three crdm skills are in no package manifest and carry a retired roles: field'
status: completed
type: bug
priority: normal
created_at: 2026-09-26T04:09:28Z
updated_at: 2026-10-07T17:30:00Z
parent: folio-assistant-1xhc
---

Measured 2026-09-26 on `origin/main` at `6840b14097b`. **This fails every open PR, not one.**

## The two failures

Both name the same three files, added by main's commit `7edf7b7ed5a` (*"feat: CRDM Phase 4b prioritization, SDLC/release skills, CRDM phase detail skills"*):

    cat-harness/skills/sdlc/crdm/crdm-needs-assessment.md
    cat-harness/skills/sdlc/crdm/crdm-impact-analysis.md
    cat-harness/skills/sdlc/crdm/crdm-requirements-template.md

| gate | what it says |
|---|---|
| `skill package manifests cover the package` (test) | all three are unlisted in `cat-harness/skills/sdlc/crdm/package-manifest.json` |
| `check:retired-front-matter` | all three carry `roles:`, retired from skill markdown |

## It is main's, established rather than assumed

- `git show origin/main:cat-harness/skills/sdlc/crdm/package-manifest.json | grep -c 'needs-assessment|impact-analysis|requirements-template'` → **0**. Not listed on main either.
- No fix exists to port: the 25 most recently updated remote branches were checked for a manifest listing any of the three. **None does.**

## The proposed patch

1. Add the three basenames to the `skills` array in `cat-harness/skills/sdlc/crdm/package-manifest.json`.
2. Remove the `roles:` key from each file's front matter. That field is retired — 325 annotations across 140 files, read by nothing, dangling from its first commit (record: `fsh-guts/retired/skill-roles-front-matter.md`). If a skill should declare who performs it, that is bean `y1w9`, and the field has to be declared before it is written.

Not applied here: this is not the work of whoever's PR happens to notice it, and `check:retired-front-matter` plus the manifest belong to the crdm package. Reported with the patch rather than widened into an unrelated PR.

## Why this keeps happening — the same shape landed yesterday

`decision-methodology-selector.md` shipped unlisted in `folio-core`'s manifest on 2026-09-25 and was fixed within hours. **This is the second occurrence in two days**, so the class is worth a gate at the point of authoring rather than a fix per occurrence: a new skill file and its manifest entry are one change, and nothing makes an author write both.

## Done when

- [ ] The three are listed in the crdm package manifest.
- [ ] The retired `roles:` key is gone from all three.
- [ ] `bun test -t 'every skill file is listed in its package manifest'` and `bun run cat check:retired-front-matter` are green on main.
- [ ] A decision is recorded on whether authoring a skill without its manifest entry should be caught earlier, given two occurrences in two days.

## CORRECTED 2026-09-26 — this bean named ONE cause; there are THREE, across five failures

The first version of this bean reported *"two gates"*. That was **wrong**, and
wrong the same way twice in one session: a failure list was read partially and
the remainder dropped silently. CI on `f641c1ffcbe` reported **five** test
failures; the local sweep had four and this bean named two of them.

The full set, each established against `origin/main` rather than inferred:

| # | failing test / gate | root cause |
|---|---|---|
| 1 | `the sweep over the real tree > is clean, and scanned enough files…` | **A** |
| 2 | `the graph-kind exemption > the exemption guards a non-empty set, and only that set` | **A** |
| 3 | `check:retired-front-matter` | **A** |
| 4 | `skill package manifests cover the package` | **B** |
| 5 | `the real corpus — and the gate can actually fail > no NEW drift` | **C** |
| — | `this repository's own corpus > the committed index is up to date and valid` | **regeneration — fixed**, `bun run cat translation:index` |

### Cause A — the retired `roles:` field, in FOUR files across TWO packages

Not three in crdm. `cat-harness/skills/process/workflow/branch-freshness.md` carries it
too, and on `origin/main` it reads literally:

    roles: [reader, collaborator, owner]

Those three actor ids **have never existed in any commit** — which is the whole
reason the field was retired (325 annotations across 140 files, read by nothing;
record: `fsh-guts/retired/skill-roles-front-matter.md`).

Files: `skills/process/workflow/branch-freshness.md`,
`skills/sdlc/crdm/crdm-needs-assessment.md`, `skills/sdlc/crdm/crdm-impact-analysis.md`,
`skills/sdlc/crdm/crdm-requirements-template.md`.

Failure 2 is the same cause seen from the other side: that test asserts the
exemption guards a **non-empty set and only that set**, and expects
`branch-freshness.md` to be a `folio-memory/v1` entry (where `roles:` is a live
axis). It is not one — it is a skill. So the file is in the guarded set for the
wrong reason, and the test is doing its job.

### Cause B — three crdm skills in no package manifest

Unchanged from this bean's first version, and still unfixed on main:
`crdm-needs-assessment.md`, `crdm-impact-analysis.md`,
`crdm-requirements-template.md` are absent from
`cat-harness/skills/sdlc/crdm/package-manifest.json`.

### Cause C — translated pages published with no `.po` catalogue

**A separate defect this bean missed entirely.** Five locales × several pages
are published with no catalogue and no `UNCATALOGED` record:

    error {ar,es,fr,ru,zh}/accessibility:  published with no `.po` catalogue
    error {ar,es,fr,ru,zh}/content-types:  published with no `.po` catalogue
    …

`cat-harness/docs/{ar,es,fr,ru,zh}/accessibility.md` all exist on `origin/main`;
no matching `.po` does. The gate's own remedy: add the catalogue, or record it
in `UNCATALOGED` with a reason and a date.

### Established, not assumed

- `git show origin/main:…/branch-freshness.md | grep '^roles:'` → present.
- `git show origin/main:…/crdm/package-manifest.json | grep -c …` → **0**.
- The locale pages are in `git ls-tree origin/main`; no `.po` is.
- `git diff --name-only origin/main HEAD` over those paths returns only
  **generated** `kg-qa` sidecars — regeneration output for main's new files,
  not edits to any source.

### Done when

- [ ] `roles:` removed from all **four** files (or, where a file really is a
      `folio-memory/v1` entry, declared as one — that is the exemption).
- [ ] The three crdm skills listed in the crdm package manifest.
- [ ] Each published translated page has a `.po` catalogue, or an `UNCATALOGED`
      entry with a reason and a date.
- [ ] `bun test` green on `main` for all four tests, and
      `bun run cat check:retired-front-matter` green.
- [ ] A decision on catching an unlisted skill at authoring time — **third**
      occurrence of that shape in two days.

## RESOLVED 2026-09-26 — and the count of occurrences is the finding

Owner authorised fixing all three here rather than waiting for the package
owners. What actually happened:

| cause | outcome |
|---|---|
| **A** retired `roles:` in 4 files | **already fixed on main** in the 11 intervening commits — patch not applied |
| **B** 3 crdm skills unlisted | **already fixed on main** — manifest now lists all 6 |
| **C** 25 translations with no `.po` | **fixed here** — recorded in `UNCATALOGED` |
| **D** `workflow/release-epic-planning.md` | **NEW, fixed here** — arrived unlisted AND carrying `roles:`, hours after A and B were repaired |

### Cause C, and why the reason is a measurement rather than a borrowed sentence

The precedent entry (`es/agent-onboarding`) reads *"the page's structure matches
its source, so it is current but untracked"*. Repeating that of 25 other pages
would be a claim, so it was checked: `translation-drift` compares
`sameStructure(src, got)` at line 298 and reports a mismatch as **drift**,
on a separate branch from the missing-catalogue report at line 308. None of the
25 reported drift. So "structurally current" is derived, not assumed.

Recorded as a **backlog**, not a dispensation — writing the catalogues is still
the fix. The file's own comment supplies the guard: an entry whose page has been
fixed must not survive, *"that is how a backlog turns into a set of claims about
a corpus that has moved on"*.

### The pattern, now measured across four occurrences in two days

| when | file(s) | unlisted | retired `roles:` |
|---|---|---|---|
| 09-25 | `process-core/decision-methodology-selector.md` | yes | — |
| 09-26 | 3 × `skills/sdlc/crdm/crdm-*.md` | yes | yes |
| 09-26 | `skills/process/workflow/branch-freshness.md` | — | yes |
| 09-26 | `skills/process/workflow/release-epic-planning.md` | yes | yes |

**Four in two days, and the last one landed hours after the previous three were
repaired.** Each repair is two minutes; the class is not going away, because a
skill file and its manifest entry are one change and nothing makes an author
write both — and `roles:` is a field a template or an example is still teaching
people to write, since it keeps reappearing on brand-new files.

That second point is the sharper one, and I went looking for the cause before
asserting it. **The search came back empty, so the claim is withdrawn.**

I had written here that four fresh files carrying a retired field "is not four
mistakes, it is one unfixed generator, template or example". Then I checked:

| searched | result |
|---|---|
| `roles: [` across `cat-harness/`, `.claude/` (templates, skills, tools, schemas) | no emitter — only `role-graph`/`todo`/`degradation` uses of an unrelated `roles` field, and `assistant-types.ts` DISCUSSING the retirement |
| the exact triple `reader, collaborator, owner` as a live template | **nothing** |
| `^roles:` in `docs/`, `templates/`, `.claude/` outside generated output | **nothing** |
| `^roles:` in the GENERATED reference (`docs/reference/`) — the copy an agent reading published docs would imitate | **0 files** |

So there is no readable source in this checkout that teaches the field. The
cause is **could not determine**, and the likeliest remaining explanations —
agents pattern-matching from pre-retirement files still visible in git history,
or reproducing it from outside the repo entirely — are not verifiable from in
here. Recorded as undetermined rather than as the tidy single-generator story,
which is what I would have written had I not looked.

What that changes about the remedy: if nothing in the repo emits it, no edit to
the repo prevents the next occurrence — only a **check** does. Which makes the
authoring-time gate below the whole answer rather than a nice-to-have.

## Done when

- [x] `roles:` gone from all affected files (A by main, D here)
- [x] crdm skills listed (main), `release-epic-planning` listed (here)
- [x] Every published translation has a catalogue or an `UNCATALOGED` record
- [x] `translation:drift:check` green, falsified in both directions
- [x] `bun run cat gates` 153/153 and `bunx playwright test` 700 passed
- [x] Looked for what keeps writing `roles:` onto new skill files — **no emitter
      exists in this checkout**, including in the generated reference. Recorded
      above as could-not-determine; the single-generator hypothesis is withdrawn.
- [ ] Decide whether an unlisted skill should fail at authoring time rather than
      in the next PR's CI — four occurrences in two days.

## REVERTED 2026-09-26 — cause C should never have been fixed this way

The 25 `UNCATALOGED` entries are removed. They were merged (#1364) on the
owner's instruction to me, and the owner has since reverted that instruction on
being shown what the instruction collided with. **Both directions came from the
owner within about forty minutes**, which is the finding, not a footnote.

### What the entries collided with

1. **A sibling PR was already doing the identical work.** #1381, *"Record the 25
   uncatalogued translations"*, open, carrying the same 27 entries. The merge
   here would have made it fail `translation-drift.test.ts:154` — *"no page is
   recorded TWICE"* — on 52 entries with 25 duplicated. My merge **blocked
   another session's PR**, and that PR had the work first.
2. **Two other sessions carry the opposite decision, same day.** Their check-in
   prompts record it directly: *"DO NOT add UNCATALOGED entries to go green —
   documented as a BACKLOG not a policy, 2->29 retires a working gate"*, and
   *"The owner chose on 2026-09-26 to ask the t8g3 campaign for the catalogues
   rather than record the absence"*, under a bean `ngxj` with a 48-hour expiry.
   Neither `ngxj` nor `0xfe` exists on any pushed ref, so the beans could not be
   read — only the prompts.

### Why the reverted direction is the better one, on the merits

2 recorded absences to 27 changes what the gate MEANS: from *"published
translations are catalogued"* to *"we noted that they are not"*. That is not a
backlog entry, it is retiring a working gate by filling it. My own commit
called the entries *"a BACKLOG, not a dispensation"* — the volume is what makes
that distinction stop holding.

### What this costs, stated plainly

`main` is red again on `translation:drift:check` and `no NEW drift`, and every
open PR with it. That is the state it was in before #1364, and it is the state
the other sessions had deliberately chosen to sit in while asking issue #206's
translation campaign for the actual `.po` files. The fix is the catalogues.

### The instruction-collision is the durable finding

Nothing in this repository let either side see the other. I had no way to read
`ngxj`; those sessions had no way to see my question. The owner answered both
questions truthfully and the answers contradicted, because each was asked
without the other on the table. **Seven sessions were running.** That is the
same cost this session has measured five other ways (`r1vw` re-implemented,
`check:stale-paths` nearly rebuilt, `4pm8` closing mid-edit, `kupb` re-parented
nine hours early, two of this bean's own causes fixed while the patch was held)
— but this is the first time it reached `main` and had to be undone.

## Done when

- [x] The 25 entries removed; `UNCATALOGED` back to its original 2
- [x] `git diff origin/main` is a pure deletion, nothing else
- [x] `no page is recorded TWICE` passes, so #1381 is unblocked
- [ ] The `.po` catalogues land (issue #206 / bean `ngxj`, not this bean)
- [x] ~~A way for one session to see another's open question before answering
      it~~ — **WITHDRAWN 2026-09-26: the mechanism already exists and I skipped
      it.** See below.

## The remedy I proposed already existed — withdrawn, and the real gap is narrower

I recommended building cross-session question visibility. Then I looked, which
is the step that should have come first. `bean-coordination` §"A claim is
branch-local" **already prescribes the check**, with the command, and names my
exact case in its own words:

> `gh pr list --state open --search '<bean-id>'`
>
> Both are cheap, and **the second catches the case that matters most in
> practice — a sibling minutes ahead of you who already has a PR up.**

#1381 was up. I did not look. **Seventh premise to dissolve on re-measurement
today, and the first that was my own proposal.**

### What IS a real gap, and it is one sentence wide

Those checks are written as *pre-claim*. I was not claiming: I already held
`tuvg` and was executing an owner instruction on one cause inside it. **No
claim, so the rule never fired.** Two edits to the skill follow, and both are
mechanical rather than aspirational:

1. **The trigger is starting work, not claiming.** A cause inside a bean you
   hold, a fix just asked for, a gate you are unbreaking — each is a unit a
   sibling may already have a PR up for, and none involves a claim.
2. **Search the subject, not only the bean id.** The sibling's bean `0xfe` was
   on an unpushed branch, so an id search would have returned nothing. #1381's
   title was *"Record the 25 uncatalogued translations"* — `UNCATALOGED` would
   have matched; `tuvg` never could.

Also recorded there: a duplicate-detecting test punishes **whoever merges
second**, not whoever duplicated. Merging first is not evidence of being first.

### What this does NOT fix, stated so nobody reads it as closed

The two contradictory owner answers are still possible. Nothing above would have
shown me that another session had already asked and been told *no* — that
information lived only in an unpushed bean and another session's check-in text.
The PR check would have stopped me **by finding the duplicate work**, not by
finding the decision. That remains unsolved, and it is deliberately NOT being
designed here: it is a platform capability change, so it belongs in CRDM behind
an issue, and I have not been given permission to open one.

## Completed on landed evidence
Landed on main in PR #1364 (k59d round 3: crdm skills manifests and roles).
