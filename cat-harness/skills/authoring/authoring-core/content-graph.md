---
name: content-graph
description: >
  Editorial graph analysis skill — builds a content graph from uses[],
  interprets, proofs, and examples relationships; builds a chapter/section
  topology graph; and applies heuristics to identify forward references,
  cross-section/cross-chapter coupling, and sections that are too sparse or
  too dense. Produces actionable reorganisation suggestions and can implement
  approved moves.
allowed-tools: Read Edit Write Bash Grep Glob Agent
---

# Content Graph — Editorial Organisation Skill

## Two relations — read this first

A block participates in **two different** dependency relations, and this
skill is about the first one:

| Relation | Source | Answers | Maintained by |
|---|---|---|---|
| **editorial** | `uses[]` | "what must a reader have read to follow this?" | agent / human — it is authored content |
| **formal** | the content type's formal reference → its dependency graph | "what does this block's formal layer actually invoke?" | machine-derived, never hand-written |

They diverge in both directions, legitimately: a formal layer invokes
helpers nobody needs to read about; a claim is motivated by an example
it never formally cites. **Never populate `uses[]` from a formal graph**
— it destroys the editorial signal every heuristic below is computed
from. The layer that ships a formal content type defines its formal dependency
graph and links down to this skill.

The reorganisation heuristics in this skill (forward references,
coupling, section balance) are **editorial-only** by design: reading
order is a question about readers, so mixing formal edges in would make
the answers wrong, not richer.

Impact questions ("what breaks if this changes?") want the **union** of
both. Build it with `pipeline/content-graph.ts`, whose accessors
default to the union and take an optional `EdgeKind` filter:

```sh
bun run pipeline/content-graph.ts content/<paper>
```

Auditing whether `uses[]` is *well used* is a separate skill:
`uses-editorial-review` (plus the mechanical `uses` QA axis).

## Overview

This skill analyses the **full content graph** of the project at two levels:

1. **Block graph** — Every content block is a node. Edges represent
   **editorial** relationships: `uses[]` (reader-prerequisite),
   `interprets` (remark → statement), `proofs[]` (proof → statement),
   `examples[]` (example → statement). The block graph captures the
   argument structure *as presented to a reader*.

2. **Chapter/section graph** — Chapters and sections are nodes. A
   directed edge from section S₁ to section S₂ exists whenever a block in
   S₁ uses a block in S₂. The section graph captures the pedagogical
   reading order.

These two graphs are used together to apply heuristics and generate
ranked reorganisation suggestions.

## When to Use This Skill

- "content graph" / "content organisation"
- "cross-chapter arrows" / "cross-section dependencies"
- "forward references" / "minimise forward refs"
- "sections too small" / "sections too large" / "section balance"
- "disentangle content" / "reorganise chapters"
- "analyse content connections"
- "show me the block graph" / "show me the chapter graph"
- "what blocks should move?" / "suggest reorganisation"

## Prerequisites

- Python 3 and `graphviz` (installed automatically if missing)
- Content block `.ts` files in `content/<paper>/`
- Chapter manifests with `sections → blocks` structure

## Heuristics

The skill applies the following heuristics, each producing a severity-
ranked finding:

### H1 — Forward references (severity: HIGH)

A **forward reference** occurs when block A `uses` block B, but B appears
*later* in the document than A.  These cause readers to encounter concepts
before they are defined.

A block's position is its (chapter_number, section_index, block_index)
tuple in document order.

```
forward_ref: A (pos P_A) uses B (pos P_B) where P_B > P_A
```

**Ideal:** 0 forward references.
**Acceptable:** ≤ 5 (genuine architectural cycles).
**Flag for action:** > 5.

### H2 — Cross-chapter coupling (severity: MEDIUM)

A **cross-chapter edge** occurs when block A in chapter C₁ uses block B in
chapter C₂ (C₁ ≠ C₂).

Count cross-chapter edges per chapter pair (C₁ → C₂):
- Edges going *forward* (C₁.number < C₂.number): blocks in early
  chapters depend on later chapters' content → **may be a problem** (forward
  reference by chapter).
- Edges going *backward* (C₁.number > C₂.number): normal; later chapters
  build on earlier ones → fine.

**Flag**: chapters with more than 10 cross-chapter forward edges.

### H3 — Cross-section coupling (severity: MEDIUM)

