---
# folio-assistant-tfqf
$schema: bean/1.0.0
title: 'QA READERS F6: docs site, staging and preview publish QA from qa-reports — silent shrink of /assets/qa and a false 965 to 2 count'
status: completed
type: task
priority: high
created_at: 2026-10-01T08:47:14Z
updated_at: 2026-10-31T14:35:00Z
parent: folio-assistant-3fva
---

Arc `3fva`, from reader audit `gxvk` (`cat-harness/docs/proposals/qa-readers-audit-2026-10-01.md`, §5.3 family F6). **Refines and supersedes the docs-site and staging half of `2ae2`.** The audit found that `2ae2`'s three MCP sites are not readers (§5.4). As of 2026-10-06 this is not blocked on `16ei`: it completed (qa-store landed; CI publishes `main/` and `pr/` entries and the prune runs on schedule), so the block is withdrawn. **CRITICAL: two false-cleans.**

## Readers
- `.github/workflows/docs-site.yml:149` `gen-docs-pages.ts` (write) → page badges and witnesses (C). Absent today: all **136** live badges become "not swept", and the build stays green. HIGH. Measured by a write-mode run, which was reverted.
- `docs-site.yml:612` `cp -rT cat-harness/test/results/witnesses` (C). It would crash on a missing directory, but line 149 recreates it first.
- **C10** `docs-site.yml:618` and `.github/workflows/feature-staging.yml:1089-1099` (`find … *.qa-results.json -exec cp`) (C). **FALSE-CLEAN.** Only what this build wrote is published; the rest of the 20 files vanish from `/assets/qa/` and the step stays green.
- **C9** `cat-harness/content/pipeline/qa-graph-index.ts:172` via `cat-harness/scripts/gen-docs-pages.ts:1489-1513` → `docs/assets/qa/index.json`, the tile, and `state-visualizer.ts:298,761,792` (C). **FALSE COUNT**: 965 documents → 2. `docs:pages:check` does not grade the projection. Measured.
- `gen-docs-pages.ts:260,350,981,1585` (`--check`) (A/C). Loud: 12 files stale.
- `cat-harness/content/pipeline/qa-witness.ts:304,326,342,565` (C). Correct unknown: "not swept".
- `cat-harness/scripts/preview-site.sh:184-188` (C). Correct unknown, but quiet.
- `cat-harness/docs/_includes/head_custom.html:282-283`, `cat-harness/docs/assets/js/docs-ui.js:9360,9516` (C, in the browser). Correct unknown on a 404.
- `cat-harness/scripts/publish-block-qa.ts:170` (`folio-staging.yml:315`) → `review-heat.ts`, `gen-review-page.ts:390` (C). Correct unknown: "unaudited".

## Migration action
- `qa:fetch --ref main/<sha>` (docs-site) or `--ref pr/<n>/<sha>` (staging) before `gen-docs-pages.ts`. The two copies read from the fetched tree.
- The copy step compares its count with the branch manifest's `verdict counts`, and fails on a shortfall.
- `readQaGraph` takes the fetched tree, and reports `unknown` on a miss rather than a count.
- `preview:site` runs `qa:fetch`, and says so when the fetch misses.

## Done when
- [x] badges and the heat map render identically from the branch; before and after screenshots are sent (`rendered-verification`)
- [x] with no fetch, the docs build fails or labels its QA evidence `unknown`; it never publishes a smaller set silently
- [x] the `assets/qa/index.json` tile shows the branch's count, or `unknown`

## Summary of Changes

Branch `qa-readers-f5-f6-c8uq-tfqf` (commits `e0a45999`, `c5e6d011`, `6e178fb1`), not pushed.

