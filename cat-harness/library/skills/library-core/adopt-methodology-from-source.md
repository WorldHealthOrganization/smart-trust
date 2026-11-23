---
name: adopt-methodology-from-source
description: >
  The general process for turning a shared paper, book or standard into an
  adopted methodology: establish origin and licence, ingest the source, find
  and summarize related work items and issues and ask whether to coordinate,
  render the method with its adopted and refused parts, place it by
  ownership, integrate it by calling existing processes, give every tool it
  uses a Tool node, and put it to the owner. Process:
  library/processes/methodology-from-source.bpmn.
---

# Adopt a methodology from a source document

The adoption **rules** are [`methodology-adoption`](../../../skills/process/process-core/methodology-adoption.md). This skill is the **operating order** for applying them when somebody shares a document and asks for its method to be used.

**Worked case:** WireGen (arXiv:2312.07755) became [`methodologies/wiregen`](../../../methodologies/wiregen.md).

## Steps (one per process activity)

1. **Origin and licence.** Record the authors, venue, identifier, and the licence the **source itself states**.
   - No stated licence means **reference only**: the library entry holds headings, page ranges and a summary in our own words.
   - A source with no origin is a house process. Write a skill instead of a methodology.
2. **Ingest** (`Process_Ingestion`, [`library-ingestion`](library-ingestion.md)) — the basic flow: the source is accepted, its metadata goes into the KG, and it is catalogued in `library/`. Reading a document into sections is a content-type refinement above this layer, and it keeps the rules that applied here: choose the rung mechanically, and never accept an inferred chapter tree.
3. **Related work** (`Process_RelatedWork`, `related-work-coordination` (opt-in `cat-harness.sdlc`)). Search work items (`beans list --json`, `beans query`) and the repository's issues and open PRs for work the method touches.
   - Categorize each hit: *overlaps, coordinate*; *affected by*; *out of scope*; or *unrelated*. Give each a one-line summary.
   - Judgement decides the categories. Present them with context, options and a recommendation (`interaction-modality` §4.1), and **ask whether and how to coordinate**. Do not act before the answer.
   - This is the same step CRDM runs when a requirement starts or changes in chat.
4. **Render the method faithfully:** what the source says, section by section, then a table of what is **adopted** and what is **refused**, each with its reason.
   - Extensions beyond the source are marked as ours.
   - Reported results are not imported as facts.
5. **Place it by ownership** (`methodology-adoption` §4), and declare the directory.
6. **Integrate by calling, not copying.** The method's judgement points are call activities into existing processes: `Process_Adjudication`, `Process_OptionsAnalysis`, `Process_Ingestion`. A change an existing process needs is made there, or becomes a work item against it.
7. **Tools.** Every script, CLI or checker the process relies on gets a Tool node (`tools/<id>/<id>.json`) satisfying a named skill. `check:tools` gates it.
8. **Owner review.** The owner adopts it, sends it back for changes (to step 4), or declines. A decline is recorded with its reason.

## Refusals

- Never hold a source's bytes or text when its licence does not allow it.
- Never adopt a method by naming it.
- Never coordinate with related work without asking.
