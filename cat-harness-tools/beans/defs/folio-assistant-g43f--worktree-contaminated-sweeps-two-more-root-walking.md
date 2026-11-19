---
# folio-assistant-g43f
$schema: bean/1.0.0
title: 'WORKTREE-CONTAMINATED SWEEPS: two more root-walking checks descend into .claude/worktrees and redden bun test for every concurrent session — vpek''s general question, answered yes'
status: completed
type: bug
priority: high
created_at: 2026-09-30T14:13:37Z
updated_at: 2026-10-07T17:48:00Z
parent: folio-assistant-1xhc
---

Bean `vpek` fixed one instance of this — `eslint.config.mjs` not ignoring
`.claude/worktrees/**` — and left the general question open on purpose:

> - [ ] The **general** question is answered rather than only this instance:
>       are there other tools that walk the tree from the repository root and
>       would find a worktree there? … Whether any of them has this problem is
>       **not determined** by this bean and must not be read as no.

**Answered, within the hour: yes, and it is a class.** Two more, both found by
their own output naming the paths.

## The two, measured

| sweep | how it reaches a worktree | measured damage |
|---|---|---|
| `cat-harness/scripts/check-stale-field-advice.ts` | its walk descends into `.claude` **on purpose** — agent instructions live there and carry advice strings — and so into `.claude/worktrees/<id>/` | **6 findings, all 6** with paths beginning `.claude/worktrees/agent-` |
| `cat-harness/scripts/check-declaration-filename.ts` | `scanMarkdown`'s `walkMd` skips only `.git` and `node_modules` — **no dot-directory guard at all** | **528** stale-path findings |

Both turn `bun test` red on a branch whose diff touches none of them, and both
do it for every concurrent session sharing the checkout, including ones that
dispatched no agent.

## Why asking git is the fix rather than another ignore entry

`.claude/worktrees/` is **gitignored** (`.gitignore:31`) and untracked, so

```
git ls-files --cached --others --exclude-standard
```

never lists it. `schemas/git-corpus.ts` already wraps exactly that, and this
repository already states the rule — `xd1g`, `ramz`, and `root-scan-census`,
whose whole subject is scripts that enumerate the filesystem instead of asking
git. **A walk is a guess at what the corpus is; git knows.**

`vpek` needed an ignore entry only because eslint cannot ask git. These two
can, so they should, and the fix is the rule rather than an exception to it.

## The fallback is NOT silent — `dh4f`

`gitCorpus` returns **`undefined`** when git cannot answer, not an empty list.
An empty corpus would make either check pass vacuously, which is the `dh4f`
shape: a consumer scanning nothing and reporting a clean run. So the walk
survives as an explicit fallback in both, and `check-stale-field-advice`
exports `adviceCorpusSource()` so a caller can tell **"clean"** from
**"could not look"**.

## The trap this fix walked into, and what it cost to notice

Switching enumeration **widened the corpus**, because the walk's exclusions
lived in the walk. `SKIP_DIRS` holds `beans`, which the walk never entered and
git lists — so the first conversion turned **21 archived beans into new
findings** and the check still exited 1, now for an entirely different reason.

Measured, before and after re-applying the walk's own exclusions to git's list:

```
first conversion   6203 file(s), 24 qualified, 21 bare   exit 1
scope preserved    5089 file(s), 13 qualified,  0 bare   exit 0
```

**A fix that silently rescopes a check is a second defect wearing the first
one's clothes.** Asking git is a change of *enumeration*, not of *scope*, and
the two have to be separated by hand because nothing in the type system does
it for you.

## Verification

```
check:stale-field-advice     exit 0   (was 1, all findings under .claude/worktrees/)
check:declaration-filename   exit 0   (was 1, 528 findings)
bun test (both test files)   41 pass, 0 fail
```

## Done when

- [x] `check-stale-field-advice` asks git, with a non-silent fallback and its
      source reportable.
- [x] `check-declaration-filename`'s markdown sweep asks git, same shape.
- [x] Neither rescopes: the walk's exclusions re-applied to git's list, with
      the before/after counts recorded above.