Same as H2 but at section granularity within a single chapter.  Report
any section pair where ≥ 3 blocks reference each other across section
boundaries.

**Ratio metric**: cross_section_edges / total_edges_in_chapter.
- Ratio < 0.20: well-structured
- 0.20–0.40: moderate coupling
- > 0.40: high coupling — restructuring likely needed

### H4 — Section too sparse (severity: LOW)

Sections with fewer than 3 content blocks (excluding intro prose) risk
fragmenting the narrative.  They are candidates for merging with an
adjacent section.

**Threshold:** < 3 non-prose blocks.
**Exception:** Intro/overview sections (first block is `prose`).

### H5 — Section too dense (severity: LOW)

Sections with more than 18 content blocks are hard to navigate.

**Threshold:** > 18 blocks.
**Suggestion:** Split along natural dependency boundaries within the
section.

### H6 — Isolated blocks (severity: LOW)

A block with no `uses[]` edges (other than prose/intro) and no block in
`uses[]` of other blocks is **isolated**.  It may belong to a different
section or chapter, or may be dead content.

### H7 — Remark / example ratio (severity: INFO)

Sections where `remark + example` blocks outnumber the content type's
claim-bearing blocks (for a paper folio, `definition + theorem + lemma +
proposition + corollary + conjecture`) by more than 2:1 may have too much
interpretation and too little substance — or vice versa.

## Placement Principles for New/Changed Content

The heuristics above detect problems **post-hoc**.  The placement
principles below are **proactive**: agents must follow them when
creating new blocks or significantly changing existing ones.

### PR1 — Topical home chapter

Every block belongs in the chapter whose topic it primarily addresses.
Build a topic map for the project (chapter directory → primary topic
scope) and use it to decide. If a block spans two chapters' topics,
split it (see PR5).

### PR2 — Forward-reference avoidance

A new block should appear **after** all blocks it `uses[]`.  Run
`content-graph-analysis.py` after placement and verify zero new forward
references.

### PR3 — Section density bounds

When adding blocks to a section, check the count stays within
**3–18 blocks**.  If adding would exceed 18, split the section first
(H5).  If a removal would drop a section below 3, consider merging
(H4).

### PR4 — Cross-chapter dependency direction

New blocks should depend **backward** (on earlier chapters), not
forward.  If a new block in Ch 3 needs to use something from Ch 7,
either:
- Move the dependency to Ch 3 first, or
- Place the new block in Ch 7 instead.

### PR5 — Topic-coherent blocks

Before accepting a new block, verify it addresses a **single topic**.
If the `.md` content contains material belonging to multiple chapters,
split it into separate blocks placed in their respective chapters.
Defer to `block-density` R1 for the full audit.

### PR6 — Table extraction on creation

If a new block's `.md` contains a table with **> 5 data rows**, extract
it immediately to a `table` block (`kind: "table"`, label:
`tbl:<name>-data`).  Reference it from the parent block via `uses[]`.
Do not wait for a later audit.  See `block-density` R3 for details.

### PR7 — Reorganisation map update

After any block move, section split/merge, or directory rename, update
`docs/reorganization-map.md` with the change.  This is mandatory — it
is the downstream debugging reference for tracing broken labels and
imports.

## Placement Checklist (for agents)

When adding a new block or significantly changing an existing block:

1. □ Identify the primary topic → select home chapter (PR1)
2. □ Check `uses[]` deps appear earlier in document order (PR2)
3. □ Check target section has 3–18 blocks after insertion (PR3)
4. □ Verify no new forward cross-chapter edges (PR4)
5. □ Verify block is single-topic; split if not (PR5)
6. □ Extract tables > 5 rows to `table` blocks (PR6)
7. □ Update `docs/reorganization-map.md` if anything moved (PR7)
8. □ Run `python3 pipeline/content-graph-analysis.py` to confirm

## Workflow

### Step 1 — Parse the content tree

Read the paper manifest to enumerate chapters.  For each chapter, read
its manifest to enumerate sections and their block lists.  Assign each
block a document position `(chapter_number, section_index, block_index)`.

For each block `.ts` file, extract:
- `label`, `kind`, `uses[]`, `interprets`, `proofs[]`, `examples[]`

### Step 2 — Build the block graph

