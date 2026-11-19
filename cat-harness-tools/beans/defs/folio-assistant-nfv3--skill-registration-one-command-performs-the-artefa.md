---
# folio-assistant-nfv3
$schema: bean/1.0.0
title: 'SKILL REGISTRATION: one command performs the artefact chain, and a gate refuses a skill that arrives without it — 7 merges have paid for its absence'
status: completed
type: task
priority: high
created_at: 2026-09-26T07:38:20Z
updated_at: 2026-09-30T22:33:45Z
parent: folio-assistant-1xhc
---

## What this is

`v625`'s open item, both halves: *"the chain is written down somewhere an author
adding a skill will find it — or, better, one command performs it."* Neither
existed. `#1383`'s author reached the same conclusion and left it deliberately —
*"a pre-merge gate … is the actual fix, and it's a separate decision I have not
taken here"* — and the owner took it on 2026-09-26.

## The defect, measured

Seven merges between 2026-09-24 and 2026-09-26 each broke the gate set by adding
a skill without its manifest entry, its reference page and its `kg-qa` sidecar.
Two were repaired on this branch (`#1365`'s six skills, `#1373`'s
`release-epic-planning`); the rest by five other sessions. Three of the seven also
reintroduced the retired `roles:` key.

**Detection was never the gap.** The gates named the files exactly, every time.
The gaps were that an author had nowhere to look up what to run, and that running
it once is not enough — CI judges the MERGE of each head into the base, so the
cost lands on whoever opens the next PR.

## Shipped

- `scripts/register-skills.ts` — `skills:register` performs, `skills:register:check`
  gates. Wired into `code-quality-gates.yml`; subject resolved from the instance's
  declarations via `kgDirectories`, never a hardcoded `skills/`.
- `skills:docs` / `skills:docs:check` — `gen-skill-docs.ts` had no package script,
  which is the gap `check:ci-invocations` exists to report. Closed on the way past.
- `skills/kg/kg-core/skill-registration.md` — the discipline, registered by the
  command it documents (267 → 268 skills).
- `tests/register-skills.test.ts` — 19 tests, every finder falsified on a synthetic
  package, anti-vacuity floor on the real corpus.

## Three things the gates corrected in my own work, and one I found by breaking it

- `join(instance, "skills")` was a declared-path literal, refused by
  `check-declared-paths`. Asking the declaration is not merely compliant: ids are
  stable across a relocation and paths are not (`iwtn` moved this id), and it
  reaches a dependent instance's packages.
- `@covers kg` names no kind — `kg` is a graph LAYER. Narrowed to `skills`, and
  only that: the derived pages and sidecars are judged by `skills:docs:check` and
  `kg:audit:check`, so claiming them would report coverage this gate does not give.
- Sorted insertion, not append. `#1383` appended believing the lists unsorted;
  they are sorted, and `kfkh` records the convention as *unenforced* — which is
  what let two sessions insert one name at two indices and keep both.
- **Deleting a probe skill exposed the direction I had not designed for**: the
  manifest entry the command had just written now pointed at nothing, and
  `kg:audit` raised `manifest-skill-exists` at **critical**. `dangling()` reports
  it and deliberately does not prune.

I also polluted the `audit-coverage` sidecar by running its WRITING form in this
container to read a list of kind names — bean `xd1g`, the trap I had written into
my own check-in note three times that day. Regenerated in a clean worktree.

## Done when

- [x] one command performs every declaration and derived artefact a skill owes
- [x] convergence ASSERTED against the `:check` forms, not a fixed pass count
- [x] a gate refuses an undeclared skill, and its message names the command
- [x] both orphan directions reported; neither silently pruned
- [x] falsified in both directions, and the clean tree still exits 0
- [x] the discipline written where an author will meet it, and registered by the
      command it documents
- [x] The merge-time half is **already decided and already covers this gate** —
      I left it here as an open question for the owner and it was answered on
      2026-09-23, before this bean existed. `nytj` owns the subject, is
      `in-progress` under a holder, and the owner chose both halves: `merge_group:`
      on the gating workflows plus `bun run cat check:merged`. Its only open box is a
      repository SETTING — switching the merge queue on for `main` — which is the
      owner's to flip, not a decision to take.

      **And it needs nothing from this bean.** `check-merged.ts` runs
      `bun run cat gates` on the merged tree, and `gates.ts` derives its list from
      `code-quality-gates.yml`, where `skills:register:check` is now wired. So the
      moment the merge queue is on, an unregistered skill cannot reach `main` —
      automatically, with no further change here. Read rather than assumed:
      `check-merged.ts:133`.

      Recorded as my error rather than dropped. I put a settled question to the
      owner as though open, which spends the one thing their accessibility
      constraints make expensive. `nytj`'s own commit message names the guard that
      would have caught it — *"'Check before you create' is why I did not"* — and
      the same check applies to a QUESTION, not only to a bean

