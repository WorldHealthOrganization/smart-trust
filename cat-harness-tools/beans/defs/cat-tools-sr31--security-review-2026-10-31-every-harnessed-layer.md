---
# cat-tools-sr31
$schema: bean/1.0.0
title: 'SECURITY REVIEW 2026-10-31: every harnessed layer, against the security sub-KG and the secure-code-authoring voice'
status: completed
type: epic
priority: high
created_at: 2026-10-31T04:05:00Z
updated_at: 2026-11-01T21:05:00Z
parent: folio-assistant-rwmf
---

Owner, 2026-10-31: *"do full QA security review on all code harnesd in a KG. record findsgs as per SOPs."*

Scope: cat-harness, cat-harness-tools, folio-assistant-core, folio-assistant-sci, fhir-harness, smart-base, smart-ra, smart-immunizations, smart-trust, who-iris, dth-hrh, bootstrap, folio-assistant. Method: the boundary table in `cat-harness/skills/conduct/security/security.md`, the 16 rules of the `secure-code-authoring` voice, the RED FLAG categories in `schemas/sdlc/red-flag.ts`, `bun audit`, `check:workflow-injection`, and a sink sweep (shell strings, path joins, HTML sinks, CORS, auth headers, unpinned actions).

Each finding is a child bug in the store of the layer that owns the code. Findings that would help an attacker against a running deployment are held out of the public stores until the owner decides how to disclose them (project thread, 2026-10-31).

Fixes are separate pull requests, each needing the owner's go-ahead.

## Done when

- [x] Every layer reviewed, findings filed as children.
- [x] `cat-harness-tools` findings (`cat-tools-a1p9`, `cat-tools-d3vq`, `cat-tools-j4sh`, `cat-tools-q8gk`, `cat-tools-w7tx`) resolved.
- [x] The owner has chosen how the held findings are disclosed.

_2026-11-01T21:05Z_ — Completed. Every finding in all 13 layers is fixed and merged (the last open fix, folio-assistant#2829, clears the folio-assistant dependency advisories). Owner Q-SEC-1 A (2026-11-01 20:57Z): held findings are filed as completed beans once fixed. The cat-harness-tools held findings are c3sf, g5oh, m1cp, p4tr and x2ua; group B and C held findings are folio-assistant i15r, jb60, 98uf, ytsf, jo5h and 10rg, plus core 82hl and 4kq2; group D are 7yp7, 0d23, 56jc, nn9p, ztg5, wea0 and 0q34. Group epics: folio-assistant 33iz and 3o2w completed, sb31 completes with #2829. MVP security review (folio-assistant#2894), session https://claude.ai/code/session_01Qmmkt7zjJDpkdmxtXvQWTS
