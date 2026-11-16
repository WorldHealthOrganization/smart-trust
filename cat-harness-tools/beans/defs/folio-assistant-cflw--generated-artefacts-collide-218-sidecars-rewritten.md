---
# folio-assistant-cflw
$schema: bean/1.0.0
title: 'Generated artefacts collide: 218 sidecars rewritten by one auditor edit'
status: completed
type: task
priority: normal
created_at: 2026-09-19T06:19:28Z
updated_at: 2026-10-07T17:37:00Z
parent: folio-assistant-1swy
---

_2026-09-19T06:19:44Z_ — MEASURED 2026-09-19, on main at d4b9f7479, by appending one comment line to scripts/kg-audit.ts and running `bun run cat kg:audit`:

  218 sidecars rewritten. Zero verdicts changed.

Cause: `auditor.script_hash` was stored in every one of the 214 kg-qa sidecars. That is not 214 facts. `kg-audit.ts` computes `auditorHash` ONCE per run (one line, before any subject is audited) and threads the same value into every report, and it has NO subset mode -- the write loop always writes all of them. So the per-file copies could not differ from each other in any run that has ever happened. What they could do is change together.

WHY IT MATTERS BEYOND TIDINESS. Two concurrent branches that both touch the graph regenerate the same 218 files and conflict by construction. Observed today on one branch: 218 conflicts, then 238, then 20, across three base merges in under an hour, none of them carrying information -- the resolution was always "re-run the generator". Each regeneration then invalidates every other open PR, so the cost is quadratic in the number of open branches.

This is NOT bean nytj. nytj is about an artefact going STALE (recorded but not in force). This is about artefacts COLLIDING. They share a cause -- committed derived state -- and have different remedies.

FIX SHIPPED: the auditor's identity is recorded once, in `skills/kg-qa.manifest.json` (`kg-qa-manifest/v1`), and removed from the sidecar schema. Re-measured with the same probe: sidecars changed 0, manifest 1, docs witnesses 20 -- 218 down to 21.

Freshness is unchanged and still has two independent halves, which is the reason nothing is lost: the manifest hash says whether the AUDITOR is the one in the tree; each sidecar's own `source_hash` says whether its SUBJECT has moved since it was judged. The per-file auditor hash never added precision the generator could deliver.

RESIDUE, deliberately not fixed here:
- The 20 `docs/assets/qa/**/*.kg.json` witnesses still embed the auditor hash once PER CRITERION. They use `qa-witness/v1`, a shape SHARED with the block QA family, where per-criterion script hashes are real information (qa-checkers-voice.ts vs qa-checkers-extended.ts are genuinely different scripts on different criteria of one block). Changing that shape touches the docs QA panel and its e2e coverage, and is a larger commitment than this bean earned. Wants its own bean.
- Whether `docs/assets/qa/` needs to be committed at all is a separate question: it is derived from the sidecars plus the manifest, and the docs site regenerates it at publish time. If it does not need committing, the residual 20 goes to 0 without touching the shared schema. Worth asking before touching the schema.

DONE WHEN: an auditor-only edit changes one file. Currently 21; 1 after the residue above is resolved.



## Claim released 2026-09-29

Released `in-progress` → `todo` on the owner's instruction (review session https://claude.ai/code/session_014Qj8wncQhqV52QGN1yZDnj). No git change to this bean since before 2026-09-26, no holder recorded, and no open working branch touches it; the sessions that held theme B (CI reliability, QA instruments, process) work stopped on the 2026-09-25 weekly usage limit. Nothing in the body was changed: re-claim with `bun run cat beans:claim <id>`.

## Completed on landed evidence
Landed on main in PR #341 (kg-qa: record the auditor once, resolving sidecar collisions).
