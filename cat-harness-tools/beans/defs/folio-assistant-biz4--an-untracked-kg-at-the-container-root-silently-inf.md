---
# folio-assistant-biz4
$schema: bean/1.0.0
title: An untracked _kg/ at the container root silently inflates local detangle counts — 229 becomes 1443, and the gate reads as a code defect
status: completed
type: task
priority: normal
created_at: 2026-09-26T11:26:16Z
updated_at: 2026-10-20T17:47:11Z
parent: folio-assistant-1xhc
blocked_by:
    - folio-assistant-xd1g
---

Found 2026-09-26 while establishing whether `kg:detangle:check` was `hloc`'s
failure or `main`'s. It was neither — it was the container.

## The measurement

`bun run cat gates` in this checkout rewrote
`cat-harness/test/results/detangle/cat-harness/schemas.detangle.json`:

```
-  "size": 229,       +  "size": 1443,
-  "internal": 125,   +  "internal": 709,
-  "cohesion": 0.82,  +  "cohesion": 0.96,
```

Reverting it made `kg:detangle:check` fail (computed 1443 ≠ committed 229).
Committing it would have pushed a number CI contradicts. **Both options are
wrong**, which is the signal that the disagreement is not in the code.

The control settles it. Same branch, clean `git worktree`, `node_modules`
symlinked, one check at a time:

| tree | stale set |
|---|---|
| pristine `main` | `bootstrap/skills`, `folio-core`, `folio-paper-adapter`, `hypothesis-generation`, `scientific-critical-thinking` |
| this branch, clean worktree | **identical five** |
| this branch, working checkout | `cat-harness/schemas` — and **none of the five** |

`cat-harness/schemas` appears in NEITHER clean tree. The cause is an untracked,
gitignored **`_kg/` (4.8 MB)** at the repository root of this container, which
the detangler walks.

## Why it is worth a bean rather than a shrug

**It inverts the usual control.** The standard question is "is this failure
mine or main's", answered by comparing against the base branch. Here the answer
was "neither", and the comparison actively MISLEADS: the working checkout and
pristine main produced **disjoint** stale sets, so a count comparison says
"1 vs 5, different, therefore mine" and a naive set comparison says "no overlap,
therefore mine". Both conclude wrongly. Only a clean worktree of the SAME
branch separates container state from code.

**It is silent and it is sticky.** Nothing warns that `_kg/` is there; it is
gitignored, so `git status` is clean; and the inflated number is plausible
rather than absurd. Every local `bun run cat gates` in this container has been
rewriting that sidecar, and the only reason it surfaced is that a stop-hook
flagged the dirty file.

**A sibling already paid for the audit:coverage half.** The standing warning is
*"NEVER run audit:coverage in this container, INCLUDING to read its output —
untracked root `_kg/`/`schemas/` pollute it"*. This extends the same cause to
`kg:detangle`, which that warning does not name, and the extension is what cost
the time.

## Done when

[ ] It is established WHERE `_kg/` comes from — which script writes it, and
    whether it is a legitimate cache or a stray output. Deleting it without
    knowing that just moves the surprise.
[ ] The detanglers (and whatever else walks the repo root) either skip
    gitignored directories or state why they must not. `gitCorpus` already
    exists for exactly this and is used by four scanners; this one is not among
    them.
[ ] Verified by BREAKING it — recreate `_kg/`, confirm the count inflates, then
    confirm the fixed scanner ignores it. A number that happens to be right on
    a clean machine is not a fix.
[ ] The standing audit:coverage warning is widened, or replaced by the scanner
    fix that makes it unnecessary.

## Not claimed

That `_kg/` should be deleted — `deletion-requires-confirmation` applies, and
nobody has established what it is. Reported, not removed.


## ESCALATION 2026-09-26: the polluted value has reached `main`, and it cost me a wrong commit

This bean was filed as "a local measurement is wrong in this container". Both
halves of that are now too weak.

### It is on the default branch

    git show origin/main:.../cat-harness/schemas.detangle.json  →  "size": 1443

Earlier the same day the committed value was **229** and only this container's
working tree produced 1443. Within roughly ninety minutes `main` carried 1443.
Nobody decided that: a session ran the writer in a polluted checkout and
committed what it produced, which is exactly what this bean predicted and did
not say loudly enough. The clean-worktree value is **229**.

### I then committed a polluted value MYSELF, with a confident wrong argument

Working `m5gx`, two detangle sidecars came back dirty and I reasoned:

> both move by exactly +1 — `processes` outbound 499→500, `folio-core` inbound
> 521→522. `Task_Gates` carries `<skill ref="platform-gates"/>`, which is one
> new edge from processes to skills/folio-core. That is NOT the biz4
> pollution, whose signature is entirely different (schemas 229→1443).

