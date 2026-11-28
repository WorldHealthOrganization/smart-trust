---
# note on folio-assistant-1bvx from claude/salvage-1809-reference-direction
$schema: folio-bean-note/v1
bean: folio-assistant-1bvx
branch: "claude/salvage-1809-reference-direction"
created: "2026-10-04"
---
## Salvage of #1809 taken over on claude/salvage-1809-reference-direction

Merge Manager salvage dispatch, 2026-10-04 (owner: "Do all six"). The claim recorded for claude/rulings-2026-10-01-late is carried forward by this branch; #1809 (branch claude/reference-direction-ratchet) was closed unmerged. Built on MAIN's design, not #1809's committed-file ratchet: X3 (LAYERING_SPECIFICATIONS exemption, 3 files out of PENDING), X1 (translation mirrors, by front matter), A.10 as a graded `wrong-direction` family (one entry per file and target) in --check's failOnNew, the regenerated sidecar committed, and `check:reference-direction:check --against main` wired into code-quality-gates.yml. Session https://claude.ai/code/session_019gRX6w8kzAX6wpHbgdyu3s

## takeover: quiet claim taken for #2108

**Taken over 2026-10-04 by session_01BccmnVFbtRpKxM39kyVw9q, for PR #2108** (the Merge Manager's salvage of #1809, owner-approved). The recorded holder is `claude/rulings-2026-10-01-late`. Its only PR, #1806, merged on 2026-10-01, and no open PR or newer commit names this bean except #2108. So it is a quiet claim, which `bean-coordination` §"A quiet claim" says any session may take. `beans:claim` refuses (`already-claimed`), so this note records the takeover rather than forcing the claim.

#2108 carries this bean's CI wiring: `check:reference-direction:check --against main` in `code-quality-gates.yml`, gated through `judgeQaResult`'s `failOnNew`. Its A.10 `wrong-direction` family **fails on a new file naming a single higher instance**, which is also the box moved here from `yj6r` on the owner's 2026-10-04 ruling. The plain form still exits 1 on inherited findings (8 `pending-stale`, 137 unlisted multi-destination files). This bean's "goes in GREEN" box is met only in the gated `--check --against main` sense, not by draining those.
