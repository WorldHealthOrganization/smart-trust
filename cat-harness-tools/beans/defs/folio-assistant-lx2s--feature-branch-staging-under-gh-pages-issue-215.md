---
# folio-assistant-lx2s
$schema: bean/1.0.0
title: 'Feature-branch staging under gh-pages (issue #215)'
status: completed
type: task
priority: normal
created_at: 2026-09-17T22:29:53Z
updated_at: 2026-10-24T13:20:00Z
parent: folio-assistant-1xhc
---


_2026-09-19T00:41:01Z_ — Verified RESOLVED, 2026-09-19 on main at 17dc1e6. .github/workflows/feature-staging.yml exists with 32 STAGING references and is demonstrably working — it deployed previews for PRs #298 and #308 in this session, each commenting the STAGING URL. Note this bean has an EMPTY body: title and issue #215 only, no statement of what 'done' means, so this verification is against observed behaviour rather than against the bean's own gate. NOT closing it — not my bean to resolve.

_Body written 2026-09-19, same situation as `t8g3`: this bean was a title and an
issue number. Reconstructed from
[issue #215](https://github.com/litlfred/folio-assistant/issues/215) and the
workflow on disk._

## Correction to my own note above

I noted this bean RESOLVED earlier today on the strength of
`feature-staging.yml` working — it deployed previews for PRs #298 and #308.
**That was too fast.** Issue #215 is still **open**, reopened after
[PR #217](https://github.com/litlfred/folio-assistant/pull/217) merged, so the
owner does not consider it finished. The mechanism runs; the issue's scope is
wider than the mechanism.

## What the owner asked for

- Feature branches render at `<owner>.github.io/<instance>/STAGING/<branch>/`.
  **Done** — `feature-staging.yml` does exactly this, with cleanup on merge or
  close.
- **All rendered content stamped with the commit sha**, so a reader can tell
  whether what they are looking at matches main, has been deployed, or is
  stale. Partially done: the injected banner carries branch and sha, and the
  KG export is stamped, but "all rendered content" is a stronger claim than a
  banner on HTML pages.
- Staging is **the place reviewers retrieve rendered changed content for
  comparison against main** during publication review. The deep-link half of
  this landed as bean `g4dv`.
- **BPMN documenting the skills and workflow per SOP.** Not evident.

The issue's worked scenario is the acceptance test worth holding it to: an
author changes an immunization schedule, the agent helps with narrative blocks
and deterministic logic and surfaces downstream implications, the guidance
review committee compares before and after on STAGING, approves, and only then
does the change merge and publication begin.

## Todo
- [x] establish what "all rendered content is stamped" covers beyond the HTML banner (owner, 2026-10-23: option A, below)
- [x] BPMN for the feature-branch review SOP: `content-change-review.bpmn`, extended by bean `en2d` (2026-09-23) with the review coordinator lane, sliced review, withdrawal, adjudication and a DMN coverage gate
- [ ] walk the issue's immunization-schedule scenario end to end and record where it breaks

## Done when
Issue #215 can be closed by its author.

## The sha-stamping inventory, measured 2026-09-19 (`938d876`)

Issue #215 asks that **all** rendered content be stamped "so it is easy to see
if rendered matches main, has been deployed, is stale". I said in #318 that only
the injected HTML banner carried a stamp. **That undersold it**, and I am
measuring rather than repeating the claim, having just had to retract the
equivalent note on `t8g3`.

Read from `feature-staging.yml` at `938d876`:

| published artefact | stamped? | where |
|---|---|---|
| every `.html` page | **yes** | banner injected into `find ./_site -name "*.html"`, carrying branch + sha; nothing is missed because the find is unfiltered |
| any page wanting build metadata | **yes** | `docs/_data/` gets `sha`, `short_sha`, `built_at`, `branch`, `staging`, `staging_slug` (:140-146), so Jekyll can surface them anywhere |
| `<stub>.jsonld` — the KG export | **yes** | `d.staging = { branch, sha, pr, run }` (:358-360) |
| `<stub>.json` — its alias | **yes** | copied **after** the stamp, deliberately, "so the two documents cannot disagree about which build they came from" (:366-367) |
| **`harness-schema-export.ts --out-dir ./_site`** | **NO** | writes `<stub>.schema.json`, `tool.schema.json` and siblings (:355); takes `--base-url` and carries no build identity at all |
| CSS, JS, images, PDFs | no | and not in-band fixable — see below |

### The one real gap

**Two self-describing data artefacts are published side by side and only one is
stamped.** `kg-export.ts` writes `<stub>.jsonld` on line 354 and is stamped four
lines later; `harness-schema-export.ts` writes its schema documents on line 355
and is never touched. A reviewer holding `tool.schema.json` off a STAGING URL
cannot tell which build produced it — which is the exact question #215 exists to
answer.

The asymmetry looks accidental rather than reasoned. The same step takes visible
care over a *weaker* case: the `.json` alias is copied after the stamp precisely
so the pair cannot disagree. That care simply was not extended to the sibling
export on the adjacent line.

`harness-schema-export.ts` already accepts `--base-url`, so it has a natural
place to accept build identity too, and the schema documents are JSON objects
with room for a `staging` key exactly like the `.jsonld`.

### The limit worth stating

CSS, JS, images and PDFs cannot carry an in-band stamp in any useful way. "All
rendered content" can only reach them through a **manifest** — one document
listing every published path with the sha that produced it. That is a design
decision, not an oversight, and it belongs to whoever owns #215 rather than
being assumed here.

### Not done

No code. This is the inventory; the schema-export stamp is a small change and
the manifest question is the owner's.

---

## Done, 2026-09-19 — the stamp, and a second defect in the one that existed

**The schema exports are stamped.** `harness-schema-export.ts` wrote
`<stub>.schema.json`, `tool.schema.json`, `tool-types.schema.json` and 44 skill
I/O contracts into `_site` with no build identity, beside a `.jsonld` that
carried one. Both exporters now stamp their own output from a single
`stagingStamp()` (`scripts/staging-stamp.ts`), and the inline `bun -e` rewrite
is gone from `feature-staging.yml`. Two stamps would have given the two
documents independent notions of one build — the failure the workflow's own
comment guards against when it copies the `.json` alias *after* the stamp.

Stamped at **write** time, not in the builders: `buildDeclarationSchema` and
friends say what a declaration IS, which is the same answer in every run, and a
run id folded in there would make two calls in one process return documents
that differ.

### The second defect: the stamp that existed was being dropped

The workflow appended a top-level `staging` key to the JSON-LD, and `staging`
was **not in the `@context`**. A JSON-LD processor discards a property that is
neither declared nor an absolute IRI — so the one artefact this build stamped
carried its stamp in the one form the consumer the export exists to serve
cannot read. It is written, published, and not there.

That is precisely the `ovkk` defect `kg-export.ts` records on
`inputSchema`/`outputSchema`, one level up on the **document root**, which is
where `undeclaredTerms` does not look: it walks `@graph`. The term is now
declared, with `branch`/`sha`/`pr`/`run` in a **scoped** context (JSON-LD 1.1
§4.1.8) rather than four global terms — they are words a graph node could
plausibly use for something else.

### Open, and deliberately not taken here

**The same root-level blind spot covers `counts`, `problems`,
`undeclaredTerms`, `danglingLinks` and `undeclaredSchemaModules`** — all
undeclared, all dropped by a processor. Whether those are graph DATA that
should survive expansion or a build REPORT that has no business being RDF is a
design call, not a bug fix. Recorded rather than decided.

**CSS, JS, images and PDFs are still unstamped**, for the reason stated above:
only a site-root manifest reaches them, and its costs (a second answer to
"which build", staleness if anything writes to `_site` afterwards, and a PDF
fetched on its own still carrying nothing) make it the owner's decision.


## 2026-09-20 — swept under `0pes` and deliberately NOT closed

The other five beans carrying *"Verified resolved … NOT closing it — not my
bean to resolve"* were discharged today under the new evidence-not-authorship
rule in `bean-coordination`. **This one was not**, and the reason is in this
bean already: the correction above walks its own resolution back.

Its *Done when* is **"Issue #215 can be closed by its author."** An agent never
closes an issue on its own say-so, so this is not an agent's to discharge under
any rule — that is obligation 2 of the new §"Closing a bean whose work has
already landed", and this bean is the worked example it cites.

Three items remain open and none is mechanical:

- [x] establish what *"all rendered content is stamped"* covers beyond the HTML banner (owner, 2026-10-23: option A, below)
- [x] BPMN for the feature-branch review SOP: `content-change-review.bpmn`, extended by bean `en2d` (2026-09-23) with the review coordinator lane, sliced review, withdrawal, adjudication and a DMN coverage gate
- [ ] walk issue #215's immunization-schedule scenario end to end and record where it breaks

The mechanism runs — `feature-staging.yml` deploys previews, and it did so for
this very sweep's PRs. The issue's scope is wider than the mechanism, which is
what the earlier correction established and why *"it works"* was too fast.



## Claim released 2026-09-29

Released `in-progress` → `todo` on the owner's instruction (review session https://claude.ai/code/session_014Qj8wncQhqV52QGN1yZDnj). No git change to this bean since before 2026-09-26, no holder recorded, and no open working branch touches it; the sessions that held theme B (CI reliability, QA instruments, process) work stopped on the 2026-09-25 weekly usage limit. Nothing in the body was changed: re-claim with `bun run cat beans:claim <id>`.

## Note (2026-10-10, drain ml9h)

Lane B scrapped the cat-harness-tools copy because the subject lives in folio-assistant / cat-harness; THIS copy is the owning one and stays open.

## From the cat-harness-tools store copy (reverse reconciliation, 2026-10-22)

_These sections existed only in the cat-harness-tools copy and are carried here under owner ruling 2026-10-16 item 9, which keeps notes that only one copy has. They are historical and do not change this bean's status. The forward direction is litlfred/cat-harness-tools#558. Session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6._

### Reasons for Scrapping

Scrapped 2026-10-10 in the cat-harness-tools store (lane B drain): **the subject is not in this repository.** It tracks litlfred/folio-assistant issue #215 and that repository's `.github/workflows/feature-staging.yml`; its done-when is the issue's author closing it. The copy in the `cat/cat-harness/beans` store (litlfred/folio-assistant) is the live one. Keep it open there.

_2026-10-16T06:30:00Z_ — Store reconciliation: status `scrapped` → `todo` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: todo, cat-harness: scrapped, cat-harness-tools: scrapped). Evidence: same as 197s: scrapped only as "not in this repository"; folio-assistant issue #215 is still open. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

## OWNER, 2026-10-23: the deploy root's stamp file stamps everything under it (option A)

Asked in the Preview storage thread (session https://claude.ai/code/session_01GQmP3RJREp5xXnAFSYYMi9). The owner chose **A** over B (a per-file manifest with content hashes) and C (leave open).

What "all rendered content is stamped" means:

- **One stamp file per deploy root names the build for everything under that root.** On the live site it is `build.json` (`sha`, `built`, `runUrl`). On a preview it is `STAGING/<slug>/staging.json` (branch, sha, PR, run), written by `staging-banner.ts`.
- **HTML pages carry no build identity in their bytes** (bean `g196`), so an unchanged page is shared by every preview and the live site. The preview banner and the footer read the stamp file when the page loads.
- **The JSON-LD and schema exports** keep their in-band `staging` stamp (2026-09-19).
- **CSS, JS, images and PDFs** are stamped by the file beside them. A file opened on its own does not say its build. That is accepted.

Revisit B (a per-path manifest) when bean `fwtz`'s cone deploy is switched on, because a cone deploy leaves untouched files from older builds.

Remaining: walk issue #215's immunization-schedule scenario end to end. Closing #215 is the owner's.

_2026-10-24T08:35:00Z_ — **Owner, 2026-10-24 (structured question Q8, 08:29Z): "A".** Walk issue #215's scenario on **litlfred/smart-immunizations-uganda**. One small sample schedule change (for example the HPV single-dose age) goes on a branch. Its preview at `STAGING/<branch>/` (`site-publish.yml`) is compared with main, and the walk records where it breaks. The branch is never merged. `xp72`'s Done-when 3 is walked on the same branch. Closing #215 stays the owner's. Session https://claude.ai/code/session_01FABZmtqnNeBaTcHsXrtyK7.

_2026-10-24T09:00:00Z_ — Claimed by the Preview storage thread for the #215 walk on a never-merged smart-immunizations-uganda branch (owner Q8 "A"). No agy claim found. Session https://claude.ai/code/session_01GQmP3RJREp5xXnAFSYYMi9.

## The #215 walk, 2026-10-24 (owner Q8 "A"): where it breaks

Walked on litlfred/smart-immunizations-uganda#12, a draft that never merges. The sample change: the single HPV dose for girls at 9 years instead of 10. Session https://claude.ai/code/session_01GQmP3RJREp5xXnAFSYYMi9.

| # | Step of the scenario | What happened | Verdict |
|---|---|---|---|
| 1 | Author changes the schedule | Branch `claude/sample-215-hpv-9y-do-not-merge`: narrative (`schedule`, `decision-logic`, `differences`, `testing`), CQL, the L2 record, test patient UGHPV01, and the workbook's HPV Q26/R26 | works |
| 2 | Agent keeps narrative and logic together | The `logic` gate (`checks.yml`: `logic:generate` then `git diff`) **caught** a hand edit of the generated FSH: the workbook is the logic's source. Fixed in c24e688; `logic:generate` and `logic:examples` pass locally | works |
| 3 | Agent surfaces downstream implications | **No tool did.** The nine places were found by grep. Two stay silent: the CQL is hand-completed and no gate compares its due date with the workbook's R26, and the L2 record still cites P10, which says 10 years, with nothing flagging that the adaptation now contradicts its evidence | **breaks** |
| 4 | Preview on STAGING | `site-publish.yml` run 40078592557 **refused**: `ig-site:ast`, "the AST is stale-inputs". The workflow refreshes the AST only for the default branch, `ig-ast-refresh.yml` seeds only from it, and no input sets `SITE_ACCEPT_STALE_AST`. The error's advice ("run the IG's Site publish") is the run that failed. **No branch that changes an IG's inputs can get a preview** | **breaks** |
| 5 | Preview with the preview-only override (built locally, not published) | The site mixes two builds. Narrative pages say **9 years** (branch). `PlanDefinition-…HPVSingleDose`, `Library-…HPVSingleDoseLogic` and `ast-data/` say **10 years** (AST from main's 91b2b5a). `folio-build.json` names the branch commit 3369fc0 as the source of the whole site, so the stamp is wrong for the artefacts: option A's "one stamp names the build for everything under it" does not hold on this route | **breaks** |
| 6 | Committee compares before and after | The IG route (`stage-local-ig.ts`) writes no `staging.json`, no banner, no ChangeSet, no `rendered-impact.json` and no review page. The committee has nothing that shows what changed. The live root's stamp here is `folio-build.json`, not `build.json` | **breaks** |
| 7 | Approve, then merge, then publish | Not reached | — |

### What would fix each break (for the owner to choose)

- **4 and 5:** the IG preview uses an AST built from the branch. `ig-ast-refresh.yml` already uploads a non-default branch's AST as a run artefact; `site-publish.yml` would pass `ref: github.ref` and the publish job would restore that artefact for a preview. fhir-harness template plus the workflow.
- **6:** the IG route gets what the folio route has: `staging.json`, the banner, and a ChangeSet over the IG's narrative pages so the review page works. This is also xp72's Done-when 3.
- **3:** a check that each CQL due-date constant matches its workbook row, and an evidence check that an L2 `change:` does not contradict its cited L1 rows.

#215 should stay open: steps 3 to 6 break.

### Owner chose C, "fix all 4 now" (2026-10-24)

| Break | Fix | State |
|---|---|---|
| 3 | `logic:check-cql` and `l2:evidence` in the Uganda `logic` gate | smart-immunizations-uganda#14, merged |
| 4, 5 | a preview builds from its own branch's AST; the stamp records the AST verdict | smart-immunizations-uganda#13 merged; fhir-harness#156 |
| 6 | IG previews get `staging.json`, the banner, a ChangeSet and `review/` | fhir-harness#158; cat-harness-tools#709 (review links name the IG page) |

Breaks 4 and 5 are verified on the hosted preview of #12 (both the PlanDefinition and `schedule.html` say 9 years). Break 6 is verified on a local build; on the hosted preview it needs #158 and #709 merged and Uganda's `index.lock.json` repinned. Then re-walk #12.

### Re-walk on the hosted preview passed (2026-10-24)

All 4 breaks are merged, and the hosted preview of smart-immunizations-uganda#12 (commit b903659, site-publish run 40096121778) was walked end to end. Getting it to publish also needed cat-harness-tools#738 (same-kind route collision), #741 (dead `ui/` script tags), fhir-harness#163 (exclusions test fixture), and a repin of Uganda's layers to main (smart-immunizations-uganda#15, still open on upstream gates).

- Banner on all 819 pages; `staging.json` written.
- `review/` lists main → branch as 9 changed, 60 unchanged. That matches the branch's 9 changed files.
- The word diff shows 10 struck and 9 inserted.
- `logic` refuses the change, as break 3's fix intends.

Gaps left, none blocking: the banner says "PR #n/a" on a manually dispatched build, and the IG build publishes no `outline.json` or `rendered-impact.json`. Results and screenshots: folio-assistant#215 (comment 6384579655), smart-immunizations-uganda#12.

### Closed (2026-10-24)

The owner chose "A Close, file gaps as beans". #215 is closed and the #12 sample is closed unmerged. The two gaps are now folio-assistant-zvl0 (banner names the PR) and folio-assistant-0om7 (outline and rendered impact).

## Kept from cat-harness-tools' copy (copy sync, 2026-10-24)

These notes were only in this copy. The newer copy from the bean branch is above them.

*2026-10-22T16:33:47Z* — Owner ruling 2026-10-16, item 9 (session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr): the copy in litlfred/folio-assistant (`cat/cat-harness/beans`) is this bean's record, its status included, because its notes carry the later evidence. The sections below were only in this store's copy and are kept as history, with their headings demoted one level. Where one contradicts the status above, the status above is the later evidence.

### Reasons for Scrapping

Scrapped 2026-10-10 in the cat-harness-tools store (lane B drain): **the subject is not in this repository.** It tracks litlfred/folio-assistant issue #215 and that repository's `.github/workflows/feature-staging.yml`; its done-when is the issue's author closing it. The copy in the `cat/cat-harness/beans` store (litlfred/folio-assistant) is the live one. Keep it open there.


## Note (2026-10-10, drain ml9h)

Lane B scrapped the cat-harness-tools copy because the subject lives in folio-assistant / cat-harness; THIS copy is the owning one and stays open.

## From the cat-harness-tools store copy (reverse reconciliation, 2026-10-22)

_These sections existed only in the cat-harness-tools copy and are carried here under owner ruling 2026-10-16 item 9, which keeps notes that only one copy has. They are historical and do not change this bean's status. The forward direction is litlfred/cat-harness-tools#558. Session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6._

### Reasons for Scrapping

Scrapped 2026-10-10 in the cat-harness-tools store (lane B drain): **the subject is not in this repository.** It tracks litlfred/folio-assistant issue #215 and that repository's `.github/workflows/feature-staging.yml`; its done-when is the issue's author closing it. The copy in the `cat/cat-harness/beans` store (litlfred/folio-assistant) is the live one. Keep it open there.

_2026-10-16T06:30:00Z_ — Store reconciliation: status `scrapped` → `todo` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: todo, cat-harness: scrapped, cat-harness-tools: scrapped). Evidence: same as 197s: scrapped only as "not in this repository"; folio-assistant issue #215 is still open. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

## OWNER, 2026-10-23: the deploy root's stamp file stamps everything under it (option A)

Asked in the Preview storage thread (session https://claude.ai/code/session_01GQmP3RJREp5xXnAFSYYMi9). The owner chose **A** over B (a per-file manifest with content hashes) and C (leave open).

What "all rendered content is stamped" means:

- **One stamp file per deploy root names the build for everything under that root.** On the live site it is `build.json` (`sha`, `built`, `runUrl`). On a preview it is `STAGING/<slug>/staging.json` (branch, sha, PR, run), written by `staging-banner.ts`.
- **HTML pages carry no build identity in their bytes** (bean `g196`), so an unchanged page is shared by every preview and the live site. The preview banner and the footer read the stamp file when the page loads.
- **The JSON-LD and schema exports** keep their in-band `staging` stamp (2026-09-19).
- **CSS, JS, images and PDFs** are stamped by the file beside them. A file opened on its own does not say its build. That is accepted.

Revisit B (a per-path manifest) when bean `fwtz`'s cone deploy is switched on, because a cone deploy leaves untouched files from older builds.

Remaining: walk issue #215's immunization-schedule scenario end to end. Closing #215 is the owner's.

_2026-10-24T08:35:00Z_ — **Owner, 2026-10-24 (structured question Q8, 08:29Z): "A".** Walk issue #215's scenario on **litlfred/smart-immunizations-uganda**. One small sample schedule change (for example the HPV single-dose age) goes on a branch. Its preview at `STAGING/<branch>/` (`site-publish.yml`) is compared with main, and the walk records where it breaks. The branch is never merged. `xp72`'s Done-when 3 is walked on the same branch. Closing #215 stays the owner's. Session https://claude.ai/code/session_01FABZmtqnNeBaTcHsXrtyK7.

_2026-10-24T09:00:00Z_ — Claimed by the Preview storage thread for the #215 walk on a never-merged smart-immunizations-uganda branch (owner Q8 "A"). No agy claim found. Session https://claude.ai/code/session_01GQmP3RJREp5xXnAFSYYMi9.

## The #215 walk, 2026-10-24 (owner Q8 "A"): where it breaks

Walked on litlfred/smart-immunizations-uganda#12, a draft that never merges. The sample change: the single HPV dose for girls at 9 years instead of 10. Session https://claude.ai/code/session_01GQmP3RJREp5xXnAFSYYMi9.

| # | Step of the scenario | What happened | Verdict |
|---|---|---|---|
| 1 | Author changes the schedule | Branch `claude/sample-215-hpv-9y-do-not-merge`: narrative (`schedule`, `decision-logic`, `differences`, `testing`), CQL, the L2 record, test patient UGHPV01, and the workbook's HPV Q26/R26 | works |
| 2 | Agent keeps narrative and logic together | The `logic` gate (`checks.yml`: `logic:generate` then `git diff`) **caught** a hand edit of the generated FSH: the workbook is the logic's source. Fixed in c24e688; `logic:generate` and `logic:examples` pass locally | works |
| 3 | Agent surfaces downstream implications | **No tool did.** The nine places were found by grep. Two stay silent: the CQL is hand-completed and no gate compares its due date with the workbook's R26, and the L2 record still cites P10, which says 10 years, with nothing flagging that the adaptation now contradicts its evidence | **breaks** |
| 4 | Preview on STAGING | `site-publish.yml` run 40078592557 **refused**: `ig-site:ast`, "the AST is stale-inputs". The workflow refreshes the AST only for the default branch, `ig-ast-refresh.yml` seeds only from it, and no input sets `SITE_ACCEPT_STALE_AST`. The error's advice ("run the IG's Site publish") is the run that failed. **No branch that changes an IG's inputs can get a preview** | **breaks** |
| 5 | Preview with the preview-only override (built locally, not published) | The site mixes two builds. Narrative pages say **9 years** (branch). `PlanDefinition-…HPVSingleDose`, `Library-…HPVSingleDoseLogic` and `ast-data/` say **10 years** (AST from main's 91b2b5a). `folio-build.json` names the branch commit 3369fc0 as the source of the whole site, so the stamp is wrong for the artefacts: option A's "one stamp names the build for everything under it" does not hold on this route | **breaks** |
| 6 | Committee compares before and after | The IG route (`stage-local-ig.ts`) writes no `staging.json`, no banner, no ChangeSet, no `rendered-impact.json` and no review page. The committee has nothing that shows what changed. The live root's stamp here is `folio-build.json`, not `build.json` | **breaks** |
| 7 | Approve, then merge, then publish | Not reached | — |

### What would fix each break (for the owner to choose)

- **4 and 5:** the IG preview uses an AST built from the branch. `ig-ast-refresh.yml` already uploads a non-default branch's AST as a run artefact; `site-publish.yml` would pass `ref: github.ref` and the publish job would restore that artefact for a preview. fhir-harness template plus the workflow.
- **6:** the IG route gets what the folio route has: `staging.json`, the banner, and a ChangeSet over the IG's narrative pages so the review page works. This is also xp72's Done-when 3.
- **3:** a check that each CQL due-date constant matches its workbook row, and an evidence check that an L2 `change:` does not contradict its cited L1 rows.

#215 should stay open: steps 3 to 6 break.

### Owner chose C, "fix all 4 now" (2026-10-24)

| Break | Fix | State |
|---|---|---|
| 3 | `logic:check-cql` and `l2:evidence` in the Uganda `logic` gate | smart-immunizations-uganda#14, merged |
| 4, 5 | a preview builds from its own branch's AST; the stamp records the AST verdict | smart-immunizations-uganda#13 merged; fhir-harness#156 |
| 6 | IG previews get `staging.json`, the banner, a ChangeSet and `review/` | fhir-harness#158; cat-harness-tools#709 (review links name the IG page) |

Breaks 4 and 5 are verified on the hosted preview of #12 (both the PlanDefinition and `schedule.html` say 9 years). Break 6 is verified on a local build; on the hosted preview it needs #158 and #709 merged and Uganda's `index.lock.json` repinned. Then re-walk #12.

### Re-walk on the hosted preview passed (2026-10-24)

All 4 breaks are merged, and the hosted preview of smart-immunizations-uganda#12 (commit b903659, site-publish run 40096121778) was walked end to end. Getting it to publish also needed cat-harness-tools#738 (same-kind route collision), #741 (dead `ui/` script tags), fhir-harness#163 (exclusions test fixture), and a repin of Uganda's layers to main (smart-immunizations-uganda#15, still open on upstream gates).

- Banner on all 819 pages; `staging.json` written.
- `review/` lists main → branch as 9 changed, 60 unchanged. That matches the branch's 9 changed files.
- The word diff shows 10 struck and 9 inserted.
- `logic` refuses the change, as break 3's fix intends.

Gaps left, none blocking: the banner says "PR #n/a" on a manually dispatched build, and the IG build publishes no `outline.json` or `rendered-impact.json`. Results and screenshots: folio-assistant#215 (comment 6384579655), smart-immunizations-uganda#12.

### Closed (2026-10-24)

The owner chose "A Close, file gaps as beans". #215 is closed and the #12 sample is closed unmerged. The two gaps are now folio-assistant-zvl0 (banner names the PR) and folio-assistant-0om7 (outline and rendered impact).


## Note (2026-10-10, drain ml9h)

Lane B scrapped the cat-harness-tools copy because the subject lives in folio-assistant / cat-harness; THIS copy is the owning one and stays open.

## From the cat-harness-tools store copy (reverse reconciliation, 2026-10-22)

_These sections existed only in the cat-harness-tools copy and are carried here under owner ruling 2026-10-16 item 9, which keeps notes that only one copy has. They are historical and do not change this bean's status. The forward direction is litlfred/cat-harness-tools#558. Session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6._

### Reasons for Scrapping

Scrapped 2026-10-10 in the cat-harness-tools store (lane B drain): **the subject is not in this repository.** It tracks litlfred/folio-assistant issue #215 and that repository's `.github/workflows/feature-staging.yml`; its done-when is the issue's author closing it. The copy in the `cat/cat-harness/beans` store (litlfred/folio-assistant) is the live one. Keep it open there.

_2026-10-16T06:30:00Z_ — Store reconciliation: status `scrapped` → `todo` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: todo, cat-harness: scrapped, cat-harness-tools: scrapped). Evidence: same as 197s: scrapped only as "not in this repository"; folio-assistant issue #215 is still open. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

## OWNER, 2026-10-23: the deploy root's stamp file stamps everything under it (option A)

Asked in the Preview storage thread (session https://claude.ai/code/session_01GQmP3RJREp5xXnAFSYYMi9). The owner chose **A** over B (a per-file manifest with content hashes) and C (leave open).

What "all rendered content is stamped" means:

- **One stamp file per deploy root names the build for everything under that root.** On the live site it is `build.json` (`sha`, `built`, `runUrl`). On a preview it is `STAGING/<slug>/staging.json` (branch, sha, PR, run), written by `staging-banner.ts`.
- **HTML pages carry no build identity in their bytes** (bean `g196`), so an unchanged page is shared by every preview and the live site. The preview banner and the footer read the stamp file when the page loads.
- **The JSON-LD and schema exports** keep their in-band `staging` stamp (2026-09-19).
- **CSS, JS, images and PDFs** are stamped by the file beside them. A file opened on its own does not say its build. That is accepted.

Revisit B (a per-path manifest) when bean `fwtz`'s cone deploy is switched on, because a cone deploy leaves untouched files from older builds.

Remaining: walk issue #215's immunization-schedule scenario end to end. Closing #215 is the owner's.

_2026-10-24T08:35:00Z_ — **Owner, 2026-10-24 (structured question Q8, 08:29Z): "A".** Walk issue #215's scenario on **litlfred/smart-immunizations-uganda**. One small sample schedule change (for example the HPV single-dose age) goes on a branch. Its preview at `STAGING/<branch>/` (`site-publish.yml`) is compared with main, and the walk records where it breaks. The branch is never merged. `xp72`'s Done-when 3 is walked on the same branch. Closing #215 stays the owner's. Session https://claude.ai/code/session_01FABZmtqnNeBaTcHsXrtyK7.

_2026-10-24T09:00:00Z_ — Claimed by the Preview storage thread for the #215 walk on a never-merged smart-immunizations-uganda branch (owner Q8 "A"). No agy claim found. Session https://claude.ai/code/session_01GQmP3RJREp5xXnAFSYYMi9.

## The #215 walk, 2026-10-24 (owner Q8 "A"): where it breaks

Walked on litlfred/smart-immunizations-uganda#12, a draft that never merges. The sample change: the single HPV dose for girls at 9 years instead of 10. Session https://claude.ai/code/session_01GQmP3RJREp5xXnAFSYYMi9.

| # | Step of the scenario | What happened | Verdict |
|---|---|---|---|
| 1 | Author changes the schedule | Branch `claude/sample-215-hpv-9y-do-not-merge`: narrative (`schedule`, `decision-logic`, `differences`, `testing`), CQL, the L2 record, test patient UGHPV01, and the workbook's HPV Q26/R26 | works |
| 2 | Agent keeps narrative and logic together | The `logic` gate (`checks.yml`: `logic:generate` then `git diff`) **caught** a hand edit of the generated FSH: the workbook is the logic's source. Fixed in c24e688; `logic:generate` and `logic:examples` pass locally | works |
| 3 | Agent surfaces downstream implications | **No tool did.** The nine places were found by grep. Two stay silent: the CQL is hand-completed and no gate compares its due date with the workbook's R26, and the L2 record still cites P10, which says 10 years, with nothing flagging that the adaptation now contradicts its evidence | **breaks** |
| 4 | Preview on STAGING | `site-publish.yml` run 40078592557 **refused**: `ig-site:ast`, "the AST is stale-inputs". The workflow refreshes the AST only for the default branch, `ig-ast-refresh.yml` seeds only from it, and no input sets `SITE_ACCEPT_STALE_AST`. The error's advice ("run the IG's Site publish") is the run that failed. **No branch that changes an IG's inputs can get a preview** | **breaks** |
| 5 | Preview with the preview-only override (built locally, not published) | The site mixes two builds. Narrative pages say **9 years** (branch). `PlanDefinition-…HPVSingleDose`, `Library-…HPVSingleDoseLogic` and `ast-data/` say **10 years** (AST from main's 91b2b5a). `folio-build.json` names the branch commit 3369fc0 as the source of the whole site, so the stamp is wrong for the artefacts: option A's "one stamp names the build for everything under it" does not hold on this route | **breaks** |
| 6 | Committee compares before and after | The IG route (`stage-local-ig.ts`) writes no `staging.json`, no banner, no ChangeSet, no `rendered-impact.json` and no review page. The committee has nothing that shows what changed. The live root's stamp here is `folio-build.json`, not `build.json` | **breaks** |
| 7 | Approve, then merge, then publish | Not reached | — |

### What would fix each break (for the owner to choose)

- **4 and 5:** the IG preview uses an AST built from the branch. `ig-ast-refresh.yml` already uploads a non-default branch's AST as a run artefact; `site-publish.yml` would pass `ref: github.ref` and the publish job would restore that artefact for a preview. fhir-harness template plus the workflow.
- **6:** the IG route gets what the folio route has: `staging.json`, the banner, and a ChangeSet over the IG's narrative pages so the review page works. This is also xp72's Done-when 3.
- **3:** a check that each CQL due-date constant matches its workbook row, and an evidence check that an L2 `change:` does not contradict its cited L1 rows.

#215 should stay open: steps 3 to 6 break.

### Owner chose C, "fix all 4 now" (2026-10-24)

| Break | Fix | State |
|---|---|---|
| 3 | `logic:check-cql` and `l2:evidence` in the Uganda `logic` gate | smart-immunizations-uganda#14, merged |
| 4, 5 | a preview builds from its own branch's AST; the stamp records the AST verdict | smart-immunizations-uganda#13 merged; fhir-harness#156 |
| 6 | IG previews get `staging.json`, the banner, a ChangeSet and `review/` | fhir-harness#158; cat-harness-tools#709 (review links name the IG page) |

Breaks 4 and 5 are verified on the hosted preview of #12 (both the PlanDefinition and `schedule.html` say 9 years). Break 6 is verified on a local build; on the hosted preview it needs #158 and #709 merged and Uganda's `index.lock.json` repinned. Then re-walk #12.

### Re-walk on the hosted preview passed (2026-10-24)

All 4 breaks are merged, and the hosted preview of smart-immunizations-uganda#12 (commit b903659, site-publish run 40096121778) was walked end to end. Getting it to publish also needed cat-harness-tools#738 (same-kind route collision), #741 (dead `ui/` script tags), fhir-harness#163 (exclusions test fixture), and a repin of Uganda's layers to main (smart-immunizations-uganda#15, still open on upstream gates).

- Banner on all 819 pages; `staging.json` written.
- `review/` lists main → branch as 9 changed, 60 unchanged. That matches the branch's 9 changed files.
- The word diff shows 10 struck and 9 inserted.
- `logic` refuses the change, as break 3's fix intends.

Gaps left, none blocking: the banner says "PR #n/a" on a manually dispatched build, and the IG build publishes no `outline.json` or `rendered-impact.json`. Results and screenshots: folio-assistant#215 (comment 6384579655), smart-immunizations-uganda#12.

### Closed (2026-10-24)

The owner chose "A Close, file gaps as beans". #215 is closed and the #12 sample is closed unmerged. The two gaps are now folio-assistant-zvl0 (banner names the PR) and folio-assistant-0om7 (outline and rendered impact).
