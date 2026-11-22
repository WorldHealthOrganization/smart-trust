---
# folio-assistant-bjzs
$schema: bean/1.0.0
title: 'PER-INSTANCE GATES: kg:audit, render:bpmn and check:workflow-refs run at the root only, so 15 nested instances are counted and none is audited'
status: completed
type: task
priority: normal
created_at: 2026-09-26T04:14:07Z
updated_at: 2026-10-16T06:30:00Z
parent: folio-assistant-d308
---

Split out of `sa8y` 2026-09-26. It was `sa8y`'s last genuinely open item and the
only one of its four; the other three are done and `sa8y` closed on the wording
fix that is its actual subject. It gets its own bean because it is a different
subject — `sa8y` is about a finding's **wording**, this is about a gate's
**range** — and because a wording bean carrying an infrastructure item is how
`sa8y` came to hold three lists that disagreed with each other.

## The gap, measured 2026-09-26

`kg:audit` runs once, from `cat-harness/`. Every other instance declares its own
graph, and the root deliberately does not read it —
`scripts/tests/instance-graph-isolation.test.ts` guards exactly that, after a
live defect on 2026-09-19 where `findBpmnDirs` walked the filesystem and
`_kg/folio-assistant.jsonld` carried **88** references to
`Process_InitializeHarness`.

So the isolation is correct and the silence is now REPORTED, as the
`nested-instance-audited` criterion (`minor`). From
`test/results/kg-qa/scenarios/kg.kg-qa.json`, this run:

| declaration | diagrams this run did not read |
|---|---|
| `bootstrap/bootstrap.json` | 3 |
| `folio-assistant-core/folio-assistant-core.json` | 1 |
| `smart-base/smart-base.json` | 1 |
| the other 12 declarations | 0 each |

**15 nested instances, 5 unread diagrams.** Read the sidecar for these figures,
never this table — `sa8y` quoted `(2)` in prose and the number was 15 by the
time anyone read it back, which is the rule about counts in prose earning
another instance.

## Why a report is not the fix

The criterion makes the gap **visible**; it does not close it. What is still
true of every nested instance:

- `kg:audit` writes it no sidecar, so "never audited" and "audited clean" are
  indistinguishable for its nodes — the exact argument `kg:audit` makes for
  being a committed sidecar rather than a console report, unapplied one level
  out.
- `translate-bpmn` — note this one **already** walks dependents' diagrams
  (69 of them, per bean `nafz`), so the gates do not even agree with each other
  about what "this corpus" means.
- `render:bpmn` never lists a nested diagram, so a process can execute and have
  no picture. `bootstrap`'s three were in that state until `sa8y` added the
  `BPMNDiagram` by hand.
- `check:workflow-refs` likewise.

`audit:coverage` is the report that would grade this, and it grades what the
root declares.

## What the fix has to get right

**Not by declaring the nested directories at the root.** That is the wrong fix
`sa8y` made and a test caught, and the `nested-instance-audited` detail string
warns against it in so many words. The shape is: run the gate **with each
declared instance as root**, and write each run's sidecars under that
instance's own results directory — so an instance's audit is an artefact OF
that instance, the same way its glossary is.

Two things to settle before writing it, and neither is the owner's judgement:

1. **`kgRoots(root)[0]` is read as "the root's graph"** while overlay order is
   deepest-dependency-first — `resolveSkillDirs` says so on itself. A per-instance
   loop must not quietly change which element that is.
2. **Which instances are in range.** `bootstrap` is nested and `smart-base` is a
   dependency; both are declarations, and a loop over all 15 audits `todos/` and
   `beans/` too, which hold no diagrams at all. Whether zero-diagram instances
   get an empty sidecar or no sidecar is the `dh4f` question — an empty sidecar
   says "looked, found nothing", no sidecar says nothing.

## Done when

- [ ] each declared instance is audited from its OWN root, with its sidecars
      under its own results directory
- [ ] `instance-graph-isolation.test.ts` still passes — the loop must not merge
      graphs, and a mutation that merges them must fail it
- [ ] a zero-diagram instance's state is determined rather than absent, per `dh4f`
- [ ] `render:bpmn` and `check:workflow-refs` reach a nested diagram, or their
      not reaching it is a reported state rather than silence
- [ ] `nested-instance-audited` stops firing for an instance that IS audited, and
      still fires for one that is not — falsified by mutation, not by inspection

---

## CORRECTED 2026-09-26 — this bean was wrong about two of its three gates

I wrote this bean from `nested-instance-audited`'s finding text without opening
the three gates it names. Measured on `origin/main`:

| gate | this bean claimed | measured |
|---|---|---|
| `check:workflow-refs` | root-only | **already per-instance** — `INSTANCES = [INSTANCE_ROOT, …"bootstrap"]` since 2026-09-19, with a docblock arguing exactly why |
| `render:bpmn` | *"never lists a nested diagram"* | reaches `folio-assistant-core` and `smart-base`; **only bootstrap's 3 are missed** |
| `kg:audit` | root-only | true — `root` is a module constant, referenced **76** times across 2344 lines, plus 9 derived `*_DIR` constants |

So "15 nested instances, 5 unread diagrams" was two facts glued together: 15 is
the count of declarations, but **2 of the 5 diagrams were being read the whole
time**. The gap is `bootstrap` alone, and the reason is specific — the root
declares `bootstrap/skills/` and not `bootstrap/processes/`, which is `pve3`'s
"declares HALF of bootstrap", and declaring the other half is the wrong fix
established twice (`sa8y`, and the leak `instance-graph-isolation.test.ts`
guards).

