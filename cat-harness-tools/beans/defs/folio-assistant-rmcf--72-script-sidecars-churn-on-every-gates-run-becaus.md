---
# folio-assistant-rmcf
$schema: bean/1.0.0
title: 72 script sidecars churn on every gates run because engine_version records the CONTAINER, and it went 1.3.14 -> 1.3.11
status: scrapped
type: task
priority: normal
created_at: 2026-09-26T21:03:15Z
updated_at: 2026-09-29T20:52:42Z
parent: folio-assistant-1xhc
---

Measured 2026-09-26 while running `bun run cat gates` on a clean tree: **72** committed
script sidecars were rewritten, and the only content change in each was run
provenance:

    -  "last_run_at": "2026-09-26T19:43:36.482Z",
    -  "last_run_sha": "abee3acee29e15ad7ae540e254fe31f2cf31cc40",
    -  "engine_version": "bun-1.3.14"
    +  "last_run_at": "2026-09-26T20:46:45.496Z",
    +  "last_run_sha": "aee82c3f51361a76f667c8c6736758710e95b28d",
    +  "engine_version": "bun-1.3.11"

**`engine_version` went DOWN.** `main`'s sidecars are stamped `bun-1.3.14`; this
container runs `bun-1.3.11`. So committing the run's output records an older engine
as the corpus's authority, and the next agent on 1.3.14 flips all 72 back.

## Why this is the `xd1g` shape and not bookkeeping

The tree guard's own advice, printed with the diff, is *"Regenerate and COMMIT what
is stale"*. That advice is right for an artefact derived from the repository and
wrong for one derived from the CONTAINER. `xd1g` measured the same defect one field
over: `cat-harness/schemas`'s detangle size went **1441 -> 1442 -> 229 -> 1443** in
one day, flipping on whether the container that last ran the writer had a package
installed. A wrong-but-stable number still supports "did this change?"; one that
flips destroys the premise of every diff over it.

`engine_version` and `last_run_sha` are exactly that: their value is a fact about
who ran last, not about the subject. 72 files churn on every run from a container
whose bun differs, which is every container that is not the one that last pushed.

## What it costs, concretely

1. **A real diff hides in the churn.** 72 provenance-only rewrites are the noise a
   substantive sidecar change has to be found inside.
2. **The tree guard fires on every local `gates` run**, so the one signal that
   exists for "a gate wrote to the tree it is judged on" (`ymsu`) is permanently
   tripped by something harmless — and a guard that always fires is one nobody
   reads.
3. **It is a merge conflict generator.** Two sessions on different bun versions
   conflict on all 72, and the resolution is meaningless either way.

Discarded rather than committed on this branch, deliberately, and this bean is the
record of why: `git restore cat-harness/content/pipeline/script-sidecars/`.

## Options, none chosen here

1. **Stop recording `engine_version`.** It is the only field of the three whose
   value is not about the repository at all. Cheapest; loses a fact somebody may
   have wanted for reproducing a checker's behaviour.
2. **Record it, but do not rewrite on a no-op.** Only stamp when the script hash or
   the verdict actually changed — so provenance follows substance rather than
   wall-clock. Keeps the fact, kills the churn.
3. **Move run provenance out of the committed sidecar** into an uncommitted or
   gitignored companion, the way `check:merged` keeps its own workspace out of the
   tree under test.
4. **Nothing, and document that these 72 are always discarded locally** — which is
   what this session did, and it relies on every future agent knowing.

Option 2 looks right from here and is not chosen: `kto9` (completed, archived)
guarded `script_commit_sha` drift in these same files, so whoever owns that guard
has context this bean does not.

## Done when

- [ ] the owner or the sidecar's owner has chosen between recording less, stamping
      less often, or moving provenance out of the committed file
- [ ] `bun run cat gates` on a clean tree in a container whose bun differs from the last
      pusher's leaves the tree clean, or the churn is deliberate and written down


## DUPLICATE of `3ozg`, which is the better record — 2026-09-27