Every sentence there is checkable and the conclusion was still wrong. The
clean worktree computes `folio-core` inbound **521** — unchanged from `main`.
The `+1` was pollution, and the "signature" I used to rule pollution out was a
rationalisation that happened to fit.

**The lesson is not "check the signature more carefully."** A plausible delta
is exactly what pollution looks like when it is small. The only thing that
distinguishes them is a CLEAN WORKTREE, and I had already written that in this
bean before ignoring it because the number looked explainable.

### It cannot be verified in this container at all

With the clean values copied in, `kg:detangle:check` STILL fails here: the
check recomputes, and the recomputation is polluted. So this gate is
structurally unverifiable in any checkout with a stray `_kg/`, in both
directions — it fails on correct data and passes on wrong data.

## Done when — REVISED

[ ] `main`'s `cat-harness/schemas.detangle.json` is corrected from 1443 to the
    clean-worktree value, and whoever committed it is told why, so the same
    checkout does not re-commit it.
[ ] Establish WHAT WRITES `_kg/`. Still unknown, still not deleted —
    `deletion-requires-confirmation`.
[ ] The detanglers skip gitignored directories, or state why they must not.
    `gitCorpus` exists for this and four scanners already use it.
[ ] Verified by BREAKING it: recreate `_kg/`, confirm the count inflates, then
    confirm the fixed scanner ignores it.
[ ] A guard that a committed measurement matches a CLEAN recomputation, because
    the failure mode here is a wrong number that looks right — and this bean
    now has two recorded instances of a reader accepting one, including its own
    author.


## RESOLVED 2026-09-26 — and this bean's own framing was too narrow

The inflation is fixed on `main`, by `a0f7719032e` — *"xd1g: kg-detangle asks git
for its corpus"*. Before it the detangler **walked the filesystem** and counted
untracked and ignored content; after it, it asks git, so only the tracked corpus
counts. `cat-harness/schemas.detangle.json` now reads **231**.

**This bean blamed `_kg/`. The real fault was ignore-BLINDNESS, of which `_kg/`
is one member.** That distinction is not pedantry — it is exactly what misled
the session working `ymsu`, whose correction on `main` is worth quoting because
the reasoning is reusable:

> I tested whether an untracked `_kg/` explained the inflation: moved it aside,
> still got 1443, concluded ignore-blindness was not the cause. The test was too
> NARROW rather than wrong — removing one ignored directory does not remove the
> others an ignore-blind walk also sees, so the number barely moved and I read
> "barely moved" as "not the cause". **A negative result from removing ONE member
> of a set says nothing about the set.**

They also retracted the inversion this bean recorded: 229 was right and 1443 was
theirs, not `main`'s. So the escalation above — *"the polluted value has reached
`main`"* — was **true when written and is no longer true**, and the value was put
there by a session that has since corrected it in public.

## Verified by breaking it, obtained naturally

The bean asked for the pollution to be recreated and the fixed scanner shown to
ignore it. No recreation was needed: **`_kg/` is still present in this container,
4.8 MB, and `kg:detangle:check` now exits 0 with `size: 231`.** The same checkout
computed 1443 earlier today. Three controls agree:

| tree | result |
|---|---|
| clean worktree of current `main` | exit 0, 29 measurements current |
| this container, `_kg/` PRESENT | exit 0, `size: 231` |
| this container, earlier today | `size: 1443` |

## Done when — settled

[x] `main`'s value corrected — **231**, by the session that introduced 1443.
[x] The detanglers skip ignored content — via `gitCorpus`, which `a0f7719032e`
    also relocated to `schemas/` so a skill does not import from a script.
[x] Verified by BREAKING it — the contamination is still on disk and no longer
    reaches the measurement.
[ ] **WHAT WRITES `_kg/` is still unknown**, and it is still not deleted
    (`deletion-requires-confirmation`). It is now HARMLESS to this gate rather
    than answered, and that distinction is the point: the question is real, it
    is just no longer blocking.
[ ] **`audit-coverage.ts` still walks** — `readdirSync` at line 270, no
    `gitCorpus`. The standing warning *"never run audit:coverage in this
    container"* is STILL LIVE. That belongs to **`xd1g`**, which owns the
    scanner sweep and is open and unclaimed; six scanners have adopted
    `gitCorpus` so far.

Closed as the detangle question it was filed for. The two unticked items are
recorded rather than carried: one is a question nobody has answered, the other
is `xd1g`'s.

## Nearly lost