Build an adjacency map:
```python
edges[(from_label, to_label)] = edge_type  # "uses"|"interprets"|"proof"|"example"
```

Index every block's document position:
```python
position[label] = (chapter_no, section_idx, block_idx)
```

### Step 3 — Build the chapter/section graph

For each chapter pair (C₁, C₂) count directed edges from blocks in C₁
to blocks in C₂:
```python
chapter_edges[(c1_num, c2_num)] += 1
```

For each section pair within the same chapter, count cross-section edges:
```python
section_edges[(s1_label, s2_label)] += 1
```

### Step 4 — Apply heuristics

Run each heuristic (H1–H7) and collect findings.  Each finding has:
- `severity`: HIGH / MEDIUM / LOW / INFO
- `heuristic`: H1–H7
- `description`: human-readable explanation
- `blocks`: list of involved block labels
- `suggestion`: proposed action

### Step 5 — Generate visualisations

Two DOT/SVG outputs (via Graphviz):

**5a. Chapter/section graph** (`/tmp/content_chapter_graph.svg`)
- Nodes: chapters (large boxes) containing sections (small boxes)
- Edges: weighted directed arrows between sections
- Color: red = forward cross-chapter edges, orange = high cross-section
  coupling, gray = normal backward dependencies

**5b. Block graph heat-map** (`/tmp/content_block_heatmap.svg`)

This is the DEPENDENCY heat map, for a paper's structure. For "where should a
reviewer of this edit look first", the heat map is the review page's
section-by-metric table, and the `review-heatmap` skill says what each of its
columns means.

- Nodes: blocks (grouped by chapter/section in clusters)
- Edges: forward references only (red), cross-chapter edges (orange)
- Isolated blocks highlighted in yellow

### Step 6 — Report findings

Print a ranked report (HIGH → LOW → INFO):

```
## Content Graph Analysis: <paper>

### Summary
- Total blocks: N  |  Chapters: N  |  Sections: N
- Total block edges: N (uses/interprets/proof/example)
- Cross-chapter edges: N  |  Cross-section edges: N
- Forward references: N

### HIGH — Forward References (H1)
- block A (ch1/sec2) uses block B (ch3/sec5) ← B defined later
  Suggestion: move B earlier, or add stub to ch1

### MEDIUM — Cross-Chapter Coupling (H2)
- Ch4 → Ch1: 14 forward edges  ← Ch4 blocks depend on Ch1
  Top offending blocks: ...

### LOW — Sparse Sections (H4)
- sec:my-section (Ch3): 2 non-prose blocks
  Suggestion: merge with adjacent sec:other-section

### LOW — Dense Sections (H5)
- sec:my-dense-section (Ch4): 20 blocks
  Suggestion: split into two sections along a dependency boundary
```

### Step 7 — Interactive suggestions

After the report, offer the user a numbered menu of actions they can
approve:

```
What would you like to do?
[1] Move block X from sec:A to sec:B
[2] Split sec:large-section into two sections
[3] Add a new section "Preliminaries" in Ch3 to absorb forward refs
[4] Merge sec:sparse-1 and sec:sparse-2
[5] Show detailed block graph for chapter N
[6] Re-run analysis after changes
[0] Done
```

For each approved action, make the minimal changes to the `.ts` manifest
files.

### Step 8 — Implement approved moves

For a block move (action [1]):
1. Remove the block name from `blocks[]` in its current section.
2. Add the block name to `blocks[]` in the target section at the
   correct position (after its `uses[]` dependencies).
3. Re-run the analysis to confirm improvement.

For a section split (action [2]):
1. Ask the user to name the two new sections and choose a split point.
2. Rewrite the chapter manifest with two `section({...})` entries.
3. Move blocks to the correct new section.

For a section merge (action [4]):
1. Combine the two `blocks[]` arrays in document order.
2. Remove the merged-away section from the chapter manifest.

Always show a before/after energy comparison:
```
Before: energy=142, backward_edges=12, sparse_sections=3
After:  energy=87,  backward_edges=4,  sparse_sections=1
```

## Python implementation

The core algorithm is a standalone Python script:

```
pipeline/content-graph-analysis.py
```

