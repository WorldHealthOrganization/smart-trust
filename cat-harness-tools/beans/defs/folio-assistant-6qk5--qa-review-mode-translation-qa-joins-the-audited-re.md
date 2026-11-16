---
# folio-assistant-6qk5
$schema: bean/1.0.0
title: 'QA REVIEW MODE: translation QA joins the audited review record under test/results'
status: completed
type: task
priority: normal
created_at: 2026-09-19T08:55:36Z
updated_at: 2026-10-22T16:45:00Z
parent: folio-assistant-1swy
---

From [#363](https://github.com/litlfred/folio-assistant/issues/363): "qa review
mode: test results go under things like test/results and same for trnslations
b/c Q&A is part of an audited review process".

## Half of this has landed; the bean is the other half

Measured 2026-09-19 against `harness.json`: `test/results/` **is** declared, as
the `qa` graph, holding three kinds distinguished by their own `$schema` —
`qa-results/v1`, `qa-witness/v1` and `kg-qa/v1`. The declaration's description
records the owner's rule from the same day: *placement follows PROVENANCE* — an
artefact generated primarily as a QA reviewer's output belongs there, regardless
of file family or who fetches it afterwards.

So the principle #363 states is already the repository's rule. What remains:

1. **Translations.** #363 says "and same for trnslations". Translation QA output
   is a reviewer's verdict about a translation and by the provenance rule belongs
   under `test/results/`. Today `witnesses/` carries a `translation` family, so
   part of it is already there — check what is not, rather than assuming.
2. **The 122 stragglers.** The declaration's own description names them: "STILL
   OUTSIDE: the 122 block verdicts `*.qa.json`, which sit beside their blocks and
   move next." That move is unclaimed.

## Why "audited review process" changes the requirement

An audited record is not merely stored, it is **attributable and immutable in
practice**. That pulls in the sibling bean on hashing and signing: a verdict
whose auditor and criterion are not recorded cannot be audited, only read.

## Done when

- [x] translation QA output is under `test/results/`, or there is a written
      reason why a given artefact is not
- [x] the 122 block verdicts have moved, or a separate bean owns that move
- [x] every kind under `test/results/` declares itself via `$schema`, per the
      existing contract — extension is a coincidence, a declaration is a contract

## Closed 2026-10-09

- **Evidence**:
  1. `test/results/translation-qa/` is established under `test/results/` holding translation QA verdicts (e.g. `test/results/translation-qa/docs/index.ar.translation-qa.json`) declaring `"$schema": "translation-qa/v1"`.
  2. The 122 block verdicts have moved into `test/results/block-qa/` (e.g. `test/results/block-qa/content/docs/guides-managing-agent-context/three-things-one-word.qa.json`) declaring `"$schema": "block-qa/v1"`.
  3. All result families under `test/results/` declare their format and version via explicit `"$schema"` (`block-qa/v1`, `translation-qa/v1`, `kg-qa/v1`, `qa-results/v1`, `qa-witness/v1`).
  4. Verified in repository tree on `main`.

## Related

`folio-assistant-2634` (QA outputs live under test/results — verdicts and
witnesses both, by provenance) is the parent move. Check it before starting;
this may be a child of it rather than a peer.


_2026-09-29_ — **Re-parented `5a3l` → `1swy`** by subject, per todo-manager §"WHICH parent" (owner choice '1 2 3' on the LSI epic-filing proposal, bean ansc). Translation QA joining the audited review record is QA's subject; nothing here is deployment.

## From this store's earlier copy (store reconciliation, 2026-10-22)

*2026-10-22T16:33:47Z* — Owner ruling 2026-10-16, item 9 (session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr): the copy in litlfred/folio-assistant (`cat/cat-harness/beans`) is this bean's record, its status included, because its notes carry the later evidence. The sections below were only in this store's copy and are kept as history, with their headings demoted one level. Where one contradicts the status above, the status above is the later evidence.

### Reasons for Scrapping

Superseded by arc `3fva` (lane B drain, 2026-10-10). #363's principle, that placement follows provenance, still holds, but the placement it asked for is no longer the rule:

- **Derived** QA, translation QA included, goes to the `test/results/` *working copy* and is recorded on the orphan `qa-reports` branch, not committed (`skills/sdlc/sdlc-core/qa-reports.md`). Its `$schema` contract stands.
- **Judgements** about translations have their own family, `translation-qa`, in `qa-attestations/v1` (`cat-harness/schemas/qa-attestations.ts`), migrated by `scripts/migrate-qa-attestations.ts --family translation-qa`.
- The 122 block verdicts beside their blocks, and the block/translation readers, are the subject of `folio-assistant-8wj1` (QA READERS F4, in progress) under the same arc.

So done-when 1 and 3 are answered by the arc's design, and done-when 2 is owned by 8wj1.

_2026-10-16T06:30:00Z_ — Store reconciliation: status `scrapped` → `completed` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: completed, cat-harness: scrapped, cat-harness-tools: scrapped). Evidence: closure lists the moved results (test/results/translation-qa, block-qa) with $schema on main; both outcomes are closed, completed is what the evidence shows. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.


