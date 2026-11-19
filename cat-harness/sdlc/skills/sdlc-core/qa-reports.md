---
name: qa-reports
description: >
  Where a QA result lives now. Derived verdicts go to the orphan `qa-reports`
  branch, keyed by commit, written by the CI job `qa-publish`. Judgements stay
  on main in the `attestations` graph. Gates compute and judge against a stored
  baseline, and a missing one is unknown. Read before you regenerate, commit,
  resolve, cite or delete anything under `test/results/` or `test/attestations/`.
adapters: [document, paper, dak]
profiles: [document, paper]
graph-typologies:
  - qa
  - attestations
---

# QA reports — derived results on a branch, judgements on `main`

**A QA result is either reproducible or it is not, and that decides where it
lives.** A script verdict is a pure function of the tree: run the producer
again and you get it back. A reviewer's judgement is not, because no re-run can
reproduce what an agent or a person decided. The two are split on that line:

| | derived | judgement |
|---|---|---|
| what | every `reviewer.kind: script` entry: `kg-qa/**`, `*.qa-results.json`, witnesses, `lsi/`, `tool-runs/`, the health report | agent, human and **baseline-pair** attestations (a baseline is a judgement) |
| graph typology | `qa` (and `health`) | `attestations` |
| written to | `<instance>/test/results/**`, the **working copy** | `<instance>/test/attestations/<family>/<mirrored subject path>.attestations.json` |
| record | the orphan **`qa-reports`** branch, `main/<sha>/` or `pr/<n>/<sha>/` | **`main`** |
| schema | the family's own | `qa-attestations/v1`, `schemas/sdlc/qa-attestations.ts` |
| on a merge conflict | take the base's side (`merge:main`), then regenerate | a person reads both sides |

**cat-harness and the content core do not commit the derived files.** Where
a layer still does, they are a copy on its way out, not the record. Do not
regenerate one in order to commit it, and do not hand-resolve one. Every `qa`
directory declares `storage` and is ignored by version control, so a new file
there is not committed. Before a layer's removal of its committed copy is
pushed, `bun run cat qa:verify-moved --key main/<head>` must answer IDENTICAL.
It compares every moved path's blob id with the entry, and an entry it cannot
read is UNKNOWN (exit 2), never a pass.

## The branch

```
qa-reports  (orphan; never merged; author folio-qa-bot)
├── index.json                   newest entry per ref
├── main/<commit-sha>/           one tree per main commit that published
│   ├── manifest.json            inputs, producers, the gates' result
│   └── <instance>/test/results/**   byte-identical to the checkout's layout
└── pr/<number>/<head-sha>/…     same shape, pruned 7 days after close
```

Everything goes through **`cat-harness-tools/scripts/qa-store.ts`**, and nothing
else writes the branch. `check:workflows` fails a raw push
(`qa-reports-unretried`).

| command | does |
|---|---|
| `bun run cat qa:fetch [--ref main\|<sha>\|pr/<n>]` | read an entry |
| `bun run cat qa:publish --ref main/<sha>\|pr/<n>/<sha>` | write one. Fetch the tip, splice, `commit-tree -p`, push **without `-f`**, 3 attempts with backoff |
| `bun run cat qa:refresh` | produce the working copy a publish stores, and say whether it is complete (below) |
| `bun run cat qa:publish --github --completeness <report>` | CI's form: derive the key, skip a fork PR with a `::notice`, and refuse an incomplete refresh |
| `bun run cat qa:prune [--apply]` | retention, as a dry run unless `--apply`. Daily in `qa-reports-prune.yml` |

**A read answers one of five states.** `hit` exits 0, `miss` 1, `usage` 2,
`corrupt` 3, `unknown` 4. **A miss is never read as "no findings".** A reader
must not turn an absent entry into an empty, clean directory.

**What `qa-publish` stores is produced in that job, not handed over by the
gates.** The gates are in judge mode and write nothing, so their checkout
holds only what is committed. So `qa:refresh` runs first. While the checkout
still tracks `test/results/`, it runs nothing, because the commit's own copy
is the record and `main/<sha>` must be byte-identical to it. Once nothing is
tracked there, it runs every writer declared in `QA_WRITERS`
(`scripts/qa-refresh.ts`) into the empty tree.
Then it checks three things. A file no writer claims, a writer that produced
nothing, or a writer that exited outside its declared exits makes the run
INCOMPLETE: the job fails, and `qa:publish --completeness` refuses to store
it. A partial entry is never published as the commit's record. Adding a QA
writer means adding it to `QA_WRITERS`, or the first CI run after its first
file lands goes red naming the unclaimed path.

