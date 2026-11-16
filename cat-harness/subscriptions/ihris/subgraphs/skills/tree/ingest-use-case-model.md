---
name: ingest-use-case-model
description: >
  Parse a use-case model report (Serlio CaseComplete "Use Case Model - Complete
  Report", Word .doc) into structured ihris-use-cases/v1 records, readable
  Markdown, and a name-matched crosswalk to the iHRIS data model. Use when
  someone shares iHRIS use-case documents.
input: src/schemas/skills/ingest-use-case-model/input.schema.json
output: src/schemas/skills/ingest-use-case-model/output.schema.json
---

# Ingest a use-case model report

CaseComplete's complete report, extracted with `antiword -w 0`, has a fixed shape:

- **Packages** are numbered headings outside any table (`1. iHRIS Manage - Core Functional`, then `  1. Data Administration` indented two spaces, then three for the next level down). Each has a description, a Notes table and a Related Documents table.
- **Actors** (`|A-PT1 HR Manager|`) carry a description, a Goals table, Notes, and "Use cases that this actor plays a role in:".
- **Use cases** (`|UC-PT23 Create a position|P5|`) carry a description, a two-column **Details** table (Parent, Primary/Supporting Actors, Preconditions, Success Guarantee, Level, Complexity, Use Case Status, Implementation Status, Assigned To, Release), a **Flow of Events** table (Main Success Scenario rows, then Extensions `3.a` with numbered steps), Notes and Referenced Requirements.
- **Requirements** (`|REQ-ICE13 Authorization|P10|`) carry a description, sometimes Details, and "Use cases that reference this requirement".
- Tables have a fixed width, and a long row wraps. A row continues the one above when its first word would not have fit there.

## Steps

1. Put the `.doc` files in `uploads/<slug>/` with a `manifest.json` pinning md5 and sha256 (git-ignored). Record the licence decision. A report that states no licence needs the owner's permission before its text is published.
2. Run `python3 src/tools/ingest_use_cases.py` (Tool `ihris-ingest-use-cases`). It stops on any line it does not understand, rather than skip it. Fix the parser, never the output.
3. Check the counts against the report's own table of contents, and check `dangling` (ids the report cites but never describes).
   Check `glossary`: the report's document summary (Subject, read with olefile) may name a glossary. A line of the text naming one stops the tool until the parser reads its entries verbatim; none found is recorded as `found: false`, `terms: []`, with what was checked. Never invent one. `build_glossary.py` (skill `build-skos-glossary`) reads this record.
4. Check the tool's last line: `leak check: N withheld strings, none found ...`. If it stops with `LEAK`, a withheld name or initials reached `library/ihris-use-cases/` or the site. Fix the tool that let it through; never edit the output to hide it.
5. Run AGENTS.md §3.

## Rules

- The crosswalk is **name matching only**, and says so on every link (`derivedBy: name-match`). An unmatched use case keeps `matches: null`. Never fill it with a plausible form (AGENTS.md §7).
- **Actors are roles.** Each actor a report describes (`A-PT1 HR Manager`) becomes a Role in `scenarios/roles.json`, folio-assistant's `scenarios` graph kind (`RoleGraphSchema`, which is strict: no `lanes`, no extra keys). The id is `ihris-` and the A-id in lower case; `title` and `description` are the report's own, verbatim; `actorKinds: ["person"]`, `skills: []`. An actor with no description is no role, since a Role needs one and none is invented. Each role cites the report actors it stands for in `_sources` (product, A-id, report file); a `_` key is documentation to folio-assistant's `readRoleGraph`, which `validate-folio.ts` uses. Two actors with the same name in different products are two roles unless the owner merges them: owner, 2026-09-24, A-ICE4 (Common) and A-PS6 (Qualify), both "Any User", are one role, `ihris-a-ice4`, citing both (`SAME_ROLE` in the tool, `OWNER_SAME_ROLE` in `qa.py`). A merge needs the same title and description in both reports, since a merged text is never written; the tool stops otherwise. Never merge on a name match alone.
- **A role's use cases are the ones whose "Primary Actors" field names it** (owner, 2026-09-24). folio-assistant's `RoleDefSchema` is strict and has no `useCases`: a story points at its role, and the role names none (folio-assistant #1168). So each (role, use case) pair is a user story in `scenarios/stories.json` (`UserStoryGraphSchema`): the id is `<role id>-<use-case id>` in lower case, `role` is `{"role": <role id>}`, and `want` is the use case's title, verbatim. Each actor's own list ("Use cases that this actor plays a role in") must agree for every use case the reports describe, or the tool stops. Listed use cases the reports never describe (dangling, e.g. UC-PS26, UC-PP11) get no story, and a role no use case names as primary actor (A-PS5 Decision Maker) has none. Supporting actors are not linked.
- **Actor names resolve to roles** by name within the product, then in Common. A name that resolves to nothing stops the build: fix the parser or ask the owner, never guess.
- **People are opaque actors.** Fields that identify people (Assigned To initials, a requirement's named Source) are never copied. Owner, 2026-09-23: one opaque actor per distinct person, `scenarios/actors/ihris-2009-staff-NN.json` (folio-assistant's `ActorDef`: id, title, kind `person`, description; no roles, no login), and the field becomes `{"actor": "ihris-2009-staff-NN"}`. The same initials, or the same name (a trailing parenthesised qualifier is not part of the name), is the same person. NN is the order of first appearance: Common, Manage, Qualify, Plan, each in document order.
- **The mapping from a person to their actor is never persisted**: not in the repository, not in any output, not in a comment, not in an error message (errors print the value's shape, `XX`, never the value). It lives in the data store only.
- **The leak check lives in the ingester, not in QA.** CI has no uploads, so it cannot know the withheld strings; only this tool can. After writing, the tool builds the site into a temporary directory and fails if any withheld name (and each name part of 3+ letters, case-insensitive) or initials (case-sensitive) appears as a whole token in `library/ihris-use-cases/` or the site. In the site, initials are checked on the use-case pages only, because short initials collide with ordinary tokens (country codes, abbreviations) on pages that never read the use cases. QA (`use-case-roles`, `use-case-staff-refs`, `role-graph`, `role-use-cases`, `role-use-cases-primary`, `staff-actors`) checks everything that can be checked without the uploads.
