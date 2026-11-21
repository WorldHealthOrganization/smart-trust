# Folio-assistant agent infrastructure

folio-assistant owns the generic agent infrastructure: the work items work plan, the
MCP server and the session-start harness. Content repositories hold only their
content and the tooling specific to it.

> The work plan itself is
> [`todo-manager`](reference/skill-instructions/todo-manager.html), claiming
> an item across sessions is
> [`bean-coordination`](reference/skill-instructions/bean-coordination.html),
> and laying folio-assistant over an existing repository is
> [`repo-conversion`](reference/skill-instructions/repo-conversion.html).

---

## §1 What beans are

[`hmans/beans`](https://github.com/hmans/beans) is a Go flat-file issue tracker
storing issues as markdown under `beans/`. It is the one todo mechanism for
agent work, session-local and cross-session alike. Discipline:
**`beans ≠ sidecars`** — never `beans create` a QA/witness/watcher queue; those
stay as bulk JSON read by their own `.ts` tooling. See
`work-plan/skills/work-plan/todo-manager.md`.

## §2 Move wiring and script together

When a hook-backed script is relocated or removed, its hook reference moves in
the same change. A script without its hook — or a hook reference without its
script — is the bug.

## §3 Cross-agent session-start design

An **agent-generic** startup surface primes any CLI — Claude Code, Gemini CLI,
Antigravity — with the work items work plan, without duplicating logic. All three
expose a `SessionStart` command hook whose stdout reaches the model (Gemini:
`hookSpecificOutput.additionalContext`), all three read `AGENTS.md` natively,
and all three support MCP servers.

**Three layers, no live logic duplicated:**

1. **Discipline (universal, static): `AGENTS.md`** at the repository root, read
   natively by every agent. Tool files are thin stubs (`CLAUDE.md` →
   `@AGENTS.md`; `GEMINI.md` → "See AGENTS.md").
2. **Live state (per-CLI hook over one shared script):**
   `scripts/session-start-coord-sweep.sh` is the single primer (emits
   `beans prime`, a CLI-independent work item list and the main-branch delta as
   markdown on stdout). Each CLI's `SessionStart` hook config differs
   (`.claude/settings.json` vs Gemini/Antigravity `hooks.json`) but invokes the
   **same** script.
3. **Live state (platform):** the `work_plan_prime` MCP tool exposes
   `beans prime` + `beans list` (with a `beans/` fallback) to any MCP-connected
   agent, and is the fallback for a CLI without a usable session hook.

**One trigger per CLI (avoid double-fire):** native Claude sessions use the
`.claude/settings.json` `SessionStart` hook; platform/MCP sessions use the MCP
tool. Nothing else runs the primer for a session that already has the hook.
