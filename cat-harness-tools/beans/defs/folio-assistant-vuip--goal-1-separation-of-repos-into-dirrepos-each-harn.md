---
# folio-assistant-vuip
$schema: bean/1.0.0
title: 'GOAL 1: separation of repos into dir/repos, each harness instantiation with config and initiation steps skilled, tooled and tested'
status: in-progress
type: milestone
priority: high
created_at: 2026-09-20T18:47:55Z
updated_at: 2026-11-15T18:56:00Z
---

The owner's words, 2026-09-20 (session_017PqeiS4JYySSWGAYLedmus), kept verbatim
because a goal paraphrased by an agent is a different goal:

> get to separtion of repos into dir/repos with each harness instiatiatin w/
> config and initation steps skilled, tooled, and tested (readme, creation of
> directories, active vs static content -- beans todos fsh-guts,etc.)

Created on the owner's ruling for bean `wqht`: *"wqht - milesotne"*. Until
now the three goals existed only as chat text, so every review reclassified
140 open items by hand. This is where goal 1 lives.

## Epics under this milestone

| epic | why |
|---|---|
| `vke6` | SPLIT (#223) — cutting the repo into layers that can depend on each other, which is the goal's first clause |

## Named in the goal, and where each lives

- **config and initiation steps** — `b5f0` (what it means to instantiate),
  `zkgs` (the per-instance config filename), `wwi6` (uploads/ and library/ at
  initiation), `lv3j` (a BPMN precondition for initialize-harness)
- **README** — `b963` fixed the cold-start path the entry documents named;
  `bootstrap/README.md` is the cold reader's entry point
- **creation of directories** — `rday` (a declaration adds and overrides, it
  does not withdraw), `wwi6`
- **active vs static content** — the `holds: content | context | state` axis,
  and `hqku`'s open question about `library/`. `b5f0` §5 argues the missing
  axis is `derived` rather than `dynamic`
- **beans, todos, fsh-guts** — `x89g` (beans/ as a real graph), `c4rz`
  (the todos graph), `t0i3` (fsh-guts as a declared non-renderable graph)

## Deliberately NOT parented here

`zzmr` (KG structure) and `1xhc` (CI reliability) both carry work this goal
needs and work two other goals need. Assigning them here would claim a
breadth they do not have. Listed rather than parented, which is the honest
state until the owner says otherwise.

## Status, measured 2026-09-20

`zlmp` — the gate `vke6` names for the whole cut — is at **0
wrong-direction edges**, re-measured on main at `4cdd77d7d8` with 0
unassigned modules. The critical path is now `wggr` (invert the stub
pattern for the workflow files, `skills/` and `schemas/`), then
`b5f0`, then `zmdo` (fork twice and prove an empty-repo bootstrap).

**`zkgs` withdrawn from the path, 2026-09-25.** It sat beside `b5f0` as a
joint second step and has been `completed` (and archived) since. Withdrawn
rather than deleted, because a reader who remembers the old chain needs to
find out what happened to the step rather than notice it is simply gone —
the same reason `p5wm` keeps a withdrawal table. `wggr`, `b5f0` and `zmdo`
were each re-checked against the store in the same pass and are all still
open, so the rest of the chain stands.

## Box 3 closes — re-derived 2026-09-26, and it was held open by a criterion it does not state

The 2026-09-21 row called this *"substantially satisfied"*, which is not a
measurement — and the word was doing real work: it hid that the three things
the box **asks for** were all present, while a **fourth** thing it does not ask
for was not.

Each criterion checked by pointing at the artefact, five days and several
thousand commits later:

| criterion | artefact, verified present |
|---|---|
| a skill that governs them | `cat-harness/skills/conduct/conduct-core/getting-started.md`, with `cat-harness/processes/getting-started.bpmn` |
| a Tool node that performs them | `folio_init`, registered at `cat-harness/src/tools/folio-init.ts:59` — registration checked, not just the file's existence |
| a test that fails when they do not run | `cat-harness/scripts/tests/init-folio.test.ts` — **30 tests, 0 fail, 235 assertions** |

### The test is not vacuous, which is the only part worth arguing

*"every file the layout needs, and no subject matter"* asserts against a
**hardcoded list of 16 paths**, and checks each one twice: against the
scaffolder's own reported `created` set **and** against the filesystem. So it
fails if initiation stops writing any of them.

That check mattered: this repository has already shipped a test whose
membership condition WAS its assertion (`declared-paths.test.ts`, replaced with
committed witnesses). A test over a list derived from what the code just did
cannot fail. This one is not that shape.

### The fourth criterion, and why it does not hold the box

The 2026-09-21 record's real reservation was *"any single assertion BINDING the
three"* — that the process should name the Tool performing it. **The box does
not ask for that.** It asks for three artefacts and they exist.

The binding is still not expressible: there is **no `tool` element** in the
BPMN extension vocabulary today, re-checked. So that observation stands.

**But the reason given for it does not.** The record argued the vocabulary was
closed — *"an activity carries `<folio:skill ref>` and `<folio:bean op>` and
nothing else"* — and that adding `folio:tool` would be inventing a term on a
test's say-so. Measured today, the vocabulary carries **thirteen** element
kinds across `bootstrap.processes:` and `cat-harness.processes:`:

    skill 572   role 194   bean 86   policy 61   no 24   adjudication 24
    judgement 11   fulfilment 11   raci 10   decision 10   log 6
    precondition 4   convention 2

The prefixes also changed (`folio:` → two namespaced vocabularies, bean `12s9`),
so the record is stale in spelling as well as in substance. And `precondition`
is the direct counter-example: it is a term `lv3j` asked for and that was
subsequently added. **This repository does extend its BPMN vocabulary when a
relation is real** — so "we do not add terms" is not why a tool binding is
absent. Whether one is wanted is still a live design question for
`bpmn-processes`, and it is still not this box's to answer.

### A near-miss worth recording, because it was mine

My first enumeration reported **zero** `bean` elements and I was about to file a
regression: AGENTS.md and `bpmn-processes` both require one where an activity
touches the work plan. The count was wrong — my character class allowed
`[A-Za-z0-9._]` in a namespace prefix, and `cat-harness` **contains a hyphen**,
so `<cat-harness.processes:bean>` never matched while
`<bootstrap.processes:skill>` did. There are 86. The instrument was broken in a
way that produced a clean, plausible, alarming number — the same shape this
goal's sibling bean `k59d` is about, one layer down.

**GOAL 1 now has ONE open box**: a new empty repository bootstrapping an
instance, then waiting on `zmdo` (`todo` at the time; proven and completed 2026-10-04 — see §"The last box: evidence for the owner").

## Box 2 — the owner's ruling, 2026-09-25

The re-measurement below left box 2 with a question the store could not answer:
the box and `check:instance-config` disagreed about whether an instance with no
config is a shortfall. Put to the owner as a selectable decision; the ruling,
kept as chosen:

> **Every config that exists is correct** — "the box means: any config present
> sits at its instantiation root and is named for its instance."

So the box asks about **naming and location, not coverage**, and an instance
with no config is not outstanding work. That is exactly what the gate already
enforces and reports green:

```
✓ every config is named after its instance, and no retired name survives
```

**Box 2 is therefore ticked**, on the gate's evidence rather than on this
bean's say-so — re-derivable at any time by running it, which is the standard
`bean-coordination` asks for when a box is closed.

The rejected reading is recorded because it changes more than this bean: had
the box meant *every instance must carry one*, 10 of 16 would be outstanding
AND `check:instance-config` would have to start failing on a state it currently
prints as legitimate. Nothing needs to change in the gate.

**GOAL 1 now has two open boxes, not three**, and box 1 is still blocked on
`zmdo`. Box 3 is NOT ticked here: the 2026-09-21 row calls it "substantially
satisfied", which is not a measurement, and nobody has re-derived it. That is
the next thing this milestone needs, and it is agent work rather than an owner
decision.

## RE-MEASURED 2026-09-25 — box 2, in the filename that now exists

The 2026-09-21 row below reads *"12 instances declare `harness.json`; **one**
has a `*.config.json`, and 11 have none"*. **`harness.json` no longer exists
anywhere in this repository** — the declaration moved to `<name>.json` beside
a `<name>.config.json` — so that row is a measurement in a vocabulary the tree
has dropped, and its arithmetic cannot be re-derived to agree or disagree.

Re-measured by running the repo's own gate rather than by counting files,
because the gate is what decides the box:

```
bun run cat check:instance-config
  → 16 instance(s) declared; 6 configs written; 10 declared with no config
  → "(· = declared but no config written; a legitimate state.)"
  → ✓ every config is named after its instance, and no retired name survives
```

So the box's premise has changed rather than its answer improving: **an
instance with no config is not a deficiency** by the gate's own verdict, and
"11 have none" was counting a legitimate state as a shortfall. What the box
still needs is a decision about what it is asking — *every instance carries a
config*, which the gate contradicts, or *every config that exists is at its
instantiation root and named for it*, which is green today. That is the
owner's to settle; it is not re-derivable from the store.

**Not touched:** the `zmdo` blocker on box 1, which was re-checked and still
holds — `zmdo` is `todo`.

## MEASURED, 2026-09-21 — where Goal 1 actually stands, and what blocks each box

Nobody had measured this goal's boxes; they were being carried as intentions.
Measured on `a11eeb39`:

| box | state |
|---|---|
| a new empty repo can bootstrap an instance | **blocked** — `zmdo` says the forks must not start before both layers reach MVP, because a fork taken mid-partition inherits the unfinished classification |
| each instantiation declares its config in one file at its own root | **not yet** — 12 instances declare `harness.json`; **one** has a `*.config.json`, and 11 have none |
| the initiation steps are skilled, tooled and tested | **substantially satisfied** — see below; the first reading of this was wrong |

### A wrong premise, checked and dropped rather than built on

The 11-of-12 number looked at first like the `dh4f` shape — a config resolving
from the wrong root. **It is not.** `resolveHarnessConfigPath` walks from the
instance root **OUTWARD**, deliberately, and says so:

> then each ancestor, because a checkout holding several instances tracks them
> at its own root, **which is the whole point of naming the file after the
> instance**.

So `cat-harness.config.json` sitting at the CHECKOUT root is the designed
placement for a multi-instance checkout, not a misplacement. And
`expectedInstanceConfigPath` returns the found path when there is one and the
instance-root location otherwise — which is the whole of the asymmetry that
looked wrong.

The 11 without a config are not misconfigured either: a config declares
`contentType` and `dependencies`, and a sub-instance that has never been
independently instantiated has neither to declare. **"Not yet" rather than
"broken"**, and it resolves when the split does.

### Box 3: all three parts exist, and my first answer was wrong

I first recorded *"the governing skill is the open half"*. **That was wrong**,
and the mistake is worth naming because it is the same one three other beans
paid for tonight: I searched `skills/folio-core/` for a FILENAME matching
`init|bootstrap` instead of reading what the skills DO.

| part | what it is |
|---|---|
| a skill that governs them | **`getting-started.md`** — *"Use whenever a user asks to create, start, set up, or initialise a folio"* — with a BPMN process, `processes/getting-started.bpmn` |
| a Tool node that performs them | **`folio_init`**, registered in `src/tools/folio-init.ts` |
| a test | **`init-folio.test.ts`**, and `workflow-roles.test.ts` loads the BPMN |

What is absent is any single assertion BINDING the three. Before calling that
a gap I checked whether the model can even express it: **`folio:tool` does not
exist in this repository's BPMN vocabulary.** An activity carries
`<folio:skill ref>` and `<folio:bean op>` and nothing else, so "the process
names the Tool that performs it" is not a link that has gone missing — it is a
relation this repository does not model.

Inventing `folio:tool` to close a box would be adding a vocabulary term on a
test's say-so, which is the wrong direction. Recorded as a design question for
whoever owns `bpmn-processes`, not taken here.

### So there is no actionable slice here, and that is the finding

Every box waits on the same thing `zmdo` names. Recording it so the next
session reads a measurement instead of re-deriving one — and so "is Goal 1
done?" has an answer with a named blocker rather than a shrug.

## Done when

- [ ] A new, empty repository can say "bootstrap a litlfred/folio-assistant
      here" and get a working instance — `zmdo`'s acceptance test, and the
      goal's own falsifier
- [x] Each instantiation declares its config in one file at its own root —
      **settled by the owner 2026-09-25**, see §"Box 2 — the owner's ruling"
- [x] The initiation steps are skilled, tooled and tested: a skill that
      governs them, a Tool node that performs them, and a test that fails
      when they do not run — **re-derived 2026-09-26**, see §"Box 3 closes"

## The last box: evidence for the owner, 2026-10-04

`zmdo`'s acceptance test — the falsifier named in box 1 — ran and passed, in real empty repositories on GitHub Actions against folio-assistant@8ea9e47:

- `cat-harness` alone → [litlfred/cat-harness-test run 37206112987](https://github.com/litlfred/cat-harness-test/actions/runs/37206112987): instance-init, declaration resolves, skills readable, beans usable, MCP serves 23 tools.
- `folio-assistant-core` alone → [litlfred/folio-test `zmdo-proof` run 37206115053](https://github.com/litlfred/folio-test/actions/runs/37206115053): a document folio, MCP serves 45 tools, it renders.

**The box is left unticked on purpose.** A goal is the owner's to call met, and the proof differs from the box's wording in one way the owner should weigh: the platform reaches the empty repository as a sparse checkout of `litlfred/folio-assistant` holding only the layer and its `needs`, because the layer repositories themselves (`litlfred/cat-harness`, `litlfred/folio-assistant-core`) are empty — seeding them is `smbc`. Recorded by session https://claude.ai/code/session_01Ga3HjmX3ag9vTgZWDSmsFi.

## State 2026-10-09 — box 1 is the owner's call
The precondition the 2026-10-04 proof differed on is now gone: the layer repositories are no longer empty. litlfred/cat-harness, cat-harness-tools, folio-assistant-core and the rest are seeded, and this repository is an index checkout that remote-mounts all 11 of them (`index.config.json`, `index.lock.json`). `init-folio` writes an `index.config.json` for a new folio (`init-folio.ts:1373`).
**What is not measured:** the `zmdo` acceptance test re-run against the *seeded repositories* rather than a sparse checkout of folio-assistant. I did not run it (it needs an empty GitHub repository and Actions). Options for the owner:
1. **Re-run the proof against the live repositories** (agent work; a new empty repo bootstraps from litlfred/cat-harness + cat-harness-tools, and from folio-assistant-core) and tick box 1 on that run. Recommended: it is what the box says.
2. **Accept the 2026-10-04 proof plus today's cutover as meeting the box** and close the milestone.
If nothing is said, the box stays open and option 1 is the next agent task. Children: `7x5n`, `iirv`, `vke6`, `whlc` remain open (`7x5n` and `iirv` carry 2026-10-09 notes). Session https://claude.ai/code/session_017QXvm7c7RDYFguWzSxhrMb.

---

_2026-11-15T18:56:00Z_ — Child status audit (session https://claude.ai/code/session_01E667391F74184786BF4B9D):
- All four children still open on 2026-10-09 (`7x5n`, `iirv`, `vke6`, `whlc`), together with `zmdo`, `wggr`, `b5f0`, `uhkv`, `zzmr`, and `f6gq`, are now **`completed`** on `main` across `cat-harness` and `cat-harness-tools`.
- The only open child under `folio-assistant-vuip` is `folio-assistant-pga6` (`Separation Phase III: L4/L5 Content, Tool and Test repos on the harness, plus current and future architecture write-up`, `status: todo` in `cat-harness`), which is deferred until after the MVP freeze per owner card Q-SEP-1 A (`2026-11-01`). Box 1 of this milestone remains unticked for the owner's call.