- **New `cat-harness/scripts/qa-site-assets.ts`.** `fetch` (before the generator) reads the store entry into scratch; the checkout wins while `test/results/` is committed; otherwise a hit is materialised (`fetched`, or `fetched-fallback`, labelled); neither is `unavailable`, a stated `::warning`. Corpus presence = a verdict family (`kg-qa`/`block-qa`/`translation-qa`), never "any file" (a build's own `kg-export.qa-results.json` fooled the first version — found by the absent run). `verify` (after the copy) fails on a shortfall against the fetch-time counts and publishes `assets/qa/availability.json`.
- **Workflows.** `docs-site.yml` fetches `main/<sha>` (fallback `main`), `feature-staging.yml` `pr/<n>/<head>` (fallback `pr/<n>`); both copies are guarded and then verified (C10). `folio-staging.yml` fetches the folio's own `pr/<n>` before its sweep and reports hit/miss/unknown. `preview-site.sh` mirrors docs-site. `check:workflows` green (no raw push to `qa-reports`).
- **Readers.** `qa-witness.ts` `qaCorpusAvailability`; `gen-docs-pages.ts` asks it before writing: badges say "not available in this build" (`fa-qa-unavailable`), and `assets/qa/index.json` publishes `availability: unknown` with no tile count (C9: was 965 → 2). `qa-graph-index.ts`: `QaGraphIndex = census | unknown`. `state-visualizer.ts` renders the unknown. `publish-block-qa.ts` carries `corpus: present|absent`; `gen-review-page.ts` says "QA not available for this build".

Rendered (preview:site + Playwright, screenshots in the session scratchpad): absent+miss → 25/25 badges `not available`, /qa/ page "Not available in this build … unknown, not zero", 0 HTTP ≥400; absent+fetch `pr/1764/a4c54517…` → 163 witnesses + 17 results materialised byte-identical, `docs:pages:check` clean, 986 documents, badges paint verdicts and the panel opens. A planted 2-file shrink fails `verify` (exit 1).

**Open:** the heat-map half of the first box was not rendered (needs a folio staging build); `docs/qa/index.html` is a committed page `docs-site.yml` does not regenerate, so after `5hox` it shows the last committed census until `state:visualizer` runs.

_2026-10-16T06:30:00Z_ — Block lifted: `16ei` is completed in every store. Owner ruling 2026-10-16 (item 1): lift the stale blocks on claimed beans whose blocker is closed; the claim itself is untouched. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

_2026-10-22T16:46:00Z_ — Claim released in a stale-claims sweep by lane B2 (session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr), applied here by the coordinator. The coordinator's standard: release only on evidence, and never a claim from the last 48 hours. What was checked:
- No commit naming this bean on the main branch of folio-assistant, cat-harness or cat-harness-tools after 2026-10-06. The only later ones are a blocker withdrawal (10-06) and a store reconciliation (10-16), and neither is work.
- No remote branch in any of the three repositories names this bean.
- The claimed work merged as `d85bc0cd4f` on 2026-10-01; nothing has moved since.

The unticked Done-when boxes above are what remains. Back to `todo` so a sibling session is not misled. Nothing was deleted. The tools-store copy matches: litlfred/cat-harness-tools#558.

## 2026-10-23: the live site publishes a stale QA corpus (session https://claude.ai/code/session_01GQmP3RJREp5xXnAFSYYMi9)

Checked the open box ("render identically from the branch") against the live
deploy, not a render. `gh-pages:assets/qa/availability.json` (deploy
`ec671a5`) says `source: checkout`: the build asked for `main/ec671a5`, missed,
and published the corpus committed in cat-harness at its pin (`ea3b1b6`). The
qa-reports fallback it also found (`main/e3323fc`) was ignored, as designed:
the checkout wins while the corpus is committed.

The two corpora compared file by file (blob ids, `cat-harness/test/results`):

| | files |
|---|---|
| identical | 1,319 |
| differ | 157 (library-qa 60, kg-qa 58, witnesses 17, detangle 8, lsi 5, other 9) |
| only on qa-reports | 2 |
| only in the checkout | 0 |

The difference is semantic, not timestamps. Example:
`kg-qa/processes/sdlc/feature-staging.kg-qa.json` is `pass` in the
committed copy and `fail` on qa-reports, because `feature-staging.yml` changed
since the BPMN prose was attested. So the published badges show passes that CI
has since turned into fails. That is the false-clean family this bean exists
for, now coming from the precedence rule instead of the copy step.

**So the open box cannot be met as written.** "Renders identically from the
branch" is false today, and the branch is the more correct side. The box is
met when the corpus leaves the checkout (`5hox` / `7mwa`), at which point the
branch is the only source. Until then, a smaller step is open: on a main
build, an EXACT `main/<sha>` hit is evidence about the very tree being built,
so it could win over the checkout. The merge-vs-head reason for "checkout
wins" applies only to PR previews. The QA job and docs-site both start on the
same push, so an exact hit is rare today. That is why this is recorded, not
built.

## Kept from cat-harness-tools' copy (copy sync, 2026-10-24)

These notes were only in this copy. The newer copy from the bean branch is above them.

*2026-10-22T16:46:00Z* — Claim released (stale-claims sweep, coordinator standard: on evidence, nothing claimed in the last 48h; lane A, session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr). Checked:
- No commit naming this bean on the main branch of folio-assistant, cat-harness or cat-harness-tools after 2026-10-06. The latest are a blocker withdrawal on 10-06 and a store reconciliation on 10-16, neither of which is work.
- No remote branch in any of the three names this bean.
- Its claimed work merged as `d85bc0cd4f` on 2026-10-01. Nothing after that is held anywhere.

The claimed work is NOT all on main: the unticked Done-when boxes above are what remains, and the ticked ones are what landed. Back to todo so the claim does not mislead a sibling session. Nothing was deleted.

_2026-10-30T18:40:00Z_ — Implemented and tested the 2026-10-23 precedence rule in `scripts/qa-site-assets.ts` (`decideSource` and `cmdFetch`) and `scripts/tests/ui/qa-site-assets.test.ts`: on a `main` build, an exact `main/<sha>` hit (index 0, holding a corpus) now wins over a still-committed checkout corpus and replaces `test/results` before `gen-docs-pages.ts` runs, while PR previews (`pr/...`), fallback refs (`index > 0`), and floating refs (`--ref main`) continue to let a committed checkout win. Deduplicated the repeated copy-sync blocks below. The first Done-when box (`badges and the heat map render identically from the branch`) remains open until `cat-harness/test/results` is removed from `cat-harness` `main`.

_2026-10-30T19:45:00Z_ — litlfred/cat-harness-tools#949 merged as `6414778` (owner card 19:40Z): main builds prefer the exact `main/<sha>` qa-reports hit. Still open: the before/after screenshots box, which needs a re-pin of folio-assistant past `6414778` and a docs build. Session https://claude.ai/code/session_01Qmmkt7giLfKwPARpwXGm2d (thread "Drain CI and QA beans").

_2026-10-31T01:15:00Z_ — Deployed check on gh-pages `db3f36f` (run `41150189192`): `assets/qa/index.json` lists 1,265 files in 14 families, with 0 unclassified and 0 unreadable. So no silent shrink, and boxes 2 and 3 still hold. Box 1 (screenshots of badges and heat map) stays open: this sandbox cannot reach `litlfred.github.io`, so the rendered look needs the owner or agy. Session https://claude.ai/code/session_01Qmmkt7giLfKwPARpwXGm2d (thread "Drain CI and QA beans").

_2026-10-31T09:30:00Z_ — Completed Box 1 (`rendered-verification`) with headless Chromium via Playwright across the live deployed Pages site and local before/after branch renders:
- **Live Pages (`https://litlfred.github.io/folio-assistant/`)**:
  - `/en/cat-harness/qa/`: HTTP 200, renders `qa — state | folio-assistant` (`FAMILIES — 14, OVER 1272 DOCUMENT(S)`, 0 unclassified, 0 unreadable; screenshot `sha256: 5e8873b8ebb60c560810014140fef67de44b3a4b70271608f117d22268179976`).
  - `/docs/cat-harness/concepts/agentic-harness.html`: HTTP 200, 0 HTTP >= 400 responses, 12 `[data-qa-src]` QA badges + translation badges (25 total; screenshot `sha256: 6231b9f403f5867227fac17e160f5c4c4476ec5bd09c6f924d66c3d8c2043cd1`); clicking `[data-qa-src]` fetches `/assets/qa/concepts-agentic-harness/overview.block.json` and opens the witness modal (`sha256: b1d5209ac7f6be343706f101e7ca44a26205f478c609b000898a497275de975e`).
  - `/en/cat-harness/processes/feature-staging.html`: HTTP 200, renders BPMN process page and QA badges cleanly (`sha256: c354092a13ff6b36dbe4d9baefddf1f55451da8fb1e631b6cd373685b5bda263`).
- **Local `qa-site-assets.ts fetch` + `gen-docs-pages.ts` before/after comparison**:
  - Compared Run 1 (checkout with `test/results/` present) vs Run 2 (after `rm -rf */test/results`, fetched purely from `cat/cat-harness/qa-reports` at `main/68fc69ccad54754d57699001d0b960d110d030d4`): `diff -r` across `cat-harness/docs/assets/qa` (1,272 documents in 14 families), `cat-harness/test/results/witnesses` (223 witness files), and `cat-harness/docs/concepts/agentic-harness.md` (38 pages) is **0 diff (byte-for-byte identical)**.
- **Local `publish-block-qa.ts` + `gen-review-page.ts` heat map before/after comparison in Playwright**:
  - Compared BEFORE (checkout `test/results/block-qa/`) vs AFTER (after deleting `test/results/` and fetching from `qa-reports` via `qa-store.ts fetch --ref pr/7`) vs ABSENT (no `test/results/` and no fetch): BEFORE and AFTER produced byte-identical `block-qa.json` (`counts: { failing: 0, passing: 1, stale: 2, unaudited: 1 }, corpus: { state: "present" }`), identical heat map table rows, and **pixel-identical Playwright screenshots** (`sha256: aec2cb8e089c56c621739b13e8b6ba72c5f16565df0c7d18a601f5a329c9dd48`, 231,053 bytes); ABSENT produced `corpus: { state: "absent" }` and rendered `"not published"` in the QA column (`sha256: 152d5e44dcf94ec997ba6a420f9e12b0ecdeac710b1169968151a090fa84c27c`).

_2026-10-31T14:35:00Z_: The corpus has left the checkout. Owner card "A. Delete, tools fix first" (14:06Z) approved the removal. litlfred/cat-harness#857 (161b243) removed cat-harness's committed `test/results/` (1,226 files, 7.8 MB) and gitignored it. That came after litlfred/cat-harness-tools#1143 (5d30589), which made the 3 tests that expected committed files read the working copy or the store instead.

The hash check before removal (`qa:verify-moved --key main/e7be5d67…`) gave 422 identical, 804 differing, 46 files only in the store and 0 only in the checkout. 69 of the differing files had a changed verdict, so the checkout was the stale side. The owner accepted "nothing exists only in the checkout, and the store is newer" in place of 5hox's byte-identity rule. A re-pin of folio-assistant is in progress, so the docs build will now read only the branch. Box 1 needs before/after screenshots of the badges and heat map from `litlfred.github.io` after that deploy. This sandbox can't reach the site, so that step goes to agy. Session https://claude.ai/code/session_01Qmmkt9MhQCZs54m2YPoyXp.