### And `check:workflow-refs` was auditing a TYPO, which is the real find

`join(INSTANCE_ROOT, "bootstrap")` — `INSTANCE_ROOT` is `cat-harness/` and
`bootstrap/` is at the REPOSITORY root. So the second instance resolved to
`cat-harness/bootstrap`, **which has never existed**. `workflowFiles` returned
`[]`, the loop ran over nothing, and the summary printed *"2 instances"* beside
the root's own count:

    before   273 skills known across 2 instances, 71 diagrams
    after    303 skills known across 2 instances, 74 diagrams

For over a year the checker believed it was auditing **the first process a new
instance runs** and was auditing a path that is not there — in the gate whose own
docblock says *"a dangling ref in a diagram this checker never opens is a broken
reference reported as clean."* Exit 0 after the fix, so nothing was hiding; what
was lost was the coverage, not a finding.

**The path fix is one expression. The reason nobody noticed is the part worth
keeping**, so `emptyInstances()` now reports a listed instance that contributed
no diagram, and an ABSENT one is **fatal** — reporting without failing would
leave exactly the gate that cannot fire (`1xhc`), which is how this survived.
An instance that exists and holds no diagram stays a report, because that is a
different fact. Falsified both ways: reintroducing the original expression gives
exit 1 and names the path; restoring it gives exit 0.

## Done when — rewritten against what is actually true

- [x] `check:workflow-refs` reaches bootstrap — it did not, despite saying so
- [x] a listed instance contributing nothing is reported; an absent one fails
- [x] tests pin the property rather than the count — the expected diagram total
      is DERIVED from both instances, because a literal goes stale the day a
      diagram is added and teaches the next agent to edit the test
- [x] `render:bpmn` renders bootstrap's 3 diagrams. **And the placement was not
      a question** — I raised it as one and it was already settled: all three
      SVGs ALREADY existed in `docs/assets/img/workflows/`, referenced by
      published pages under `docs/processes/`, and the root's site already
      publishes bootstrap content (`docs/bootstrap/`,
      `docs/uml/overview/bootstrap/`). Measuring took one command; asking would
      have cost a round.

      **It was a live defect, not a gap.** All three sources last changed
      2026-09-24 and all three SVGs were from 2026-09-20 — four days stale on the
      published site, with no gate able to say so, because `render:bpmn:check`
      judged 71 diagrams and named none of bootstrap's. Now 74, and the three
      re-rendered as CHANGED, which is what proves they were stale.

      The basename-collision caveat its docstring carried as *"today there is one
      such directory, so it is not a live defect"* is now evaluated:
      `collidingBasenames` reports it and it is FATAL, because both readings are
      wrong — in `--check` it compares one source against the other's picture, and
      in a write run the later render silently overwrites the earlier. A published
      page showing the WRONG process is worse than one showing none.
- [ ] `kg:audit` audits each declared instance from its own root. **This is the
      expensive one and it is the owner's call, not an agent's**: `root` is a
      module-level constant referenced 76 times in a 2344-line file, with 9
      derived `*_DIR` constants, and it is the gate that judges the whole
      knowledge graph. `sidecarPath` composes
      `dirname(join(root, subject.path))`, so a `../` subject escapes the
      results tree entirely (`chq5`) — meaning the ONLY correct shape is running
      it with each instance as its own root, exactly as
      `kg:locale:bootstrap` already does with `--instance ./bootstrap`. The
      precedent exists; the cost is the refactor
- [ ] whether bootstrap's `processes/` should be a declared directory of the
      root is NOT this bean's to reopen — `pve3` and `sa8y` both settled that it
      must not be



--------

## 2026-09-26T12:35Z — `--instance` works, and running it EXPOSED why the loop is not yet safe

Claimed and worked. `kg-audit.ts` now takes `--instance ROOT`, spelled as
`kg-locale-export.ts` spells it. **Two of this bean's premises were wrong in my
favour and one problem it did not anticipate is the real blocker.**

### The cost estimate was wrong, and the reason is worth keeping

This bean said *"`root` × 76 across 2344 lines plus 9 derived `*_DIR` constants"*
and I banked it as the owner's on grounds of expense. Measured: **the change is one
assignment.** Everything derives from the single `const root` — the nine `*_DIR`
constants, `knownSkills(root)`, and `sidecarPath`'s
`dirname(join(root, subject.path))` — and nothing needs a *different* root
part-way through a run, so pointing that constant elsewhere moves subject
discovery and output together with no change at any other site.

Two things fell out for free:

- **`chq5` is already answered.** `kgQaSidecarPath` composes with `relative` and
  handles an escaping subject explicitly (`escaped = rel.startsWith("..")`), so the
  `../` concern is handled in the helper rather than needing an answer here.
- **The sidecars land correctly.** Measured: `--instance ./bootstrap` wrote
  `bootstrap/test/results/kg-qa/{processes,scenarios,skills}/*.kg-qa.json` — 134
  subjects, 30 skills, 4 roles — and did **not** touch the root's sidecars. An
  instance's audit as an artefact OF that instance, which is the `## Done when`
  wording.

### One real break, found and fixed

    line 1998   sha256(readFileSync(join(root, "scripts", "kg-audit.ts")))

The auditor hash resolved against the INSTANCE. For `--instance ./bootstrap` that
is `bootstrap/scripts/kg-audit.ts`, which does not exist, so the run would have
thrown before auditing anything. One constant was answering two questions; split
into `AUDITOR_ROOT` (a fact about the program) and `root` (the instance under
audit).

