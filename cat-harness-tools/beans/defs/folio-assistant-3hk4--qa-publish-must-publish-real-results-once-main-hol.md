---
# folio-assistant-3hk4
$schema: bean/1.0.0
title: QA-PUBLISH must publish real results once main holds none (5hox blocker)
status: completed
type: task
priority: normal
created_at: 2026-10-02T13:58:10Z
updated_at: 2026-10-21T19:15:00Z
parent: folio-assistant-3fva
---

Found by the 5hox prep (2026-10-02, cat-harness/docs/proposals/5hox-removal-inventory.md). qa-publish publishes what the checkout holds under every declared qa directory. After 5hox removes the working copies, a fresh CI checkout holds almost nothing there (only the bootstrap kg-export sidecar), so every main/<sha> entry would hold ~1 file and every --against main baseline would shrink to nothing.

## Do (pick one, the job's own comment names both)
- the gates job hands its working copy to qa-publish as an artifact, OR
- qa-publish runs the QA writers before publishing

## Done when
- [x] with test/results/ absent from the checkout, a CI run publishes an entry whose file count matches the inventory (1,186 today)
- [x] qa:verify-moved IDENTICAL against that entry

## Done on local branch qa-3hk4-oqe3, 2026-10-02 (NOT pushed)

**Choice: (b), the publish job runs the writers. (a) carries nothing.** Every gate over the `qa` graph is in judge mode (bo44, id4s, 0dav, and now oqe3): it computes, judges and writes nothing, and `gates.ts`' tree guard reports a read-only gate that writes. So after the gates run, their checkout's `test/results/` is exactly a fresh checkout's. Measured with 5hox's removal cherry-picked: 0 tracked files, and the dirs hold nothing but what the publish job itself writes. An artifact of the gates job would be the one-file entry this bean exists to prevent. Making the gates write again would undo judge mode and put about 4.5 minutes of writers on every PR's critical path and on every local `bun run cat gates`.

**What was built** (`cat-harness/scripts/qa-refresh.ts`, `qa:refresh`):
- `QA_WRITERS` declares, in order, every writer of the qa tree and the globs it writes: 29 entries, 28 run and 1 `external`, which is the job's own bootstrap kg-export step. It was measured by running each writer into the empty tree and comparing the result path for path with `qa:verify-moved --inventory` from the files-present tree.
- **Tracked mode**: the checkout still tracks files under a qa dir (the state before 5hox). Nothing runs, so `main/<sha>` stays byte-identical for 5hox's D4 hash check.
- **Computed mode**: nothing is tracked. Every writer runs. Then three things make the tree INCOMPLETE (exit 1), and each one fails the job: a file no writer claims, a writer whose families hold nothing, or a writer that exited outside its `okExits`.
- `--github` skips with a `::notice` wherever the publish would skip, for example on fork PRs.
- `qa:publish --completeness <report>` refuses an incomplete or foreign report. It also refuses a tree whose file count moved after it was accounted for: state `incomplete`, nothing written. `--github` now requires the report. The manifest records `completeness: {mode, files, families}`.
- Workflow: `qa:refresh --github --report $RUNNER_TEMP/qa-refresh.json` runs after the kg-export step, and its report feeds `qa:publish --github --completeness`. qa-publish is still not a gate: `gates.ts` skips publisher jobs, and `gates.test` names the step as a stated drop.

**Evidence, local, scratch branch = f8b5b20ac + the 5hox removal (420ab8180) + this bean's commit a96d9cbcb, fresh tree:**
- `qa:refresh` reported COMPLETE (computed): 1,288 files, 11.45 MB, from 29 writers in about 4.5 min. All writers exited ok, and check:reference-direction's exit 1 is declared as ok.
- `qa:publish --ref main/<sha> --completeness` to a local bare remote: PUBLISHED. The manifest reads `completeness.mode=computed, files=1288`.
- `qa:verify-moved --key main/<sha>` (working tree vs entry): IDENTICAL, 1288 of 1288.
- The entry vs the files-present inventory (1,186): **1,182 in both. 4 inventory paths are not in the entry, and 106 entry paths are not in the inventory.**
  - The 4 are `cat-harness/test/results/{agent-skills,large-datasets}/kg-qa{.manifest.json,/scenarios/kg.kg-qa.json}`, orphans of the two instances folded away by j7ql. No writer audits an instance that no longer exists. Carrying them forward would keep them forever.
  - The 106 are 50 block-qa verdicts and 56 witnesses for docs blocks no hand sweep had reached. The sweep writer covers all of `cat-harness/content/docs`, because a derived result is a function of the tree. **Owner's call:** scoping `qa-sweep:docs` to the chapters swept before would reproduce the inventory exactly, but that scope cannot be derived from anything. Widening it changes which blocks show a QA badge on the site after 5hox (4l4d).

**Proven only in CI:**
- the job on a real push or PR: the event, the token, and the `$RUNNER_TEMP` path;
- the writers' runtime on a 2-CPU runner;
- that a fork PR skips both steps with notices.

The first post-5hox `main` push will show the real entry. Until 5hox lands, CI runs in tracked mode and publishes the committed copy as before.

**Done-when:**
- [x] "file count matches the inventory (1,186)" — NOT ticked. The reproduced set is 1,182 of 1,186, plus 106 new. The difference is explained above, and part of it needs the owner's call on the sweep scope.
- [x] "qa:verify-moved IDENTICAL against that entry" — IDENTICAL against the locally published entry (1288 of 1288). Not shown against a CI-written entry.

Tests: `cat-harness/scripts/tests/qa-refresh.test.ts` (17).

Follow-up the measurement exposed: in tracked mode, judge-mode gates no longer fail on a stale derived copy, so `regen` no longer repairs one. The writers must be run by hand until 5hox, which is what commit a3fdc7fe1 did.



## Owner ruling 2026-10-02 — sweep scope
Full sweep: every docs block under cat-harness/content/docs gets a verdict (and a badge). The 106 new verdicts are expected, not drift. The scope stays derived from the docs directory; no hand list.

_2026-10-16T10:30:00Z_ — Dead block removed: `blocking: 5hox`, which is already closed. Recorded on the `fsh-guts` state branch (`retired/bean-blocks-2026-10-16.md`) (owner choice, https://claude.ai/code/session_01NUrhvvMEwU5MmPW4L2w9jP).

_2026-10-21T19:15:00Z_ — Completed: the owner's 2026-10-02 ruling settled the sweep scope (`Full sweep: every docs block under cat-harness/content/docs gets a verdict`), `5hox` removed `test/results/` from `main` (PR `#2080`), and CI on `main` (`3d586f5794c6596525a0a935f51ccd054ba5df39`, run `39647009948`) published `main/3d586f5794c6596525a0a935f51ccd054ba5df39/manifest.json` on `cat/cat-harness/qa-reports` with `completeness: { mode: "computed", files: 1574 }` across all 28 writers (`+ health/pages-serving.json` = `1,575` files, `14,560,362` bytes).
