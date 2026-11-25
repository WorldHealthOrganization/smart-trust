# block-qa-schema

> *Part of [folio-assistant](https://github.com/litlfred/folio-assistant). The producing implementation is [`schemas/sdlc/block-qa.ts`](../sdlc/block-qa.ts); this package is the language-neutral interchange schema for the same two shapes.*

Cross-language schema for the folio **block-QA sidecar** format. Three artefacts in one package:

| Target | Where | Install |
|---|---|---|
| **JSON Schema** (canonical) | `schema/block-qa.schema.json` + `schema/qa-script.schema.json` | any language with a JSON Schema validator |
| **Pydantic models** (Python) | `python/block_qa_schema/` | `pip install block-qa-schema` |
| **Zod schemas** (TypeScript) | `js/index.ts` | `npm install @litlfred/block-qa-schema` |

All three describe the same two sidecar shapes emitted by the folio QA pipeline (`pipeline/qa-sweep.ts`):

- **`<block>.qa.json`** (`$schema: "block-qa/v1"`) — one per content block. Under each QA criterion sits an append-only array of reviewer verdicts (script / agent / human), each pinned to the content hashes it judged so it auto-stales on edit.
- **`<criterion-id>.script.json`** (`$schema: "qa-script/v1"`) — one per automated criterion, recording the checker's own source hash so a checker bug fix invalidates every verdict it ever wrote, corpus-wide.

The JSON Schema is the authoritative interchange spec; the Pydantic and Zod schemas are hand-maintained mirrors kept in sync with it.

## Why a standalone package?

Downstream consumers — dashboards, external QA tooling, other corpora adopting the same multi-reviewer audit pattern — can read or emit sidecar files without porting any of the pipeline; they need only the schema. The format and its role in a human–machine co-authoring loop are described in the [symbiotic proof-authoring note](https://github.com/litlfred/qou/blob/main/docs/outreach/symbiotic-proof-authoring-note.md) (Appendix B–D).

## Python (Pydantic)

```python
from block_qa_schema import BlockQaReport

with open("carbon-valence.qa.json") as f:
    report = BlockQaReport.model_validate_json(f.read())

for criterion, entries in report.criteria.items():
    latest = entries[-1]
    print(criterion, "→", latest.result, f"({latest.reviewer.kind}:{latest.reviewer.id})")
    if latest.metrics:
        print("   metrics:", latest.metrics)
```

## TypeScript / Node.js (Zod)

```ts
import { BlockQaReport } from "@litlfred/block-qa-schema";
import { readFileSync } from "fs";

const raw = JSON.parse(readFileSync("carbon-valence.qa.json", "utf-8"));
const report = BlockQaReport.parse(raw);

for (const [criterion, entries] of Object.entries(report.criteria)) {
  const latest = entries[entries.length - 1];
  console.log(criterion, "→", latest.result, latest.reviewer.kind);
}
```

## Other languages

Use the JSON Schemas directly — they are served from the npm package root (`@litlfred/block-qa-schema/schema` and `@litlfred/block-qa-schema/schema/qa-script`) and bundled into the Python wheel as package data (`importlib.resources.files("block_qa_schema")`).

## Field reference — `<block>.qa.json` (`block-qa/v1`)

| Field | Type | Required | Meaning |
|---|---|---|---|
| `$schema` | `"block-qa/v1"` | yes | schema marker |
| `label` | string | yes | block label (e.g. `prop:jet-tower-convergence`) |
| `kind` | string | yes | block kind (mirror of the manifest discriminator) |
| `paths` | object | yes | repo-relative source paths; `ts` required, `md`/`lean` optional |
| `source_hashes` | field-hash | yes | 12-char SHA-256 prefixes of present sources, refreshed on write |
| `criteria` | map → entry[] | yes | per-criterion append-only reviewer entries |
| `updated_at` | string | no (0.2.0) | ISO-8601 UTC last-update timestamp. New writers omit it: the date is derived from the entries' `reviewed_tree` |

Per criterion entry:

| Field | Type | Required | Meaning |
|---|---|---|---|
| `field_hash` | field-hash | yes | source hashes at audit time — mismatch ⇒ stale, re-run |
| `result` | enum | yes | `pass` / `fail` / `warn` / `n/a` |
| `severity` | enum | no | `critical` / `major` / `minor` (for fail/warn) |
| `score` | object | no | rater rubric: `value`/`max` + per-dimension `rubric` |
| `evidence` | string \| {line, text}[] | no | verbatim-quote string, or the structured location list some agent reviewers emit |
| `metrics` | map | no | descriptive checker measures (e.g. detangler `tanglement_score`, `cone_size`, `pagerank`, `graph_energy`) |
| `reviewer` | object | yes | `kind` (`script`/`agent`/`human`) + `id`, with script-hash or agent model/session/skill provenance |
| `reviewed_at` | string | no (0.2.0) | ISO-8601 UTC datetime (legacy agent entries: bare date). New writers omit it: the date is derived from `reviewed_tree`, the commit date of the commit carrying it, derived on read (owner rulings 2026-11-06, cards "QA dates" and "Date source") |
| `reviewed_tree` | string | no | tree of repo HEAD at audit time (`HEAD^{tree}`) — what producers write: a pull-request run's HEAD commit can vanish, its tree cannot |
| `reviewed_sha` | string | no | repo HEAD at audit time — superseded by `reviewed_tree` and no longer written; kept readable, and legacy agent entries omit it |
| `notes` | string | no | free-form |

Both schemas set `additionalProperties: true` — the format is intentionally extensible.

## Field reference — `<criterion-id>.script.json` (`qa-script/v1`)

| Field | Type | Required | Meaning |
|---|---|---|---|
| `$schema` | `"qa-script/v1"` | yes | schema marker |
| `criterion_id` | string | yes | criterion this sidecar tracks |
| `source_file` | string | yes | repo-relative checker source path |
| `script_hash` | string | yes | 12-char SHA-256 prefix of the checker content |
| `script_commit_sha` | string | yes | last commit touching the checker |
| `extra_inputs` | string[] | no | extra files the checker consults |
| `deps_hash` | string | no | hash of concatenated extra inputs |
| `last_run_at` | string | no (0.2.0) | ISO-8601 UTC of the most recent sweep. New writers omit it; the run's time is in the run record |
| `last_run_sha` | string | yes | repo HEAD at the most recent sweep |
| `engine_version` | string | no | e.g. `bun-1.3.11+node-22` |

## License

Apache-2.0. See [LICENSE](https://github.com/litlfred/folio-assistant/blob/main/LICENSE) in the parent repository.