### THE BLOCKER, and it would have shipped as 76 false criticals

The bootstrap run reports **CRITICAL — 76 findings**, of which
`graph:kg actor-roles-resolve` is **73**. Those are false.

    ACTOR_DIR = join(repoRootFor(root), ".claude", "skills", "actors")

`repoRootFor` returns the REPOSITORY root whatever the instance, so the actor set
does not follow `--instance`. Measured: **36 repo-level actors judged against
bootstrap's 4 roles**, so almost every actor names a role bootstrap's graph does
not declare, and each becomes a critical.

And the actor set being repo-level is **correct** — AGENTS.md declares Actor in
`.claude/skills/actors/*.json` at the repository root, one set across instances,
because an actor persists across processes while a role is a swimlane inside one.
So the defect is not the path; it is that `actor-roles-resolve` compares a SHARED
actor set against ONE instance's role graph, which is only a meaningful question
at the root.

**This is the shape kg-audit.ts argues against in its own docblock** — *"a finding
nobody can act on … is a check somebody switches off"* (`readsProse`, on scoping
`role-has-persona`). A per-instance run that emits 73 unactionable criticals is
that, one level out.

### Second blocker, smaller

`bootstrap/test/` is an **undeclared directory**. The sidecars are correct and
their home is not declared in `bootstrap/bootstrap.json`, so committing them would
create a results graph no sweep reads — `dh4f` from the writing side, which is the
same defect `#1399` just fixed in `writeReport` (`process.cwd()` writing a
top-level `test/results/`).

### So what is pushed, and what is not

Pushed: the `--instance` flag, the `AUDITOR_ROOT` split, usage lines. Default
behaviour byte-identical — `kg:audit:check` exits 0 and the only sidecar change is
the manifest's own auditor hash, which necessarily moves when the auditor does.

**Not pushed: any loop, any CI wiring, and bootstrap's sidecars.** Shipping the
loop now would put 73 unactionable criticals in front of the next agent, and
committing the sidecars would declare a graph nothing reads. The output this run
produced was removed rather than left in the tree, because `audit:coverage` walks
from the repository root with no gitignore awareness (`xd1g`).

## Done when — revised against what was measured

[x] the gate can run from another declared instance's root, sidecars under that
    instance's own results directory
[x] the auditor hash survives a non-auditor root
[x] `instance-graph-isolation.test.ts` unaffected — this is a separate RUN, not a
    wider walk; no directory was declared at the root
[ ] **per-instance criteria are scoped**: a criterion whose subject is repo-level
    (`actor-roles-resolve`, and any other reading `repoRootFor`) must be `n/a` in
    an instance run rather than a finding. Needs a rule, not a patch — which
    criteria are instance-scoped is a property of each criterion
[ ] a nested instance DECLARES its results directory before its sidecars are
    committed
[ ] a zero-diagram instance's state is determined rather than absent (`dh4f`) —
    untouched, and it only becomes live once a loop exists
[ ] `nested-instance-audited` stops firing for an instance that IS audited —
    cannot be tested until the loop lands; note it still fired (15) inside the
    bootstrap run, which is itself suspect and unexamined



--------

## 2026-09-26T13:30Z — ALL 68 CRITERIA CLASSIFIED, at the owner's direction

Asked which of four shapes to use and **the owner chose classifying all 68**, over my
recommendation to declare only the one measured to misfire. Their choice was better,
and the reason is measurable: my recommendation would have caught 73 of the 76 false
criticals and left 3.

### What was added

`KgCriterionDefinition` gains **`scope: KgCriterionScope`** — `"instance" | "repo"` —
**required**, so a criterion that has not decided does not compile, the same argument
that makes `renderable` and `holds` required on a graph kind. Plus `scopeBasis`,
required for `repo` and asserted absent for `instance`.

    68 criteria   63 instance   5 repo

The five: `actor-roles-resolve`, `actor-capabilities-resolve`,
`actor-permissions-resolve`, `actor-is-not-a-role`, `nested-instance-audited`.

### The rule, and the case that proves it is the right rule

**Scope follows the SUBJECT, not the data consulted.** Reading repository-level data
is not the defect — `.claude/skills/local`, the convention refs and `git ls-files` are
all repo-wide by design and correct. The defect is comparing a repository-level SET
against an instance-level one.

`actor-kind-fits-role` is the case that tests it: `applies: ["role"]`, so its subject
is one instance's role, yet it consults the repository actor set. Classified
`instance` — and measured to produce **no** findings in the bootstrap run, because it
degrades to `n/a` when no actor declares the role. Safe per instance rather than
arguably so.

And the actor criteria all carry `applies: ["graph"]`, which is why scope **cannot**
be derived from the subject kind: the graph roll-up holds both
`skill-in-role-or-process`, which every instance answers about itself, and
`actor-roles-resolve`, which only the repository can. That killed the "derive it
mechanically" option on evidence rather than taste.

### Suppression is LOUD, which is the mitigation for the risk the owner accepted

A `repo` criterion in an instance run records **`n/a` plus a finding naming the scope
and its basis**, and the run prints a counted line:

    instance run: bootstrap — 5 `repo`-scoped criterion result(s) recorded n/a, each
    with its basis in the sidecar. 5 of 68 criteria are `repo`-scoped.

`n/a` rather than a fifth `KgResult`, because this is `applies` on another axis —
not-applicable-here, not could-not-determine — and a new state would change every
consumer. But never a SILENT `n/a`: the whole hazard of a scope field is that a wrong
`repo` reads as clean forever, so the count is a number a reader can challenge.
Applied in `report()` **before `tally()`**, so totals describe what the run judged.