**`qa-publish` is a job, not a gate.** It runs after `gates` whatever they
concluded (the evidence of a red commit is evidence too). It is the only job
holding `contents: write`, and `bun run cat gates` never runs it locally. Its red
means the record was not stored, never that the commit is bad
([`ci-health`](../../../skills/process/process-core/ci-health.md)). Diagram: `sdlc/processes/qa-publish.bpmn`, called
from `Task_QaPublish` in `code-quality-gates.bpmn`.

### Whose branch: each layer publishes its own

**The branch is the store of the repository that declares it.** A layer
repository that declares a `qa` directory with `storage` (`test/results/`,
keyed by commit) keeps its results on `cat/cat-harness/qa-reports` of **its
own** repository, keyed by **its own** commits. Its
`.github/workflows/publish-qa.yml` calls the tools layer's reusable
`layer-qa-publish.yml`, which audits that one layer with the layer at the
pushed commit and publishes `main/<sha>` or `pr/<n>/<sha>`.

An index reads a mounted layer's results from that layer's store at the
commit its lock pins (`scripts/layer-qa.ts`, `readQaTreeAtCommit`), and never
from its own store. A pin the layer has not published is a `miss` naming the
commit. cat-harness, and the layers it hosts (`kgQaHomeFor` "hosted"), are
still written by the index's `qa-publish`.

A layer that stops committing `test/results/` without a publisher keeps its
verdicts nowhere, so setting a layer up includes the caller ([`initialization`](../../../docs/bootstrap/initialization.md)
step 5, [`sub-kg-lifecycle`](../../../skills/kg/graph-management/sub-kg-lifecycle.md)
stage 10 "its QA record"), and `init-folio --instance` writes it.

## Gates compute and judge

A gate over the `qa` graph does not compare a fresh run against a committed
file, because the committed file is not the record. Its `--check` form **computes and judges, and writes nothing**:

- **A finding fails only if it is NEW against a baseline.** The baseline is
  the committed working copy for now, and `--against <ref>` reads it from
  `qa-reports` (for example `--against main`). Inherited findings are counted
  and reported, but they do not fail this change.
- **A missing baseline is UNKNOWN.** It is printed, it is never a pass, and it
  is never a fail, because an unwritten baseline is not this change's defect.
- **The four judge states** are `ok` (exit 0), `finding` (1), `unknown` (2)
  and `error` (2), from `JUDGEMENT_EXIT` in `scripts/qa-results.ts`. An
  `unknown` from a source that would not read outranks a finding, because a
  sweep that was blind on one part has not cleared the others.

Each script's docblock says which form it is in.

## Attestations

- **A writer moves judgements as it saves.** If a writer finds judgements in a
  prior derived file and the store holds no entry for them, it moves them into
  the store as it saves. `bun run cat qa:attestations:migrate` does a whole
  layer at once, and `:check` exits 1
  while any judgement is still only in a derived file.
- **A corrupt store reads UNKNOWN and is refused.** No writer overwrites it,
  and no writer regenerates past it.
- **Two disagreeing judgements are a person's to reconcile.** The migration
  refuses that case, and so should you. Never take one side.
- **Commit the store file.** It is authored content on `main`, the same class
  as a review verdict.

## What to do, by situation

| you are about to | do instead |
|---|---|
| regenerate a `test/results` file and commit it | regenerate it so the gates see the tree; `qa-publish` stores the record |
| resolve a conflict in `test/results/` | `bun run cat merge:main` takes the base's side, then `bun run cat regen` ([`prepare-merge`](prepare-merge.md)) |
| resolve a conflict in `test/attestations/` | read both sides. Keep both judgements unless they are the same one |
| cite a derived result | `qa-reports:main/<sha>/<path>` ([`decision-audit`](../../../skills/process/process-core/decision-audit.md)) |
| read a result in a test | build a fixture, or read it through `readQa` and assert the state ([`test-engineer`](test-engineer.md)) |
| delete a result to clear a sweep | don't ([`deletion-requires-confirmation`](../../../skills/conduct/conduct-core/deletion-requires-confirmation.md)) |

## Related

- [`directory-conventions`](../../../skills/kg/kg-core/directory-conventions.md)
  §"`storage`" covers the declaration field that marks a directory as
  stored. Every `qa` directory sets it, and each working copy is ignored by
  version control.
- [`content-context-and-state-graphs`](../../../skills/kg/kg-core/content-context-and-state-graphs.md)
  explains why both halves are `state`, and why only one of them can be
  rebuilt.
- [`qa-witness`](qa-witness.md) covers the published projection of a verdict.