This bean existed only on PR #1401's branch, which was closed unmerged as a
duplicate of `om30`; resetting the branch afterwards discarded it. Recovered
from `d25494497bb` by hand. `ahab`, `3x2o` and `872t` survived because they rode
merged PRs, and `m5gx` survived because `beans:claim` pushes the bean to the
default branch — **claiming is what made it durable**, which is a reason to
claim beyond coordination.


## Verified settled, 2026-09-27 (session on `claude/dead-declaration-keys`)

Re-derived in a container that still carries the contamination, which is the
only place the claim can be tested:

    du -sh _kg                ->  17M   (grown from the 4.8M this bean recorded)
    committed schemas sidecar ->  size 233, internal 126, cohesion 0.82
    bun run cat kg:detangle:check ->  exit 0

So the contamination is on disk and no longer reaches the measurement --
`a0f7719032e`'s `gitCorpus` holds. Marking completed on that evidence rather
than on authorship.

The 4.8M -> 17M growth is worth recording: the five `cat-harness.<locale>.jsonld`
files are dated to this session's `lvw0` work, so the residue GROWS with every
export a session runs. That is an argument for answering "what writes `_kg/`"
rather than leaving it, but it is not this bean's.

## The two unticked items, and where they went

- **What writes `_kg/`** -- still unknown, still not deleted
  (`deletion-requires-confirmation`). Harmless to this gate rather than
  answered.
- **`audit-coverage.ts` still walks** (`readdirSync`, no `gitCorpus`), so the
  standing *"never run `audit:coverage` in this container"* warning is live.
  That is `xd1g`'s, which is open and unclaimed and whose own "Done when" is
  broader: eleven root-rooted scanners, a shared rule rather than eleven
  copies, and a check so number twelve is caught rather than discovered by a
  contributor with residue on their machine.

---

## 2026-09-27 — THIRD INSTANCE, and this one flips a QA VERDICT rather than a count

Found while moving the Lean `lean.ref` resolver out of core (PR #1465). Same
class as this bean's `_kg/`, and the differences are worth recording because one
of them makes it worse and the other makes it catchable.

### The measurement

`bun run cat skill:register` in this container wrote a **seventh** file beyond the
six the change actually stales:

```
cat-harness/test/results/kg-qa/skills/authoring/folio-paper-adapter/lean-generation.kg-qa.json

  "prose-claims-resolve":
-   "result": "unknown"          +  "result": "fail"
-   "detail": "content/schema/references.ts is not in this repository (a folio's file?)"
+   "detail": "content/schema/references.ts declares no `key`"
  totals:  fail 2 -> 3,  unknown 1 -> 0      (and one finding DROPPED)
```

Nothing in that branch touches the `lean-generation` skill.

**Diagnosed, not assumed.** Moved the offending directory aside, re-ran
`kg:audit`: **no change written to that file at all**. Moved it back, the diff
returns. So the cause is container state, exactly as this bean's control
established for `_kg/`.

### The culprit, and why it is not `_kg/`

An untracked **`content/`** at the repository root — four
`*.script.json` sidecars dated 2026-09-12, residue from `c25761d2cfc`'s move of
the instance under `cat-harness/`. They are **not** duplicates of their
same-named counterparts under `cat-harness/content/pipeline/script-sidecars/`:
each names a *different* checker in `source_file` (`qa-checkers-extended.ts` vs
`qa-checkers-vacuity.ts`) and carries `bun-1.3.11` against the other's
`bun-1.3.14`. Two generations, not two copies.

**Distinct from `folio-assistant-oq57` and `-3ozg`**, which are both `completed`
and both about the **tracked** `cat-harness/content/pipeline/script-sidecars/`
being rewritten by `bun test` on volatile fields. This is the untracked ROOT
copy, and neither fix touches it.

### Two differences from the `_kg/` instance

**Worse:** `_kg/` inflates a `size` count — plausible but obviously numeric.
This one flips an adjudication `unknown -> fail` and *drops a finding*, so it
reads as a real QA regression in a skill the branch never went near. A count
invites suspicion; a verdict invites a fix to the wrong thing.

**Better, and it is the useful half:** this residue is untracked-but-NOT-gitignored,
so `git status` shows `?? content/`, and **`check-undeclared-files.test.ts`
catches it** — it is the one difference this bean's own analysis turns on
(*"it is gitignored, so `git status` is clean"*). So the guard that exists does
cover the non-gitignored case and structurally cannot cover the gitignored one.
That is a coverage statement about the guard, not a new guard proposal.

### Status

Left in place, deliberately: the four files are not deletable duplicates, and
removing another session's untracked files is not PR #1465's call. The
regeneration in that PR was done with the directory moved aside, so its six
committed artefacts are what CI writes — verified by the two hard gates going
green on the push.
