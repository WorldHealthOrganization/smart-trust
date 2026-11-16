---
# folio-assistant-5qy8
$schema: bean/1.0.0
title: 'QA SIDECAR LOCATION CONTRADICTION: the folio_init template commits *.qa.json while AGENTS.md puts QA on the qa-reports branch'
status: completed
type: bug
priority: normal
created_at: 2026-10-04T15:10:09Z
updated_at: 2026-10-22T16:45:00Z
parent: folio-assistant-3fva
---

Recorded from the qou work-plan analysis, 2026-10-04 (session https://claude.ai/code/session_01NdDGeP1SyShmoUssLuRZ91). Not started: recorded so the gap has an owner. The owner ruled 2026-10-04 for qou: use the cat-harness qa-reports branch. The folio_init template (cat-harness/templates/) still writes a layout that commits sidecars on main. Reconcile the template with skills/sdlc/sdlc-core/qa-reports.md.

## Closed 2026-10-09

Reconciled `folio_init` templates and generated guidance with `skills/sdlc/sdlc-core/qa-reports.md` (derived QA verdicts stored on orphan `qa-reports` branch, authored judgements on `main` in `test/attestations/`, working copy in `test/results/` machine-written and not committed to `main`).

- **Worktree branch**: `claude/5qy8-qa-sidecar-location`
- **Commit**: `97272f89a45ecfa39f93ea2cc2622cbf19ad3278`
- **Changes**:
  - `templates/document/github/workflows/qa-sweep.yml`:
    - Updated docblock and comments to clarify that QA sidecars produced in working copy under `test/results/` during sweep are checked for schema sanity for the `qa-reports` branch and not committed to `main`.
  - `scripts/init-folio.ts`:
    - Updated generated README/AGENTS layout: `test/results/block-qa/` documented as machine-written working copy published to `qa-reports`, and added `test/attestations/` for reviewer judgements and baseline attestations committed on `main`.
    - Removed outdated instruction "Commit those files with the edit they are about"; reconciled with `qa-reports.md` policy.
  - `scripts/tests/init-folio-qa.test.ts` & `scripts/tests/init-folio.test.ts`:
    - Verified against updated text and layout.
- **Verification Evidence**:
  - `bun test scripts/tests/init-folio-qa.test.ts`: 2 pass, 0 fail (2.45s).
  - `bun test scripts/tests/init-folio.test.ts`: 44 pass, 0 fail (5.00s).
  - Combined suite: 46 pass, 0 fail (7.00s).
  - `bun run typecheck`: 0 errors (clean).

## From this store's earlier copy (store reconciliation, 2026-10-22)

*2026-10-22T16:33:47Z* — Owner ruling 2026-10-16, item 9 (session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr): the copy in litlfred/folio-assistant (`cat/cat-harness/beans`) is this bean's record, its status included, because its notes carry the later evidence. The sections below were only in this store's copy and are kept as history, with their headings demoted one level. Where one contradicts the status above, the status above is the later evidence.

### Progress 2026-10-10 (lane B drain, PR for cat-tools-yylt)

- [x] The scaffold's `.gitignore` now ignores `test/results/`, the QA working copy. Derived verdicts go to `qa-reports`; `test/attestations/` stays committed. Tested in `init-folio.test.ts`.
- [x] `qa-sweep.yml` and `qa-sweep-nightly.yml` already publish to `qa-reports` and commit nothing.
- [ ] **One contradiction is left, in `templates/document/github/workflows/section-title-audit.yml`.** Its comments say verdicts live on `qa-reports`, but its hard gate regenerates `{{folio}}/<document>/section-title-audit.qa.json` and runs `git diff --exit-code` on it, so the sidecar must be committed and fresh on main. The sidecar also carries the **agent** story-coherence verdicts (`agent[key]`, carried forward by `reviewed_hash`), and those are judgements, not derived results.

### Owner decision

Where do section-title-audit's agent verdicts live?

1. **(Recommended)** Move the `agent` slots to `test/attestations/section-title/…` (judgements on main, as ruling D2 says), make the sidecar a derived working copy published to `qa-reports`, and replace the freshness gate with compute-and-judge.
2. Keep the sidecar committed on main, and record it in `skills/sdlc/sdlc-core/qa-reports.md` as a named exception: a file that carries judgements.
3. Drop the agent block from the sidecar entirely and keep only the machine review.
4. Leave it as it is.

**Default if no answer:** option 2. It is documentation only: no data moves and no gate changes.

### Owner ruling 2026-10-11 (relayed by lane A, answered in their session)

**Option 1:** move section-title-audit's agent slots to `test/attestations/section-title/…`, make the sidecar a derived working copy published to `qa-reports`, and replace its freshness gate with compute-and-judge.

### Progress 2026-10-11 (lane B), owner option 1
- [x] cat-harness#142 (merged): the `section-title` family in qa-attestations/v1.
- [x] cat-harness-tools#119: verdicts go to `<attestations>/section-title/<paper>/section-title-audit.attestations.json`. The derived copy goes to `test/results/section-title/<paper>/section-title-audit.json`. A legacy sidecar's verdicts are auto-moved. The template gate is now compute-and-judge.

### Summary of Changes

Built to the owner's option 1.
- **cat-harness#142** adds the `section-title` family to qa-attestations/v1. It holds decided verdicts only, each pinned to the hash it reviewed.
- **cat-harness-tools#119** splits section-title-audit by provenance:
  - verdicts go to `<attestations>/section-title/<paper>/section-title-audit.attestations.json`, written by `--verdict`;
  - the derived copy goes to `test/results/section-title/<paper>/section-title-audit.json`. It is not `*.qa.json`, because the template's schema-sanity step requires block-qa/v1 of those.
- A legacy committed sidecar's decided verdicts move into the store on first save. Removing the legacy file from main is left to a person.
- The template's git-diff freshness gate is now compute-and-judge: it computes the derived copy, and an unreadable store exits 2.


## Closed 2026-10-09

Reconciled `folio_init` templates and generated guidance with `skills/sdlc/sdlc-core/qa-reports.md` (derived QA verdicts stored on orphan `qa-reports` branch, authored judgements on `main` in `test/attestations/`, working copy in `test/results/` machine-written and not committed to `main`).

- **Worktree branch**: `claude/5qy8-qa-sidecar-location`
- **Commit**: `97272f89a45ecfa39f93ea2cc2622cbf19ad3278`
- **Changes**:
  - `templates/document/github/workflows/qa-sweep.yml`:
    - Updated docblock and comments to clarify that QA sidecars produced in working copy under `test/results/` during sweep are checked for schema sanity for the `qa-reports` branch and not committed to `main`.
  - `scripts/init-folio.ts`:
    - Updated generated README/AGENTS layout: `test/results/block-qa/` documented as machine-written working copy published to `qa-reports`, and added `test/attestations/` for reviewer judgements and baseline attestations committed on `main`.
    - Removed outdated instruction "Commit those files with the edit they are about"; reconciled with `qa-reports.md` policy.
  - `scripts/tests/init-folio-qa.test.ts` & `scripts/tests/init-folio.test.ts`:
    - Verified against updated text and layout.
- **Verification Evidence**:
  - `bun test scripts/tests/init-folio-qa.test.ts`: 2 pass, 0 fail (2.45s).
  - `bun test scripts/tests/init-folio.test.ts`: 44 pass, 0 fail (5.00s).
  - Combined suite: 46 pass, 0 fail (7.00s).
  - `bun run typecheck`: 0 errors (clean).

## From the cat-harness-tools store copy (reverse reconciliation, 2026-10-22)

_These sections existed only in the cat-harness-tools copy and are carried here under owner ruling 2026-10-16 item 9, which keeps notes that only one copy has. They are historical and do not change this bean's status. The forward direction is litlfred/cat-harness-tools#558. Session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6._

### Progress 2026-10-10 (lane B drain, PR for cat-tools-yylt)

- [x] The scaffold's `.gitignore` now ignores `test/results/`, the QA working copy. Derived verdicts go to `qa-reports`; `test/attestations/` stays committed. Tested in `init-folio.test.ts`.
- [x] `qa-sweep.yml` and `qa-sweep-nightly.yml` already publish to `qa-reports` and commit nothing.
- [ ] **One contradiction is left, in `templates/document/github/workflows/section-title-audit.yml`.** Its comments say verdicts live on `qa-reports`, but its hard gate regenerates `{{folio}}/<document>/section-title-audit.qa.json` and runs `git diff --exit-code` on it, so the sidecar must be committed and fresh on main. The sidecar also carries the **agent** story-coherence verdicts (`agent[key]`, carried forward by `reviewed_hash`), and those are judgements, not derived results.

### Owner decision

Where do section-title-audit's agent verdicts live?

1. **(Recommended)** Move the `agent` slots to `test/attestations/section-title/…` (judgements on main, as ruling D2 says), make the sidecar a derived working copy published to `qa-reports`, and replace the freshness gate with compute-and-judge.
2. Keep the sidecar committed on main, and record it in `skills/sdlc/sdlc-core/qa-reports.md` as a named exception: a file that carries judgements.
3. Drop the agent block from the sidecar entirely and keep only the machine review.
4. Leave it as it is.

**Default if no answer:** option 2. It is documentation only: no data moves and no gate changes.

### Owner ruling 2026-10-11 (relayed by lane A, answered in their session)

**Option 1:** move section-title-audit's agent slots to `test/attestations/section-title/…`, make the sidecar a derived working copy published to `qa-reports`, and replace its freshness gate with compute-and-judge.

### Progress 2026-10-11 (lane B), owner option 1
- [x] cat-harness#142 (merged): the `section-title` family in qa-attestations/v1.
- [x] cat-harness-tools#119: verdicts go to `<attestations>/section-title/<paper>/section-title-audit.attestations.json`. The derived copy goes to `test/results/section-title/<paper>/section-title-audit.json`. A legacy sidecar's verdicts are auto-moved. The template gate is now compute-and-judge.

### Summary of Changes

Built to the owner's option 1.
- **cat-harness#142** adds the `section-title` family to qa-attestations/v1. It holds decided verdicts only, each pinned to the hash it reviewed.
- **cat-harness-tools#119** splits section-title-audit by provenance:
  - verdicts go to `<attestations>/section-title/<paper>/section-title-audit.attestations.json`, written by `--verdict`;
  - the derived copy goes to `test/results/section-title/<paper>/section-title-audit.json`. It is not `*.qa.json`, because the template's schema-sanity step requires block-qa/v1 of those.
- A legacy committed sidecar's decided verdicts move into the store on first save. Removing the legacy file from main is left to a person.
- The template's git-diff freshness gate is now compute-and-judge: it computes the derived copy, and an unreadable store exits 2.


## Closed 2026-10-09

Reconciled folio workflow templates in `templates/document/github/workflows/` with `skills/sdlc/sdlc-core/qa-reports.md`:
- `templates/document/github/workflows/qa-sweep-nightly.yml`: Replaced the rolling PR workflow that committed `*.qa.json` sidecars to `main` with a publish step using `qa-store.ts publish` (`qa:publish`) targeting the orphan `qa-reports` branch (`main/<sha>/`), keeping `main` clean. Updated permissions to `contents: write` (removing `pull-requests: write`).
- `templates/document/github/workflows/qa-sweep.yml`: Updated comments and schema sanity checks to reflect that derived QA verdicts live in `test/results/` and are stored on the orphan `qa-reports` branch, while authored judgements and reviewer attestations stay on `main` in `test/attestations/`. Added attestation schema validation (`qa-attestations/v1`).
- `templates/document/github/workflows/section-title-audit.yml`: Updated documentation and step comments to reflect that machine findings belong with QA results on the orphan `qa-reports` branch while agent judgements/attestations remain on `main`.

Commit: `ddbba9a05ae225ba0a4b228b5bdd371efd7dc4a4` (pushed to `origin/main`).
Verification: Template YAML validation tests passing via `bun test scripts/tests/init-folio.test.ts -t "every template parses as YAML"`.
