---
name: repo-conversion
description: Lay folio-assistant over a repository that already exists, without losing or silently moving what is in it. Scans the tree read-only, classifies candidate files into library (external source) and content (authored here) with an explicit third bucket for what it cannot classify, scans outside the content tree for mathematical evidence and refutations, lists the content markers (an IG, a DAK, processes, work items, library, Lean, folio manifests) the harness could declare and declares only the ones the person picks, puts the three questions the scan cannot answer to the author as selections, and hands ingestion to one agent or a small swarm. Use when a user wants an existing repo converted to a folio, asks to import what is already there, asks whether their PDFs/notes/drafts can come along, or asks what else in a repository an existing harness could declare.
user_invocable: true
---

# /repo-conversion — folio-assistant over a repo that already has a life

Process: the content core's `processes/conduct/getting-started.bpmn`,
`Task_ScanRepo`, `Task_ChooseHarnessed` and `Task_ConfirmImport` (both non-relaxable).
Scanner: `bun run cat-harness-tools/scripts/scan-repo-content.ts`.

## 0. The one rule

**Scan, show, ask, then move — and never in any other order.** The author's
repository is the thing of value; the scaffolding is replaceable. A wrong
import is not fixed by a `git checkout`, because the author has to work out
what the agent did.

`Task_ConfirmImport` is marked `relaxable="false"` in the BPMN, and a content
package may not declare it away.

## 1. Scan — read-only, and honest about its limits

```sh
bun run cat-harness-tools/scripts/scan-repo-content.ts            # human-readable report
bun run cat-harness-tools/scripts/scan-repo-content.ts --json     # same, as facts
```

It walks the working tree (respecting `.gitignore`) and sorts what it finds into
**three** buckets:

| bucket | means | typical |
|---|---|---|
| `library` | external source material — something somebody else wrote, that the folio will cite or ingest | PDFs, papers, scans, datasets, `references/`, `papers/`, `sources/` |
| `content` | material authored here, that could become folio blocks | Markdown prose, `docs/`, `notes/`, `drafts/`, `.tex` |
| `unclassified` | it could not tell | everything else, and it is reported, not hidden |

**`unclassified` is reported, never forced.** A two-bucket scanner's mistakes
arrive as moved files; this one reports what it could not place, and the
author disposes of it.

The classification is by **path convention and extension only**. It does not
read file contents or call a model, so the author can disagree with any row of
it in one word.

### Outside-content candidate scanning — preserving evidence and refutations

In repositories with formal, analytical, or domain-specific content, crucial
verification scripts, macros, and counterexamples often live **outside** the
primary content tree (`content/` or `folio/`); a conversion that carries only
that tree drops the evidence that some claims are false.

