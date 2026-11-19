---
# folio-assistant-v556
$schema: bean/1.0.0
title: 'Two kg-export sidecars carry three script hashes between them, and no gate can see it: a generator with no --check is invisible to check:artefact-verification'
status: completed
type: task
priority: normal
created_at: 2026-09-22T10:24:29Z
updated_at: 2026-10-02T06:44:57Z
parent: folio-assistant-1swy
---

MEASURED 2026-09-22 on main at `f4de6c1e20`, clean tree, by running `bun run cat kg:export` and reading both committed sidecars back.

`scripts/kg-export.ts` writes two `qa-results/v1` sidecars. Between them and the script actually in the tree there are **three different hashes for one script**:

| file | committed `producer.script_hash` |
|---|---|
| `cat-harness/test/results/kg-export.qa-results.json` | `c18f56d374e0` |
| `cat-harness/test/results/kg-export.bootstrap.qa-results.json` | `bc6ea7492239` |
| what `kg-export.ts` in the tree hashes to | `66bad125d600` |

One script cannot have three hashes. **Both committed sidecars are stale, by different amounts, and they disagree with each other as well as with the tree.**

## Why nothing reports it — and this is the part worth fixing

`bun run cat gates` passes **121/121** over this state. `bun run cat regen` reports **"38 current, 0 regenerated"**. Neither is malfunctioning:

- `regen-after-merge` works on **verify/write pairs**. `kg:export` has **no `--check` mode** (`package.json` has `kg:export` and nothing else), so it has no pair and regen correctly ignores it.
- `check:artefact-verification` — the gate added under `jfr6` *specifically* to ask whether generated artefacts are valid for a consumer — derives its inventory from `package.json` and, in its own words, *"a check counts as generated-artefact currency when its script is invoked with `--check`."* So an artefact whose generator has **no `--check` at all** is not in the 45 declared entries and never will be. Confirmed: `kg:export declared? False`.

**That is the finding.** The gate written to catch artefacts nobody verifies has a blind spot shaped exactly like an artefact nobody verifies — a `dh4f` in the `dh4f` catcher. It is not that the declaration is missing; it is that the inventory *cannot* contain it.

## Against its neighbours — it is neither

- **NOT `nytj`** (staleness: an artefact recorded but not in force). That family is about a verdict that exists and is ignored. Here the verdict is present and current in content; only its producer stamp is wrong, and nothing reads it.
- **NOT `cflw`** (collision: 218 sidecars rewritten by one auditor edit). `cflw` shipped a fix by moving the auditor's identity into `skills/kg-qa.manifest.json` for the `kg-qa` family, and explicitly left a named residue — the 20 `qa-witness/v1` docs witnesses — saying it *"wants its own bean"*. **This is a THIRD family, `qa-results/v1`, which `cflw` does not name at all.** Same root cause (a per-file copy of a once-per-run value), different file shape, different remedy surface.

Worth recording that `cflw`'s own analysis predicts this: *"the per-file auditor hash never added precision the generator could deliver."* Two sidecars from one run of one script should carry one hash; they carry two, which is that sentence proven twice over.

## Also corrected here

An earlier reading of mine in session `017PqeiS` said `kg-export.test.ts` writes the sidecar it validates, making a vacuous check. **That was wrong.** The test's `writeFileSync` calls all target a temp directory; the writer is `kg-export.ts`'s own CLI via `writeQaResult`. There is no check that cannot fail — there is **no check at all**, which is a different and larger problem, and the corrected version is the one above.

## Done when

- [x] Decide whether `producer.script_hash` belongs per-sidecar at all for `qa-results/v1`, or once per producer as `cflw` did for `kg-qa` — the two sidecars come from one run of one script, so per-file cannot carry information
- [x] Either give `kg:export` a `--check` mode so it enters the verify/write pairs and the artefact-verification inventory, or record why it should not be checked
- [x] Close the inventory blind spot: `check:artefact-verification` should be able to report a GENERATOR with no `--check`, rather than being structurally unable to see one. "Nobody has said" is its own stated finding; "cannot be asked" is worse
- [x] Re-measure: on a clean tree, one run of one generator leaves one hash

Claimed by claude/kg-audit-bugs (session https://claude.ai/code/session_01CVVoavPoCHMLA7AASxG8cH)

## Summary of Changes

Branch `claude/kg-audit-bugs`, PR #1842, issue #1835.

**Re-measured** on `main` `cf3e624`. Two hashes now, not three: the host sidecar had caught up
(`e95fab417728` = the script). `kg-export.bootstrap.qa-results.json` was still at `47109f5daf3d`, and
regenerating it showed it was also hiding **3 findings** (`undeclaredSchemaModules`: three
`bootstrap-tools/schemas/*.ts` with no `@graphNode` tag), with every gate green.
`check:published-instance-exports` no longer reads it, because both workflows now export bootstrap through
`bootstrap-tools/scripts/export-graph.ts`. **No workflow produces this sidecar any more.**

**Done when**:
- [x] *Per-sidecar hash or once per producer?* **Decided: keep it per sidecar**, and the decision can be
  reversed. `qa-results/v1` is shared by 17 producers and each sidecar is meant to be read on its own. The
  drift came from the missing check, not from where the field sits. With the check in place, one run of one
  generator leaves one hash: both sidecars now carry the same `script_hash`.
- [x] `kg:export` has a `--check` mode (`kg:export:check`, now a CI step in `code-quality-gates.yml`) and a
  writer, `--sidecars` (`kg:export:sidecars`, paired in regen's `WRITER_OVERRIDES`). It derives its subjects
  from what is committed: the host plus every `kg-export.<stub>` sidecar, matched to its instance. It
  re-runs the exporter into a temp `--qa-root`, compares with `qaResultState`, and reports a sidecar that
  no instance owns as an ORPHAN.
- [x] Blind spot closed: `check:artefact-verification` gained a second derived inventory,
  `deriveUncheckedGenerators`. It lists scripts that call the `qa-results/v1` writer and that no command
  runs with `--check`. Each must be declared under `unchecked` with a reason, or it is a finding. Measured:
  **8** such generators. `kg-export.ts` left the list with this change; the other 7 (`check-l1-complete`,
  `check-lane-documentation`, `check-layout-norms`, `check-methodology-evidence`, `check-rendered-labels`,
  `check-wireframes`, `lsi`) are declared. Each rewrites its sidecar on every run, so the only thing that
  catches drift is the tree guard in `bun run cat gates`.
- [x] Re-measured: on a clean tree, `kg:export:check` reports both sidecars current with one hash.

Tests: `kg-export-sidecars.test.ts` (subject derivation, orphans) and `artefact-verification.test.ts`
(unchecked-generator inventory, declaration states, the real repository).

**Left for the owner**: the bootstrap sidecar now has a check but still no reader. Should it be retired?
That would be a deletion (`deletion-requires-confirmation`), so it is not done here.
