---
# folio-assistant-2as0
$schema: bean/1.0.0
title: 'Agent-triggered staging: local build + push to gh-pages, then an Artifact preview (#2410)'
status: completed
type: feature
priority: normal
created_at: 2026-10-07T11:12:53Z
updated_at: 2026-10-07T12:44:42Z
parent: folio-assistant-q4jm
---

Issue #2410. PR 1: cat-harness/scripts/stage-local.ts builds the folio's preview in the agent's checkout and pushes STAGING/<slug>/ through the same gate and render log as the workflow. PR 2: --artifact publishes it as a claude.ai Artifact. Measured 2026-10-07: 33 min runner queue before the workflow ran 45 s; Pages deploy 47 min queued.

*2026-10-07* — completed: PR 1 (stage-local, push to gh-pages) merged in litlfred/folio-assistant#2411 (c3ddeae); PR 2 (--artifact bundle) is the PR carrying this commit. First real Artifact preview of smart-ra published 2026-10-07.
