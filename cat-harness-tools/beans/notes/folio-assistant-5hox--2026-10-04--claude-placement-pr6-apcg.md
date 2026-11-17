---
# note on folio-assistant-5hox from claude/placement-pr6-apcg
$schema: folio-bean-note/v1
bean: folio-assistant-5hox
branch: "claude/placement-pr6-apcg"
created: "2026-10-04"
---
## A bot catch-up untracked five of these files on a feature branch; refused and kept tracked

A bot catch-up commit on `claude/placement-pr6-apcg` (`260f9c1262`, author `Claude <noreply@anthropic.com>`) **deleted five of the files this bean protects**, and I have refused the deletion on that branch rather than carrying it.

The five:

- `cat-harness/test/results/detangle/cat-harness/processes/sdlc.detangle.json`
- `cat-harness/test/results/detangle/cat-harness/skills/sdlc/sdlc-core.detangle.json`
- `cat-harness/test/results/lsi/cat-harness/skills.lsi.json`
- `cat-harness/test/results/term-mapping.qa-results.json`
- `cat-harness/test/results/tool-runs/lsi-index/cat-harness/skills.tool-run.json`

Checked rather than assumed: `git cat-file -e origin/main:<path>` says **main still tracks all five** at `2f00a2ea5c`. The removal arrived on the feature branch only.

## The mechanism, because this will happen again to somebody else

`cat-harness/test/results/` **is** in `.gitignore`, and has been for some time — it is not new on this merge. `.gitignore` says why in its own comment: each of those directories declares `storage: { branch: qa-reports }`, so *"the record is the orphan `qa-reports` branch, keyed by commit"*.

But **ignoring is not untracking.** The files are tracked AND ignored, which is the correct mid-arc state for this bean, and any step that rebuilds the index from the working tree — a `git add -A` after a sweep, a regen whose orphan pass runs over an ignored tree — drops them silently. Re-adding them needs `git add -f` precisely because they are ignored, which is the tell that the removal was mechanical rather than decided.

So the risk this bean guards is not only "an agent decides to delete them". It is "an ordinary index rebuild deletes them and the diff looks like housekeeping". On a PR about something else entirely, nobody reviewing it for its stated purpose is looking for an untracking of five committed artefacts.

## Why I did not take the deletion

This bean is explicit: *"only on the owner's explicit go, after the branch holds a hash-verified copy"*, `deletion-requires-confirmation`, **"Never on an agent's own initiative"**, `status: todo`, with four unmet `blocked_by` beans (`7mwa`, `2gst`, `8wj1`, `oqe3`) and preconditions of a 7-day green window on the branch plus a blob-hash-identical `qa-reports:main/<head>` tree for every moved path. None of that has happened.

Resolved on `claude/placement-pr6-apcg` by keeping all five tracked (`git add -f`). They are **not** byte-equal to main's copies and should not be: that branch removes eleven skills, so the LSI index, both detangle sidecars and the term-mapping results all legitimately move. The point is that the branch introduces **no removal**.

## Suggestion for this bean's "done when"

Add a precondition that is cheap and would have caught this: a gate that fails when a commit UNTRACKS a path under a `storage`-declaring directory without the owner's recorded go — i.e. make the untracking detectable rather than relying on every agent reading this bean. The gate has the information it needs: the declaration says `storage`, and `git diff --diff-filter=D` says what left the index.
