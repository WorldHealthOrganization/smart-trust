<!-- Generated from memory/derive-the-gate-list-from-the-workflow.md by `bun run cat agent-memory`. -->
<!-- Not injected into MEMORY.md; read on demand. Edits here are lost. -->

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
