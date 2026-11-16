---
# folio-assistant-qrlc
$schema: bean/1.0.0
title: 'LIVE vs LATENT: does a scanner''s committed OUTPUT change when gitignored content is present? The detector xd1g could not build'
status: completed
type: task
priority: normal
created_at: 2026-09-27T16:37:38Z
updated_at: 2026-10-07T17:18:00Z
parent: folio-assistant-1xhc
---

## Built and falsified, 2026-09-27 — PR #1475

The question `xd1g` could not answer, and a sibling session posed: **does a
generator's COMMITTED OUTPUT change when gitignored content is present?**

`bun run detect:live-corpus`. Twice per writer with the tree restored between
-- run as committed, record what it changed; plant gitignored content, run
again, record what it changed. Different change-sets => LIVE.

Nothing is listed by hand. The comparison is `git status` plus each changed
path's content, so it needs no writer->artefact table; the writers themselves
are derived (`X` is a writer when `X:check` exists). That is deliberate: a
roster is the class this bean family has now paid for four times.

## The falsifier, run first and passed

    against a0f7719032e~1 (pre-fix kg-detangle)   LIVE
      first artefact named: schemas.detangle.json   <- the 233 -> 1443 file
    against the fixed code                         latent

It separates the one known live case from its own fix. Re-runnable: detached
worktree at that ref, symlink node_modules, copy the probe in.

## THE RESULT, and it answers the open question

62 writers: **3 LIVE, 52 latent, 7 undetermined.**

The sibling entry says *"across every scanner examined in this bean's
lifetime, exactly one had a live effect: `kg-detangle`, and it is fixed"*.
**That is no longer true, and this is the measurement that shows it.** Two
independent writers are live RIGHT NOW on the fixed tree:

- **`docs:auto`** -- reproduced by hand. A planted `probe.bpmn` under the
  gitignored `block-qa-schema/dist/`, which sits INSIDE the declared
  `cat-harness/schemas` graph directory, is published as a PROCESS on
  `docs-auto/index/processes/index.html`, with a GitHub blob link to a file
  that is not in the repository. A contributor who has run a build publishes a
  page listing a process nobody wrote, pointing at a 404.
- **`library:viz`** -- independently live; 3 artefacts move.
- `skill:register` reports live on the SAME two files, because `docs:auto` runs
  inside its chain. Not counted as a third cause.

7 undetermined (`health`, `ingest:ig*`, `translate-bpmn*`, `translate-kg-viewer`)
-- they exit non-zero in this container, so the probe reports them unmeasured
rather than latent. A failed run read as "no difference" is `dh4f` one level up.

## Three refusals, each guarding a way to fake a clearance

Dirty tree -> exit 2 (cannot tell the writer's output from yours). Writer
exits non-zero -> UNDETERMINED, never latent. `restore()` never deletes
untracked output a writer created -- `deletion-requires-confirmation` in the
script most likely to breach it.

## LATENT IS NOT A CLEARANCE

It means this plant did not reach the writer: five extensions under two ignored
trees. A different extension or directory could still reach it. The report says
that in those words rather than implying a pass, because "measured clean" and
"not reached by this probe" are different facts and this establishes only the
second.

## Open

The two live writers are NOT fixed here -- this bean built the detector and
measured. Fixing `docs:auto` and `library:viz` is the next piece, and it now
has a test that can show it working, which is exactly what the sibling said a
shape-sweep could never have.

## Completed on landed evidence
Landed on main in PR #1475 (qrlc: git-derived top-level scan for three scanners, and the live-vs-latent detector (finds 2 live writers)).