### Running it caught a misclassification of mine — the same way the 73 were caught

After the scope field, bootstrap still reported **3 criticals**, all
`satisfies-resolves` citing `../.claude/skills/capabilities/*.json` — a `where` that
escapes the instance, which is the tell. Decisive check: **at the root that criterion
passes with 0 findings**, so the 3 were created by the instance run.

Fixed at the data rather than by suppressing the criterion: `readSatisfiers()` skips
repository-level `CAPABILITY_DIR` when `INSTANCE_RUN`. Suppressing
`satisfies-resolves` outright would have thrown away the instance half — a
front-matter `satisfies` inside the instance is a real question.

    bootstrap criticals   76 → 3 (scope field) → 0 (satisfier scoping)
    root run              byte-identical: pass 3051 fail 144 n/a 1477 unknown 10

### And my own test broke a sibling test

`kg-criterion-scope.test.ts` first spawned the WRITING form and deleted
`bootstrap/test/` afterwards. `bun test` runs files in parallel, so for the length of
the run bootstrap transiently held sidecars naming paths above it — and
`graph.test.ts > only the listed structural names remain` (bean `iwtn`) reads exactly
that. **Passed alone, failed in the suite**: the `ymsu` shape, a test that writes what
another test reads. Now it spawns `--check`, which writes nothing, and asserts that it
wrote nothing. Root cause removed rather than cleaned up after.

Same pollution also silently changed bootstrap's generated UML and detangle
artefacts, which reverted once regenerated over a clean tree — `xd1g` a third time in
one day, and the first time it reached files I nearly committed.

### Falsified by mutation, both directions

    actor-roles-resolve → "instance"        2 tests fail, incl. the spawned run
    suppression line made unreachable        the spawned run fails
    restored                                 5 pass

## Done when

[x] each declared instance can be audited from its OWN root, sidecars under its own
    results directory
[x] the auditor hash survives a non-auditor root
[x] `instance-graph-isolation.test.ts` unaffected — a separate RUN, not a wider walk
[x] **per-instance criteria are scoped** — all 68 classified, `repo` requires a basis,
    suppression is counted and visible, falsified by mutation
[ ] a nested instance DECLARES its results directory before its sidecars are
    committed — still open, and still the reason no loop exists
[ ] a zero-diagram instance's state is determined rather than absent (`dh4f`) — only
    becomes live once a loop exists
[ ] `nested-instance-audited` stops firing for an instance that IS audited — now
    `repo`-scoped, so it no longer fires INSIDE an instance run (which was the
    unexamined 15). Whether the ROOT's copy should stop naming an instance that has
    its own sidecar is a different question and untouched



--------

## 2026-09-26T17:00Z — the last box has a MEASURED blocker now, and it is not the one this bean named

I went to close *"a nested instance DECLARES its results directory before its
sidecars are committed"*, having wrongly banked it as the owner's. It is not the
owner's — `cat-harness.json` already carries the precedent:

    { "id": "qa", "path": "test/results/", "dependents": "reproduce",
      "graphKinds": ["qa"] }

and that entry's own description names the contents: *"`kg-qa/v1` (`kg-qa/**`, the
KG verdicts themselves — what `kg-audit` wrote)"*. Declaring the same for bootstrap
is following an established shape, not a judgement.

**The declaration still must not land, and the falsifier is what says so.**

### `iwtn` refuses the sidecars, and it is right to

`graph.test.ts > nothing in bootstrap/ names anything above it (bean iwtn)` fails on
the generated tree with **16 findings**. Not path escapes — I fixed those, and
measured `grep -rl "\.\./" bootstrap/test/results/` → **0 files**. It refuses the
NAMES:

    test/results/kg-qa/tools/cat-harness-schema.kg-qa.json
    test/results/kg-qa/tools/folio-init.kg-qa.json
    test/results/kg-qa/tools/folio-viewer.kg-qa.json
    test/results/kg-qa/tools/smart-liquid-variables.kg-qa.json
    …and a `kg.kg-qa.json` detail naming `smart-base-tools`

Those are **cat-harness's Tool nodes, audited as bootstrap's**.

### A THIRD cross-instance leak, and this one cannot be closed with a guard

Measured:

| question | answer |
|---|---|
| does `bootstrap.json` declare a `tools` directory? | **no** — its 7 ids are skills, schemas, scenarios, processes, models, swimlane-glossary, bootstrap-translations |
| does `bootstrap/tools/` exist on disk? | **no** |
| how many tool sidecars did the instance run write? | **119** |