**Usage:**
```bash
# Full heuristic report
cd content && python3 pipeline/content-graph-analysis.py

# Write report to /tmp/content-graph-report.md
cd content && python3 pipeline/content-graph-analysis.py --md

# Generate concrete, implementable reorganisation proposals
cd content && python3 pipeline/content-graph-analysis.py --proposals
# → output also written to /tmp/content-graph-proposals.md

# Specific chapter only
cd content && python3 pipeline/content-graph-analysis.py --chapter <chapter-dir>

# Generate visualisations
cd content && python3 pipeline/content-graph-analysis.py --visualise

# Export graph as JSON (for MCP consumption)
cd content && python3 pipeline/content-graph-analysis.py --json > /tmp/content-graph.json
```

### Proposal kinds (--proposals output)

| Kind | Description | Trigger |
|------|-------------|---------|
| `split` | Split a dense section (> 18 blocks) along natural comment boundaries | H5 |
| `merge` | Merge two adjacent sparse sections (< 3 non-prose blocks each) | H4 |
| `move` | Move a block that is forward-referenced by ≥ 3 earlier blocks | H1 |
| `reverse` | Fix an `interprets`/`example` block that appears before its target | H1 |

Each proposal includes:
- A unique ID (`P1`, `P2`, …) for stable reference
- Exact chapter manifest path and section labels to edit
- Concrete `blocks[]` array changes to make
- Expected forward-reference reduction

### Chapter naming convention

Directory names are **descriptive slugs** with NO chapter numbers:
- `introduction/`, `<topic-a>/`, `<topic-b>/`, etc.
- The paper manifest `chapters[]` array defines the chapter order
- Chapter numbers are auto-derived: numbered chapters get sequential 1, 2, 3…
- Chapters with `tabLabel` set (e.g. `"I"`, `"G"`) are unnumbered (`\chapter*{}`)
- To reorder chapters: just reorder lines in the paper manifest — no renames needed

**Key functions:**
- `parse_paper(root)` → `{chapters, sections, blocks, positions}`
- `build_block_graph(blocks)` → `{nodes, edges}`
- `build_section_graph(blocks, positions)` → `{chapter_edges, section_edges}`
- `apply_heuristics(graph, positions)` → `[Finding]`
- `generate_proposals(...)` → `[Proposal]` (split/merge/move/reverse)
- `generate_dot_chapter(graph)` → SVG path
- `generate_dot_blocks(graph)` → SVG path
- `report(findings)` → formatted text

## Integration with other skills

| After this skill | Use next |
|-----------------|----------|
| Block moves approved | the content type's block validation skill — verify schema integrity |
| Forward refs identified | `chapter-complexity-review` — block-level reorder within chapter |
| Cross-chapter coupling found | the content type's critical-path analysis skill — trace logical dependency chain |
| Sparse sections found | `editor` — add missing content blocks |
| Dense sections found | `block-density` / the content type's block review skill — audit individual blocks for splitting |
| Proposals generated | Approve with user, then implement via manifest edits + re-run |
| New content proposed | Run placement checklist (PR1–PR7) before accepting |
| Block too long / multi-topic | `block-density` — single-topic coherence audit |
| Large table found in block | `block-density` R3 — extract to `table` block |
| Feature branch ready to merge | `/prepare-merge` (slash command) — upstream check + placement + density + one-voice |

## Output artefacts

| File | Purpose |
|------|---------|
| `/tmp/content_chapter_graph.svg` | Section-level topology |
| `/tmp/content_block_heatmap.svg` | Block-level dependency heat-map |
| `/tmp/content-graph.json` | Machine-readable graph export |
| `/tmp/content-graph-report.md` | Full analysis report |
| `/tmp/content-graph-proposals.md` | Concrete reorganisation proposals |

## Drawing it

`bun run cat content:graph:uml --root <content dir> --out <dir> [--status <status file>]`
(Tool `content-graph-uml`) draws this graph under the
[`graph-rendering`](../../kg/graph-management/graph-rendering.md) rules:
- chapters as packages;
- `uses[]` and `interprets` solid, the content type's formal edges dashed
  purple (supplied by the content type's formal-graph builder);
- status fills from the content type's status file;
- one diagram per chapter, with blocks in other chapters as dashed stubs;
- portrait and landscape views, and a `--check` that needs no Java.

It builds on `buildContentGraph`, so it draws exactly the graph the QA checks
read. `content-graph-analysis.py --visualise` re-parses the sources instead
and has no staleness check.
