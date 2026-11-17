---
# folio-assistant-8wj1
$schema: bean/1.0.0
title: 'QA READERS F4: block and translation read-modify-write writers stop dropping agent verdicts when the prior is absent — the block-qa D2 split'
status: completed
type: task
priority: critical
created_at: 2026-10-01T08:47:13Z
updated_at: 2026-10-23T13:35:00Z
parent: folio-assistant-3fva
---

Arc `3fva`, from reader audit `gxvk` (`cat-harness/docs/proposals/qa-readers-audit-2026-10-01.md`, §5.2 family F4). Refines `oqe3` (`translation:block-qa:check`) and `2ae2` (`qa-agent-write`). As of 2026-10-06 this is not blocked on `16ei`: it completed (qa-store landed; CI publishes `main/` and `pr/` entries and the prune runs on schedule), so the block is withdrawn.

**CRITICAL (C11), and it must land before `5hox`.** Each writer below READS the prior verdict file to keep the entries it does not own, including the 13 agent verdicts (11 block-qa and 2 translation-qa, in 12 files). With the prior absent, it writes back a report holding only its own entries, and nothing reports the loss.

## Readers
- `cat-harness/content/pipeline/qa-utils.ts:975,1097` (`loadQaReport`, block discovery) (B). Unknown.
- `content/pipeline/qa-sweep.ts:415-416`, plus `sameScriptVerdict` at `:580,:632,:664,:720` (B). **LOSS.**
- `content/pipeline/qa-merge-findings.ts:186-211` (B). **LOSS.**
- `content/pipeline/integration-audit.ts:222-228` (B). **LOSS.**
- `content/pipeline/language-trap-audit.ts:346,558-559` (B). **LOSS.**
- `content/pipeline/q-usage-audit.ts:292-293,453` (B). **LOSS.**
- `content/pipeline/proof-narrative-lean-equiv-sweep.ts:515-530` (B). **LOSS.**
- `content/pipeline/qa-agent-entry.ts:78-79` (D). **LOSS.**
- `content/pipeline/translation-block-qa.ts:831-856`: `--check` is loud (35 stale, measured); the write path through `mergeCriteria` is **LOSS** (A/B).
- `content/pipeline/qa-staleness.ts:131-136` (MCP `qa_staleness`) (D). Correct unknown: `[NO-QA]`, measured.
- MCP `qa_sweep` (`folio-assistant-core/adapters/document/tools/qa.ts:39-54`) → `qa-sweep.ts` (D). **LOSS.**
- `content/pipeline/qa-agent-drain-queue.ts:89`, `semantic-cone.ts:193`, `proof-axis-dashboard.ts:128` (D/C). Unknown.
- `cat-harness/src/qa-agent-write.ts:163,181,225` (D) reads and writes the LEGACY beside-block `${base}.qa.json`, not `test/results/block-qa/`. The live-defects bean records that.

## Migration action
1. **D2 split of mixed files.** The 13 agent entries move to `test/attestations/` on main. Script entries go to the branch.
2. Every read-modify-write reads the script half from `qa-store` and the attestation half from `test/attestations/`. A miss on either is `unknown`, and **never a blank prior**.
3. An agent verdict (`qa-agent-entry`, `qa-agent-write`) is written to `test/attestations/` only.
4. `qa-paths.ts` keeps the path functions. `qa-witness.ts` (publish family) consumes them and does not edit them.

## Done when
- [x] a sweep over a tree with no `test/results/` and no fetch refuses or reports `unknown`; it does not write a report missing the 13 agent entries. All 9 writers re-source attestations from `test/attestations/`. With the store unreadable they exit 4 and write nothing. Tested per writer family with the prior ABSENT in `scripts/tests/qa-attestations-writers.test.ts`. The SCRIPT half with no fetch is still open; see Summary.
- [x] the 13 agent entries are byte-identical in `test/attestations/` (checked by a test): `schemas/qa-attestations-criteria.test.ts` (was `content/pipeline/qa-attestations.test.ts`), over the real corpus
- [x] `translation:block-qa:check` and the MCP `qa_staleness` and `qa_sweep` give the same results with `test/results/` absent and the branch fetched. — **Done 2026-10-23: `litlfred/cat-harness-tools#563` (`05fa7f1`), `litlfred/cat-harness-tools#564` (`67240eb12d`), `litlfred/cat-harness-tools#568` (`3db526d4f9`, `--prior-from <ref>`), and `litlfred/folio-assistant-core#177` (`cc0025146d`, `qa_staleness` passes `--against main`) all merged.**


