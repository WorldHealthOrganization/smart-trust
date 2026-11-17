---
name: platform-gates
description: >
  `bun test` passing is not the gates passing. What to run before you push,
  why the list is derived from the CI workflow rather than written down, and
  what a `*:check` failure is actually telling you to do.
adapters: [document, paper, dak]
profiles: [document, paper]
---

# The platform's own gates — run what CI will run

**One command:**

```sh
bun run cat gates          # the fast set
bun run cat gates --all    # plus the jobs that need a browser
bun run cat gates:list     # see them without running them
```

Run it **before you push**, not after CI tells you.

---

## The CI workflow is the list

This skill does not list the gates, because a written list drifts from CI and
a stale list reads as authoritative, so nobody checks it. `bun run cat gates`
derives the set from `.github/workflows/code-quality-gates.yml` at the moment
you run it, so a gate added to CI is in your next local sweep.

`package.json` is not the authority: many of its `check:` scripts appear in no
workflow, and running all of them would fail you on things CI does not gate.
The workflow's own comments name the scripts it deliberately excludes, with a
reason beside each (for example `check:ci-health` is a report about `main`, not
a gate on your diff). Read the reasons there.

---

## `bun test` green is not the gates green

The test suite, `tsc --noEmit` and the `*:check` gates fail independently. One
cause can also fail two gates at once. Run the gate set, not just the tests.

---

## ...and the gates green is not the PUBLISHED PAGE green

Gates read **sources**. A defect that exists only in a renderer's output — for
example markup that Kramdown escapes because a Liquid whitespace-strip joined
two attributes — passes every gate.

- **Gate coverage is bounded by what a gate can look at.** Ask what the gates
  *read*, not how many there are.
- **When your change alters a rendered page, build the page.** The site build is
  not in the fast loop. `check:escaped-markup` asks one narrow version of "the
  output is well-formed", and only in `docs-site.yml`, where `_site/` exists. If
  the real build will not run locally (the `just-the-docs` remote theme 403s
  through the agent proxy), stub the **theme** and build anyway; never
  substitute the thing under test. `continual-progress` §"A template is not a
  page" carries the discipline.

---

## ...and a green gate is not a VERIFIED FACT

A gate can see the artefact and still answer a different question from yours.

**A rule that lives only in prose has a compliance ceiling nobody measures.**
When you write a rule into prose, ask what would fail if somebody ignored it;
if the answer is *nothing*, you have written a wish. The measurable form is a
check, a schema field, or a test.

**A gate's silence is bounded by its stated scope.** `check:stale-paths`, for
example, judges two shapes — an id adjacent to an arrow, and a numbered step
under a path heading — and declines everything else. Prose that merely mentions
a closed work item passes it while carrying the same defect. Likewise
`check:ci-health` labels workflow files that produced no run *unjudged, not
green*. **Green over a narrow rule is worse than red**, because red is examined;
a gate that does not fire is indistinguishable from one that passed.

Before quoting a tick as evidence:

> **What does this gate say it judges, and is my claim inside it?**

Read the check's own header — every one here states its scope and its declined
cases — rather than inferring the scope from the fact that it ran.

---

## Fast versus full is job membership

The split is read from the workflow at run time.

- **fast** — the `typescript` job. No browser. This is the inner loop.
- **`--all`** — adds the jobs that install Chromium. `render:bpmn:check` is
  there because bpmn-js renders through a browser, so it can pass locally only
  because a browser happened to be installed.

`render:bpmn:check` and `node-views:report` are **QA reports, not merge
gates**: their results go to the `qa-reports` branch and show on each layer's
QA page, and neither is in `index-gates.json` or always-green. The node-view
report needs a built site or a live base, so it is not in the fast set either;
its author's check is `node-views:judge --against main`, which fails only on a
finding new against the baseline.

---

## Running "the gates that relate to my change" is not running the gates

**Pick the gate set by JOB MEMBERSHIP, never by which gates you judge
relevant.** `bun run cat gates --all` is the whole point of there being a
command. A subset chosen by an author tests the author's model of the change,
and CI tests the change; they differ precisely where the bug is. `gates --all`
takes minutes; a red CI run costs a push cycle.

### A verification names a tree

> **A verification names a TREE, not a branch.** Anything edited after the run
> started is unverified, however green the run was.

**`bun run cat gates` reads the WORKING TREE, not the commit.** An edit made
while it runs leaves the change unverified, and can make the run report
failures that were never in any commit. Nothing looks wrong when this happens:
the run really passed, about a different tree from the one pushed. **Run the gates after the last edit,
not alongside it** — if you edit while they run, the run is spent and needs
doing again.

