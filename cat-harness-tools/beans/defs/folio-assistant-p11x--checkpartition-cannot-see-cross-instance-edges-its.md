---
# folio-assistant-p11x
$schema: bean/1.0.0
title: 'check:partition cannot see cross-instance edges: its ROOT is cat-harness/, so every 0 it reports is scoped to one instance'
status: completed
type: bug
priority: normal
created_at: 2026-09-27T09:52:20Z
updated_at: 2026-10-07T17:24:00Z
parent: folio-assistant-1xhc
---

Opened 2026-09-27 because **`bf5l` asked for it and it did not exist.** That
bean's closing section says, of making the blind checks see the edge it found:
*"Making the blind checks see it is NOT done here … it wants its own bean."* A
corpus-grep across `beans/defs/` and `beans/defs/archive/` found no such bean, so
`bf5l` completed with its follow-up unrecorded.

## What is measured

Verified directly, not carried from `bf5l`:

| evidence | value |
|---|---|
| `cat-harness/scripts/partition/instance-rules.ts:1747` | `export const ROOT = resolve(import.meta.dir, "..", "..")` — resolves to **`<checkout>/cat-harness`** |
| `:1755` | `SCAN_ROOTS = ["src","schemas","adapters","content","scripts","test","types"]`, relative to that ROOT |
| `repo-partition.ts --repo core` | **257** paths, **0** beginning `folio-assistant-core/` |
| checkout root | `folio-assistant-core/`, `folio-assistant-sci/`, `smart-base/` all **exist** and are outside the scan; `smart-kg/` does not exist |

So the five buckets assign **cat-harness's own ~1200 modules** to future repos.
Every `0 wrong-direction edges` the tool prints is scoped to one instance, and it
is silent about imports between the already-extracted siblings.

## Why that is a defect rather than a documented limitation

`bf5l` measured the discriminator and it is not theoretical. With a real
wrong-direction import in place (`cat-harness/schemas/intake.ts` importing
`folio-assistant-core`):

| check | what it reads | verdict with the sabotage in place |
|---|---|---|
| `check:instance-graph` | declarations only | ✓ no cycle |
| `check:partition` | modules bucketed by PATH RULE | **0 wrong-direction** |
| `kg:detangle` | a node's layer is its INSTANCE | **1 wrong-direction** |

`bf5l`'s own sentence: ***"three green checks did not mean the layering held."***
`zhg2` independently measures **8** real `cat-harness → folio-assistant-core`
imports invisible to `check:partition`.

## Why it matters now rather than later

`migration-plan.md:165-175` makes Phase I.1 *"resolve each wrong-direction
cross-edge"* with the gate *"the list is empty or every survivor has a written
reason"*, and I.1b puts `check:partition --strict` in CI so *"a new edge fails the
PR that introduces it"*. `repo-partition.ts:170-197` records both axes at zero
and enforced, and treats that as I.1 discharged.

**A gate that cannot see the cross-instance axis discharges I.1 for one instance
and reports it as done.** That is `1xhc`'s thesis exactly — *a gate that does not
fire is indistinguishable from one that passed* — which is why this is parented
there rather than under `vke6`, even though the work is partition-shaped.

It also means a reader of any PR citing `wrong-direction: 0` gets an
over-broad claim unless the PR says which scope. That happened on #1465 and was
corrected there by comment; the fix belongs here, not in per-PR prose.

## Options, none chosen — this is the owner's call

1. **Widen `SCAN_ROOTS`/`ROOT` to the checkout.** Directly addresses it. Cost: the
   partition then classifies ~17 instances' modules, and `instance-rules.ts`'s
   path rules are written against cat-harness-relative paths — most would need a
   prefix dimension. Risk: a large reclassification, and `--strict` in CI would
   start failing on `zhg2`'s 8 known imports, which are not yet triaged.