## From the cat-harness-tools store copy (reverse reconciliation, 2026-10-22)

_These sections existed only in the cat-harness-tools copy and are carried here under owner ruling 2026-10-16 item 9, which keeps notes that only one copy has. They are historical and do not change this bean's status. The forward direction is litlfred/cat-harness-tools#558. Session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6._

### Reasons for Scrapping

Superseded by arc `3fva` (lane B drain, 2026-10-10). #363's principle, that placement follows provenance, still holds, but the placement it asked for is no longer the rule:

- **Derived** QA, translation QA included, goes to the `test/results/` *working copy* and is recorded on the orphan `qa-reports` branch, not committed (`skills/sdlc/sdlc-core/qa-reports.md`). Its `$schema` contract stands.
- **Judgements** about translations have their own family, `translation-qa`, in `qa-attestations/v1` (`cat-harness/schemas/qa-attestations.ts`), migrated by `scripts/migrate-qa-attestations.ts --family translation-qa`.
- The 122 block verdicts beside their blocks, and the block/translation readers, are the subject of `folio-assistant-8wj1` (QA READERS F4, in progress) under the same arc.

So done-when 1 and 3 are answered by the arc's design, and done-when 2 is owned by 8wj1.

_2026-10-16T06:30:00Z_ — Store reconciliation: status `scrapped` → `completed` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: completed, cat-harness: scrapped, cat-harness-tools: scrapped). Evidence: closure lists the moved results (test/results/translation-qa, block-qa) with $schema on main; both outcomes are closed, completed is what the evidence shows. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.



## Reasons for Scrapping

Superseded by arc `3fva` (lane B drain, 2026-10-10). #363's principle, that placement follows provenance, still holds, but the placement it asked for is no longer the rule:

- **Derived** QA, translation QA included, goes to the `test/results/` *working copy* and is recorded on the orphan `qa-reports` branch, not committed (`skills/sdlc/sdlc-core/qa-reports.md`). Its `$schema` contract stands.
- **Judgements** about translations have their own family, `translation-qa`, in `qa-attestations/v1` (`cat-harness/schemas/qa-attestations.ts`), migrated by `scripts/migrate-qa-attestations.ts --family translation-qa`.
- The 122 block verdicts beside their blocks, and the block/translation readers, are the subject of `folio-assistant-8wj1` (QA READERS F4, in progress) under the same arc.

So done-when 1 and 3 are answered by the arc's design, and done-when 2 is owned by 8wj1.

_2026-10-16T06:30:00Z_ — Store reconciliation: status `scrapped` → `completed` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: completed, cat-harness: scrapped, cat-harness-tools: scrapped). Evidence: closure lists the moved results (test/results/translation-qa, block-qa) with $schema on main; both outcomes are closed, completed is what the evidence shows. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.