So they do not come from `TOOLS_DIR` (which would be the absent
`bootstrap/tools/`). They come from `auditTools()` → `checkTools()`, and:

    cat-harness/scripts/check-tools.ts:297
      export function checkTools(): ToolCheck {

**It takes no root parameter at all**, and calls `knownSkills()` with no argument.
It is hardcoded to the auditor's own instance, so an instance run audits the
AUDITOR's tools and files the verdicts under the instance.

That is the same class as the two already fixed here — repo-level actors judged
against one instance's roles (73 false criticals), and repo-level capabilities
judged against one instance's requirements (3 more) — but it is **not** the same
size of fix. Those were a `scope` declaration and a one-line `INSTANCE_RUN` guard
inside this file. This one needs a root threaded through another module that has
its own gate (`check:tools`) and its own callers.

### Why it is not being done in this change

Not a reclassification. The six `tool-*` criteria are correctly `instance`: *"does
this tool resolve its paths"* is answerable per instance — **if the tool SET is the
instance's**. So the fix belongs in the data, as `readSatisfiers()`'s did, and the
data lives in `check-tools.ts`.

Stopping here rather than expanding into it is deliberate. `check-tools.ts` was last
touched 2026-09-24 and no bean names the rootless registry, so nothing is in
flight — but it is a second module with a second gate, and the falsifier firing is
the signal to record rather than to widen. Ten sibling collisions this session all
began with widening.

## Done when — the last box, restated against measurement

[ ] `checkTools()` takes an instance root, so an instance run audits THAT
    instance's tools. Falsified by: `bootstrap` writes **no** `tools/` sidecars
    (it declares no tools directory and has none), and `iwtn` goes green on the
    generated tree
[ ] THEN declare bootstrap's `qa` → `test/results/` following
    `cat-harness.json`'s entry, and commit the declaration WITH the sidecars — the
    `dh4f` rule is declare only what exists, so they arrive together or not at all
[ ] only then the loop, and the `dh4f` zero-diagram question

What is already proven, and worth not re-deriving: the bootstrap run reports **0
criticals**, 693 pass / 11 fail / 284 n/a / 7 unknown, sidecars land under the
instance's own tree, the root run stays byte-identical, and **0** files carry a
`../` escape.


## checkTools() now takes an instance root — third leak closed (2026-09-26, 19:5x)

`checkTools()` had NO root parameter; `auditTools()` therefore audited
cat-harness's Tool nodes as bootstrap's — **119** sidecars into an instance that
declares no `tools` directory.

**The fix was much smaller than the cost I banked it on.** `toolsOf(instanceRoot)`
already existed in `tools/discover.ts`, and its docblock names this exact
failure. Every caller passes no argument, so an optional parameter left the
repo-wide `check:tools` CLI and its five tests untouched. Third time this
session that "the cost is real" was the wrong reason to hand something over.

Falsified both ways, control in the same throwaway worktree:

| tree | tools/ sidecars | total | iwtn |
|---|---|---|---|
| root run, before and after | — | 547 unchanged | — |
| bootstrap, un-patched | 119 | 135 | FAILS |
| bootstrap, patched | **0** | 16 | still fails |

**The anti-vacuity floor guarding this encoded the leak.** `kg-criterion-scope`
asserted > 50 subjects, calibrated at 134 of which 119 were the leak — so fixing
the leak failed the floor meant to guard the fix. Re-based on 10 from what
bootstrap DECLARES (7 own skills + 3 diagrams), not from what a run reported.

## The last box stays OPEN — a FOURTH leak, now measured

`iwtn` narrowed from 16 findings to **2 lines naming one subject**,
`smart-base-tools` in `bootstrap/test/results/kg-qa/scenarios/kg.kg-qa.json`:

    knownSkills("./bootstrap")   30 skills, 23 of them cat-harness's
    skill-in-role-or-process     23 findings

Counts match, so this single leak explains the whole remainder. `smart-base-tools`
lives at `cat-harness/skills/authoring/authoring-who-smart-guidelines/smart-base-tools.md`
and nothing under `bootstrap/` mentions it.

It is in `knownSkills` — the canonical function with many consumers — so it is
NOT the same size as the previous three, and unlike them it may be intentional:
AGENTS.md says an instance INHERITS its dependencies' skills. Bootstrap is
cat-harness's dependency, not the reverse, so inheriting upward looks wrong, but
whether the overlay is meant to be directional is a design question rather than a
defect I should settle inside a merge.

## Done when

- [x] `checkTools()` takes an instance root; bootstrap writes **0** `tools/`
      sidecars; root run byte-identical across 547 sidecars
- [ ] the FOURTH leak: whether `knownSkills(instance)` should return only that
      instance's skills, or inherit its dependencies' — directional or not
- [ ] THEN declare bootstrap's `qa` → `test/results/`, with the sidecars in the
      same commit (`dh4f`)
- [ ] only then the loop, and the zero-diagram question


## 2026-09-27: the fourth leak closed, and the last box landed

**The fourth leak was declared, not a judgement call.** `knownSkills` read
`.claude/skills/` from `repoRootFor(root)` — the REPOSITORY — so every nested
instance inherited the repo's agent-level skills. 23 of bootstrap's 30 came from
`.claude/skills/local/`; its own are **7**.

I had banked this as the owner's on the grounds that AGENTS.md says an instance
inherits its dependencies' skills. The answer was in a field I had not opened:

    cat-harness.needs = ["bootstrap"]      bootstrap.needs = []
    _needs_comment: "So bootsteap, cat harness, fa-core, f-a, from bottom to top."

Bootstrap is the bottom layer, so it inherits nothing and the read was inheriting
UPWARD. **Fourth time "this needs a decision" was wrong where a declaration
already answered it.** The test is not size and not how architectural it feels.

Guarded on `OWN_INSTANCE`, derived from the module's own path (the device
`AUDITOR_ROOT` and `INSTANCE_ROOT` use). All 23 `local/` names also exist as
`.md` under the layer above, so the scan adds no name at root — redundant in this
corpus, kept because the deny-list exists so a new json-declared group is picked
up automatically.

| | before | after |
|---|---|---|
| bootstrap skills | 30 (23 leaked) | **7** |
| the layer above | 274 | **274 unchanged** |
| root `kg:audit` | — | exit 0, **0** changes across committed sidecars |
| `iwtn` | FAILS | **25 pass / 0 fail** |