`3ozg` (filed by a sibling, merged as #1438) is the same defect measured
independently: the same 72 files under `cat-harness/content/pipeline/script-sidecars/`,
the same three fields, the same `bun-1.3.14` committed against `bun-1.3.11` local.

**Theirs is the better record and should be the one worked**, for two reasons this
bean does not have: it names the writer, `saveQaScriptSidecar` in `qa-utils.ts`, and
its callers `script-sweep.ts` and `qa-sweep.ts`; and it measured on **pristine
`main`** at two commits, which establishes the churn is not branch-specific — this
bean only ever saw it on a branch.

**Left open rather than scrapped**, because it carries something `3ozg` does not: the
four remedies put to the owner and still unanswered — stop recording
`engine_version`; stamp only on a real change; move run provenance out of the
committed sidecar; or document the discard as intended. Option 2 looked right to me.
Whoever works `3ozg` should read those four and this repository's rule that a bean is
never deleted, only `scrapped` with reasons.

**How the duplication happened is the reusable part.** Neither session was careless:
`rmcf` was filed 2026-09-26 on a branch with no PR yet, so an open-PR search would
have returned nothing, and `3ozg` was filed from pristine `main` where `rmcf` was not
yet visible. That is `dx5j`'s window from a third direction — after the claim-early
rule (`35nj`) and after the re-check-before-PR rule, and it still produced two beans
for one defect.


---

## Same defect as `3ozg`, and the fix is in flight there

_2026-09-27, from the session holding `3ozg`._ This bean and `3ozg` are the same
defect measured independently — 72 sidecars, the same three fields,
`engine_version` 1.3.14 vs 1.3.11. `3ozg` is claimed and carries the fix:
**pin the runtime**, on the owner's instruction.

What landed there: `.bun-version` at `1.3.14`, all 22 `oven-sh/setup-bun@v2`
sites given that literal explicitly (18 said `latest`; four said nothing at all),
a `bun` row in `upstream-pins.json` so the weekly watchdog tracks it, and
`check:bun-pin` asserting the 22 agree with the file.

Two things worth having here even if this bean is later scrapped as the duplicate:

- **Do not "fix" this by dropping `engine_version`.** It is READ —
  `qa-utils.ts:1769`, inside `saveQaScriptSidecar`'s write-skip guard — and
  dropping it makes a sidecar produced by a different engine compare as current.
  The two `last_run_*` fields are already excluded from that comparison, so
  `engine_version` was the only field ever causing a write and the others were
  passengers.
- **CI was the larger offender, not the containers.** Upstream Bun is at
  `bun-v1.4.2`; CI ran `bun-version: latest`, so CI would have rewritten all 86
  sidecars to `bun-1.4.2` on its next sweep whatever any agent did.

Residual, and why `3ozg` stays open: a pin cannot reach a container image the
repository does not control, so an agent whose Bun differs from the pin still
sees the rewrite.

_2026-09-27T05:55Z, cross-reference from bean `3ozg`. A note, not a claim: status untouched, nothing ticked._

**Option 2 is implemented**, on the owner's choice of *"skip no-op writes"* (put to them in the session that filed `3ozg`). `saveQaScriptSidecar` no longer counts `engine_version` as a change, so a script sidecar is rewritten only when its source file, hashes or extra inputs move. The writer this bean never named is `init-folio-qa.test.ts`, which runs a real `qa-sweep`. It was found by bisecting 432 test files. With the fix, `bun run cat gates` passes 167/167 and ends clean.

Whether this bean closes on that evidence is for its owner, per `bean-coordination` §"Closing a bean whose work has already landed".


_2026-09-29_ — **Scrapped as a duplicate of `3ozg`** (owner choice '1 2 3' on the LSI epic-filing proposal, bean ansc). Same defect (72 script sidecars rewritten, the same three provenance fields); `3ozg` measured it on pristine main, named the writer (`saveQaScriptSidecar`), and was fixed and completed with the owner's chosen remedy — `engine_version` no longer counts as a change — which answers remedy 1/2 of the four listed here. Found by `lsi` (cosine ≥ 0.95) and confirmed by reading both. Not deleted: a scrapped bean keeps the next agent from re-filing it.
