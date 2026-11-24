---
name: branch-archaeology
description: >
  Classify every remote branch against the default branch (merged, landed by
  squash or cherry-pick, partially landed, unlanded, undetermined) by commit
  ancestry, patch-id and merge-tree, not by subject line. Report only, never
  delete. A branch touching content or mathematics is a salvage-review item
  and never a delete candidate. Covers the treeless fetch that makes thousands
  of branches cheap, caching by tip sha, and the report's shape. Read before
  answering "which branches can go?" or "what work never landed?".
graph-typologies:
  - beans
---

# Branch archaeology: what each branch holds that main does not

The question sounds like `git branch -r --no-merged`, and that command answers
it wrong. It tests **ancestry**, so a branch landed by **squash** or
**cherry-pick** (which is how most PRs land here) shows as unmerged forever.
`lsi:epics` uses it to find unmerged branches, which is fine for filing and
wrong for disposal.

**Measured in one folio, 2026-10-04:** 6,480
remote branches, of which **461 held mathematics not on main**. Those 461 are
the reason for the rule in §2. A sweep that labelled them "stale" would have
offered the only copy of proofs for deletion.

## 1. The five classes, decided in this order

| class | test | meaning |
|---|---|---|
| `merged` | `git merge-base --is-ancestor <tip> origin/main` | every commit is on main |
| `landed` | `git merge-tree --write-tree origin/main <tip>` produces **main's own tree**, or every commit's patch-id is on main (`git cherry origin/main <tip>` prints only `-`), or the branch's **combined** diff patch-id matches a main commit (the squash case) | the CHANGE is on main under other commits |
| `partial` | some commits' patch-ids are on main, some are not | part landed; the rest is unique work |
| `unlanded` | none of the above, and every test ran | unique work |
| `undetermined` | a test could not run: an object could not be fetched, or merge-tree conflicted and patch-ids disagree | **not** `unlanded` and **not** `landed`. Report it as unknown |

Some notes on the tests:

- **The merge-tree test is the strongest.** If merging the branch into main
  changes nothing, then nothing on the branch is missing from main, however it
  got there: squash, cherry-pick, a re-implementation with the same result, or
  a revert-and-reapply. A **conflict** proves nothing either way, so move on to
  the patch-id tests.
- **`git cherry` compares per-commit patch-ids.** It catches cherry-picks. It
  misses a squash, because one squashed commit's patch-id equals the sum of the
  branch, not any single commit. Hence the combined test:

  ```sh
  base=$(git merge-base origin/main "$tip")
  git diff "$base" "$tip" | git patch-id --stable          # the branch as one patch
  git log --format=%H "$base"..origin/main | while read c; do
    git show "$c" | git patch-id --stable                  # each main commit since
  done
  ```

- **Subject lines are never evidence.** Two commits titled "fix build" share
  nothing, and a squash usually renames.
- **`undetermined` must never be folded into either neighbour.** A census that
  counts it as unlanded inflates salvage work. One that counts it as landed
  offers unique work for deletion, which is the `dh4f` shape: a clean report
  over what the tool could not read.

Two flags sit beside the class rather than inside it:

- **`open-pr: #n`** — any branch backing an open PR is live, whatever its class.
- **`beans: […]`** — work item ids named in its commit messages, the same
  extraction `lsi:epics` performs. This is the link that lets
  `work-plan-restructure` (opt-in `cat-harness.work-plan`) close a work item whose work
  this census shows `landed`.

## 2. Content protection: a content branch is salvage-review, never delete-candidate

**If an unlanded or partial branch touches content, it goes on the
salvage-review list and is never offered for deletion, at any age or size.**
"Content" means any path under a directory the layer declares with a
content kind (`folio`, `library`), any `.lean` file, and the folio's block,
chapter and computation sources. Read the declaration
(`<instance>.json`); do not use a hard-coded path list.

The reason is asymmetric cost. A platform branch's unique work can usually be
re-derived from the issue that motivated it. A proof, a computation or an
authored chapter often cannot, because the session that wrote it is gone and
its scrollback with it. So:

| branch | goes to |
|---|---|
| `merged` / `landed`, no open PR | **delete-candidate** list, with size, age, last author and the evidence that it landed |
| `partial` / `unlanded`, no content touched | **review** list, with unique commits, size and age |
| `partial` / `unlanded`, content touched | **salvage-review** list, with the unique paths and hunks, and work item ids |
| `undetermined` | **unknown** list, with the test that failed |
| any class with an open PR | not listed for disposal at all |