**A SECOND site deliberately not fixed.** `skillMdDirs` discovers
`.claude/skills/<group>` from the repo root and returns RELATIVE parts, which are
joined onto the INSTANCE root — where they exist for nobody, including the layer
above. So `.claude/skills/interaction-modality/SKILL.md` is invisible to every
instance. Repairing it naively would add a skill named `SKILL`, so it is a
question about Claude-Code-format skill directories, not a path fix. Recorded.

**The last box landed**: `qa` → `test/results/` declared WITH its files.
16 generated files of TWO kinds in TWO directories — 15 `kg-qa/v1` sidecars under
`test/results/kg-qa/` (skills 7, processes 3, scenarios 5) plus one
`kg-qa-manifest/v1` at `skills/kg-qa.manifest.json`, which is OUTSIDE the declared
directory and matches the precedent's shape.

Two of my own claims were wrong en route and both are corrected in the commits:
I called the manifest pre-existing and tracked (it was never tracked), and the
`audit:coverage` comparison I first wrote keyed on a field the sidecar does not
have, so it reported "nothing moved" for all 45 rows.

And `iwtn` failed on the declaration written to satisfy it — the description named
the layer above four times. When a rule forbids naming something, the prose
EXPLAINING the rule is the likeliest place to name it.

## Done when

- [x] `check:workflow-refs` audits a path that exists (71→74 diagrams, 273→303 skills)
- [x] the render:bpmn half — resolved in main's favour (`oqdr`, #1394)
- [x] `kg:audit --instance`, all 68 criteria scoped `instance|repo` (63/5)
- [x] `checkTools()` takes an instance root — 119 phantom tool sidecars → 0
- [x] `knownSkills()` stops inheriting the repo's `.claude/` upward — 23 → 0
- [x] bootstrap declares `qa` → `test/results/`, with its files, `iwtn` green
- [ ] the loop: run the per-instance audit for the remaining declared instances
- [ ] the `dh4f` zero-diagram question — an instance that declares `processes/`
      and has none: is that `unknown` or a finding?


## 2026-09-27, box 7: the loop is NOT batchable — two blockers measured

Enumerated the declared instances: **15**, of which only 2 declare `qa`
(bootstrap, cat-harness). The other 13 have no `test/results` at all. Ran the
non-writing `--check` against all 13 before changing anything.

### Blocker 1 — a CRASH, fixed in bce18c147f

`kg:audit --instance ./large-datasets` threw instead of auditing:
`unclaimedSkillContracts` asked `instanceDirectoryForGraph` for THE `schemas`
directory, and that instance declares **two** (`schemas/` and `sources/`).
Declaring a kind twice is legal — `cat-harness.json` does it — so the accessor's
refusal is right and the caller was asking the wrong question.

Fixed with `instanceDirectoriesForGraph`, a plural sibling with the identical
`scope` filter. NOT `[0]`: that hides a directory and reports clean (`dh4f`).
large-datasets now audits — 4 subjects, 3 skills, 0 fail. Root run byte-identical.

Three tests added, and the honest note is which one matters: the two accessor
tests would NOT have caught this, because the defect was a caller picking the
singular where its question was plural and no grep finds that. The third runs
`kg:audit --instance` against such an instance. Reverting the caller makes it
fail (4 pass / 1 fail) and the fix makes it pass (5 pass).

### Blocker 2 — a FIFTH cross-instance issue, OPPOSITE polarity. Not fixed.

`folio-assistant-core` (2) and `smart-base` (11) report **critical**
`skill-ref-resolves` / `role-ref-resolves` / `raci-role-resolves` findings that
are **FALSE**:

    smart-base   Knowledge-graph audit (12 subjects, 0 skills, 0 roles)

smart-base declares no `skills` and no `scenarios` directory, so its own sets are
empty — while `Process_DIIG` references `skill ref="methodology-adoption"`,
which exists at `cat-harness/skills/process/process-core/methodology-adoption.md`.
cat-harness is smart-base's TRANSITIVE DEPENDENCY
(`smart-base → fhir-harness → folio-assistant-core → cat-harness`), so the
reference is legitimate and inherited DOWN the `needs` chain.

**The four leaks fixed so far were an instance seeing things ABOVE it. This is an
instance unable to see things BELOW it** — same axis, other direction.

