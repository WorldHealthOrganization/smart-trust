# l1-extraction — as-is intent

## Covers

The `l1-extraction` kind viewer, declared by the SMART Guidelines base layer (owner, 2026-10-16: the kind belongs to that layer), for every `l1-extraction` directory a layer in the checkout declares. Drawn by that layer's Tool `l1-extraction-pages` (`scripts/gen-l1-extraction-pages.ts` there): a hub at `<locale>/<smart-guidelines-base>/l1-extraction/` and one page per declaring layer under it. The route key is the one `index.json` records for this wireframe.

### How this was drawn

From the pages `gen-l1-extraction-pages --site` writes in a checkout of the index with the pull request that adds the viewer overlaid, not from a built site. The drawing is the hub, then the base layer's own page with its long tables trimmed to one or two rows. The page of the immunizations guideline above it has the same sections, with 75 statements and no candidate-sentence file.

## Who it is for, and what they need to do

- **Readers:** a guideline author or reviewer checking what an agent extracted from a WHO publication at L1, and what still needs a person.
- **Tasks:**
  - see which layers hold L1 extractions, and how much each holds
  - read the L1 statements and where in the source each was read from
  - see which candidate sentences were excluded, and review them
  - reach each file at its pinned source

## What it must show

1. The mark that everything shown is a candidate, on every page.
2. Per directory: its library entry, when it sits in one.
3. L1 statements with type, text, where they were read from and their file.
4. Candidate sentences with counts, coverage and decisions, every one folded.
5. Graph documents with their context, graph id, node types and edge predicates.
6. Every file, what it is, and a link to it at the pinned commit.

## Findings

1. **The Counts table shows a string as a count.** `statementClass` → `implementation-practice` is drawn in a right-aligned number column. The candidates file's `counts` mixes a label into the counts; the viewer should show it as the class, not a count.
2. **The statement and candidate tables are wide.** Five and four columns of prose at 390 px scroll sideways inside their wrapper.
3. **Links out are not marked.** "source" leaves the site for GitHub; nothing says so.
