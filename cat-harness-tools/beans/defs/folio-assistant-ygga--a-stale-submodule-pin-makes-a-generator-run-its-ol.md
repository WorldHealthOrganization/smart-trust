---
# folio-assistant-ygga
$schema: bean/1.0.0
title: A STALE SUBMODULE PIN makes a generator run its OLD code and report success, and the gate guarding its output re-runs the same stale writer and finds it current
status: completed
type: bug
priority: normal
created_at: 2026-10-03T09:28:22Z
updated_at: 2026-10-07T17:24:00Z
parent: folio-assistant-1xhc
---

## Measured 2026-10-03 on PR #1959, with a 101-file blast radius

A generator that lives in a submodule runs the code the **pin** points at, not
the code `main` carries. After `git merge origin/main` the pin moves, and a
worktree whose submodules were not re-initialised runs the OLD generator.

While resolving `beans/README.md` on `claude/platform-milestone`,
`bun run cat readme:subgraphs` was run before `git submodule status` was checked.
Both submodules reported `+` (stale). The old generator ran and rewrote
**101 READMEs**, stripping the provenance banner from each. It exited **0** and
printed `101 written`.

### Why this is worse than an ordinary stale-artefact bug

**`101 written` is indistinguishable from a correct run.** The output of a
correct run and the output of a 101-file silent deletion have the same shape,
the same exit code, and no warning between them.

And the gate does not catch it. `readme:subgraphs:check` re-runs **the same
stale generator** and compares its output against the files that generator just
wrote, so it finds its own output current and passes. Committed, this would
have been:

- a 101-file deletion of authored provenance banners,
- **conflict-free**, because the deletions are on one side only, and
- **green on the very gate that guards those files**.

That is bean `ymsu`'s shape (a gate that writes what a later gate reads) with
the writer's *version* as the hidden variable instead of its ordering, and
`1xhc`'s consequence: the gate firing tells you nothing, because it is agreeing
with itself.

It was caught only because the files were restored from `MERGE_HEAD`, the pins
updated, and the generator re-run: `0 written`, `0 stale`.

### Also measured

With current pins the generator emits **descriptions, not file counts**, so
adding a bean no longer makes `beans/README.md` stale at all. An agent carrying
the older mental model will "fix" a count that the generator has stopped
producing.

## Proposed (raised by the agent that hit it; not yet decided)

1. **`readme:subgraphs` — and any generator whose code lives in a submodule —
   refuses, or at minimum warns loudly, when `git submodule status` reports
   `+`.** A one-line guard against a measured 101-file blast radius. Refusing is
   the safer default: a generator that cannot tell which version of itself is
   running has no business writing 101 files.
2. **`git submodule update --init --recursive` belongs after every merge from
   `main`**, not only at session start. The hazard recurs on every merge-forward
   because main moves the pins while you work, which is why a session-start-only
   habit does not cover it.

## Done when

- a stale pin cannot produce a silent full-tree rewrite: the generator refuses
  or warns, and the decision between those two is recorded with its reason;
- the check and the writer cannot agree with each other out of a stale pin —
  whatever form that takes, it is stated how the check detects a version skew
  it is itself subject to;
- the merge-forward guidance names the submodule update.

## Not in scope

The `bun run cat gates` contention in a shared container, and whether this
environment needs a documented gate split or an explicit "CI is the gate" — a
separate finding from the same session, and its own bean.

## Completed on landed evidence
Landed on main in PR #1959 (beans(rwmf): a fourth milestone, GOAL 4 / PLATFORM — with a per-epic assignment PROPOSAL for all 17 orphan epics).