Precedent for the fix exists: `satisfiableSkills` in `check-tools.ts` widens
resolution across instances while keeping coverage narrow, on the recorded ruling
*"not in my overlay is not does not exist"* (owner's `pve3`). So the direction is
arguably declared again, via `needs` — but it changes what three criteria MEAN
across every instance, so it is recorded for a decision rather than taken.

**Consequence: committing sidecars for the 13 undeclared instances now would
commit 13 sets of false criticals.** The loop waits on blocker 2.

## Done when

- [x] `check:workflow-refs` audits a path that exists
- [x] the render:bpmn half — resolved in main's favour (`oqdr`, #1394)
- [x] `kg:audit --instance`, all criteria scoped `instance|repo`
- [x] `checkTools()` takes an instance root — 119 phantom sidecars → 0
- [x] `knownSkills()` stops inheriting the repo's `.claude/` upward — 23 → 0
- [x] bootstrap declares `qa` → `test/results/`, with its files, `iwtn` green
- [x] the loop no longer CRASHES on an instance declaring a kind twice
- [ ] **resolution must follow `needs` DOWNWARD, or the 13 remaining instances
      cannot be audited without committing false criticals** — owner's call on
      whether `skill-ref-resolves`, `role-ref-resolves` and `raci-role-resolves`
      resolve against the dependency closure, as `satisfiableSkills` already does
- [ ] the `dh4f` zero-diagram question


## 2026-09-27, box 8: blocker 2 resolved — resolution follows `needs` DOWNWARD

The owner's call, asked in box 7, was given: *"how resolve?"* then *"go"*. Both
halves are done, and the box named three criteria because three were wrong.

### The skill half

`resolvableSkills` = own skills ∪ every instance reached through `needs`,
transitively, via `orderedDependencies` (reused — it already walks the chain, and
a second walker is the `j79e` defect). Six resolution sites read it.

`smart-base`: `skill-ref-resolves` **fail (9) → pass (0)**, all nine naming
`methodology-adoption` four layers down its chain. Anchored against an
independently produced answer: its sidecar now matches
`cat-harness/test/results/kg-qa/_external/smart-base/` on 5 of 6 skill criteria.

### The role half — measured, not assumed

11 of 13 instances then reported zero criticals. The two that did not,
`smart-base` and `folio-assistant-core`, named `business-analyst`,
`programme-manager` and `deep-researcher` — **all three defined in
`cat-harness/scenarios/roles.json`**, a transitive dependency of both. Only
bootstrap (4 roles) and cat-harness (48) declare a role graph at all.

`resolvableRoleIds` = own graph's ids ∪ every dependency's. `role-ref-resolves`
and `raci-role-resolves` were REMOVED from the seven-criterion `!graph`
overwrite, because neither needs a graph of this instance's own: both ask whether
a named role exists, which a set of ids answers.

### IDS, not the graph — and the measurement that settled it

Overlaying the `RoleGraph` OBJECT was rejected on evidence. The audit emits one
SUBJECT per role, so an overlay gives cat-harness's run bootstrap's 4 roles as 4
new sidecars — for roles bootstrap's own run already audits. That duplicates a
dependency's subjects into its dependent, which is what
`instance-graph-isolation.test.ts` forbids and what this bean's own box 2
requires. **Resolution widens; subjecthood does not** — the `pve3` split, twice.

The five criteria needing role OBJECTS (`lane-binds-role`,
`role-carries-activity-skill`, `activity-fulfilment-kind`, the two RACI shape
checks) stay `unknown`, with the message CORRECTED: it said only "no role graph
declared at scenarios/roles.json", which reads as "these roles do not exist"
when they do, one layer down.

### Result

**0 criticals across all 13 instances** (was 13 with 2 sets of false ones).
Default run byte-identical across every sidecar, 48 roles, `fail` 201 unchanged.
bootstrap unchanged. `instance-graph-isolation.test.ts` green.

### Two mistakes worth recording, both caught by a falsifier

1. `resolvableRoleIds` was seeded from dependencies alone and **not from the
   instance's own graph**, so cat-harness resolved against bootstrap's 4 roles
   and none of its own 48: default run `fail` 201 → **273**. A closure must
   contain the instance it is the closure of. The "default run byte-identical"
   falsifier caught it immediately; nothing else would have.
2. The first version of the test spawned `kg:audit --instance` with `--json` but
   without `--check`, and the audit WRITES `skills/kg-qa.manifest.json` unless
   `--check` is set. That left stray manifests in three instances' `skills/`
   directories, which changed the UML generated FROM those directories and made
   `uml:overview:check` and two `skill:register:check` entries fail — which I
   first reported as pre-existing on `main`. It was mine. The test now passes
   `--check` on every spawn and is verified to leave the tree byte-identical.

## Done when

- [x] `check:workflow-refs` audits a path that exists
- [x] the render:bpmn half — resolved in main's favour (`oqdr`, #1394)
- [x] `kg:audit --instance`, all criteria scoped `instance|repo`
- [x] `checkTools()` takes an instance root — 119 phantom sidecars → 0
- [x] `knownSkills()` stops inheriting the repo's `.claude/` upward — 23 → 0
- [x] bootstrap declares `qa` → `test/results/`, with its files, `iwtn` green
- [x] the loop no longer CRASHES on an instance declaring a kind twice
- [x] **resolution follows `needs` DOWNWARD** — skills and roles, all three
      criteria, 0 criticals across 13 instances, default run byte-identical
- [ ] the loop: commit the 13 instances' sidecars — now UNBLOCKED, and it needs
      a gate that keeps them current, or 13 sets of artefacts start going stale
      the moment they land
- [ ] the `dh4f` zero-diagram question


## 2026-09-27, box 9: the loop — every declared instance is audited, and its verdict is committed

`kg:audit:all` / `kg:audit:all:check` (`scripts/kg-audit-all.ts`), wired into
`code-quality-gates.yml` beside the single-instance step it generalises.

**Spawned per instance, not looped in-process.** `kg-audit.ts` resolves `root`
once at module scope and derives nine `*_DIR` constants, subject discovery and
its output path from it — its own docblock says why that is right. So a `--all`
flag would have to unpick the design. Spawning also makes a crash in one
instance a REPORTED failure rather than an exception that ends the sweep;
`crashed` is a third outcome, not a kind of failure, because nothing was judged.

**Result: 15 instances audited, 15 clean, 0 produced no report.** 13 of them had
no `test/results` at all before this.

### Three coupled changes the loop forced, each measured rather than predicted

1. **The 13 instances DECLARE their `qa` directory**, with the sidecars in the
   same commit — box 6's precedent, and `dh4f`'s rule. `audit:coverage` now
   reports the `qa` kind as **15 declared directories, state `covered`** (was 2).

2. **The auditor manifest moved out of `skills/`.** `KG_QA_MANIFEST_PATH` was
   `skills/kg-qa.manifest.json`, harmless while ONE instance was audited.
   `kg-audit.ts` writes it unconditionally, so the first full sweep CREATED a
   `skills/` directory holding nothing but a manifest in every instance that has
   none — and the generated UML and the navbar both moved to report a skills
   graph with no skills. It is now `test/results/kg-qa.manifest.json`, which is
   where it belongs on its own terms: it describes the SIDECARS.
   `kg-qa-manifest/v1`'s registration moved from the `skills` kind to `qa` with
   it — a kind claiming a `$schema` whose files live in another kind's directory
   is a validator aimed at nothing.

3. **Two prose counts were falsified by that move and corrected**: cat-harness's
   `qa` description said "Three kinds live here" (now four, manifest enumerated),
   and the 13 generated descriptions said "ONE kind lives here" (now two). A
   count in prose is a claim, and this is the second time in two days it was the
   thing that went stale first.

### What the loop found on its FIRST run

bootstrap's `kg-qa.manifest.json` was **stale** — it records the auditor's hash,
so every instance's manifest goes stale the moment `kg-audit.ts` changes, and
nothing said so because no gate ran bootstrap's audit. That is this bean's
subject demonstrating itself.

### The ROOT instance — audited since `pgzn` (2026-10-02, PR #1842)

`pgzn` is completed: `kg-audit.ts` now resolves its repository root through
`checkoutRootFor`, `kg-audit-all.ts` no longer skips the root instance, and its
sidecars are committed under `cat-harness/test/results/folio-assistant/`, so
coverage is **16 of 16**. The history below is kept as it was written. Note that
its "obvious repair is wrong" paragraph does not hold: for the root instance
`siblingScopeFor` IS the checkout, which is where `package.json` lives, and it
agrees with `repoRootFor` for every nested instance (measured over all 18).

### (history) Still not audited: the ROOT instance

`kg:audit --instance .` exits 1 before auditing anything (bean `pgzn`). The
sweep prints that gap on EVERY run, clean or not — a gap mentioned only when
something else fails is a gap nobody reads on the day it matters. So coverage is
**15 of 16**, stated rather than rounded up.

The obvious repair is wrong, and the corpus says so: the value feeds
`rootScripts`, which reads `package.json`, and `siblingScopeFor`'s own docblock
warns that substituting it for `repoRootFor` *"would make the repository-furniture
question wrong for that same instance, in the other direction."*

### The `dh4f` zero-diagram question, measured

**No instance in this corpus declares `processes/` and holds no diagram.** The
two that declare it (`folio-assistant-core`, `smart-base`) hold one each; the
eleven with no diagrams declare no `processes` directory. So the question is
hypothetical here, every instance yields at least one subject, and no sidecar
set is empty. It is a case to guard by construction, not a live finding — which
is worth saying plainly, because the box was written as though a corpus case
existed.

## Done when

- [x] every earlier box (see above)
- [x] resolution follows `needs` downward — skills and roles
- [x] the loop: every declared instance audited, its sidecars committed, and a
      CI gate that keeps them current
- [x] the dh4f zero-diagram question — no corpus case; guard by construction

## Evidence: Closed on Landed Work (2026-10-09)

All Done-when items verified landed on main:
1. Per-instance audits implemented in `scripts/kg-audit-all.ts` with `--instance` support and scoping across all 68 criteria (`scripts/kg-audit.ts`).
2. Resolution follows `needs` downward for skills and roles (PR #1842 / `pgzn` / `bce18c147f`).
3. Root instance audited via `checkoutRootFor` and included in `kg:audit:all` coverage (16 of 16).
4. Zero-diagram `dh4f` question guarded by construction:
   - In `check-workflow-refs.ts`, `emptyInstances()` detects any listed instance with 0 `.bpmn` diagrams and reports it (`? ... declares no diagram — nothing here was checked for it`), while absent paths exit 1.
   - Pinned by construction in `cat-harness-tools/scripts/tests/workflow-refs-instances.test.ts`.

## Merged from the folio-assistant copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
- [x] the dh4f zero-diagram question — no corpus case; guard by construction

## Evidence: Closed on Landed Work (2026-10-09)

All Done-when items verified landed on main:
1. Per-instance audits implemented in `scripts/kg-audit-all.ts` with `--instance` support and scoping across all 68 criteria (`scripts/kg-audit.ts`).
2. Resolution follows `needs` downward for skills and roles (PR #1842 / `pgzn` / `bce18c147f`).
3. Root instance audited via `checkoutRootFor` and included in `kg:audit:all` coverage (16 of 16).
4. Zero-diagram `dh4f` question guarded by construction:
   - In `check-workflow-refs.ts`, `emptyInstances()` detects any listed instance with 0 `.bpmn` diagrams and reports it (`? ... declares no diagram — nothing here was checked for it`), while absent paths exit 1.
   - Pinned by construction in `cat-harness-tools/scripts/tests/workflow-refs-instances.test.ts`.

```

## Merged from the cat-harness copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
- [x] the ROOT instance is audited too — done by `pgzn` (PR #1842)
- [ ] the `dh4f` zero-diagram question — no corpus case; guard by construction

_2026-10-16T06:30:00Z_ — Store reconciliation: status `in-progress` → `completed` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: completed, cat-harness: in-progress, cat-harness-tools: in-progress). Evidence: closed in the folio-assistant store copy (2026-10-09); commit bce18c14 is on folio-assistant main. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.
```
