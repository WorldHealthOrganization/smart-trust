---
name: prepare-merge
description: >
  Take a feature branch to a clean, conflict-free, green, pushed state so it can
  be merged with no surprises: base merged in, generated files regenerated, the
  folio's content-type gates run, then pushed. It does NOT merge and does NOT
  push to the default branch. Use for "prepare-merge", "make it mergeable",
  "ship it".
user_invocable: true
---

# Prepare-merge — get a feature branch ready to land

Canonical, repo-agnostic recipe for taking a `claude/*` (or any feature) branch
to a **clean, conflict-free, green, pushed** state so it can be merged with no
surprises. Downstream repositories vendor or sync it rather than maintaining
their own copy. "Prepare-merge" is a plain-English ask, not a built-in command,
so without one recipe each agent re-derives the steps, inconsistently or
unsafely.

**"Prepare-merge" ≠ "merge".** It makes the branch *mergeable* and stops. It
does **not** push to the default branch and does **not** merge a PR. Both are
outward-facing, hard-to-reverse actions — do them only on an explicit request.
The merge itself is its own sub-process with its own gate,
[`merge-to-main`](merge-to-main.md): evidence on the head, the owner's
authorisation for THAT merge, recorded, then the merge. Asking for
prepare-merge (or "ship it") is not that authorisation.

## `fsh-guts` must not reach publication

Before a branch that touches the knowledge graph ships, the published export
must contain no reference to `fsh-guts` — not the graph typology, not the
declared directory, not the skill that documents it, and not an edge naming
any of them.

`scripts/tests/fsh-guts-unpublished.test.ts` asserts it against the built
artefact and runs in `bun test`. The mechanism is in
[`kg-export`](../../../skills/kg/kg-core/kg-export.md) §"`fsh-guts` NEVER reaches a published graph".

## Recipe

1. **Clean + committed.** `git status --short` must be empty. Commit outstanding
   work first (the container is ephemeral — uncommitted work is lost on resume).
2. **Fetch the base + your branch** (retry on network error, backoff 2/4/8/16s):
   `git fetch origin <base> <branch>`.
3. **Integrate if the base moved.** Compare `git merge-base HEAD origin/<base>`
   to `git rev-parse origin/<base>`:
   - **Equal** → base hasn't moved; nothing to do (your branch is a clean
     fast-forward).
   - **Different** → bring the base in, resolve conflicts, then re-run the
     green check. A rebase needs a force-push **with lease**: `git push --force-with-lease` — never a bare `--force` (it
     clobbers sibling pushes).

   **Merge with `bun run cat merge:main`, never a plain `git merge` followed by
   regen.** It resolves every conflict a declared pattern covers (glossaries,
   translated glossaries, UML, viewer pages, site data, QA sidecars), refuses
   the rest with the tree restored, and runs regen on the result. A plain
   `git merge` stops on those same generated files, one by one.

   **After EVERY base merge, conflicted or not, run `bun run cat regen`** —
   see §"A clean merge can produce a wrong artefact" below. If you merged with
   `bun run cat merge:main`, its regen already was that run; do not run a
   second one. For a merge whose conflicts were all generated, the round is
   [`merge-conflict-patterns`](merge-conflict-patterns.md) §"A merge round —
   run each check ONCE": targeted checks and a push, with CI's sharded run as
   the full gate set in place of a local `bun run cat gates` or `check:merged`.
   An authored conflict, or a merge that touched code, still owes both.

   A conflict in `test/results/` or `test/attestations/`: see §"Conflicts in
   `test/results/` and `test/attestations/`" below before resolving either by
   hand.