A skill edit is the case most likely to produce this, because a skill body has
two committed artefacts generated from it. **A skill edit is three files:**

| file | regenerate with |
|---|---|
| the body, `skills/<pkg>/<name>.md` | — you edit it |
| `test/results/kg-qa/.../<name>.kg-qa.json` | `bun run cat kg:audit` |
| `docs/reference/skill-instructions/<name>.md` | `bun run cat-harness-tools/scripts/gen-skill-docs.ts` |

The `kg-qa` row is a derived QA result whose record is the commit-keyed entry
the CI job `qa-publish` stores on the orphan `qa-reports` branch. While a
committed copy exists, `kg:audit:check` compares against it, so regenerate it.
`bun run cat skill:register` does all of it in one command.

### A minted term needs a gloss

**`termIri("X")` MINTS a term, and a minted term needs a gloss.** Adding a new
`@type` or a new property in `kg-export.ts` is therefore a TWO-file change:
the emitter, and `schemas/content/vocabulary.ts` (`CLASS_GLOSSES` for a type,
`PROPERTY_GLOSSES` for a property). `ns:check` refuses the half done alone.

This is a *different* gate from the export's own undeclared-term report: **one
checks that the JSON-LD `@context` binds the term, the other checks that the
namespace DEFINES it.** Both must pass, and passing the first is not evidence
about the second.

---

## What a `*:check` failure is telling you

Most of these gates compare a **committed artefact** against what its
**generator** would produce now. A red one almost never means "the artefact is
wrong". It means **you changed an input and did not regenerate**.

So the fix is to run the generator and commit its output — never to hand-edit
the artefact into agreement, which makes the next regeneration noisy and
detaches the artefact from its source.

**QA gates have a different shape.** A gate over the `qa` graph **computes and
judges**: `--check` writes nothing, and fails only on a finding that is **NEW**
against a baseline — the committed working copy, or `--against <ref>` on the
`qa-reports` branch. A missing baseline is **UNKNOWN**, printed and never a
pass, never a fail. The four judge states are `ok` (0), `finding` (1),
`unknown` and `error` (2) — `JUDGEMENT_EXIT` in `scripts/qa-results.ts`. A red
one of THOSE is a real finding your change introduced; regenerating does not
clear it, fixing the subject does. Which gates have this shape is in each
script's own docblock.

Each `*:check` script has a generator beside it under the same stem;
`bun run cat gates:list` shows the check, and the script it checks is named in
the check's own output when it fails.

---

## ...and a green gate set is not a CLEAN RUN

`bun run cat gates` snapshots the tree before the first gate and after every one, so
every gate can pass and the run still exit 1:

```
✗ every gate passed, and the run is NOT clean — 1 gate(s) changed the tree.
```

The gates after the mutation were handed the repaired tree, so their verdicts
describe a state you have not committed.
`gate-tree-mutation` (opt-in `cat-harness.sdlc`) carries the two causes, the one
command that tells them apart, and the question that settles the second: does
the churning field describe the **subject** the artefact is about, or the **run**
that produced it? Only the first is a reason to write.

---

## Three things this skill will not do for you

**It does not replace reading the failure.** The runner names the failing
command and the CI step it belongs to, so a local failure and a red PR are
findable by the same string. Read what the gate printed.

**It does not tell you a gate is wrong.** A gate whose purpose you cannot state
gets "fixed" by being made to pass, which turns the check into decoration.
Every gate in that workflow carries a
comment saying what it catches; if you think one is wrong, that comment is what
you are arguing with.

**It does not make `--all` optional before a push that touches a diagram.**
Anything under `processes/` changes a rendered SVG, and the check for
that is in the browser job.

---

## If `bun run cat gates` reports no gates

It **fails** rather than exiting clean: an empty sweep that exits 0 is
indistinguishable from a passing one. If you see that refusal, the workflow was
renamed or restructured and the reader needs fixing — not the gate list.

---

## Related

| | |
|---|---|
| `.github/workflows/code-quality-gates.yml` | the authority, with a comment per gate saying what it catches |
| `scripts/gates.ts` | the reader, and the vacuity guard |
| [`continual-progress`](../../conduct/conduct-core/continual-progress.md) | commit early, open the PR at the first commit — this is the step before the push |
| `prepare-merge` (opt-in `cat-harness.sdlc`) | the pre-merge recipe, which runs these plus content-type gates |
| [`ci-health`](ci-health.md) | whether the workflows themselves are working — a different question |
| `gate-tree-mutation` (opt-in `cat-harness.sdlc`) | reading `NOT clean` — a green gate set over a tree a gate repaired |