- [ ] **The class is swept, not just these two.** `root-scan-census` counts 65
      enumerating scripts in `cat-harness/scripts` alone. Three are now known
      (eslint via `vpek`, and these two). **How many of the remaining 62 walk
      from a root that contains `.claude/` is NOT determined here** and must
      not be read as none. The census already classifies `seededAtRoot` and
      `gitAware` per script — that is the instrument, and it has not been
      pointed at this question.
- [ ] Whether the census itself should FAIL on a root-walking sweep that is
      not git-aware, rather than only report. It reports and never fails by
      the owner's ruling of 2026-09-27; this bean is evidence for revisiting
      that, and does not presume the answer.

## Not in scope

Converting any of the other 62. That is the sweep above, and doing it
piecemeal while the class is unmeasured is how a count reads as improvement
while the subject moves — which is `tqv4`, one corpus over.


## The denominator, supplied by the census — and `tqv4` has been fixed

`root-scan-census:check` went red on this branch, correctly: making two scripts
git-aware changes their classification. Regenerating it produced the number the
open box above asked for, so it no longer has to be guessed.

**On `main`, 2026-09-30:**

```
root-scan census — 69 enumerating script(s), 14 ask git.
  scope: bootstrap-tools 0, cat-harness 66, fhir-harness 0,
         folio-assistant-core 2, large-datasets 0, smart-trust 0, who-iris 1
         (the rest: no scripts/)
  seeded AT a root constant: 1; of those, not git-aware: 1
    · folio-assistant-core/scripts/check-artifact-index.ts
```

**55 of 69 do not ask git.** That is the class's denominator, and it is a
FLOOR by the census's own statement — both filters are syntactic, the loose one
over-counts and the tight one under-counts, and the gap between them is the
finding rather than either number.

Three are now known to have reached a worktree (eslint via `vpek`, and the two
fixed here). **Whether any of the other 52 do is still not determined**, and
`gitAware: false` is not the same question — a script that walks one declared
directory never reaches `.claude/` and is fine as it is. The question is
narrower: **which of them walk from a root that contains `.claude/`?**

### Two things this measurement settles that were open elsewhere

**`tqv4` has been fixed, by another session, while this was being written.**
That bean's whole subject was that `root-scan-census` was instance-scoped, so
scripts moved up into `folio-assistant-core/` were counted nowhere, and its
headline family read `0 of 0` while the repository's only instance of the shape
sat outside the scan. The output above reports **per-instance scope across all
17**, and the family now names
`folio-assistant-core/scripts/check-artifact-index.ts` — exactly the file
`tqv4` measured as invisible. The count also moved 65 → **69**, which is the
scope widening rather than four new scanners.

**The census is now the right instrument for the sweep**, which it was not when
this bean was opened: an instance-scoped census could not have answered a
question about the whole checkout.


## The class sweep — done, and the result is NEGATIVE

`generalise-the-fix` Move 1.2: three instances is a class, so sweep for
siblings rather than stop at the third. Done 2026-09-30, read-only.

**No fourth instance found.** A negative result is a real result, and this
records the method so the next reader can judge it rather than trust it.

### Two filters, and the gap between them is the point

Over the 205 enumerating scripts under `*/scripts/` and
`cat-harness/content/pipeline/`:

| filter | count | what it is worth |
|---|---|---|
| **loose** — does not ask git, and either has no `startsWith(".")` guard or names `.claude` explicitly | **142** | **useless as an upper bound.** Most walk a NAMED SUBDIRECTORY (`content/`, `translations/`, `folio/<paper>`) and never approach `.claude/` |
| **tight** — additionally SEEDED at a root constant (`REPO_ROOT` / `INSTANCE_ROOT` / `ROOT`) | **2** | both **false positives on inspection** — see below |
| **known actual** | **3** | eslint (`vpek`), and the two fixed in this bean |

142 is not "142 bugs", and reporting it as one would be the same over-claim
this bean's own `SKIP_DIRS` trap was about. The census documents exactly this
shape about its own two filters: *"the loose one over-counts … the tight one
under-counts … the gap between them is the finding, not either number."*

### The two candidates, and why both fell

```
cat-harness/content/pipeline/audit-status-sections.ts:130    const root = join("folio", paper);
cat-harness/content/pipeline/extract-status-sections.ts:98   let root = join("folio", paper);
```

