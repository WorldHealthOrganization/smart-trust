---
name: ingest-toolkit-stage
description: >
  Ingest a saved page of the iHRIS Implementation Toolkit (toolkit.ihris.org)
  into library/ihris-toolkit as a structured ihris-toolkit-stage/v1 record and a
  readable Markdown section. Use when a toolkit page is shared.
input: src/schemas/skills/ingest-toolkit-stage/input.schema.json
output: src/schemas/skills/ingest-toolkit-stage/output.schema.json
---

# Ingest a toolkit stage page

A toolkit stage page (WordPress, theme `intrahealth-ihris-it`) has a fixed
shape, and the extraction relies on it:

- `.entry-content` holds the introduction, then `#stage-steps` holds one
  `.step` per **domain** (`<h3>`): Governance, Project Management, Software &
  Systems, Data Sharing & Interoperability, Data Quality & Standards, Training &
  Support, Data Use & Reporting, and then Deliverable (or Ongoing).
- Within a step, a plain `<p>` is an **objective**. The `a.tool.<kind>` links
  after it are its **tools**. `<li>` items are **key questions**.
- The sidebar has the stage graphic and caption (`.stage-graph-stats`),
  `.stage-challenges`, and `.stage-definition` (technical terms in `<strong>`).

## Steps

1. Save the page with the browser's "save complete page" into
   `uploads/toolkit/<stage-slug>.html`. Copy the stage graphic from the
   `_files` folder to `uploads/toolkit/<stage-slug>-<graphic-file>`.
2. Add the slug to `STAGES` in `src/tools/build_kg.py` if it is new.
3. Build and validate.

Tool documents hosted on the toolkit (`hostedOnToolkit: true`) are recorded as
`materialization: "referenced"`. When someone uploads one, ingest it as its
own `library/` item and change that tool's state.