**The delete-candidate list is a report, not an action.**
[`deletion-requires-confirmation`](../../../skills/conduct/conduct-core/deletion-requires-confirmation.md):
the owner reads it, with sizes and ages, and says which go. A branch is the
last copy of its commits once the PR is closed, and `plj1` is that skill's
worked example of a workflow whose shape deleted work nobody decided to delete.

### The content census — "absent on main" is the signal, "differs" is not

For a branch on the salvage list, the question is which of its content is
**nowhere on main**. Compare at three levels, strongest first:

1. **By name, not by path.** For each Lean module and declaration, and each
   block label, the branch adds, search main for the **name** anywhere. A
   module that moved directories is still on main. **Measured in the `qou`
   orphaned-content census, 2026-10-04:** of 60 recent unlanded branches, 32
   touched content and 27 carried content not on main. After excluding schema
   files, the residue was **12 Lean modules on 7 branches** whose names occur
   nowhere on main. That residue is the salvage list. The other 55 files that
   merely "differ" are not.
2. **Path-remapped.** A branch cut before a layout move uses the old paths
   (qou's branches all predate its `content/` → `folio/` move). Remap through
   the move before comparing, or every file reads as absent. Take the remap
   from the commit that made the move. Do not guess it.
3. **"Differs from main" is not unique work.** Main moved on after the branch
   was cut. Count it separately, and never as math. Only a three-way
   comparison against the merge-base says whose change a hunk is.

**Salvage is filed per CLUSTER, not per branch.** 461 branches are not 461
work items. Work items are not sidecars, and one work item per branch is the generated-template
flood `work-plan-restructure` exists to clean up.
Group the salvage list by the subject its unique paths touch (a chapter, a Lean
namespace), and propose one work item per group to the owner.

## 3. Making 6,000 branches cheap: a treeless fetch

```sh
git fetch --filter=tree:0 origin '+refs/heads/*:refs/remotes/origin/*'
```

This fetches every head's **commits** without their trees or blobs: **15 s for
~6.5k branches** in qou. That is enough for the ancestry test and for the
commit-message work item extraction. The merge-tree and patch-id tests need trees
and blobs, which the partial clone then fetches **on demand**, per branch. So
order the work to fetch as little as possible:

1. Ancestry for every branch (commits only, cheap). Most stale branches end
   here as `merged`.
2. Open-PR heads from the API, once.
3. Merge-tree, then patch-id, only for what is left. A branch whose objects
   cannot be fetched is `undetermined` (§1), not skipped silently.

## 4. Cache by tip sha, and know which classes go stale

Key each row by **branch tip sha** and record the **main sha** it was computed
against.

- `merged` and `landed` are **monotone**: main only grows, so they stay true
  while the tip is unchanged. The exception is a revert on main, which the
  next full run catches.
- `partial`, `unlanded` and `undetermined` **must be recomputed when main
  moves**, because the work may have landed since.
- A changed tip invalidates the row whatever its class.

A re-run then costs only the branches that moved plus the non-monotone rows.
The full answer is never re-derived from scratch, which is the waste
[`goal-review`](goal-review.md) and the survey graph (`beans/surveys/`)
already exist to stop.

## 5. The report

For each branch: name, tip sha, main sha, class, the evidence (which test
decided it, patch-ids matched of total), `open-pr`, `beans`, commits ahead,
size of the unique diff, last commit date, and the last author or
`Claude-Session:` trailer. Then the four lists in §2, each with counts, and
the `undetermined` count stated beside the others, never dropped.

Where it goes: summarised on the issue or in a work item note
(`bun run cat beans:note`) for the owner, and the per-branch rows as a file
attached to that review. A committed, declared home for a recurring census
(a `qa-reports` sidecar) is not built yet. Do not invent an undeclared
directory for it. Name the gap instead.

## What this skill does not do

- **Delete, prune or close anything.** Not branches, not PRs, not work items.
- **Judge whether unique work is wanted.** `unlanded` means "not on main", not
  "should be on main". That call belongs to the owner, through salvage review.
- **Replace [`branch-freshness`](branch-freshness.md)**
  (your own branch against main) or [`coordinate`](coordinate.md) (live sibling
  PRs). This skill is the census of everything else.