Both walk `folio/<paper>` — a folio's content directory. Neither can reach
`.claude/`. They matched only because the regex saw `walkMd(root)` and read the
PARAMETER NAME `root` as a root constant.

### The blind spot, stated rather than implied

The tight filter is defeated by **a walk whose root arrives as a parameter from
a caller that passes the repository root**. That is not hypothetical — it is
the limitation `root-scan-census` already documents about its own
`seededAtRoot` filter, measured there as catching 4 of 62 and missing one of
`xd1g`'s twelve.

So this sweep establishes **no fourth instance among scripts whose walk root is
syntactically visible**, and says nothing about one whose root is passed in.
That residue is why the box below stays open rather than being ticked.

## Done when — updated

- [x] `check-stale-field-advice` asks git, non-silent fallback, source reportable.
- [x] `check-declaration-filename`'s markdown sweep asks git, same shape.
- [x] Neither rescopes — before/after counts recorded.
- [x] **The class is swept.** 205 enumerating scripts examined; loose filter 142,
      tight filter 2, both tight candidates false positives on inspection; **no
      fourth instance found.** Method and its blind spot above.
- [ ] Whether `root-scan-census` should FAIL on a root-walking sweep that is
      not git-aware, rather than only report. It reports and never fails by the
      owner's ruling of 2026-09-27. This bean is evidence for revisiting that —
      **55 of 69 enumerating scripts do not ask git** — and deliberately does
      not presume the answer, because most of those 55 are walking a directory
      they own, where a walk is fine.



## Seen again 2026-10-03 (session_01AxhsSvodhTgaioG1nUBWkh)
A `bun run cat gates` run in worktree `agent-a4f48d5f4b9b6cf79` failed 5 of 220: part of the run picked up the SIBLING worktree `.claude/worktrees/agent-a632837f47a89d903` as an instance, and the failing tests and flagged files (`gen-slice-sqlite.ts`, `vendor-sqlite-wasm.ts`) existed only there. Re-run alone, `check:declared-paths`, `check:artefact-verification`, `check:partition` and the three test files all passed. So at least one of those sweeps (or the instance discovery behind them) still descends into `.claude/worktrees/`.

_2026-10-03T14:06:30Z_ — Claimed by claude/nifty-faraday-8ql41p — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## 2026-10-03 follow-up — the instance-discovery escape (session_01AxhsSvodhTgaioG1nUBWkh)

### What the reproduction showed, and did not

Probe: `git worktree add .claude/worktrees/g43f-probe HEAD`, seeded with
`agent-a632837f47a89d903`'s `gen-slice-sqlite.ts`, `vendor-sqlite-wasm.ts`, its
`package.json`, and a failing `*.test.ts`. With that probe nested AND ten live
sibling worktrees beside this one, **before any fix**:

```
check:declared-paths, check:artefact-verification, check:partition   exit 0, 0 mentions of the probe
bun test                                                            14726 pass, 0 fail (724 files); probe test not collected
bun run cat gates                                                       220 of 220 pass
```

So the 5-of-220 failure of 2026-10-03 is **NOT reproduced** by a nested worktree,
nor by siblings. Each of the three checks roots its scan at its own
`import.meta.dir`, so flagging `gen-slice-sqlite.ts` means the process READ
`agent-a632…`'s tree as its own. That points to the run's working directory
(the main checkout, or `agent-a632…` itself) rather than to a sweep descending.
**Not determined**, and not to be read as "no sweep descends".

### The escape that IS real — found while looking

`repoRootFor` is `dirname`. For the ROOT instance of a worktree that is
`.claude/worktrees/`, and `instanceRootsIn` there returned **every sibling
worktree** (measured: 10) as an instance. Three call sites composed exactly
that: `content-holds-code.ts` (reached by `kg-audit` for the root instance),
`check-tools.ts` (`declaredProcessIds`, `satisfiableSkills`) and
`kg-subscribe.ts --check`.

Fixed at two layers:

