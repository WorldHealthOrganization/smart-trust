---
$schema: folio-memory/v1
id: derive-the-gate-list-from-the-workflow
label: trap
summary: "derive the gate list from the WORKFLOW, not from package.json"
createdAt: 2026-09-19
roles:
  - build-pipeline
  - validation-pipeline
references:
  - kind: agent
    id: ci-health-watcher
---
**`bun run cat gates`** runs what CI runs, derived from the workflow at run time
(`--all` adds the browser job). Never hand-list them: three checks are invoked
by PATH so a `bun run <script>` sweep cannot see them, and a hand-list of 17
read as coverage while the real set was 37 (measured 2026-09-19, by the agent
that wrote this entry's advice into a command).

**Editing a script that WRITES a witness restales every published projection of
it** — regenerate both sides and verify by parsing, not by grep.

<!-- detail -->

The command:

    grep -oE "bun run (scripts/[a-z-]+\.ts[^ ]*|[a-z:.-]+)" \
      .github/workflows/code-quality-gates.yml | sort -u

`gen-docs-pages` has no `package.json` alias at all.

`kg-audit.ts` records its own `scriptHash` in 220 `kg-qa` sidecars AND in 20
`test/results/witnesses/**/*.kg.json`. Regenerate both. Verify by parsing each
side and blanking the hash keys — these are single-line JSON, so
`grep -v scriptHash` filters nothing.

`MEMORY.md` is generated from `memory/` by `bun run cat agent-memory`; a TRAP
written into it directly is deleted by the next run. The harness injects the
FIRST 200 lines, so an entry past that line is dropped silently — put evidence
in an entry's `detail`, which is written beside the file rather than into it.