2. **Leave `check:partition` instance-scoped and make `kg:detangle` the
   cross-instance gate**, since it already sees the axis (it is the one check
   that caught `bf5l`'s sabotage). Cost: near zero in code; it is a statement
   about which check owns which question, plus wiring `kg:detangle`'s
   wrong-direction count into CI as blocking.
3. **Name the scope in the output.** Cheapest, and not a fix: print
   `wrong-direction edges (scope: cat-harness/)`. Stops the over-broad read
   without making anything visible.

**Not established:** whether `zhg2`'s 8 are all real or partly artefacts of its
own widened detector — its PR #1222 is delivered, green and **not merged**, with
343 findings still `PENDING`. Any of the three options above should be measured
against a triaged set, not against 8 untriaged hits.

**Default if nothing is done:** `check:partition` keeps reporting 0, Phase I.1
stays discharged on one instance's evidence, and the next PR to cite the number
repeats the over-broad claim.

_2026-09-30T11:01:23Z_ — Claimed by worktree-agent-a7a16afc216992bbf — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## RULED — Option 2, owner, 2026-09-30. Implemented in PR #1580 / issue #1578.

> Leave `check:partition` instance-scoped and make `kg:detangle` the
> cross-instance gate, since it already sees the axis.

### The shape, and why it is a second gate rather than a third flag

`--gate-direction` on `kg-detangle.ts`, `kg:detangle:direction` in
`package.json`, and a **separate CI step** from `kg:detangle:check`.

The constraint that was easiest to get wrong: the existing step's comment
records a ruling that the detangle measurements are **pinned, not graded** — it
fails on a stale or orphaned sidecar, never on a number, *"because the carve is
an adjudication a person makes"*. Making that step grade its numbers would have
overridden a recorded ruling in service of a different one. So:

| step | grades | fails on |
|---|---|---|
| `kg:detangle:check` (unchanged) | nothing | a stale or orphaned sidecar |
| `kg:detangle:direction` (new) | one number | a wrong-direction edge across a declared instance boundary |

The split is not stylistic. A module's **bucket** is taste; an import pointing
at an instance that declares a dependency on you is a **contradiction between
two `<instance>.json` files**, and no adjudication makes it consistent.

### Falsified before shipping

`bf5l`'s sabotage planted in `cat-harness/schemas/intake.ts`, measured
2026-09-30 on the branch:

| check | verdict with the sabotage in place |
|---|---|
| `check:partition` | **0** wrong-direction, exit 0 |
| `kg:detangle:direction` | **1** wrong-direction, exit 1 |

Reproduces `bf5l`'s discriminator exactly. Removed; tree clean; gate back to 0.

### `zhg2`'s 8 — remeasured, and the honest answer is a blind spot rather than a count

This bean carried *"`zhg2` independently measures 8 real `cat-harness →
folio-assistant-core` imports invisible to `check:partition`."* Measured today
(`grep` over `import`/`require` lines under `cat-harness/`): **2 remain**, both
onto `folio-assistant-core/schemas/dublin-core.js` —
`cat-harness/adapters/document/intake-records.ts` and its `.test.ts` sibling.
(`cat-harness/schemas/glossary-graph-kind.ts` matches only in prose, where its
docblock states the rule it is obeying.)

**The new gate does not see those 2, and that is a finding, not something to
tune away.** `kg-detangle.ts`'s `SCAN` lists `cat-harness/schemas` but not
`cat-harness/adapters`, so the axis is only as wide as that list. It catches
`bf5l`'s sabotage because that one is in `schemas/`. The gate now **prints its
scan targets and states that an import from an unlisted directory is real and
invisible to it** — so the count cannot be read as covering what it does not
reach. Widening `SCAN` is a separate decision with its own reclassification
cost and is NOT taken here.

### The denominator, and bean `cjvs`

Took `cjvs`'s Done-when 2 — *"`kg:detangle` says whether its wrong-direction
count is over all edges or only the resolving ones. Today a reader cannot
tell."* It matters more once the count BLOCKS: a gate whose denominator
silently drops unresolved edges can pass because an edge failed to resolve
rather than because the layering held, which is `1xhc` arriving through the
back door of its own remedy. The gate now states the denominator, the excluded
dangling count and its breakdown, reported and never graded.

Remeasured on the branch, since `main` has moved since `cjvs` was written:

| | `cjvs`, 2026-09-26 | 2026-09-30 |
|---|---:|---:|
| nodes | 697 | **718** |
| edges | 2828 | **3015** |
| dangling | 190 | **198** |
| — `ts-import` | 137 | **145** |
| — `md-link` | 28 | **28** |
| — `bpmn-skill` | 25 | **25** |

`cjvs`'s other two boxes are deliberately untouched.

### Borrowed defect — `ymsu`, accepted rather than fixed

The owner accepted in writing that Option 2 concentrates this axis onto a
script carrying the `ymsu` write-into-tree defect, and chose it over the "fix
`ymsu` first" variant. **`ymsu` is not fixed here** and still reaches
`kg:detangle:check` in the step above.

One narrowing, checkable rather than hopeful: `ymsu`'s mechanism is `bun test`
repairing a **sidecar** that a later gate then compares against itself.
`--gate-direction` reads no committed file and writes none — it recomputes the
classification from the corpus each run — so that masking cannot reach it. The
flag also suppresses the sidecar write, so the gate cannot mutate its own
subject.

### Option 3's substance came along, and why that is not option-shopping

Option 3 (print the scope) was **not** the option ruled. Its substance is here
anyway because the two stopped being alternatives: Option 3 was rejected as a
fix-substitute — *"stops the over-broad read without making anything visible"* —
and under Option 2 something IS visible, so the same print line stops standing
in for a fix and becomes the pointer to one. It goes further than Option 3
asked: it names the check that owns the other question, because a reader who
knows a number is incomplete and cannot find its complement is barely better off
than one who never doubted it. Derived from `ROOT`/`SCAN_ROOTS`, never spelled
out — a literal instance name here is the exact assumption this bean recorded as
wrong.

### Corrected, because a `0` was being read as discharging Phase I.1

- `cat-harness/docs/architecture/migration-plan.md` — I.1's gate was **one**
  check and is now two, I.1a (within-instance) and I.1b (cross-instance), with
  why they are not each other's second opinion. §0.2 now states its scope.
- `cat-harness/docs/architecture/current-state.md` — *"Every module is
  classified, so this is a complete count rather than a floor"* is complete
  **over one instance**; corrected in place rather than deleted, since the
  table is still the within-instance worklist.
- `cat-harness/scripts/repo-partition.ts` — header docblock, the report's own
  output, the failure message, and the "both axes are now zero and both are
  enforced" enforcement comment that was the sentence being over-read.
- `skills/kg/graph-management/kg-separation.md` — the signal table listed
  `kg:detangle:check` under "wrong-direction edges", which was itself part of
  the confusion: that script grades staleness, not direction. Split into three
  rows.
- `skills/kg/graph-management/graph-detanglement.md` — the graded/pinned line,
  what the gate refuses to grade and why.

### The gate's own coverage, measured and printed — 3 of 19 instances

The `0` above is not a verdict over the checkout. `kg-detangle.ts`'s `SCAN` is
a list of directories, and the graph reaches only the instances those
directories sit in. **Measured 2026-09-30: 3 of the checkout's 19 declared
instances contribute nodes.** The gate now prints that ratio and NAMES the 16
it does not reach, derived from the checkout so one added tomorrow appears
without an edit here.

That was found by a concrete case rather than by inspection.
**`cat-harness/` imports from `bootstrap-tools/`, an instance it does not
declare needing**, and nothing sees it:

| | |
|---|---|
| `cat-harness.json` | `needs: ["bootstrap"]` |
| `bootstrap-tools.json` | `needs: ["bootstrap"]` — a **sibling**, not an ancestor |

`allowedFromNeeds` gives `cat-harness` the set `{cat-harness, bootstrap}`, and
`DirectionPermit` exists in `layer-direction.ts` but **no `permits` entry is
declared anywhere in the repository**. So by the declared rule these are
wrong-direction edges.

Measured here independently, and my numbers refine rather than contradict the
20 reported:

| measurement | value |
|---|---|
| import statements naming `bootstrap-tools/` under `cat-harness/` | **20** |
| files carrying them | 24 — **10** under `cat-harness/schemas` (in `SCAN`), **13** under `scripts`, **1** under `content` (not in `SCAN`) |
| how many reach `kg:detangle` at all | **6**, and only as **dangling refs** |
| `check:partition` verdict | 0 — its `ROOT` is `cat-harness/`, which is this bean |
| `check:instance-graph` verdict | ✓ — it judges declarations, never imports |

**Why the blocking gate cannot catch them however blocking it is made**, and
the two halves fail differently:

- an importer **outside** `SCAN` is not a node, so its edges are never
  extracted and appear **nowhere**, not even as dangling;
- an importer **inside** `SCAN` reaching a target outside it produces a
  **dangling** ref, which the edge denominator already excludes.

That is `bf5l`'s three-green-checks table with a fourth row.

**NOT FIXED HERE, and deliberately not fixed by adding `bootstrap-tools` to
`SCAN`** — that would add nodes and edges to a set of pinned adjudications
mid-flight, the same reason the extractor was left alone. Whether
`cat-harness` should declare `bootstrap-tools` among its `needs`, or
`bootstrap-tools` should fold into `bootstrap` for this purpose, is a
declaration ruling for the owner. Bean `xsqm` moved that code out and the
`needs` was very likely not updated with it. Filed separately.

What this bean's change does about it is refuse to let the omission read as
clean: **not "clean", NOT MEASURED**, named instance by instance.

#### Context for whoever rules on the `bootstrap-tools` declaration

Found while measuring the above; **recorded, not acted on**, because the answer
is a declaration ruling. The history explains the mismatch and narrows the
question.

`bootstrap-tools/` was **retired** by bean `319n` (2026-09-24, *"Zod is in
cat-harness: move bootstrap-tools' schemas, retire the instance"*) and then
**re-created as a sibling instance** by bean `xsqm` (2026-09-29). Its own
declaration says why:

> Re-created 2026-09-29 … after bean `319n` had folded it into cat-harness:
> across two repositories, Zod in cat-harness would make a bootstrap release
> depend on cat-harness, which depends on bootstrap. A SIBLING, never nested in
> bootstrap … It depends on bootstrap and on nothing above it —
> `check:tools-closure` fails on any import that leaves it.

So the **architectural** direction is not in dispute: `bootstrap-tools` sits
below `cat-harness` and imports nothing above itself, and `check:tools-closure`
is a real gate (`package.json:301`, wired at `code-quality-gates.yml:1007`)
enforcing that half. What is missing is the **other** half: nothing says
`cat-harness` may reach *into* it, and `cat-harness.json` still declares
`needs: ["bootstrap"]` — the value it had while the code was still inside it.

That makes the likely resolution the cheap one — `cat-harness` declares
`needs: ["bootstrap", "bootstrap-tools"]` — rather than a code move. But it IS
a ruling: `allowedFromNeeds` is what every direction verdict in the repository
is computed from, so widening it is a statement about the layer graph, not a
lint fix. **Left for the owner.**

Worth noting for whoever takes it: `check:tools-closure` guards imports
*leaving* `bootstrap-tools`, and this bean's gate guards edges between scanned
instances. Neither guards `cat-harness → bootstrap-tools`, which is how 20
imports sit between two gates that each look like they would have caught them.

## Completed on landed evidence
Landed on main in PR #1580 (Option 2: check:partition scoped to cat-harness/ and detangle cross-instance edge check added).