---

## 2026-09-26, later: a sibling built the same command, and theirs is right about the chain

`main` gained `skill:register` → `cat-harness/scripts/skill-register.ts` (bean
`v625`, 183 lines). Mine is `skills:register` → `register-skills.ts`. **Two
commands one letter apart**, found in a merge conflict on `package.json` rather
than by looking — the sixth sibling collision this session, and the only one where
both artefacts survived into one tree.

### Their chain is MEASURED; mine was inferred, and mine was wrong

Theirs is five steps, each measured red-then-green **in isolation**:

    gen-skill-docs · glossary:page · docs:auto · kg:audit · kg:detangle

Mine was nine. The four extras — `glossary:export`, `uml:overview`, `prov:qaqc`,
`tools:viz` — staled in the runs I watched because that branch *also* added three
Tool nodes and merged 20 translated pages. Their docblock names this exact
failure, three times over: *"they had gone red in the same sessions for unrelated
reasons and were attributed here."* I used the method they had already proved
wrong.

Two further corrections I took from them:

- **`bun run cat gates` cannot derive the chain.** `bun test` runs the detangle and
  kg-audit writers, so those checks read green by the time they execute — bean
  `ymsu`'s blind spot. Only an isolated run of one check against a known tree
  measures anything.
- **The five are NOT order-dependent** — they ran them in reverse and re-checked
  green. I had asserted order-dependence from watching `docs:auto` stale behind
  `glossary:page`, a real observation on a tree changing for four reasons at once.

`CHAIN` is now their five. The convergence loop stays, with its purpose corrected:
not to shuffle a dependency, but so the command can say the chain **landed**
rather than that it **ran**.

