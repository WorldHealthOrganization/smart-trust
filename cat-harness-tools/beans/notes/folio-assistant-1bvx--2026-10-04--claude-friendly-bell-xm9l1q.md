---
# note on folio-assistant-1bvx from claude/friendly-bell-xm9l1q
$schema: folio-bean-note/v1
bean: folio-assistant-1bvx
branch: "claude/friendly-bell-xm9l1q"
created: "2026-10-04"
---
## handover: the reference-direction box moved here from yj6r

**Hand-off from `yj6r`, on the owner's ruling (2026-10-04).** `yj6r`'s box *"`check:reference-direction` wired into a workflow, with a failing criterion that bites on a single-target escape"* now belongs here. The owner answered *"Move box, drop clause"* to the question asked on #2089.

It belongs here because `yj6r` is the IMPORT axis, which is wired and gated (`check:import-direction --all` in `code-quality-gates.yml`), and its §"NOT in scope" excludes the prose axis. This bean already owns the prose axis and its rule *"if it does belong in CI, it goes in GREEN"*. So the moved box adds one requirement to this bean's Done-when: **once wired, the criterion must bite on a single-target escape.**

State on 2026-10-04: `check:reference-direction` still exits 1 on `main`, and no workflow runs it. This bean's holder note names `claude/rulings-2026-10-01-late` (2026-10-01). No open PR names `1bvx`, so per `bean-coordination` §"A quiet claim" the claim may be stale.
