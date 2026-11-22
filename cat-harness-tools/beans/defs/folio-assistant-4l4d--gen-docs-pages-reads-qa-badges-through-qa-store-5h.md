---
# folio-assistant-4l4d
$schema: bean/1.0.0
title: GEN-DOCS-PAGES reads QA badges through qa-store (5hox blocker)
status: completed
type: task
priority: normal
created_at: 2026-10-02T13:58:10Z
updated_at: 2026-10-02T17:56:38Z
parent: folio-assistant-3fva
blocking:
    - folio-assistant-5hox
---

Found by the 5hox prep (2026-10-02). docs:pages:check and check:ci-invocations go red with test/results/ absent: committed docs pages embed QA badges, and without the corpus gen-docs-pages writes 'not available', so every page reads stale. Either read the corpus through qa-store (fetch miss = UNKNOWN, never a stale page), or move the badges out of the committed pages into the build.

## Done when
- [ ] docs:pages:check passes with test/results/ absent and a qa-reports entry fetched
- [ ] a fetch miss is reported UNKNOWN, not as stale pages



## Coordination (2026-10-02, rule from PR #1886)
Overlap with session_013Wb's refactors #1885 (gp2f: nav/harness/icons/inline scripts → shared assets) and #1881 (library path IRIs). Agreed: 4l4d proceeds now and is not held on #1885; if badges become client-loaded they load as their OWN shared JSON asset fetched by the badge script, never inlined per page; gp2f builds on this. #1764/#1801's docs-site.yml and gen-docs-pages.ts changes land first; gp2f rebases.
- [x] docs:pages:check passes with test/results/ absent and a qa-reports entry fetched
- [x] a fetch miss is reported UNKNOWN, not as stale pages

## Done on local branch qa-4l4d-f3bh, 2026-10-02 (NOT pushed)

Commits d6ec93bae (design), f121c7f8a (regen), c2b29408c (kind-validator test).

Design: committed pages carry only a stable badge placeholder; the QA data is a separate JSON asset.

- Every (subject, family) on a generated page is one uniform `<button class="fa-qa-badge fa-qa-pending">` carrying the projection URL and the page's `qa-index.json` URL. Nothing in the page depends on the QA corpus: not the verdict (d2kp) and no longer whether a sidecar exists.
- The per-page `qa-index.json` (`folio-qa-index/v1`) gains `corpus: "present" | "absent"` and an `unswept` key list. gen-docs-pages writes it into the stored witness tree (`test/results/witnesses/`), which docs-site.yml already generates after `qa-site-assets.ts fetch` and copies to `/assets/qa/`. `paintQaBadges` in docs-ui.js fetches it: a row paints a verdict; an `unswept` key paints the inert "not swept" span; `corpus: "absent"` paints every badge "not available in this build" (inert); an index that will not load paints unknown ("not available in this build").
- The authored-page list moved from the Jekyll data file `_data/translation-qa-pages.json` (removed; Jekyll baked it into every page) to the asset `/assets/qa/translation-qa-pages.json` (`folio-qa-translation-pages/v1`), fetched by docs-ui.js. head_custom.html always publishes the paths plus the list URL. A list saying `corpus: "absent"`, or one that will not load, makes the badge read "not available in this build".
- Witness-tree writes are `stored` when the qa directory declares `storage`: under `--check` neither a missing nor a different working copy is gated, and orphans there are advisory. `--check` creates no directories.
- check-qa-corpus accepts `unswept` keys and flags an index written without the corpus in a published tree. Both schemas are registered in graph-kind-registry.

Coordination constraint (agreed with the gp2f / PR #1885 session, recorded on PR #1886): QA badges load from their OWN shared asset, small JSON fetched by the badge script at runtime, per the owner's rule that page content loads from published KG/JSON assets. They are never inlined per page. Nav, harness bar, icons and `_includes` are not restructured beyond what the badges need. The only `_includes` change is the `translationQa` block in head_custom.html. gp2f owns the rest and builds on this.

Verification:

- verified: `docs:pages:check` and `check:ci-invocations` pass with `test/results/` present (checkout copy), absent (moved aside), and with a qa-reports entry fetched (`qa:fetch --ref pr/1801` on a scratch branch with the 5hox deletion applied).
- verified: with the corpus absent, `--check` reports "N witness file(s) are not in this checkout … not a staleness failure", not stale pages. The index says `corpus: "absent"`, and the e2e spec asserts every badge then reads "not available in this build" and never a verdict or "not swept".
- verified: the badge asset generation is covered by `scripts/tests/qa-badge-placeholder.test.ts` (placeholder is structure-only; every committed source page carries placeholders only; index/list say `absent` rather than empty), `check-qa-corpus.test.ts`, `qa-e2e-fixtures.test.ts`, and the e2e specs qa-badge / qa-panel / translation-badges (53 passed).
- not yet: translated copies of generated pages (`docs/<locale>/*.md`) still carry the old server-rendered spans. Nothing regenerates them and no gate compares them, so they do not affect this bean, but their badges are a frozen snapshot.
