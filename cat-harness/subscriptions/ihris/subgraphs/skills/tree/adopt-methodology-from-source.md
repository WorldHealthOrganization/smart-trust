---
name: adopt-methodology-from-source
description: >
  The general process for turning a shared paper, book or standard into an
  adopted methodology in this folio: origin and licence, ingestion, related
  beans and issues, a faithful rendering with adopted and refused parts,
  placement, integration into existing processes, Tool nodes, and owner review.
  Process: processes/methodology-from-source.bpmn.
input: src/schemas/skills/adopt-methodology-from-source/input.schema.json
output: src/schemas/skills/adopt-methodology-from-source/output.schema.json
---

# Adopt a methodology from a source document

**Worked case:** WireGen (arXiv:2312.07755) became [`methodologies/wiregen`](../../methodologies/wiregen/wiregen.md) on 2026-09-23. The adoption rules themselves are folio-assistant's `methodology-adoption`. This skill is the *operating order* for doing it from a shared document, and it does not restate those rules.

## Steps (one per process activity)

1. **Origin and licence.** Record the authors, venue, identifier, and the licence **the source itself states**.
   - No stated licence means **reference only**: the file goes in `uploads/<slug>/` (git-ignored) with a `manifest.json` pinning `md5` and `sha256`, and `library/<slug>/` holds headings, page ranges and a summary in our own words.
   - A source with no origin is a house process. Write a skill instead of a methodology.
2. **Ingest** with folio-assistant's rungs (Tool `ihris-ingest-pdf`). An embedded outline gives real sections. Without one, use page granularity; an inferred chapter tree is never accepted.
3. **Related work** (folio-assistant `Process_RelatedWork`, skill `related-work-coordination`). Search beans (`beans list`, `beans query`) and GitHub issues for anything the method touches.
   - Categorize each hit: *duplicates*, *depends on*, *affected by*, *unrelated*. Add a one-line summary.
   - Judgement decides the categories. Show the list to the owner, and **ask whether to coordinate** (link, block, merge, note only) as a structured question. Do not act before the answer.
4. **Render the method faithfully.** What the source says, cited by section. Then a table of **adopted** and **refused** parts, each with a reason.
   - An extension beyond the source is marked as ours.
   - Reported results are not imported as facts.
   - Scores are refused and averages never taken (`methodology-adoption`).
5. **Place by ownership.** A domain-neutral method belongs to the harness, and a domain method to the folio. If the session cannot write where the method belongs, draft it where it can, say so in the file, and open a bean to move it.
6. **Integrate by calling, not copying.** Write the method's process as a spec in `processes/specs/` and generate the BPMN (Tool `ihris-gen-bpmn`). Its judgement points are `callActivity` into existing processes: `Process_Adjudication`, `Process_OptionsAnalysis`, `Process_Ingestion`. A change an existing process needs becomes a bean against its owner.
7. **Tools.** Every script, CLI or checker the process uses gets a `src/tools/<id>.tool.json` that satisfies a named skill. `validate.py` checks them with folio-assistant's `ToolDefinitionSchema`.
8. **Owner review.** The owner adopts it, asks for changes (back to step 4), or declines. A decline is recorded with its reason, not deleted.

## Refusals

- Never commit a source whose licence does not allow it.
- Never adopt by naming. A citation without a rendered method is not an adoption.
- Never coordinate with related work without asking.
