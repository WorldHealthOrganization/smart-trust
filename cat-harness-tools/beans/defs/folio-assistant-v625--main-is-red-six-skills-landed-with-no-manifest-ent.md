---
# folio-assistant-v625
$schema: bean/1.0.0
title: 'MAIN IS RED: six skills landed with no manifest entry and no reference page — one cause, four failing gates'
status: completed
type: bug
priority: normal
created_at: 2026-09-26T05:10:48Z
updated_at: 2026-10-07T17:30:00Z
parent: folio-assistant-1xhc
---

`main` was red in CI, and four of its seven failures had one cause: **six skill
files existed with no package-manifest entry and no published reference page.**

| file | manifest | reference page |
|---|---|---|
| `crdm/crdm-needs-assessment.md` | missing | missing |
| `crdm/crdm-impact-analysis.md` | missing | missing |
| `crdm/crdm-requirements-template.md` | missing | missing |
| `workflow/code-review-process.md` | missing | missing |
| `workflow/branch-freshness.md` | missing | missing |
| `workflow/release-lifecycle.md` | missing | missing |

Both `skill coverage` and `skill package manifests cover the package` named the
IDENTICAL six. This is the `decision-methodology-selector` defect (fixed
2026-09-25, one file) recurring at **six**.

## Registering a skill is a CHAIN, and nothing performs it atomically

This is the finding worth keeping. Fixing the two named gates made **four more**
go red, and fixing those made **two more** go red. Each regeneration staled the
next artefact:

```
add 6 to package-manifest.json
  -> gen-skill-docs            (6 reference pages)
     -> gen-docs-pages         (docs pages index)
        -> translation:index   (35 translations index)
           -> docs:harness     (harness docs)
              -> state:visualizer
```

Six steps. An author who adds a skill and runs the two obvious ones lands a
tree that is red in four other places, and **every one of those reds names a
generated file rather than the skill they added** — so the cause is invisible
from the symptom. That is why this recurred: the first author was not careless,
they were three steps short of a chain nobody has written down.

**`bun run cat gates` is the only thing that finds the whole chain**, and only by
running it repeatedly until the set stops changing: 7 -> 8 -> 7 -> 4 here, with
the membership changing each time, not just the count.

## A separate defect on the same four files

`check:retired-front-matter` was red on four of the six, and it is NOT the same
cause — measured before and after registering them: 4 findings both times. They
carried `roles: [reader, collaborator, owner]`, a field the gate records as
retired, read by nothing, and *dangling from its first commit* — those three
actor ids have never existed in any commit. Removed.

Worth separating because the shared file list made it LOOK like one cause. It
was two causes on one set of files, and asserting the first would have been
wrong.

## I committed `kfkh`'s defect while fixing this one

Adding `parent:` to this bean by regex inserted a SECOND `priority:` key, and
`check:bean-front-matter` caught it — the duplicate-front-matter-key defect
`kfkh` records, reproduced live by the tooling-free edit. Fixed by deduping
keys within the front-matter fence.

## Measured

| | before | after |
|---|---|---|
| `bun run cat gates` | 7 of 153 failed | **4 of 153** |
| `bun test` failures | 8 (local worktree) | **1** |
| `skill coverage` | 6 missing | 0 |
| `skill package manifests` | 6 unlisted | 0 |
| `check:retired-front-matter` | 4 | 0 |
| `gen-skill-docs --check` | red | green |

The remaining 4 are pre-existing on `main`, each verified there directly:
`bun test` (one failure, the drift test below), `check:glossary`,
`translation:drift:check` (**25 newly drifted — identical count on pristine
main**), `docs:auto:check`.

## Done when

- [x] The six are in their package manifests and have reference pages.
- [x] The retired `roles:` key is gone from the four that carried it.
- [x] Every artefact the chain stales is regenerated.
- [x] The chain is written down somewhere an author adding a skill will find
      it — or, better, one command performs it. **`bun run cat skill:register`**,
      plus a pointer in `AGENTS.md`.
- [ ] `translation:drift:check`'s 25, `check:glossary` and `docs:auto:check`
      are somebody's: all three are pre-existing and none is this bean's.

---

## 2026-09-26, ~40 minutes later — IT RECURRED, and that closes the argument

This bean's open Done-when was *"the chain is written down somewhere an author
adding a skill will find it — or, better, one command performs it."* It was a
prediction. It is now a measurement.

`cat-harness/skills/process/workflow/release-epic-planning.md` landed on `main` from a
sibling session **after** #1378 merged, carrying:

| | |
|---|---|
| package-manifest entry | **missing** |
| published reference page | **missing** |
| `roles: [reader, collaborator, owner]` | **present** — the retired key, again |

So BOTH defects #1378 fixed recurred within the hour, on the next skill added.
Registered here through the full six steps.

**The second one tells us how it propagates.** The retired `roles:` key is not
being typed fresh each time — it is being **copied from an existing skill file
as a template**. That is why removing it from four files did not stop it: the
template it is copied from was not one of the four, or the author copied one of
them before #1378 landed. A gate that fires after the fact cannot break that
loop; only the copied source can.

