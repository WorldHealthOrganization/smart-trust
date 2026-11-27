---
# folio-assistant-tqjj
$schema: bean/1.0.0
title: 'LSI trio off main: the index sidecar, its run record and the viewer page conflict on ~80% of merges'
status: completed
type: task
priority: normal
created_at: 2026-10-04T08:21:22Z
updated_at: 2026-10-07T17:30:00Z
parent: folio-assistant-hfag
---

Sibling of ba9e (its worked example is PR #2044); the class is y7b3, "a timestamp or total in a committed generated file turns every pair of concurrent changes into a conflict". The landing place is arc 3fva, owner rulings D1/D4.

## Measured (2026-10-04, this checkout, 400 commits on main)

| file | commits touching it, of 400 |
|---|---|
| cat-harness/test/results/lsi/cat-harness/skills.lsi.json | 317 (79%) |
| cat-harness/docs/lsi/index.md | 319 (80%) |
| cat-harness/test/results/tool-runs/lsi-index/cat-harness/skills.tool-run.json | 254 (64%) |

## in5a does NOT apply, measured

in5a is about content that depends on the CONTAINER. Regenerated skills.lsi.json
in this container on an unchanged tree: byte-identical to the committed file
(diff 0 lines). It is tree-determined, so take-base plus a regeneration pass
converges -- in5a loop absent.

The reason take-base is still not the fix is global SENSITIVITY, not
nondeterminism. Appending one sentence to one of 229 skill files changed:

- fingerprint
- 9 of 12 `dimensions` entries
- 166 of 229 `neighbours` entries (72%)
- `findings`: UNCHANGED. Every other field: unchanged.

Byte shares of the 89,585-byte sidecar: `neighbours` 84,167 (94%),
`dimensions` 4,692 (5.2%), `findings` 248 (0.3%). So every merge rewrites 94%
of the file, and the only judgement in it is 0.3%.

## And nothing on main judges those bytes

.gitattributes 77-80 already records it: corrupting the sidecar fingerprint
left lsi:skills:check at exit 0, because that gate validates the RUN RECORD
fingerprint and never the sidecar contents. That measurement is why
skills.lsi.json was refused a -merge entry (eqxp).

## The landing place exists and the last blocker is gone

- cat-harness.json declares storage {branch: cat/cat-harness/qa-reports,
  keyedBy: commit} on test/results/.
- .gitignore:255 already ignores cat-harness/test/results/ and says "neither is
  committed" -- yet 1,028 files there are still TRACKED.
- Readers were migrated by oq1j.
- 5hox recorded on 2026-10-02 that lsi:viz:check exits 2 for want of a main/
  entry on qa-reports. 105 main/<sha> entries now exist (latest publish
  2026-10-04T08:16).

Measured with the LSI sidecars moved aside:

- lsi:skills:check  exit 0  "fresh -- recomputed in this run (229 units)"
- lsi:viz:check     exit 0  "indexes read from qa-reports main/12b916e9...;
                             cat-harness/docs/lsi/index.md is current"

## Scope

The LSI subset of 5hox only -- the 8 files whose readers oq1j already migrated.
NOT the 1,186-file removal: its (A)-(E) gate blockers are other QA families.

## Done when

[ ] the 4 *.lsi.json and 4 lsi-index *.tool-run.json are untracked from main
[ ] docs/lsi/index.md no longer carries a value that moves with a corpus edit
[ ] bun run cat gates green
[ ] merge-conflict-patterns / the LSI skill say where the data now lives


## Claim 2026-10-04

Held by session https://claude.ai/code/session_01SjvqTkDQsqa6SLLFjBwoD3, branch
worktree-agent-a51863e62bc94a374. beans:claim reported the bean is new on this
branch so no sibling can see it; claimed locally, visible when the PR opens.


## Progress 2026-10-04 — PRs #2066 and #2068

Split, because a diff touching `.github/workflows/` cannot be resolved by the
merge bot (no `workflows` token scope; owner ruling on #2043):

- **#2068** (one file + its required gates.ts exemption): the docs-site build
  step that draws the viewer page. Safe to merge FIRST — while the page is
  still committed the step rewrites an ephemeral build tree.
- **#2066**: everything else.

### Measured since the bean was written

- `qa:refresh` mode was per CHECKOUT, not per writer. Untracking one family
  while 1,020 siblings stayed tracked left mode=`tracked`, so no writer ran,
  nothing produced the family, and `qa-reports` stopped carrying it with NO
  step failing. Fixed to decide per writer from each writers declared paths
  (`mixed` mode). This is also what makes 5hox landable one family at a time.
- Untracking the sidecars does not fix the PAGE, it moves the defect: with no
  sidecar in the checkout `lsi:viz` reads `qa-reports` at `main`, which
  `parseQaRef` resolves to `main-latest`. A committed page would then go stale
  whenever anyone else pushed to main -- in5a loop, via the network. So the
  page is drawn in the docs-site build after its `qa:fetch`, which pins the
  entry to the build sha.
- `lsi:viz:check` now asks whether the page can be DRAWN. Falsified against
  `--ref pr/999999`: exit 2, "MISS ... this is NOT a pass".
- The docs-auto `lsi` type is REMOVED. `filesOfGraph` reads the committed tree
  by contract, so it collected nothing while the qa dirs held 1,215 other
  files and the dh4f guard refused -- correctly.
- Corroboration of the ba9e class, live: untracking 8 files moved two README
  counts (`cat-harness/test/README.md` 1028 -> 1020, `docs/README.md`
  153 -> 151).

### Still open

[ ] `bun run cat gates` green on #2066
[ ] #2068 needs the `STEP_EXEMPTIONS` entry for `bun run cat lsi:viz`
    ("no step CI runs is unclassified", gates.test.ts)

## Completed on landed evidence
Landed on main in PR #2044 (ba9e: no file counts in committed READMEs; publish them in the KG export).