- **Shared:** `instanceRootsIn` drops a child that holds its own `.git` (a
  worktree's is a FILE) unless the scanned root's `.gitmodules` names it, via
  the new exported `isForeignCheckout`. `bootstrap/`, `bootstrap-tools/` keep
  their place; a fixture with no `.git` is unchanged. This reaches every
  `instanceRootsIn` caller (~40), whatever scope it arrives with.
- **Call sites:** the three above use `siblingScopeFor`, which keeps the root
  instance inside its own checkout.

Regression test: `cat-harness/schemas/instance-roots-worktrees.test.ts` builds a
real `git worktree add` fixture and asserts neither the nested nor the escaped
scan sees a sibling.

### Class audit — recorded, not fixed

`repoRootFor(x)` with an `x` that can be the root instance still escapes the
checkout for **file reads**, though no longer for instance discovery:
`known-skills.ts:462,766` (`join(repoRootFor(root), ".claude", "skills")` — a
missing dir read as empty, the `dh4f` shape), `kg-export.ts:1519`,
`schema-graph.ts:773`, `gen-subgraph-jsonld.ts:540`,
`check-subgraph-coverage.ts:440` default, `voice-criteria.ts:75`,
`liquid-values.ts:124` and `cat-harness.ts` `rootForScope`/6065 (a
`scope: "repository"` entry on the root declaration), `core/access.ts:83`,
`pages-bootstrap.ts:152`, `check-agents-xref.ts:266`, `validate-skills.ts:78,85`,
`ensure-landing-sticky.ts:386`, `declared-dirs.ts:45`,
`check-retired-front-matter.ts:46,212`, `library-graph.ts:748`,
`voices-graph.ts:269`. Each is safe today only because its caller passes a
NESTED instance. The fix is `repoRootFor` answering "the checkout" for the root
instance, which changes ~60 callers and is its own bean.

Static sweep of non-git enumerators seeded at a root-ish variable with no
dot guard: 32 candidates; those inspected (`check-secret-leaks`,
`check-self-discharging-instances`, `process-model`, `lean-coverage`,
`summaries`, `beans-prime`, `check-declared-paths`) walk a named subdirectory.

- [x] Reproduce with a nested probe worktree — done; not reproduced (above).
- [x] Instance discovery cannot list a sibling or nested worktree — `isForeignCheckout`, with a regression test.
- [x] The three call sites that composed the escape use `siblingScopeFor`.
- [x] `repoRootFor` escapes the checkout for the root instance — classified and fixed below (`checkoutRootFor`).
- [ ] What actually produced the 2026-10-03 5-of-220 — not determined.

## 2026-10-03 — the `repoRootFor` class, classified and fixed (session_01AxhsSvodhTgaioG1nUBWkh)

**Shared primitive: `checkoutRootFor(instanceRoot)`** in
`cat-harness/schemas/cat-harness.ts`. An instance holding its own `.git` that
its parent's `.gitmodules` does not name IS a checkout (main clone or
worktree) and answers itself; anything else is nested and keeps `dirname`
(`repoRootFor`'s contract, unchanged, so every non-git fixture reads as
before). A declared submodule whose parent holds no `.git` THROWS rather than
guessing (`dh4f`). Read from the filesystem, not `git rev-parse
--show-toplevel`: `rootForScope` is on the hot path of every declared-directory
resolution, and a fixture built under a checkout would get the ENCLOSING
toplevel. **It absorbs, rather than duplicates, the `checkoutRootFor` that
`schemas/harness-config.ts` already exported** (the container rule alone, i.e.
`siblingScopeFor`): the container rule is kept for git-less trees and that
export now delegates here, so `kg-audit`, `kg-export` and `qa-witness` get the
git-aware answer too — a root checkout that aggregates nothing no longer
returns its parent. `repoRootFor` itself is not changed — ~60 callers, most fed a nested
instance, and its tests pin `dirname`.

Classes: **(a)** reads a sibling INSTANCE → `siblingScopeFor`; **(b)** reads a
REPOSITORY-level file → `checkoutRootFor`; **(c)** correct as is.