## Summary of Changes (2026-10-01, branch `worktree-agent-a8ba4c80e273d619d`, NOT pushed)

Held by session https://claude.ai/code/session_01LKpuPotV3Ve5Za75DQ3AQR (sub-agent of `claude/quirky-davinci-ixuymr`). Announced here rather than through `beans:claim`, because this session pushes nothing.

**Measured** with `bun run cat qa:attestations:migrate:check`, which counts every non-script entry in every derived block or translation report:
- before: 157 derived reports, **13 non-script entries in 12 files** (11 `block-qa/v1`, 2 `translation-qa/v1`; 12 by `kind: agent`), 0 in a store;
- after: the same 13, all held in `test/attestations/`, 0 missing.

**Writers found by grep.** There were 9, not 8. The ninth is `src/qa-agent-write.ts`, which the audit filed under F8b. Since `r7v6` it writes the results tree, so it had the same C11 loss.

**Store layout**
- `<instance>/test/attestations/<family>/<mirrored path>.attestations.json`, plus the marker `attestations.store.json`. Code: `cat-harness/content/pipeline/qa-attestations.ts`.
- `qa-attestations/v1` carries `family` and `subject` (the instance-relative path, plus `locale` for translation-qa) and a `criteria` map with the derived report's shape.
- Read states: hit, miss, no-store, corrupt and unknown.
- Writers use `resolvePrior` and `finalizeCriteria`. On a no-store instance (one that never migrated), they ADOPT the prior's attestations.

**Byte preservation.** 10 of the 12 source files are ASCII-escaped (an em dash is written as the six characters `—`). The store keeps each source's escaping. Tests check two things on the real corpus: each entry's TEXT is the same bytes in both files, and each derived file recomposes byte for byte from its script half plus the store.

**Commits**
- `8758a003`: the store and the migration (`qa:attestations:migrate`, `:check`); 12 store files.
- `c7988bdd`: 8 block writers, and the CI gate.
- `6b04f7b3`: the translation writer, the per-family C11 tests, and the 35 translation-qa sidecars restamped by `script_hash`.
- `8bb8d554`: `qa:resolve-conflicts` (520m) reads the store.
- `870e259a`: regen, and `@covers`.
- `32677ff4`: the `check:artefact-verification` declaration.

**Behaviour**
- Every writer refuses (UNKNOWN, writes nothing, exit 4) when the store is corrupt or unreadable, or when the prior holds an attestation the store lacks.
- `qa-merge-findings` now anchors at the block's content repo. It used the git top level, which pointed at a results tree nothing reads.
- `language-trap-audit` used to drop adjudications on its own criteria by overwriting the array. It no longer does.

**Gates.** Baseline was `bun run cat gates` before any change: 2 of 203 red. They were `bun test` (1 failing test: "the report is a fixpoint") and `translation:catalogue:check`. After (at `870e259a`): bun test was 13787 pass and 1 fail, the same test as the baseline. Gates were 3 of 203 red: the same two, plus `check:artefact-verification`, which flagged the new `:check`. `32677ff4` declares it, and it now passes.

**Reconcile with `2gst`.** 2gst's layout is uncommitted, in its own worktree (`schemas/qa-attestations.ts`, the declared `attestations` directory).
- The two agree on the root, the `<family>/` mirror, the suffix, the `$schema` tag and the `family` field.
- `subject`: 2gst uses the object `{kind,id,path}`, 8wj1 a string plus `locale`.
- Payload: 2gst uses family arrays, 8wj1 `criteria`, which fits 2gst's "a family adds its own arrays".
- Presence: 2gst uses the DECLARED directory, and an absent one reads unknown. 8wj1 uses a marker file, and absence means no-store, which adopts the prior's attestations.
- Module: 2gst's `schemas/qa-attestations.ts` against 8wj1's `content/pipeline/qa-attestations.ts`.
- Recommended: after 2gst lands, 8wj1's families become members of 2gst's discriminated union, `storeState` reads `attestationsHomeFor`, and the marker goes.

