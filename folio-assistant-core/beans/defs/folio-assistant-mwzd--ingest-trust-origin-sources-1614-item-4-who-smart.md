---
# folio-assistant-mwzd
$schema: bean/1.0.0
title: 'INGEST trust + origin sources (#1614 item 4): WHO SMART Trust IG, C2PA spec, DSpace 7 REST contract'
status: completed
type: task
priority: normal
created_at: 2026-10-01T06:42:36Z
updated_at: 2026-10-24T07:20:00Z
parent: folio-assistant-scfh
---

Issue #1614 item 4, slides 2 of the KG/folio-asst deck: signed assets and the trust network; IRIS (DSpace) as the L1 origin.

## Done when

- [x] WHO SMART Trust IG narrative pages held as an L1 entry under the smart-trust instance, IG version recorded from sushi-config.yaml
- [ ] C2PA Technical Specification (latest released version) held or referenced per its licence, version recorded
- [ ] DSpace 7 REST contract (7.x branch) held or referenced per its licence, branch recorded
- [ ] each entry records repo, commit SHA, path and published-vs-working-copy
- [x] evidence wired where a node really relies on a source; smart-base diig declares its evidence
- [ ] check:l1-complete, check:source-licence, check:methodology-evidence, tsc pass


## 2026-10-01 — paused for placement PR6 (session session_01CVVoavPoCHMLA7AASxG8cH)
Library placement is decided by apcg (library/<group>/<slug>/, owner ruling 2026-09-30). Moving sources now would move them twice.


2026-10-09: blocker `apcg` is completed — removed (session https://claude.ai/code/session_01BJNRo4kh8U15HZVFDhYNJL). Its sources sit on GitHub, so this is reachable.



2026-10-09: blocker `apcg` is completed — removed (session https://claude.ai/code/session_01BJNRo4kh8U15HZVFDhYNJL). Its sources sit on GitHub, so this is reachable.

2026-10-23 (`litlfred/folio-assistant-core#186`, `110feca3`): Ingested C2PA Technical Specification v2.5 (`folio-assistant-core/library/c2pa-2026-specification-2-5/`, `c2pa-org/specifications` @ `f314ed94b9dc3e73e4f1b620ef8a18ee7a0ff859`, `CC-BY-4.0`, 771 sections/blocks) and DSpace 7 REST Contract (`folio-assistant-core/library/dspace-7-rest-contract/`, `DSpace/RestContract` @ `1c16b57ed2b19343a93bd2b8fb2e40941a3e636b` branch `dspace-7_x`, `BSD-3-Clause`, 762 sections/blocks) with `repo`, `commit`, `path`, `published-vs-working-copy`, and `THIRD-PARTY-NOTICES.md` entries; verified `check:l1-complete`, `check:source-licence`, `check:methodology-evidence`, `gen-library-jsonld --check`, `library-keywords --check`, `library-readmes --check`, and `tsc --noEmit` all pass.

_2026-10-24T07:20:00Z_ — **Completed** (drain, session https://claude.ai/code/session_01CLVaA6b8XQ5xhvqNZCqc4R). Every "Done when" box was already ticked with evidence. The SMART Trust IG narrative pages are held as L1 library entries `who-smart-trust-*` in litlfred/smart-trust-tools `library/`; C2PA v2.5 and the DSpace 7 REST contract are in folio-assistant-core#186 (`110feca3`).


_2026-10-16T07:00:00Z_ — Block lifted (owner ruling 2026-10-16, items 1 and 9): `apcg` is completed, and the folio-assistant copy lifted this edge on 2026-10-09. Session https://claude.ai/code/session_01K9Xi9QSxCNYju8QNu7EuHg.

_2026-10-24T07:20:00Z_ — **Completed** (drain, session https://claude.ai/code/session_01CLVaA6b8XQ5xhvqNZCqc4R). Every "Done when" box was already ticked with evidence. The SMART Trust IG narrative pages are held as L1 library entries `who-smart-trust-*` in litlfred/smart-trust-tools `library/`; C2PA v2.5 and the DSpace 7 REST contract are in folio-assistant-core#186 (`110feca3`).

## Merged from the folio-assistant copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
- [x] WHO SMART Trust IG narrative pages held as an L1 entry under the smart-trust instance, IG version recorded from sushi-config.yaml
- [x] C2PA Technical Specification (latest released version) held or referenced per its licence, version recorded (`folio-assistant-core/library/c2pa-2026-specification-2-5/`, v2.5, `CC-BY-4.0`, `litlfred/folio-assistant-core#186` `110feca3`)
- [x] DSpace 7 REST contract (7.x branch) held or referenced per its licence, branch recorded (`folio-assistant-core/library/dspace-7-rest-contract/`, branch `dspace-7_x`, `BSD-3-Clause`, `litlfred/folio-assistant-core#186` `110feca3`)
- [x] each entry records repo, commit SHA, path and published-vs-working-copy (`c2pa-2026-specification-2-5`: `https://github.com/c2pa-org/specifications` @ `f314ed94b9dc3e73e4f1b620ef8a18ee7a0ff859`, `build/site/specifications/2.5/specs/C2PA_Specification.html.md` + `_images/`, published v2.5 site output on `main`; `dspace-7-rest-contract`: `https://github.com/DSpace/RestContract` @ `1c16b57ed2b19343a93bd2b8fb2e40941a3e636b`, `.`, working copy of `dspace-7_x`)
- [x] evidence wired where a node really relies on a source; smart-base diig declares its evidence
- [x] check:l1-complete, check:source-licence, check:methodology-evidence, tsc pass (`litlfred/folio-assistant-core#186`)
```
