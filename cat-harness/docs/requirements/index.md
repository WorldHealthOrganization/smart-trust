---
title: "Requirements"
kind: requirements
summary: >-
  What the harness promises, one page per shipped feature. Each page is a filed proposal whose front matter is a Requirement.
parent: ""
has_children: true
---

# Requirements

What this harness **promises**, one page per shipped feature.

A feature starts as a **proposal** in [Proposals]({{ '/proposals/' | relative_url }}), where the initial analysis, the MVP and the options are argued. When the feature ships, its proposal is **moved** here and filed. Its front matter becomes a `Requirement`, and its body keeps the reasoning. The move uses `git mv`, so `git log --follow` walks a requirement back through the argument that produced it.

## What a page here must carry

The front matter is checked by `bun run cat check:requirements` against the bootstrap schema, `bootstrap/schemas/requirement.schema.json`:

- `id`: `req:<slug>`, and the slug is the file name. No two documents in either sub-graph share a slug, so a filed proposal can never land on an existing requirement.
- `title`, `description` and `actors`: the roles it is about, by id.
- `status`: `in-force` once filed. `superseded` requires `supersededBy`.
- `proposedIn`: the proposal's path before the move.
- `statements`: each with a `key`, a `label`, a `conformance` level (`SHALL`, `SHOULD`, `MAY` or `SHALL NOT`) and the `requirement` sentence. A `functional` statement may add `activity`, `capability` ("I want") and `benefit` ("so that"). A `non-functional` one may add a `category`.

A test run names the statements it checks, in its `requirements` array (`folio-test-run/v1`), as `req:<slug>#<key>`.

## How filing is organised

The assessment of open requirements standards is [`methodologies/requirements-standards-assessment.md`](../../methodologies/requirements-standards-assessment.md). The literature search, candidate methodologies and the BPMN filing process (`Process_RequirementsFiling`, `sdlc/processes/requirements-filing.bpmn` (opt-in `cat-harness.sdlc`)) are in [`methodologies/requirements-filing-and-organisation.md`](../../methodologies/requirements-filing-and-organisation.md):

1. **Flat physical paths, two-level semantic IDs** (Doorstop + MADR): Every filed requirement lives at `docs/requirements/<slug>.md` with `id: req:<slug>` and statement keys `req:<slug>#<key>`. Physical files stay flat so `git mv docs/proposals/<slug>.md docs/requirements/<slug>.md` is 1:1 and `check:requirements` checks slug uniqueness across `docs/proposals/` and `docs/requirements/`.
2. **Faceted organisation by canonical concern group** (Volere + IREB CPRE): Filed `in-force` requirements are indexed on this page under the eight canonical concern groups declared in [`code-lists/concern-group.json`](../../code-lists/concern-group.json) (`sdlc`, `process`, `tools`, `kg`, `library`, `content`, `ui`, `conduct`).
3. **Three-axis bidirectional traceability** (ISO/IEC/IEEE 29148 Clause 5.2.7 + IREB + W3C PROV-O): Backward lineage (`proposedIn`, `derivedFrom`), horizontal dependencies (`dependsOn`), and forward links (`beans`, `skills`, `processes`, `RequirementSet`, and `test/attestations/` + `test/runs/`).
4. **Immutable lifecycle for change, supersession, and retirement** (`proposed → in-force → superseded | retired`): Filed requirements are never deleted with `git rm`. In-scope clarifications edit `docs/requirements/<slug>.md` in place; scope-changing replacements file `docs/requirements/<new-slug>.md` and flip the old record to `status: superseded` (`supersededBy: req:<new-slug>`); obsolete requirements flip to `status: retired` and move to the **Superseded and Retired Requirements** table below.

### In-force requirements by concern group (`code-lists/concern-group.json`)

| Concern group (`code`) | Filed `in-force` requirements |
|---|---|
| **Software delivery lifecycle** (`sdlc`) | _None filed yet._ |
| **Process model and execution** (`process`) | _None filed yet._ |
| **Tools and MCP** (`tools`) | _None filed yet._ |
| **Knowledge graph** (`kg`) | _None filed yet._ |
| **Library and information management** (`library`) | _None filed yet._ |
| **Content authoring** (`content`) | _None filed yet._ |
| **Rendering, UI and publication surfaces** (`ui`) | _None filed yet._ |
| **Agent conduct** (`conduct`) | _None filed yet._ |

### Superseded and retired requirements

| Requirement (`id`) | Status (`superseded` \| `retired`) | Superseded by / Retirement note |
|---|---|---|
| _None yet._ | — | — |