4. **Prove it merges cleanly** (no assumptions):
   - `git merge-base --is-ancestor origin/<base> HEAD` → success means a clean
     fast-forward, so conflicts are impossible. This alone is sufficient.
   - Otherwise dry-run with `git merge-tree --write-tree origin/<base> HEAD`
     (exit 0 = clean; non-zero = not clean; add `--name-only` to list the
     conflicted paths) and trust its **exit code AND its first line**. Exit 1
     means CONFLICT only when stdout opens with the merged tree's id — git
     also exits **1** for a ref it cannot merge (unfetched, mistyped), printing
     no tree, and that is "could not determine", never "conflicted with
     nothing in conflict".
   - **Capture `$?` on the line after the command, before anything else
     runs** — `git merge-tree … >/dev/null 2>&1; rc=$?`, or `cmd || rc=$?`.
     `echo "base($(git rev-parse --short origin/main)) rc=$?"` reports the
     SUBSTITUTION's status, always 0 when the ref exists. `if ! cmd; then
     rc=$?` is the same trap: inside that branch `$?` is `! cmd`'s status, 0.
     `shell-exit-status.test.ts` fails on either shape in a tracked script or
     workflow.
   - **GitHub's HTTP 405 "Pull Request has merge conflicts" is a backstop, not
     a check** — it is learned at merge time, after the PR was announced
     clean. Do **not** grep the old three-arg output for `<<<<<<<` / "changed
     in both": that false-positives on files which legitimately contain those
     literals (docs about merge conflicts, test fixtures, this skill).
   - **A clean text merge is not a clean state.** `merge-tree` answers "do
     the files conflict?", not "do the gates pass on the result?". Before
     asking for a merge, run **`bun run cat check:merged`**: it builds the merge
     with the current base in a throwaway worktree and runs the full
     `bun run cat gates` there (exit 0 passes, 1 fails, 2 could not determine —
     never read as clean). A generated measurement can be green on the
     branch, green on the base, merge without a conflict, and be stale on the
     result.
   - GitHub's **merge queue** tests exactly the commit that will land; the
     gating workflows carry `merge_group:` so it works once the owner turns it
     on. Until then, `check:merged` is the agent's half.
5. **Green check.** Run the project's tests/build (here: `bun test`, plus
   `bun build <file> --target=bun` for type-checking touched files). Report
   **honestly**: distinguish failures you caused from pre-existing ones (diff the
   counts against a baseline run on the merge-base). Do not call a branch green
   by silently inheriting red.

   **Then run `bun run cat security:gate`, by name, and quote its result.** It
   runs every security check this repository has (workflow injection, secret
   leaks, lockfile and toolchain pins, QA reviewer permission, materialised
   fixity) plus two advisories, and refuses when a blocking check fails OR
   could not be run. Most of those checks are also inside `bun run cat gates`;
   naming the command here makes the merge step cover security explicitly,
   rather than only when the CI run before it happened to include it. Its
   advisories (unpinned third-party actions, dependency advisories) are
   reported in the PR and are not cleared by a green gate.

   **Check the adversarial review verdict with `bun run cat check:adversarial-review`.**
   On any branch with agent provenance (trailers, `claude/*` branch, bot
   committer), it verifies that an independent adversarial review verdict
   exists, binds to the head SHA, and covers the full diff without silent
   truncation. Findings are warn-only ("would have blocked"): they are
   recorded, as data for deciding when to promote the check to a gate, and do
   not hold the merge.

   **Know what the target covered.** Green is a claim about the files the build
   compiled, which is usually fewer than the files on disk — build targets
   default to a root plus its transitive imports. Confirm the files *you
   touched* were in it (artifact count vs. source count, or build the module by
   name), and scope any corpus-wide number you quote to what actually ran.

   For `contentType: paper` branches that touch content blocks, also run the
   **`block_pdf_render`** gate:
   ```
   bun run scripts/render-changed-blocks.ts [--upload-drive]
   ```
   This compiles a standalone PDF for every changed block and scrapes the
   LaTeX log; `--upload-drive` additionally pushes clean PDFs to Google Drive
   when it is configured. Exits 1 on LaTeX errors (fix required); exits 0 with warnings
   only (advisory); exits 2 on setup problems — including **no local
   `latexmk`**, which is the common case in a container. Exit 2 means the gate
   did **not run**; report it that way rather than folding it into a green.

   **For a branch that changes a folio's blocks, report review coverage.**
   `content-change-review.bpmn`'s coverage gate (`GW_Covered`, table
   `decisions/review-coverage-gate.dmn`) reads the block counts below and,
   where the preview published a `rendered-impact.json`, three page counts
   (unreviewed pages, undetermined inputs, missed pages; see
   [`rendered-impact`](rendered-impact.md)). Report them in the PR body, in
   the gate's own terms, and a page count the preview did not publish as
   "not known":
   - **open defects**: review comments of kind `defect` still `open` or
     `addressed`, from the preview's `review-comments.json`;
   - **changed blocks with neither a verdict nor a waiver** on their current
     version.

   Both come from one command, the `folio-review-coverage` Tool, run on the
   preview's published files with `--changeset changeset.json --blocks
   blocks.json --comments review-comments.json [--rendered
   rendered-impact.json --measured rendered-measured.json]`. Its command line
   is the Tool node's `invoke`, declared by the content layer that owns the
   review process. Quote its stderr summary. **If the preview has no
   `review-comments.json`, or one with no `verdicts` field, write "not
   measured"**, never 0. Never count resolved comments as coverage: a
   resolved comment is not a reviewer's verdict on the block.

   This REPORTS; it does not merge or refuse. The gate belongs to the review
   process, and the committee decides the outcome. A branch like this is a
   content PR: label it `content` and write its `## Content review` section
   before it is ready (§"Content PRs"). Say so when coverage could
   not be measured, because a branch passed with unmeasured coverage reads as
   "reviewed".
6. **Push** the feature branch (retry/backoff as in step 2):
   `git push -u origin <branch>`. Then **ask whether the push produced a run**:
   `bun run cat check:head-has-run`.

   **The push runs the fast gates first, where the pre-push hook is on.** Git's
   `pre-push` hook (installed by `cat-harness-tools/scripts/git-hooks/install.sh`)
   and, for agents, a Claude Code `PreToolUse` hook on `git push` both run
   `cat-harness-tools/scripts/pre-push-gates.ts` on the checked-out tree, before
   anything leaves the container (work items `cat-tools-pp9g` and
   `folio-assistant-fn8q`). It runs the fast gates **minus the whole-suite
   `bun test`**, plus only the test files whose import closure holds a file the
   push changed (owner, 2026-11-05: "Affected tests only"). CI still runs the
   whole suite. What it says:
   - **refused**: a gate or an affected test that is green on the push's base
     *in this same environment* is red now. Fix it, as you would a red CI job.
     It quotes the gates or tests and the log path;
   - **`? gates not judged`**: a red it cannot attribute to this push (red on
     the base too, or no base outcomes recorded here), tracked files that
     differ from HEAD, exit 2, or no `cat` runner. The push goes and CI decides.
     A fresh container reddens some tests CI passes (no publish-time pages, a
     slower machine), so this is **not** a local green: report it as not
     determined, never as pass;
   - **`✓`**: the fast gates passed on this tree and the affected tests with
     them. A record keyed by the tree is written; it names `bun test` as held
     out, so it never claims the suite. Pushing the same tree again re-runs
     nothing.

   A push the hook refused is never forced through with a bare `--no-verify`.
   If you must push anyway, name the reason, which is logged to
   `.git/cat-gates/push.log`: `CAT_GATES_BYPASS='<reason>' git push ...`, and
   put the same reason in the PR body. A local pass does not replace step 7:
   CI still runs every gate.

   This does not change what you do next — step 7 dispatches either way. It
   changes what you can honestly SAY. A push can silently produce no run, and
   a pull request showing zero checks is indistinguishable from one whose
   checks have not started (§Guardrails, "NO CHECKS IS NOT GREEN"). If the
   check reports **no run**, write that in the PR body alongside the
   dispatched run's URL.

   Three states, and the third is not a finding: `could not ask` (no remote, no
   network, 403, 404) means nothing was established, and it must not be
   reported as either answer.
7. **Dispatch the repo's CI on the pushed branch, and fold the result into the
   PR.** Local green is not CI green — CI runs on a cold cache, its own
   toolchain, and without whatever build flags you set locally. So after the
   push, trigger the relevant workflow against your branch
   (`gh workflow run <wf>.yml --ref <branch>`, or the `actions_run_trigger`
   MCP tool), wait for it, and put the **run URL and conclusion** in the PR
   body. Red → fix and re-dispatch. Do not open a PR citing a workflow nobody
   ran.

   If you lack `actions: write` and dispatch returns 403, do **not** quietly
   skip it: state in the PR that CI was not run, and give the exact command a
   maintainer should run.

   **Find the workflow by reading `.github/workflows/`, not by name.** Guessing
   a workflow name is how this gate gets skipped while appearing to run (a
   guessed name can be a *publish* workflow). In a repository whose workflows
   are all `workflow_dispatch`-only, nothing runs on push or PR, and "CI is
   green" is only ever true because someone dispatched it. Check when CI last
   ran (`actions_list` → `list_workflow_runs`): "there is a workflow" is not
   evidence anything is being checked.

   Many workflows document a **local equivalent in their own header**. Run
   those; they are the same check without the dispatch. Read the workflow
   before assuming there is no local path.
8. **Stop here** unless a PR / merge was explicitly requested. If a PR *was*
   requested, see below.

## What a green LOCAL run entitles you to claim

The same commit can fail different tests in CI, in a clean worktree, and
when the failing files are run alone, and the sets need not be nested. A green
local run is not a weaker version of a green CI run — it is a different
measurement, and either can be the one that is wrong.

What it entitles you to say, exactly:

> *The gates I ran passed, on the tree I ran them on, in this environment.*

And what it does **not** entitle:

- **"CI will pass."** CI tests `refs/pull/N/merge`, not your head — a tree
  neither parent holds. A staleness that exists only in the merge tree cannot be
  seen from any checkout.
- **"The gate set passed."** Only if you ran the gate set. A subset chosen by
  hand misses gates such as `check:partition` (a new script must be classified
  in `scripts/partition/instance-rules.ts`) and `no check script is unrun` (a
  new `check:*` needs a `SCRIPT_EXEMPTIONS` entry when no workflow runs it —
  or, for a script owned by a layer above cat-harness, a
  `gateExemptions.scripts` row in that layer's `<instance>.json`).
  `bun run cat gates` derives its list from the workflow, so it cannot drift
  from what CI runs.
- **"Nothing is failing, so nothing is wrong."** A *conflicted* head produces no
  merge ref, so `pull_request` workflows never fire and the PR shows **zero**
  check runs. That reads as untested, not as red.
- **"It passed in isolation, so the failure is not mine."** Running the file
  alone removes the only condition under which it failed — for example a test
  near its time budget that crosses it only under load.

**Your environment is part of the claim, and it can be checked.** Run
`bun run cat check:environment` before trusting a run from any hand-built
tree, and install dependencies rather than borrowing them: a symlinked root
`node_modules` makes any tool that resolves a real path through it report a
location this repository does not contain. Confirming the symlink is
git-ignored is not enough; path resolution is a separate confound.

## A new gate in a lower layer must pass downstream (STRICT)

A layer that adds a gate or a `check:*` script takes on its downstream
layers too (owner ruling, 2026-11-07, card "Rule 13": add it): the next re-pin of each one runs it. Twice on 2026-11-07 a
lower layer's main broke every downstream re-pin. New check scripts that no
downstream workflow ran failed `no check script is unrun`
(`check:test-gherkin`, and `translation:page-qa:check`, which also had a
flag mismatch). Checks that walked the file tree without skipping declared
build outputs failed too (two such checks in the tools layer). Each time, the
re-pin became the P0.

So, in the same PR that adds the gate:

1. **It passes on the layer's own main.**
2. **It says how downstream layers run it**: either wired through the
   shared reusable workflow, or declared opt-in per layer with an exemption
   row each downstream layer can carry.
3. **A downstream dry run proves it**: lay the branch over a fresh mount of
   folio-assistant main, and run the gate set there. Say in the PR what ran
   and its result.

Without all three, the gate waits. It never lands for the next re-pin to
discover.

The converse holds too: **a gate judges a repository against its own
dependencies, never against a dependent's pins of it.** A gate that mounts a
downstream index and so tests an older copy of the repository under review
is a defect in the gate, and its red never holds the lower PR
([`merge-queue`](merge-queue.md) §"A lower repository never waits on a
higher one").

## A clean merge can produce a wrong artefact (STRICT)

**`bun run cat regen` after every base merge.** Not only after a conflicted one —
after every one. `bun run cat merge:main` runs it as part of the merge, so after
`merge:main` it has already happened once and a second run re-asks the same
tree.

Two branches can change one committed generated file in non-overlapping
places — say one adds a `count` field to a projection's header and the other
adds an entry to its array. Git merges them with **no conflict** and produces
an artefact **neither side would ever emit** (a count that disagrees with the
list).

> **A conflict is a question. A clean merge is an assertion that the result is
> correct** — and for a generated file that assertion is worth nothing, because
> git is merging text it has no way to evaluate.

> **After a merge, RE-RUN THE GENERATORS. Never read the diff to decide whether
> you need to.**

`bun run cat regen` does it by asking each gate first, so its output is the set of
artefacts the merge actually broke rather than a wholesale rewrite:

```sh
bun run cat regen                   # repair what is stale in the whole gate set
bun run cat regen --fast            # ...only the jobs that install no browser
bun run cat regen --dry-run         # report what is stale, change nothing
bun run cat regen --changed <base>  # ask only the pairs whose inputs changed since <base>
bun run cat regen --explain         # say, per pair, why it was asked or not
```

It asks the gates rather than regenerating everything because the gates
(read from the workflow, not `package.json`) are the list, and because
rewriting artefacts that were already correct leaves a diff that says nothing
about what the merge broke.

**The QA working copy is part of the run — do not build it by hand around
regen.** Generators such as `uml:overview` and `readme:subgraphs` read the
computed, ignored `*/test/results/` tree. Before every pass regen asks the
copy's stamp (`bun run cat qa:working-copy -- --status`) whether it was built
from the tree as it stands, and rebuilds it if not. The paths that rebuild
changed join the pass's change set, so any pair that reads them is asked
again. A failed build exits 2, and regen never grades a pass over a half-built
copy. `gates` uses the same stamp, so the `gates` that follows a regen on the
same tree builds nothing.

It reports four states, and **`unrepaired` is the one to read**: a check that
still fails after its writer ran is a real defect, not staleness, and the
command exits non-zero rather than claiming a repair it did not make. So is a
check with **no writer**.

**`--changed` asks less, and says what it assumed.** A pair whose declared
inputs, script sources and commands meet none of the paths changed since
`<base>` (plus the working tree) is **not asked**: its answer is its answer at
`<base>`. Undeclared and `{tracked}` pairs are always asked, as is any pair
whose inputs cannot be determined. `bun run cat merge:main` passes the merge's
**fork point**, so a skipped pair is one NEITHER side touched, and it is
current if the fork point, the branch tip or the base tip was current.
`merge:main -- --full-regen` asks every pair. Separately, every pass after the
first asks only the pairs whose inputs the previous pass actually changed
(measured from `git`, not declared). Both cuts are only as good as the
`task-io.ts` declarations — and, for a task owned by a layer above
cat-harness, that layer's own `taskIo` block in its `<instance>.json`.
`task-io.ts` collects them and **refuses a task declared twice**, so declare a
row where its script lives, never in both places. The whole-tree pairs
(`kg:audit:all:check`, `skill:register:check`, `kg:audit:check`) still run
after every merge.

### Submodules: check the pointers BEFORE you stage the merge (STRICT)

**A base merge can roll a submodule back without a conflict, and `git add -A`
is how.** `git merge` updates a submodule's gitlink in the index but **not the
submodule's working checkout**. If the checkout still sits at the branch's old
pointer, `git add -A` during conflict resolution stages that stale checkout,
rolling the submodule back in the merge commit. `bun run cat regen` then runs
against the old tools and "repairs" generated files to their old form, and CI
fails in code the PR never touched. No step conflicts, and every local check
against the stale submodule passes.

So, after any base merge and **before** staging:

```sh
git submodule update --init --recursive   # move each checkout to the merged pointer
git diff --cached --submodule=short -- bootstrap bootstrap-tools   # must be empty unless YOU bumped it
```

Then regenerate. **Stage paths by name during a merge, never `git add -A`**,
and before pushing confirm the merge carries only your change:

```sh
git diff --stat origin/<base> HEAD   # should list your files, not hundreds
```

A diff against the base far larger than your PR is the signal.

## Conflicts in `test/results/` and `test/attestations/` — regenerate one, read the other

| tree | holds | durable home | on a conflict |
|---|---|---|---|
| `<instance>/test/results/**` | DERIVED verdicts — every `script` entry | the orphan `qa-reports` branch, `main/<sha>/` and `pr/<n>/<sha>/`, written by the CI job `qa-publish` | **take the base's side**: `bun run cat merge:main` does, then `bun run cat regen` |
| `<instance>/test/attestations/**` | JUDGEMENTS — every agent, human and baseline-pair attestation, `qa-attestations/v1` | `main`, as authored content | **a person reads both sides**; never regenerated, never "take ours" |

`test/results/` files are not committed on `main`, so a base merge conflicts
there only for a branch that still carries a copy. `merge:main` takes the
base's side (the `derived-results` pattern in
[`merge-conflict-patterns`](merge-conflict-patterns.md)), which is the
deletion, and `regen` rewrites the working copy. **Do not hand-resolve one and
do not regenerate one in order to "commit the result"**: the record of a
commit is its `qa-reports` entry, which no merge touches. Regenerating is a
resolution, not a guess, because both writers are idempotent
(`sameScriptVerdict` keeps a reproduced entry verbatim and ignores
`reviewed_at`, `reviewed_sha` and `script_commit_sha`), so a sidecar is a pure
function of the tree.

A conflict in `test/attestations/` is two judgements that disagree, and
reconciling them is a person's call. No merge-conflict pattern names that
tree, so `merge:main` refuses it, as does `qa:attestations:migrate`. Keep both
sides' entries unless they are the same judgement; then run
`bun run cat qa:attestations:migrate:check`, which exits 1 if a judgement is
still only in a derived file.

There is no `qa:resolve-conflicts` command: derived sidecars are not
committed, so there is nothing for it to resolve.

## A change that moves a cached step's key — publish what CI can verify

If the change moves the key of an `exact` cached step whose producer the
determinism audit lists as DETERMINISTIC, run `bun run cat cache:publish <step>`
before pushing, so CI only verifies the entry instead of rebuilding it. Today
that is `cat-mount` when `index.lock.json` changes. Verdicts are never
published this way. The rule, the trust classes and the budget are in
[`cache-first-ci`](cache-first-ci.md).

## Content PRs: label `content`, and document the review before ready (STRICT)

Owner, 2026-11-15: "content PRs get a label and that indicates a content
review process needs to be documented as part of making it ready".

**What is content.** A PR is a content PR when it changes folio content
text or what a reader of the folio sees as its substance: block wording,
tables, figures and the models they are drawn from (ArchiMate, BPMN, DMN),
glossary terms and definitions, references, a change set (`CS-`), a public
comment response, or a re-derivation of a content layer's generated
summaries. It is not content when it changes only harness or tool code, workflows, pins
(`index.lock.json`), work items, tests or docs about the platform. A PR that
regenerates a content table or figure from its source is content too: what
the reader sees changes. When in doubt, label it `content`; the owner can
take the label off.

**What the agent does.**

1. **Label it `content` when you open it** (or as soon as you see it is
   content). The label exists in every content repository; create it with
   colour `0e8a16` if a new repository lacks it.
2. **Open it as a draft, and keep it a draft** until the review is
   documented. Never merge it, and never ask the merge manager to: content is
   the owner's or the committee's decision
   ([`merge-manager-watcher`](merge-manager-watcher.md) §"Safety rules").
3. **Before marking it ready, add a `## Content review` section** to the PR
   body that says which review process it went through and points to its
   record. One or more of:
   - the owner's decision card id (`Q-…`) approving the wording, or a
     corpus-gate waiver card;
   - the committee decision or public-comment review-log entry (a link);
   - the editing-hci-validation instance of the changed blocks (its path or
     work item), the record `check:corpus-gate` reads;
   - the review page of the preview with its verdicts (a link), and the
     review coverage numbers of §"Recipe" step 5.
   Say what is still open, if anything. A placeholder ("TODO", "pending")
   is not a record. Never invent a review step that did not happen: a
   recorded waiver is better than a made-up history.
4. **Then mark it ready.** `merge:guard` check 9 (`content-review`) reads
   that section: a content draft without it is `pending`, and a content PR
   marked ready without it is a `failure`.

**Keep functional changes out of it.** A code, configuration, pin, schema,
CI or tooling change found inside a content PR is split into its own
non-content PR, and removed from the content PR with an ordinary revert
commit. Bring a content PR up to current main only after every repository it
depends on is stable ([`merge-manager-watcher`](merge-manager-watcher.md)
§"Merging across dependent repositories", rules 4 and 5).

**What the merge manager does.** `merge:watch`, both the report and
`--queue`, leaves out every PR labelled `content`, so content never appears
in the merge manager's status table, even with `ready-to-merge` on it.
Content PRs go to the owner one by one, by card.

## Shipping is not merging — hand over on the PR itself

A PR is handed over when it is **ready to merge** as defined in
[`merge-queue`](merge-queue.md) §"What 'ready to merge' means".

What happens after the handover is [`merge-to-main`](merge-to-main.md), called
by `merge-train.bpmn` for a queued PR and by `crdm-close.bpmn` for a CRDM
feature.

When the branch is green and pushed, it reaches the Merge Steward only by its
own state: label `ready-to-merge`, a signed `ready: <head sha>` comment, and no
`needs-merge-human`. [`merge-queue`](merge-queue.md) §"Handing a PR to the
queue" has the six points, and when NOT to spend CI keeping up while far back.

The PR's state is the record. The request to merge is a message: send the
merge manager the six-line merge request of
[`merge-manager-watcher`](merge-manager-watcher.md) §"The merge request: six
lines", with the PR URL, the session URL, what changed, the rendered preview
and what to look for in it (owner ruling, 2026-11-07). Never merge it
yourself, and never re-pin to make it green: send `repin+merge:` instead
(owner ruling, 2026-11-13). A lone session is elected merge manager alone,
so it posts the same six lines in its own chat, then asks the owner by
card.

## Opening the PR (only when asked)

GitHub access here is via the **GitHub MCP server**, whose tools are
**deferred** (lazy-loaded). At session start they appear as names only — you
cannot call them until you load the schema:

```
ToolSearch  "select:mcp__github__create_pull_request"
```

Then call `mcp__github__create_pull_request` with `owner`, `repo`, `head`
(the feature branch), `base`. This "load-then-call" round-trip is by design,
not a failure, and is needed once per deferred tool per session, for every `mcp__github__*` tool (review,
comment, merge, CI status).

PR body content: [`pr-description`](pr-description.md), written for a first-time reader.
PR body convention: end with the Claude Code footer + session link (see the
harness git instructions). Do not include the model identifier in the PR.

## Guardrails

- **Never push to the default branch** and **never merge a PR** without an
  explicit ask. Prepare-merge leaves the decision to the human. When the ask
  comes, the merge runs [`merge-to-main`](merge-to-main.md); a broad
  instruction such as "fix all issues until green" is not the ask.
- **In folio-assistant an agent never merges to `main` at all.** When CI is
  green on every job: mark the PR Ready for review, add the label
  `ready-to-merge`, and comment `ready: <head sha>`. The Merge Steward session
  brings `main` in, regenerates and merges. If it reports red: fix, then
  re-label. The policy is in [`continual-progress`](../../../skills/conduct/conduct-core/continual-progress.md)
  §"Green means handed to the Merge Steward".
- **Check the change against the skills that govern it before calling it
  ready**, an agent's PR above all. Green CI says the code does what its
  tests say; it does not say the change keeps the rules the owner set for
  that area. Read the governing skills (from the mounted layers when the MCP
  skill server is unreachable) and hold the diff to them: a step that, say,
  copies the IG Publisher's finished HTML into a site passes every test and
  breaks `ig-render-jekyll`. A design choice the PR body describes in passing
  is a question for the owner when a skill already answers it, never an
  implementation detail to merge past.
- **`--force-with-lease`, never bare `--force`** when a rebase rewrote history.
- **Honest green.** Pre-existing red is reported as pre-existing, with evidence;
  your-change red blocks the "ready" claim.

- **NO CHECKS IS NOT GREEN — verify against the run list, never the PR page.**
  A PR with **zero** check runs renders *identically* to one whose checks have
  not started. Both are "nothing red". A push followed by a PR can produce no
  `pull_request`-event run for that head, the newest run on the branch being
  for the *previous* head. **Waiting longer is not the remedy**, because how
  long you wait does not predict whether a run appears, and neither is
  avoiding force-pushes: plain fast-forwards hit it too.

  So before calling a branch ready, and **before any merge**:

  0. **Read `mergeable_state` FIRST — and believe it only when it says
     `dirty`.** `clean` can be served stale (a merged PR's pre-merge view), and
     `unknown` means GitHub has not finished computing it. `dirty` is the one
     value worth acting on unilaterally, because its remedy — merging the base
     in — costs nothing on a PR that did not need it. `dirty` means the PR
     conflicts with its base, which is very likely why nothing ran: a workflow
     `on: pull_request:` with `actions/checkout@v4` and no `ref:` checks out
     `refs/pull/N/merge`, and **a conflicting PR has no such commit**.

     **When it is `dirty`, merge the base branch in — do NOT dispatch.** A
     `workflow_dispatch` run resolves `refs/heads/<branch>`, so it tests **the
     branch, not the merge result**: on a conflicted PR that is a green signal
     for a tree that will never exist. The workaround in step 3 is for a
     MERGEABLE PR whose run never fired.

  1. Read the PR's `head_sha`.
  2. `mcp__github__actions_list` → `list_workflow_runs`, filtered by branch, and
     find a run whose `head_sha` matches.
  3. **No run for that sha → the branch is NOT ready**, whatever the PR page
     shows. Say so in those words rather than "checks pending", and re-run them
     with `mcp__github__actions_run_trigger` → `run_workflow` against the branch.
  4. Re-check after **every** push. A new commit moves the head, and the head is
     what the absence attaches to.

  An agent holding a standing merge authorisation must not read zero checks as
  nothing-red: **could-not-determine is never rendered as clean**, at the
  merge decision as everywhere else.
- **One branch.** Develop on the assigned `claude/*` branch; moving work to a
  different branch needs explicit permission.
- **NEVER DELETE A FEATURE OR branches/ BRANCH** without explicit assent from the
  user or the repository owner. Not after a merge, not as cleanup, not to quiet a
  tool that complains about it, and never by passing `--delete-branch` or its API
  equivalent. A merged branch is still the record of how the work was done, the
  base a revert or a follow-up is cut from, and the ref a staging deploy is served
  under. Deleting it is irreversible from the agent's side and buys nothing the
  owner asked for.

  The same rule is in [`prepare-merge-auto.md`](prepare-merge-auto.md) Phase 4
  and the anti-patterns, because an agent following either skill must meet it.
  If you change one copy, change the other.

  **When a tool or hook complains about a branch, fix the tool** — for example
  a reachability check in a stop hook — never delete the branch.
