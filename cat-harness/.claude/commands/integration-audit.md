---
description: "Sidecar-invalidation utility for the integration-watcher pipeline. Adds mechanical QA fields (script-reviewer entries) to per-block `.qa.json` sidecars and marks the existing entries stale so the n..."
argument-hint: "[what to run it on]"
generated: cat-harness-tools/scripts/gen-skill-commands.ts
---

# /integration-audit

Run the `integration-audit` skill. Read [`editorial/skills/editorial-audits/integration-audit.md`](../../editorial/skills/editorial-audits/integration-audit.md) and follow it.

This command is a pointer, generated from that skill's `user_invocable: true`; the
instructions live in the skill and nowhere else. The same skill is also served as the
MCP prompt `integration-audit` by the folio-assistant server.

Arguments, if any: $ARGUMENTS
