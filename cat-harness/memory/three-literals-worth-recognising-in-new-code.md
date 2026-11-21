---
$schema: folio-memory/v1
id: three-literals-worth-recognising-in-new-code
label: trap
summary: "three literals worth recognising in new code"
createdAt: 2026-09-19
roles:
  - code-reviewer
references:
  - kind: agent
    id: platform-boundary-guard
---
Each shipped once:

1. **Modules prefixed `QOU.`** regardless of the folio's Lake library. Now
   read from `lakefile.toml`, and left **unprefixed** when no lakefile names
   one — *a wrong namespace is worse than none*, because it is what a reader
   pastes into an `import`.
2. **Workflow descriptions from a hardcoded map of twelve `qou` filenames**,
   consulted *before* the workflow's own `name:`. Now always the `name:`.
3. **The simulator directory as the literal `folio-assistant/simulators`.**
   Now `<name>.config.json`, and the fallback is the folio-root `simulators`
   — the platform has no such directory since 2026-09-19.