### What this rules out

- **Not carelessness.** Two independent authors, two independent sessions, the
  same six-step gap and the same copied key. A process that two careful people
  fail at in one hour is a process defect.
- **Not fixed by documentation alone.** #1378's commit message wrote the chain
  down in full, and it was written down before this author needed it. Prose in a
  merged commit is not reachable from the moment of authoring.

### What the fix has to look like

One command that performs all six steps, invoked by whoever adds a skill —
plus a template or scaffold that does not carry `roles:`. Either half alone
leaves the other loop open: a command nobody runs, or a clean template with a
five-step tail still done by hand.

Still an owner decision (where such a command lives, whether it hooks the
commit boundary), so recorded rather than built. But the evidence side is now
closed: this is not a hypothetical.

---

## 2026-09-26 — done, and THE CHAIN IN THIS BEAN WAS WRONG

`bun run cat skill:register` performs it, verifies each step, and says what it
deliberately will not do. `AGENTS.md` points at it. But the substantive
correction is to this bean's own content.

### The six steps recorded above are wrong in both directions

Measured by experiment — a throwaway skill added to a green tree, each check
run **individually**, against a baseline measured the same way:

| this bean said | measurement |
|---|---|
| `gen-skill-docs` | ✅ in the chain |
| `gen-docs-pages` | ❌ **NOT staled by adding a skill** |
| `translation:index` | ❌ **NOT staled** |
| `docs:harness` | ❌ **NOT staled** |
| `state:visualizer` | ❌ **NOT staled** |
| — | ✅ `glossary:page` — **missing from this bean** |
| — | ✅ `docs:auto` — **missing** |
| — | ✅ `kg:audit` — **missing** |
| — | ✅ `kg:detangle` — **missing** |

Four wrong, four missing, one right. The chain is five writers, not six, and
only one of the six named here belongs to it.

**How it went wrong:** every earlier version was written from memory of a
session in which other things were also stale. `gen-docs-pages` and friends had
gone red *in the same sessions*, for unrelated reasons, and were attributed
here. `glossary:page` and `docs:auto` were already red on a red `main`, so they
were filtered out as "not mine" — when adding a skill breaks them too. **On a
dirty baseline you cannot attribute in either direction**, and every reading
taken during this repository's red period was unreliable both ways.

### `bun run cat gates` cannot derive this, which is why it stayed wrong

The first experiment used `gates` and found four stale artefacts.
`kg:audit:check` and `kg:detangle:check` were **green in it and red when run
alone against the identical tree** — `bun test` runs those writers, so the
artefacts are repaired before the checks execute. Bean `ymsu`'s blind spot,
hiding two fifths of this chain.

Running the checks in *sequence* perturbs too: a later sweep found
`kg:audit:check` green again because something earlier in the loop wrote. Only
an isolated run of one check against a known tree measures anything.

### And the "order-sensitive" claim was attached to the wrong thing

An earlier note here said the chain is order-sensitive. The five are **order-
free** — verified by running them in reverse and re-checking. The ordering that
was measured is real but belongs to `gen-docs-pages` → `docs:harness`, and
neither is in this chain. A true fact about one pair, asserted about another.

### The scaffold half needed nothing

Zero skill files, zero templates and zero generators now carry `roles:`, so
copy-paste has nothing to propagate and `check:retired-front-matter` catches
reintroduction. Recorded rather than built.

## Summary of Changes

- `cat-harness/scripts/skill-register.ts` — the five writers, each with the
  check that proves it landed and the reason it is in the chain. Verification
  re-proves sufficiency at runtime rather than asserting coverage, so an
  under-declared list cannot report false success. Vacuity guard included.
- `skill:register` / `skill:register:check` in `package.json`.
- `skill-register.test.ts` — 14 tests, both anti-regression directions
  falsified: dropping `kg:audit` fails, re-adding `docs:harness` fails with a
  message saying to measure rather than remember.
- `AGENTS.md` — the pointer, with the warning not to re-derive through `gates`.
- Idempotent: run on a clean tree, zero generated files change.


## The command gains flags, a QA sidecar, and tests — 2026-09-26

`skill:register` was a runner that printed. It now records.

| flag | what it does |
|---|---|
| `--help` | the chain and the flags, without running anything |
| `--check` | verify only, never regenerate (wired as `skill:register:check`) |
| `--dry-run` | list the chain and write a report saying nothing ran |
| `--json` | the verdicts as JSON |
| `--no-report` | skip the sidecar |

### The sidecar, and the one invariant it exists for

`cat-harness/test/results/skill-register.qa-results.json`, family
`registration-chain`, one entry per step carrying `verify`, `because`, `ran` and
— only when `ran` — `current`.

**`ran` is emitted on every entry, including when it is `false`.** That is the
whole point rather than a detail. A printed verdict scrolls away, which makes
*"never verified"* and *"verified clean"* the same observation — the confusion
this repository builds sidecars to prevent, and the confusion a report that
omitted `ran` would reproduce *inside* the sidecar. `--dry-run` is the case that
tempts the omission, so it is the case with a test. Conversely `current` is
**absent** when `ran: false`: a step that did not run has no verdict, and
`current: false` would report it as measured and red.