| site | class | why / fix |
|---|---|---|
| `cat-harness.ts` `rootForScope` | b | `scope: "repository"` base → `checkoutRootFor` |
| `cat-harness.ts` `declaredKindsEntryRoot` (was :6147) | b | inlined copy → `rootForScope` |
| `liquid-values.ts:124` | b | inlined copy → `rootForScope` |
| `kg-export.ts:1519` | b | root declaration's `repository` → `checkoutRootFor` |
| `gen-subgraph-jsonld.ts:540` | b | root declaration's `repository` → `checkoutRootFor` |
| `schema-graph.ts:773` | b | path base; `kg-audit` passes the root instance → `checkoutRootFor` |
| `check-subgraph-coverage.ts:440` default | b | decides `isRoot` → `checkoutRootFor` |
| `core/access.ts:83` | b | actor registry at the checkout → `checkoutRootFor` |
| `pages-bootstrap.ts:152` | b | `.github/workflows` → `checkoutRootFor` |
| `ensure-landing-sticky.ts:440` | b | `declaredIn` relative path → `checkoutRootFor` |
| `check-retired-front-matter.ts:212` default | b | sweep roots → `checkoutRootFor` |
| `library-graph.ts:748` default | b | upload-queue base → `checkoutRootFor` |
| `known-skills.ts:462` | b | `.claude/skills` → `checkoutRootFor`, **scope preserved** (below) |
| `voice-criteria.ts:75` | a | `instanceRootsIn` → `siblingScopeFor` |
| `voices-graph.ts:269` default | a | `instanceRootsIn` → `siblingScopeFor` |
| `known-skills.ts:766` | c | guarded to `OWN_INSTANCE` (nested) |
| `check-agents-xref.ts:266` | c | instance from `import.meta.dir` = `cat-harness/` |
| `validate-skills.ts:78,85` | c | `rootDir` = `cat-harness/` |
| `declared-dirs.ts:45` | c | instance from `import.meta.dir` |
| `check-retired-front-matter.ts:46` | c | `INSTANCE` = `cat-harness/` |
| `ensure-landing-sticky.ts:386` | c | already guarded (`repoRoot !== own` and `.git`) |

**13 (b) + 2 (a) fixed, 6 (c) left.** Not swept: the ~40 further
`repoRootFor` callers outside the bean's list (e.g. `kg-export.ts`'s
`repoRootFor(ROOT)` with `ROOT` = `cat-harness/`); those inspected take a
nested instance.

### The rescope this fix walked into — the bean's own trap, again

Pointing `known-skills.ts:462` at the checkout WIDENED the root instance's
skill set: **0 → 4** names, one of them `SKILL` (the stem of
`.claude/skills/interaction-modality/SKILL.md`), and `kg:audit:all` regenerated
`folio-assistant/kg-qa/scenarios/kg.kg-qa.json` with a new
`skill-has-entry-point` fail. So the read now never leaves the checkout, but
the root instance still does not read `.claude/skills`. Whether it SHOULD is a
scope decision, open, and not made here.

Regression: `cat-harness/schemas/instance-roots-worktrees.test.ts`, a real
`git worktree add` fixture with the root instance in `.claude/worktrees/<x>`,
asserting `checkoutRootFor`, `rootForScope`, `findPublishWorkflows`,
`skillMdDirs` (a seeded `.claude/worktrees/.claude/skills/leak` is not read),
`check-retired-front-matter`'s sweep roots, `auditInstance`'s default and
`readSchemaGraph`'s module paths all resolve inside the worktree — plus a live
assertion on the checkout the test runs in.

- [x] Whether the root instance should read the checkout's `.claude/skills` (0 → 4, including a bogus `SKILL`). Owner, 2026-10-04: "do g43f". It does, and a `.claude/skills/<group>/` holding only Claude Code's `SKILL.md` loader stub is not a group of skills: **0 → 3** (`bean-coordination`, `todo-manager`, both stubs of corpus skills, and `language-trap-agent-audit`). The stub rule is scoped to `.claude/skills` only — elsewhere `SKILL.md` is a skill's own file (who-iris's voices), and excluding it globally dropped three of them from `kg:audit` (measured, then reverted). Regression in `instance-roots-worktrees.test.ts`; `kg:audit:all:check` 14/14 clean.

## Completed on landed evidence
Landed on main in commit 25b66768c08e (known-skills: root instance reads its own .claude/skills; SKILL.md-only group is a loader stub).