`scan-repo-content.ts` scans outside the content tree and classifies these
artifacts into read-only candidate classifications (defined by the content-type
layer's conversion refinement skill), reporting source location, rationale, and
`linkStatus` (`linked` when referenced by at least one content block, or
`unlinked` when orphaned). Like the general scan, candidate scanning **never
writes, moves, or modifies files**; it presents the candidates to the author
and agent so decisions can be made before importing.

## 2. Show, then ask — three questions, all as selections

Present the scan as counts and a handful of examples per bucket, never as a
1,400-line file list. Then three questions, each answerable by picking. Load
[`interaction-modality`](interaction-modality.md) first.

**Q1 — import at all?**
1. Import everything the scan found *(recommended)*
2. Import only the `library` bucket — sources now, prose later
3. Import nothing; just set up folio-assistant
4. Let me pick bucket by bucket

**Q2 — where does each group go?** Only for groups the scan was not confident
about, and only when Q1 was not "nothing". Offer `library/` vs `content/` per
*directory*, not per file (a per-file interrogation is the accessibility
failure in [`interaction-modality`](interaction-modality.md) §0).

**Q3 — leave in place, or reorganise?**
1. **Leave everything where it is** *(recommended)* — the folio references the
   files at their current paths. Nothing moves, every existing link still
   works, and the decision stays open.
2. Reorganise into `library/` and `content/` — tidier, and it rewrites paths.
   Offer this only on a clean working tree, do it in its own commit, and use
   `git mv` so history follows.

Recommend **leave in place** by default: a broken relative link in somebody's
README is a defect.

## 2a. Markers — choose what the harness reads (declare, don't slurp)

A harness declares what it reads in a repository; it does not take all of
its content. The principle is
[directory-conventions](../../kg/kg-core/directory-conventions.md) §"A marker
declares what is read, and nothing else is".

The scan's fourth section, `markers`, lists the content a harness COULD be
told to read: a `sushi-config.yaml` (an IG: `contentTypes.ig`), a legacy
`dak.json` (`contentTypes.dak`), `.bpmn` processes, a work items store, `library/`,
`uploads/`, Lean (`contentType: paper`) and folio manifests
(`contentType: document`). For each it gives the paths, whether it is already
declared — `declared`, `not-declared`, or `unknown` when there is no readable
`index.config.json` to ask — and the snippet that would declare it, with where
it goes (`index.config.json#contentTypes`, or a local layer's
`<name>.json#directories`). Content types come from the registry
(`defaultContentTypes`; an `{ indexSection }` type is checked against
`contentTypes.<id>`), directory facets are checked against the registered graph
typologies, and only the evidence the registries cannot state is a short table
in `cat-harness-tools/scripts/lib/content-markers.ts`. Where each kind of
content lives is [directory-conventions](../../kg/kg-core/directory-conventions.md).

```sh
bun run cat-harness-tools/scripts/scan-repo-content.ts [dir] --markers          # the list
bun run cat-harness-tools/scripts/scan-repo-content.ts [dir] --markers --json   # same, as facts
```

A plain command: any agent host (Claude Code, Gemini CLI, Antigravity, Cursor,
Copilot) or a person at a shell runs it, with no MCP server. It writes nothing.

**Q0 — which of these should the harness read?** (`Task_ChooseHarnessed`,
non-relaxable). Ask it the [`interaction-modality`](interaction-modality.md)
way — the full question in the chat, then a tap card where the host has one,
otherwise a numbered pick-list with its default stated. Never a typed reply.
Offer only the markers that are `not-declared` (or `unknown`), one option each:

1. **None of these for now** *(the default)* — nothing is declared; the scan can be run again any time
2. `contentTypes.ig` — `sushi-config.yaml`, `input/fsh/`, … (the FHIR IG)
3. `directories: processes` — `processes/` (7 BPMN files)
4. Let me pick several — the same options as a multi-select

**The default declares nothing**, and the agent never declares a marker the
person did not pick. Declare exactly the picks — the scan's `suggestion`
snippet, at its `suggestion.at` — in the scaffolding commit, or in its own
commit on a layer that already exists.

**After setup, too.** The same question fits any layer at any time: "what
else could this harness declare?" is `--markers` on the layer's repository,
then Q0. Rows already `declared` are shown for context and are not offered.

A content type registered by a higher harness layer appears as a hint when that
layer is not loaded, with a `note` saying where the type lives. Declaring a
scoped content type is not a boolean flag: its `include` list states everything
that layer's readers will read, so confirm the list with the person and consult
that layer's build-pipeline skill for how additional paths are added later.

## 3. Dispatch the ingestion

Ingestion proper is `library/processes/document-ingestion.bpmn` (and the
content layer's document-intake refinement skill when converting into a content
folio). What this skill decides is *how
much parallelism*, and it is a question for the author because it spends their
tokens:

| scale | when | how |
|---|---|---|
| **inline** | under ~10 documents | do it here, no subagents |
| **one agent** | tens of documents, one kind | a single background agent, reporting per document |
| **small swarm** | hundreds, or several distinct kinds | `dispatch-agent` (opt-in `cat-harness.sdlc`) — 2–4 agents partitioned **by directory**, never by file count |

Partition by directory because a per-file partition puts two agents in the same
manifest, and the conflicts cost more than the parallelism saves.

Open one work item per ingestion front before dispatching — running the existence
check in `todo-manager.md` (opt-in `cat-harness.work-plan`) §"Check before you create" first —
so a session that dies mid-import leaves a plan behind rather than a half-full
`library/`.

## 4. The conversion itself

Once Q1–Q3 are answered, `folio_init` against the existing directory. It refuses
rather than overwrites where a file is already present, which on this branch is
the common case (`README.md`, `.gitignore`, a `docs/`). Read its report rather
than assuming; the files it declined to write are the ones you now merge by
hand:

- **`AGENTS.md`** — if one exists, merge; do not replace. It is the most
  valuable file in the repository for the next agent.
- **`README.md`** — never replaced. `readme-sections.ts` only writes inside
  marker pairs the author has opted into, so offer to add markers rather than
  content.
- **`.gitignore`** — append the folio entries; keep theirs.

**If the remote is empty, push `main` first.** A repository with work
locally can still have an empty remote, and GitHub makes the first branch
pushed to an empty repository its default. Run `init-folio` or push `main`
before any feature branch.

**If `main` has no harness yet, land a setup-only PR first.** A fork or an
existing repository whose `main` has no `index.config.json` and
`index.lock.json` gives the full PR checks nothing to compare against: the
base side fails before any test runs, and the PR's own gates are skipped. So
open one small PR with only what `folio_init` writes and the pins, merge it,
and only then branch for content. Draft-tier checks never build the base, so
this does not show until the content PR leaves draft.

**The setup-only PR has a Tool: `instantiate-harness`.** It pins the harness
and every layer it needs, mounts them, commits the setup on
`harness/<harness>`, opens that PR, and renders the branch's preview at
`gh-pages:branches/<branch>/`. On a repository with nothing mounted yet, run it
from a fresh clone of the tools layer:

```sh
git clone --depth 1 https://github.com/litlfred/cat-harness-tools /tmp/cht
echo "<where the author consented>" | bun run /tmp/cht/scripts/instantiate-harness.ts \
  --repo . --harness <owner/repo> --consent-by <who> [--plan | --local]
```

The setup also writes `.github/cat.ts` and `.github/mount-from-lock.sh` and
sets the root's `cat` script to `bun .github/cat.ts`, so after the merge a
fresh clone needs no mount step: the first `bun run cat …` mounts the layers.

`--plan` prints the closure and every step and writes nothing; `--local`
commits on the branch and pushes nothing. The harness's own adoption steps
are its checkout scripts `instantiate:<harness>` (files it declares, committed
with the setup) and `prepare:<harness>` (what the site is built from, never
committed). For an IG on a FHIR harness these declare `contentTypes.ig` and build
the IG's first AST.

A harness built on this platform may add adoption steps of its own for its
kind of repository, for example about CI that already publishes a site on
every push. Ask `skill_list` for the skill governing that kind before
calling the conversion done.

## 5. Publishing — provision `gh-pages` first; an overlay needs it too

An overlay never reaches [`getting-started`](getting-started.md) §5 by
itself, so this section repeats the one step a publishing route cannot skip:
**provision `gh-pages` before GitHub Pages is switched on.**

The step is `Task_ProvisionGhPages` ("Provision gh-pages") in
`getting-started.bpmn`,
on the shared path after scaffolding and before the Pages build, and it
carries the semantics of `A_Provision` in bootstrap-tools'
[`render-kg-to-github-pages.bpmn`](../../../../bootstrap-tools/processes/render-kg-to-github-pages.bpmn).
The tool is `pages-bootstrap`:

```sh
bun run cat-harness-tools/scripts/pages-bootstrap.ts               # reports `unprovisioned` (exit 3) and the exact command when gh-pages is absent
bun run cat-harness-tools/scripts/pages-bootstrap.ts --provision   # pushes an orphan gh-pages: placeholder index.html + .nojekyll
```

`--provision` is idempotent and never forces a push, and nothing creates a
remote branch without it. Then switch Pages on with **Source: "Deploy from a
branch: gh-pages, / (root)"** — the script prints the source it expects. When
the repository's publish workflow pushes `gh-pages`, "GitHub Actions" is the
wrong source: the workflow would push a branch Pages was never told to serve.

**The same holds for an overlay that
[remote-mounts](../../kg/kg-core/remote-mount.md) its dependencies.** A mount
brings layers in; it does not provision anything on the downstream's remote.

## 6. Anti-patterns

1. **Moving a file before Q3 is answered.**
2. **Reporting a two-bucket classification.** If `unclassified` is empty on a
   real repository, suspect the scanner rather than celebrate it.
3. **A per-file confirmation loop.** See §2.
4. **Swarming a 12-document import.** The dispatch overhead exceeds the work.
5. **Replacing an existing `AGENTS.md` or `README.md`.** Merge, or leave.
6. **Treating the scan as ingestion.** It reads; it never writes. Ingestion is
   a separate process with its own diagram and its own gate.
7. **Switching Pages on before `gh-pages` exists, or choosing "GitHub
   Actions" for a workflow that pushes `gh-pages`.** See §5.
8. **Dropping outside-content math artifacts or unlinked audit refutations.**
   Carrying only the primary content tree (`content/` or `folio/`) drops outside proofs,
   computations, and refutations showing that some paper claims are false. See §1.