And a test of mine had to change with it — it asserted `CHAIN.length > 5`,
encoding my wrong nine, so a correct change failed it. That is the trap the
neighbouring test warns about in prose (*"a count in a test goes stale exactly as
a count in prose does"*). I wrote the warning and then wrote the count. It asserts
properties now.

### Where they differ, and the one where theirs is the better default

| | `skill:register` (theirs) | `skills:register` (mine) |
|---|---|---|
| chain | **5, measured** | 5, now taken from theirs |
| wired into CI | no | **yes** — `skills:register:check` in `code-quality-gates.yml` |
| adds the manifest entry | **refuses, deliberately** | yes |
| strips a retired `roles:` | no | yes |
| reports a dangling entry | no | yes |
| tests | 1 file | 19 tests |

**Their refusal to add the manifest entry is a real argument against my
default**, and I think they are right: *"that is the author's assertion that the
file is a skill of that package, not a derivable fact, and a command that guessed
it would register files someone was still drafting."* Mine would register a
half-written skill the moment somebody ran it.

### Not consolidated here, and that is deliberate

`skill-register.ts` is a sibling's **merged** work. Deleting or absorbing it is
not an agent's call —
[`deletion-requires-confirmation`](../../../cat-harness/skills/conduct/conduct-core/deletion-requires-confirmation.md) — and two
commands one letter apart is a defect that should be closed by a decision rather
than by whoever pushes next. Both are green side by side, so nothing is broken
while it waits.

## Done when

- [x] ~~the chain~~ — replaced by the measured five from `skill-register.ts`
- [ ] **ONE command, not two.** Recommended shape, for the owner: keep
      `skill:register`'s chain and its refusal to write manifest entries, keep
      `skills:register:check`'s CI wiring, the dangling report and the retired-key
      strip, under a single name. Whichever file survives, the other's docblock
      evidence has to move with it — the measured chain and the
      `gates`-cannot-derive-it finding are the most valuable things either file
      contains



--------

## 2026-09-26, resolved: the owner chose main's name, and the merge found a defect in mine

**`skill:register` survives; `skills:register` is gone.** Put to the owner as a
three-option choice because retiring a command is removing a durable artefact
(`deletion-requires-confirmation`), and they chose main's name on the reason that
mattered: it was already on `main`, so every other session already calls it.
Pushed as `a2985fdefe` + `ea126a6228`.

### What crossed over, and the one thing that did not

`skill-register.ts` keeps its name, its five measured steps and its docblock, and
gains the three things this bean had built that it lacked:

- **the CI gate** — `skill:register:check`, replacing `skills:register:check` in
  `code-quality-gates.yml`. This is the load-bearing half. For four days the gate
  was on the command that did NOT survive, and a documented obligation with no
  gate is exactly what let seven merges repeat one defect.
- **the dangling report** — a manifest entry with no file behind it, which
  `kg:audit` calls `manifest-skill-exists` at severity critical.
- **the retired-`roles:` strip.**

**My manifest-write was dropped, deliberately** — the one place the consolidation
took the OLDER design over the newer one. Their argument is better than mine:
which package a file belongs to is the author's assertion, and *"a command that
guessed it would register files someone was still drafting."* The command now
names the file and the remedy instead.

`register-skills.ts` and `register-skills.test.ts` are gone. The 19 tests merged
into `skill-register.test.ts` beside the sibling's 6 — **30 pass**.

### The merge found a real defect in MY version, and my own test installed it

The chain verified `glossary:page` with `glossary:check`. Those are different
programs:

    check:glossary   folio-assistant-core/scripts/glossary-page.ts --check
                     ← the checker for what `glossary:page` writes
    glossary:check   cat-harness/scripts/glossary-export.ts --check
                     ← the SKOS projection, unrelated

So one of five pairings was a writer against an unrelated check. **The cause
matters more than the fix.** My test asserted *every check ends in `:check`* —
which looked like a property and is a naming convention this repository does not
hold. `check:glossary` cannot satisfy it, so the assertion drove out the correct
pairing and installed the wrong one. And it passed.

Replaced by two assertions that hold by construction: no step verifies itself
with its own writer, and no writer repeats. `missingScripts()` covers
declaredness. **A convention test can enforce a defect** — worth carrying to the
corpus if it recurs.

That makes **four** wrong answers about this five-item list across two sessions
(their three, my one). The docblock now states the count, because "measure it, do
not recall it" has needed saying four times.

### And I over-generalised the bean-link fix in the wrong direction

Earlier today I qualified `](deletion-requires-confirmation.md)` to
`](../../cat-harness/skills/folio-core/…)` in this bean, correct from
`beans/defs/`. Writing the skill doc I reached for the qualified form again —
and inside `skills/folio-core/`, where the two files are siblings, the BARE form
is correct and the qualified one resolves to nothing. Same class as the original
defect, opposite direction, caught before commit by checking the path rather
than the pattern.

### Verified

    skill:register:check   exit 0 — 268 skills across 16 packages
    falsified end-to-end   exit 1 on an undeclared skill, on a retired `roles:`,
                           and on a dangling manifest entry; exit 0 restored
    skill:register         chain converged, 5/5 checks green in isolation
    bun test               11806 pass / 56 skip / 1 fail (main's drift, inherited)
    tsc, eslint            clean
    audit:coverage         require-all + strict exit 0 in a clean worktree;
                           0 gates have NOT declared a kind

## Done when (consolidation)

[x] the two commands are one, under the name the owner chose
[x] the gate follows the surviving name — it is the only thing making the
    obligation binding
[x] the dropped behaviour is dropped on an argument, recorded here, not by
    accident of which file won
[x] both suites merged rather than one discarded



--------

## 2026-09-26T12:20Z — CORRECTION: the gate I called load-bearing has NEVER RUN

I wrote, in this bean and in the PR body and in three check-in notes, that
`skill:register:check` in `code-quality-gates.yml` is *"the load-bearing half"* and
*"the only thing that makes the obligation binding"*.

**It has not executed once.** Measured:

    .github/workflows/code-quality-gates.yml
      line 260   run: bun test                   job `typescript`
      line 639   run: bun run cat skill:register:check   job `typescript`  ← same job

A failing step skips every step behind it in the same job. `bun test` is red on
`main` (the 25 uncatalogued translations, bean `ngxj`, and `f6r1` has now shown the
mechanical remedy is closed) so it is red on every run of this branch — and my gate
sits 379 lines downstream of it. Run `36238697037` on this branch, job
`TypeScript — tests, lint, types (hard)`: step 34, *"every skill is declared, and
declares nothing absent"*, conclusion **`skipped`**. Steps 7 through 52 all
skipped, 45 gates returning no verdict.

**So this bean shipped the exact defect its own parent epic is named for.**
`1xhc` is *"a gate that does not fire is indistinguishable from one that passed"*,
and I added a gate that cannot fire, inside a PR whose second feature is a
year-old instance of the same shape (`check:workflow-refs` auditing a path that
never existed).

### I had the evidence and did not apply it

An hour before writing this I recorded the identical mechanism on bean `9cc0` —
*"CI cannot see the typecheck failure either: step 6 fails, steps 7 onward
including `tsc --noEmit` are SKIPPED"* — and cited `m5gx` for it. I read the
skipped-step list, described it accurately, drew the conclusion for
somebody else's defect, and did not turn it on my own gate in the same file.
Noticing a mechanism is not the same as checking what of mine it applies to.

### The fix exists and is somebody else's, already measured

PR **#1399** (`claude/brave-hypatia-r820sf`, bean `v625`) adds a SEPARATE CI job,
`skill-registration-chain`, and argues the placement from the same measurement on
main's run `36234052354`: *"a failing step skips every step behind it … 45 gates
returning no verdict while the job reported as one red. A step in front would
widen that cascade instead of adding a verdict. A separate job skips nothing and
runs in parallel: 13s measured, against ~2.5min for typescript."*

That is a better answer than mine and it is already written. **Not duplicating it** —
moving my step into its own job on this branch would collide with theirs in the
same file and re-run their measurement badly. Coordinated on #1399 instead.

### What this means for #1361 as it stands

The gate is **declared and inert**. `skill:register:check` is correct, exits 0 on a
clean tree and 1 on each of the three defects (falsified end-to-end), and
`audit:coverage` counts it as a gate covering the `skills` kind — which is now
itself slightly generous, since declaring coverage is not the same as running.
It becomes real the moment either #1399's separate job lands or `bun test` goes
green.

Recorded rather than silently fixed, because a reviewer reading "a gate refuses an
undeclared skill" should know it currently does not.



--------

## 2026-09-26T14:20Z — CORRECTION TO THE CORRECTION: the gate RAN, and passed

The entry above says `skill:register:check` *"has not executed once"*. **That was
true when written and is no longer true.** Evidence:

    run 36247786373, head 0ae70b6be2, job `Repository gates (hard)`
      step 31  every skill is declared, and declares nothing absent   SUCCESS

First execution, and it passed.

### What changed, and it was not me

Main split the workflow (bean `om30`): the gates moved out of `typescript` into a
new `Repository gates (hard)` job with **deliberately no `needs: typescript`**, on
exactly the argument this bean recorded — *"`bun test` was step 2 of 47 here, and
Actions stops a job at its first failing step … 113 `bun run` invocations did not
execute at all."*

So my gate is now step 31 of 45 in a job that never runs `bun test`. It is no
longer structurally inert.

**Two independent sessions reached the same finding within the hour** — `om30` from
main, and this bean plus `9cc0` from here, each measuring a different run
(`36234052354` and `36238697037`). Neither knew of the other. That is the tenth
collision of the session and the first where both parties were right and the fix
came from the one who owned the workflow.

### It still was not free of the shape, one level in

On the PREVIOUS head `56e6c4bde7` the same job failed at **step 11**, *"glossary
page and SKOS"* — three stale `kg-skills` glossary files, **mine** — so steps 12-45
were skipped and my gate at 31 did not run *again*, now behind my own staleness
rather than behind `bun test`. First-failure-skips-rest applies inside the new job
too; what changed is that a red `bun test` no longer reaches it.

Fixed by the merge that regenerated those three files, which is why step 31 shows
success on `0ae70b6be2`.

### And step 33 caught something real of mine in the same run

`audit:coverage` failed there: an earlier `--theirs` merge resolution on
`audit-coverage.qa-results.json` had dropped this branch's two entries, and
**`audit:coverage` is not one of the six steps in `skill:register`**, so the chain I
run after every merge could not restore it. Regenerated in a clean worktree;
`require-all` and `:strict` both exit 0 at `49e58e76c2`.

Worth keeping as a rule: taking `--theirs` on a generated file is correct for a
parseable base, but it needs a regeneration to follow, and the registration chain
does not cover every generated artefact.


## CORRECTION, 2026-09-30 — "the moment the merge queue is on" never arrives

This bean says *"the moment the merge queue is on, an unregistered skill cannot
reach `main` — automatically, with no further change here"*, and treats `nytj`'s
last box as an owner's pending flip. Bean `1hjm`: the flip does not exist on
this repository — `Require merge queue` is absent from the ruleset form, and
`nytj`'s box is now closed not-done for that reason.

**The reading of `check-merged.ts` was right and is unaffected.** `bun run cat gates`
does derive its list from `code-quality-gates.yml`, and `skills:register:check`
is in it. What is wrong is only the trigger: that protection arrives via the
queue, so on this repository `skill:register:check` is enforced on `pull_request`
and `push` alone, and an unregistered skill reaching `main` is still possible
through merge skew.