Open: the SCRIPT half (other writers' script criteria in the same file) is still carried from the prior derived file. With it absent, those criteria wait for their own writer to re-run. That is regenerable, not lost, but it belongs on `qa-store` (`16ei`), and it is the remaining third Done-when.

## Owner rulings 2026-10-01 (binding) — reconciliation with `2gst`
1. **2gst's declared design wins.** 8wj1 adapts: subject is an OBJECT, the families are members of the one `QaAttestationsSchema` union, presence is the DECLARED `attestations` directory (no marker file), one schema module.
2. **A folio with no store yet auto-moves on first save**, for ALL families, kg-qa included. A writer that finds judgements in a prior derived file and no store entry moves them into the store as it saves; it does not refuse and wait for a manual migration. Nothing is ever silently dropped. A corrupt store is still UNKNOWN and refused.
3. **The store stays at `<instance>/test/attestations/`** (layout-norms baseline entry kept).

## Summary of Changes — merged onto `claude/quirky-davinci-ixuymr` (2026-10-01, NOT pushed)
Cherry-picked `8758a003..e8caf202`, then:
- `b18799fb` — **one schema, one API, one migration.** `block-qa` and `translation-qa` are members of `schemas/qa-attestations.ts`'s union: `subject {kind: "block", id, path}` (id and path = the instance-relative subject root), a `criteria` map holding only non-script entries, plus `locale` on translation-qa. `content/pipeline/qa-attestations.ts` is deleted; `resolvePrior` / `finalizeCriteria` / split / compose live in the schema module and the nine writers import them from there. The marker `attestations.store.json` is gone. The 12 store files are converted: only the subject lines change, every entry byte-identical. `qa-attestations-migrate.ts` is deleted; `migrate-kg-attestations.ts` is generalised to `scripts/migrate-qa-attestations.ts` for all three families, and `qa:attestations:migrate[:check]` run it.
- **Ruling 2.** `readAttestationFile` answers `absent` (was `unknown`) when the store directory is not there. On `miss` or `absent`, `resolvePrior` MOVES the prior's judgements (`adopt`), and `finalizeCriteria` writes them to the store before the derived report. `corrupt`/`unknown` still refuse (exit 4). The old `unmigrated` refusal is now `conflict`, and only for a store HIT plus a prior judgement the store lacks: refused, never dropped, a person reconciles.
- **Kept:** the 9 writers, `qa:resolve-conflicts` reading the store, the `language-trap-audit` overwrite fix, the `qa-merge-findings` repo-root fix, and `qa-attestations-writers.test.ts` (now also: no store → qa-sweep moves the prior's judgements; corrupt store → exit 4, nothing written; store hit + stray prior judgement → conflict).
- **Counts, measured before and after:** 13 judgements (11 block-qa + 2 translation-qa) in 12 derived files, all 13 held in the store, entries byte-identical. A round-trip test on the real corpus starts from NO store, runs each subject's first save, and reproduces the committed store byte for byte, and each derived report byte for byte.
- `9f858484`: declaration, conventions and gate text. `604ef031`: regen.

**One deviation, flagged.** Block and translation derived reports still carry a PROJECTION of their judgements, composed from the store and never the source once the store holds the subject. So "the derived file is clean" holds for kg-qa only. About 30 readers and the published site take `criteria[id][0]` from the derived file; stripping the projection is reader work that belongs with `5hox`.

**Still open.** The third Done-when (the script half through `qa-store`). Also, `translation-roundtrip.ts` writes agent round-trip entries straight into a legacy-path sidecar and is not yet a store writer. With a store hit, its new entry makes the next writer refuse with `conflict`: loud, not lost.

_2026-10-16T06:30:00Z_ — Block lifted: `16ei` is completed in every store. Owner ruling 2026-10-16 (item 1): lift the stale blocks on claimed beans whose blocker is closed; the claim itself is untouched. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

_2026-10-22T16:46:00Z_ — Claim released in a stale-claims sweep by lane B2 (session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr), applied here by the coordinator. The coordinator's standard: release only on evidence, and never a claim from the last 48 hours. What was checked:
- No commit naming this bean on the main branch of folio-assistant, cat-harness or cat-harness-tools after 2026-10-06. The only later ones are a blocker withdrawal (10-06) and a store reconciliation (10-16), and neither is work.
- No remote branch in any of the three repositories names this bean.
- The holding branch `claude/quirky-davinci-ixuymr` was last committed to on 2026-10-03, and the claim recorded its work as "NOT pushed".

The unticked Done-when boxes above are what remains. Back to `todo` so a sibling session is not misled. Nothing was deleted. The tools-store copy matches: litlfred/cat-harness-tools#558.

_2026-10-22T17:05:00Z_ — Open PRs for the third Done-when box (`translation:block-qa:check` and `qa_staleness` with `test/results/` absent and `qa-reports` fetched): `litlfred/cat-harness-tools#563` (`translation:block-qa:check` reads each prior from the store) and `litlfred/cat-harness-tools#564` (`qa-staleness --against <ref>` reads block sidecars from `qa-reports`).

_2026-10-22T16:51:00Z_ — Claimed by lane B2 (session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr) for the one open box. Measured at index 1730012 with qa-reports f92e2d2: `translation:block-qa:check` exits 0 both ways, but the inherited baseline findings are 6 with `test/results/` present and 3 with it absent. The cause is that `mergeWithAttestations` takes the prior from the working copy. The planned fix is in cat-harness-tools: in a stored dir with `--against`, read the prior from the branch (`readBaseline` → `readQa`) and refuse if it is unreadable. MCP `qa_staleness` and `qa_sweep` follow. Recorded by the coordinator.

_2026-10-22T17:05:00Z_ — **Owner ruling, 2026-10-22: option B** on what QA *writers* (qa_sweep and every block writer) do when `test/results/` is absent. Writers take `--prior-from <ref>` and read the prior sidecar from qa-reports, so a rewrite carries the other writers' entries. An unreadable branch read refuses (exit 2) and never falls back to the working copy. Rejected: A (recompose and accept a temporary thinning) and C (refuse when the folder is absent). Lane B2 implements it. The bean closes when B, cat-harness-tools#563 and the qa-staleness PR have all landed. Recorded by the coordinator, session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6.

_2026-10-23T08:00:00Z_ — `litlfred/cat-harness-tools#564` (`qa-staleness --against <ref>: read block sidecars from qa-reports (8wj1)`) merged as `67240eb12d`; `litlfred/cat-harness-tools#563` (`translation:block-qa:check reads each prior from the store`, `78c7cbf340`) and `litlfred/cat-harness-tools#568` (`Block writers: --prior-from <ref> reads the prior report from qa-reports (8wj1, option B)`, `1955471643`) are open in CI.

_2026-10-23T08:38:00Z_ — `litlfred/cat-harness-tools#563` (`05fa7f1`) and `litlfred/cat-harness-tools#568` (`3db526d4f9`) merged on `cat-harness-tools` `main`; `litlfred/folio-assistant-core#177` (`qa_staleness MCP tool: pass --against main (bean 8wj1)`, `cc0025146d`) and index re-pin `litlfred/folio-assistant#2628` (`85ece35fe6`) are open in CI.

## Kept from cat-harness-tools' copy (copy sync, 2026-10-24)

These notes were only in this copy. The newer copy from the bean branch is above them.

*2026-10-22T16:46:00Z* — Claim released (stale-claims sweep, coordinator standard: on evidence, nothing claimed in the last 48h; lane A, session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr). Checked:
- No commit naming this bean on the main branch of folio-assistant, cat-harness or cat-harness-tools after 2026-10-06. The latest are a blocker withdrawal on 10-06 and a store reconciliation on 10-16, neither of which is work.
- No remote branch in any of the three names this bean.
- The holding branch named above (`claude/quirky-davinci-ixuymr`) was last touched on 2026-10-03.

The claimed work is NOT all on main: the unticked Done-when boxes above are what remains, and the ticked ones are what landed. Back to todo so the claim does not mislead a sibling session. Nothing was deleted.

*2026-10-22T17:10:00Z* — Progress, and a provisional ruling (lane A, session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr). The third Done-when has three parts.

- **translation:block-qa:check:** litlfred/cat-harness-tools#563.
  - In a stored tree with `--against`, each prior is read from qa-reports instead of the working copy.
  - Measured in the index at 1730012 against qa-reports main: inherited findings were 6 with `test/results/` present and 3 with it absent. They are now 6 both ways, with the same verdict.
- **qa_staleness:** litlfred/cat-harness-tools#564 adds `qa-staleness --against <ref>`.
  - On cat-harness `docs/source`, 172 blocks were all NO-QA with `test/results/` absent. Now the per-block results are identical both ways.
  - A sidecar the branch cannot read is UNKNOWN, never NO-QA.
  - The MCP wrapper (folio-assistant-core `adapters/document/tools/audit.ts`) must pass `--against main`. That is routed to lane C.
- **qa_sweep and the other block writers: option (B), owner, 2026-10-22.** It overrides the provisional (A) the coordinator first took.
  - Every block writer gains `--prior-from <ref>`, which reads the earlier sidecar from qa-reports.
  - A rewrite then carries the other writers' entries even when `test/results/` is absent.
  - A branch read that cannot be made refuses loudly (exit 2), the same way the readers in #563 and #564 do. It never falls back silently to the working copy.

This bean stays in-progress until B's `--prior-from` writers land, together with #563 and #564.

*2026-10-23T07:52:00Z* — Option (B) under way; claimed by lane A (session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr).
- **litlfred/cat-harness-tools#568** adds `--prior-from <ref>` to every block writer. These are qa-sweep; integration-audit, which passes the flag through to its child qa-sweep; language-trap-audit; proof-narrative-lean-equiv-sweep; q-usage-audit; qa-agent-entry; qa-merge-findings; and src/qa-agent-write.
- **How a read at the ref resolves:**
  - A hit is the prior.
  - A miss is a block with no history.
  - An unreachable store, or a report that is corrupt or not block-qa/v1, refuses that block with an `UNKNOWN … Nothing was written for it` line, and the run exits 2. It never falls back to the working copy.
  - A malformed ref exits 2 before any read.
- **Merged:** #564 (`qa-staleness --against`), 2026-10-23.
- **Open:** #563 (translation:block-qa:check) and #568.

Stays in-progress until #563 and #568 land.

*2026-10-23T08:26:00Z* — All three code parts of the third Done-when are merged to cat-harness-tools main:
- #563 (`translation:block-qa:check` priors read from the store), 05fa7f1
- #564 (`qa-staleness --against`), 67240eb
- #568 (`--prior-from` on every block writer), 3db526d

**Still open:** the MCP wrapper (folio-assistant-core `adapters/document/tools/audit.ts`) must pass `--against main`, routed to lane C. The index also has to re-pin to these mains, which lane C does via folio-assistant#2628. Stays in-progress until the wrapper lands.


_2026-10-16T06:30:00Z_ — Block lifted: `16ei` is completed in every store. Owner ruling 2026-10-16 (item 1): lift the stale blocks on claimed beans whose blocker is closed; the claim itself is untouched. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

_2026-10-22T16:46:00Z_ — Claim released in a stale-claims sweep by lane B2 (session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr), applied here by the coordinator. The coordinator's standard: release only on evidence, and never a claim from the last 48 hours. What was checked:
- No commit naming this bean on the main branch of folio-assistant, cat-harness or cat-harness-tools after 2026-10-06. The only later ones are a blocker withdrawal (10-06) and a store reconciliation (10-16), and neither is work.
- No remote branch in any of the three repositories names this bean.
- The holding branch `claude/quirky-davinci-ixuymr` was last committed to on 2026-10-03, and the claim recorded its work as "NOT pushed".

The unticked Done-when boxes above are what remains. Back to `todo` so a sibling session is not misled. Nothing was deleted. The tools-store copy matches: litlfred/cat-harness-tools#558.

_2026-10-22T17:05:00Z_ — Open PRs for the third Done-when box (`translation:block-qa:check` and `qa_staleness` with `test/results/` absent and `qa-reports` fetched): `litlfred/cat-harness-tools#563` (`translation:block-qa:check` reads each prior from the store) and `litlfred/cat-harness-tools#564` (`qa-staleness --against <ref>` reads block sidecars from `qa-reports`).

_2026-10-22T16:51:00Z_ — Claimed by lane B2 (session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr) for the one open box. Measured at index 1730012 with qa-reports f92e2d2: `translation:block-qa:check` exits 0 both ways, but the inherited baseline findings are 6 with `test/results/` present and 3 with it absent. The cause is that `mergeWithAttestations` takes the prior from the working copy. The planned fix is in cat-harness-tools: in a stored dir with `--against`, read the prior from the branch (`readBaseline` → `readQa`) and refuse if it is unreadable. MCP `qa_staleness` and `qa_sweep` follow. Recorded by the coordinator.

_2026-10-22T17:05:00Z_ — **Owner ruling, 2026-10-22: option B** on what QA *writers* (qa_sweep and every block writer) do when `test/results/` is absent. Writers take `--prior-from <ref>` and read the prior sidecar from qa-reports, so a rewrite carries the other writers' entries. An unreadable branch read refuses (exit 2) and never falls back to the working copy. Rejected: A (recompose and accept a temporary thinning) and C (refuse when the folder is absent). Lane B2 implements it. The bean closes when B, cat-harness-tools#563 and the qa-staleness PR have all landed. Recorded by the coordinator, session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6.

_2026-10-23T08:00:00Z_ — `litlfred/cat-harness-tools#564` (`qa-staleness --against <ref>: read block sidecars from qa-reports (8wj1)`) merged as `67240eb12d`; `litlfred/cat-harness-tools#563` (`translation:block-qa:check reads each prior from the store`, `78c7cbf340`) and `litlfred/cat-harness-tools#568` (`Block writers: --prior-from <ref> reads the prior report from qa-reports (8wj1, option B)`, `1955471643`) are open in CI.

_2026-10-23T08:38:00Z_ — `litlfred/cat-harness-tools#563` (`05fa7f1`) and `litlfred/cat-harness-tools#568` (`3db526d4f9`) merged on `cat-harness-tools` `main`; `litlfred/folio-assistant-core#177` (`qa_staleness MCP tool: pass --against main (bean 8wj1)`, `cc0025146d`) and index re-pin `litlfred/folio-assistant#2628` (`85ece35fe6`) are open in CI.


_2026-10-16T06:30:00Z_ — Block lifted: `16ei` is completed in every store. Owner ruling 2026-10-16 (item 1): lift the stale blocks on claimed beans whose blocker is closed; the claim itself is untouched. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

_2026-10-22T16:46:00Z_ — Claim released in a stale-claims sweep by lane B2 (session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr), applied here by the coordinator. The coordinator's standard: release only on evidence, and never a claim from the last 48 hours. What was checked:
- No commit naming this bean on the main branch of folio-assistant, cat-harness or cat-harness-tools after 2026-10-06. The only later ones are a blocker withdrawal (10-06) and a store reconciliation (10-16), and neither is work.
- No remote branch in any of the three repositories names this bean.
- The holding branch `claude/quirky-davinci-ixuymr` was last committed to on 2026-10-03, and the claim recorded its work as "NOT pushed".

The unticked Done-when boxes above are what remains. Back to `todo` so a sibling session is not misled. Nothing was deleted. The tools-store copy matches: litlfred/cat-harness-tools#558.

_2026-10-22T17:05:00Z_ — Open PRs for the third Done-when box (`translation:block-qa:check` and `qa_staleness` with `test/results/` absent and `qa-reports` fetched): `litlfred/cat-harness-tools#563` (`translation:block-qa:check` reads each prior from the store) and `litlfred/cat-harness-tools#564` (`qa-staleness --against <ref>` reads block sidecars from `qa-reports`).

_2026-10-22T16:51:00Z_ — Claimed by lane B2 (session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr) for the one open box. Measured at index 1730012 with qa-reports f92e2d2: `translation:block-qa:check` exits 0 both ways, but the inherited baseline findings are 6 with `test/results/` present and 3 with it absent. The cause is that `mergeWithAttestations` takes the prior from the working copy. The planned fix is in cat-harness-tools: in a stored dir with `--against`, read the prior from the branch (`readBaseline` → `readQa`) and refuse if it is unreadable. MCP `qa_staleness` and `qa_sweep` follow. Recorded by the coordinator.

_2026-10-22T17:05:00Z_ — **Owner ruling, 2026-10-22: option B** on what QA *writers* (qa_sweep and every block writer) do when `test/results/` is absent. Writers take `--prior-from <ref>` and read the prior sidecar from qa-reports, so a rewrite carries the other writers' entries. An unreadable branch read refuses (exit 2) and never falls back to the working copy. Rejected: A (recompose and accept a temporary thinning) and C (refuse when the folder is absent). Lane B2 implements it. The bean closes when B, cat-harness-tools#563 and the qa-staleness PR have all landed. Recorded by the coordinator, session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6.

_2026-10-23T08:00:00Z_ — `litlfred/cat-harness-tools#564` (`qa-staleness --against <ref>: read block sidecars from qa-reports (8wj1)`) merged as `67240eb12d`; `litlfred/cat-harness-tools#563` (`translation:block-qa:check reads each prior from the store`, `78c7cbf340`) and `litlfred/cat-harness-tools#568` (`Block writers: --prior-from <ref> reads the prior report from qa-reports (8wj1, option B)`, `1955471643`) are open in CI.

_2026-10-23T08:38:00Z_ — `litlfred/cat-harness-tools#563` (`05fa7f1`) and `litlfred/cat-harness-tools#568` (`3db526d4f9`) merged on `cat-harness-tools` `main`; `litlfred/folio-assistant-core#177` (`qa_staleness MCP tool: pass --against main (bean 8wj1)`, `cc0025146d`) and index re-pin `litlfred/folio-assistant#2628` (`85ece35fe6`) are open in CI.
