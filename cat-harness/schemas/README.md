# cat-harness schemas

The schemas cat-harness keeps are the ones that are data:

- **[skills/](./skills/)** — the per-skill JSON Schemas.
- **[kinds/](./kinds/)** — one JSON Schema per graph typology (kind) whose nodes a
  Zod schema checks, GENERATED from that Zod by the tools layer's
  [`gen-kind-json-schemas.ts`](https://github.com/litlfred/cat-harness-tools/blob/main/scripts/gen-kind-json-schemas.ts)
  (`bun run cat kind:json-schemas`; `kind:json-schemas:check` fails on a kind
  without its file, a stale file, or an `$id` that is not the file's path).
  Each `$id` is `<iriBase>v<major>/<path>`, as bootstrap's are. Do not edit them.
- **[staging-comparison.schema.json](./staging-comparison.schema.json)** — the shape of a staging comparison report.
- **[assistant-schema.puml](./assistant-schema.puml)** — the PlantUML model of the content-object schema.

The Zod sources of the content-object model, and the code that reads these
schemas, moved to [cat-harness-tools/schemas/](https://github.com/litlfred/cat-harness-tools/tree/main/schemas)
in bean `8lcl` (owner, 2026-10-30, card "A. One coordinated move"). A
definition belongs here; the code that implements it belongs there.
