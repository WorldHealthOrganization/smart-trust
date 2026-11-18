<!-- Generated from memory/never-assert-on-a-qa-verdict-from-the-published-corpus.md by `bun run cat agent-memory`. -->
<!-- Not injected into MEMORY.md; read on demand. Edits here are lost. -->

Measured 2026-09-19 (work item `tywj`): `test/qa-panel.e2e.ts` pinned the first row
to `voice-status-leak`/`fail`/`critical`, the fold count to `47` and the checker
hash to `5af6856733f3`. An adjudication in `c8fbad385` turned that criterion
`pass`; four assertions went red for reasons unrelated to the panel.

The settled answer (#319) keeps only the script witness, so the hash the spec
asserts is still the corpus's own.

I tried freezing a captured copy and withdrew it: reading the value out of a
frozen document makes the assertion self-consistent, not correct — the same
defect one field down.

`severity`, `evidence` and `changed` exist only in states the corpus is not in,
so no live sidecar vouches for them. Work items `tywj`, `qjyi`, `iumj`.