The report is written **before** the exit branches, so a red run is recorded and
not only printed.

### A defect found and fixed in the same change

`writeReport` was first called with `process.cwd()`. `writeQaResult` composes
`<root>/test/results/`, so run from the repository root it wrote a fresh
top-level `test/results/skill-register.qa-results.json` — a directory no
instance declares and no sweep reads, which is the `dh4f` shape arriving from
the writing side. Now derived from the module's own path, as
`check-layout-norms.ts` and every sibling here already do. Pinned by a test that
asserts the composed path rather than that the file exists somewhere.

Nine tests added over the new surface (20 in the file, all green): flag
defaults, each flag alone, an unrelated argument setting nothing (`bun run`
passes its own arguments through, and a loose matcher would turn `--help` into a
silent `--check`), the report's location, the `ran` invariant over the real
`STEPS`, and a red verdict reaching the file.

### The CI gate is NOT here, and that is measured rather than deferred

I wired `skill:register:check` into `code-quality-gates.yml` and then reverted
it, unpushed. All five of its commands are already their own steps in the same
job, all after `bun test`, so an appended step can only go red where an earlier
one already did — and GitHub Actions skips it, since no step carries
`if: always()`. It would have been a gate structurally incapable of failing
independently: the exact "looks like coverage, is not" shape the parent epic
`1xhc` is about.

The one placement that would be real — **before** `bun test`, the only unmasked
read of those five artefacts in CI — is red on arrival, because
`kg:detangle:check` is stale on `main` today. Split to **`fjwi`** with the four
options, the recommendation, and a 72h expiry, because the cost being weighed is
a collision with other sessions' open PRs rather than a technical unknown.

Also recorded on `ymsu` as its third instance: on main's latest completed run,
`bun test` failed and **steps 6–50 were all skipped** — 45 gates returning no
verdict, reported as one red.


### CORRECTION, same session: the gate IS here, as a separate job

The section above ends *"The CI gate is NOT here"* and says the only real
placement is red on arrival. **The second half was a bad measurement and the
first half is no longer true.** `kg:detangle:check` exits 0 on a clean tree
(three runs, committed sidecars identical to `HEAD`), and the whole chain runs
in **13s** leaving the tree untouched — so the gate landed:

`skill-registration-chain`, a **separate job** in `code-quality-gates.yml`, with
`Task_SkillChain` drawn beside `Task_Advisories` in
`processes/code-quality-gates.bpmn`.

Separate rather than a step, for two measured reasons. It never runs `bun test`,
so it is the only place in CI where these five artefacts are read **unmasked** —
which is the verdict the appended-step version could not produce, since all five
already run later in the `typescript` job after the writers have repaired two of
them. And a step placed in FRONT of `bun test` to get that unmasked read would
have skipped every step behind a failure: 45 gates, measured on main's run
36234052354. A separate job skips nothing and costs no wall-clock.

Details and the withdrawn premise are on `fjwi`, which resolved itself rather
than reaching the owner.


## The owner DECIDED to keep the chain job after its justification changed — 2026-09-26

Recorded because the next reader will notice the redundancy and reach for the
delete, and the argument that survives is not the one the job was built on.

**What changed.** `skill-registration-chain` was added because all six chain
checks lived in the `typescript` job behind `bun test`, which runs the kg-audit
and detangle WRITERS and repaired two artefacts before their checks read them
(`ymsu`). That made it "the only place those five are read against the tree as
checked out". Then `main` split the workflow: `bun test` is now the LAST step of
a six-step `typescript` job, and all 43 repository gates moved to a separate
`gates` job which runs all six chain checks and no tests. **They are unmasked
there.** The original justification is gone, and the 45-gate skip cascade this
bean's neighbours describe is gone with it.

**What the owner was asked, and answered.** Put as three options — keep, retire
the CI job and keep the local command, or defer — with the redundancy stated
plainly: one runner, 13s, re-running six checks CI already runs. The answer was
**keep**.

**The argument that survives**, and the only one that should be cited for it
from now on:

- ONE command (`bun run cat skill:register`) that regenerates AND verifies the chain
  together, which is what a skill author needs and what six separate CI steps
  cannot be
- a committed QA sidecar saying which steps ran, so "never verified" and
  "verified clean" stay distinguishable after the terminal scrolls
- **ONE named failure** — "the registration chain" — instead of six unrelated
  generated-file failures. That is this bean's ACTUAL complaint, in its own
  words: *"every one of those reds names a generated file rather than the skill
  they added — so the cause is invisible from the symptom."* The `gates` job
  reproduces exactly that symptom, six steps at a time.

**Not claimed:** that the job earns its runner on unmasking. It does not, any
more. Both places that said so — the BPMN documentation and the workflow comment
— were corrected in the same change rather than left to rot, because a job whose
stated reason is false is a job somebody deletes for the right reason on the
wrong evidence.

## Completed on landed evidence
Landed on main in PR #1378 (main was red: six skills landed unregistered — and registering one is a six-step chain).
