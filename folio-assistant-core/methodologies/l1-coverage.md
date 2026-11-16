---
$schema: folio-methodology/v1
name: l1-coverage
title: L1 publication coverage — the report contract
origin: >
  The coverage contract written for folio-assistant#2406 (FR-009) as
  `docs/COVERAGE.md` in litlfred/smart-kg (main, 0e11ce1), the L1 type
  graph's repository. smart-kg was deprecated on 2026-10-16 and its schema
  moved to the WHO SMART layer that mounts this one; this layer, which
  implements the check, took the contract with it (folio-assistant#3108).
  Substance unchanged: the marker list (§1) and the exclusion reasons (§2)
  are as written there.
applies-when: >
  **An L1 extraction of a publication has been made and must be shown not to
  have dropped anything normative.** Use it to say what a coverage report must
  contain and what its numbers mean, so two tools' reports compare and a
  reviewer knows what was counted. The skill `l1-coverage` runs it.
---

# L1 publication coverage — the report contract

**This is a contract, not an implementation.** It fixes what an L1 coverage report for one
publication must contain and what its numbers mean, so that two tools producing one can be compared
and a reviewer reading one knows what was counted. This layer implements it: the skill
[`l1-coverage`](../skills/library/ingestion/l1-coverage.md) and its script `scripts/l1-coverage.ts`.
It was written in smart-kg, beside the L1 type graph, and moved here when smart-kg was deprecated:
the type graph now lives in a layer above this one, and the definition of the check belongs with
the check.

## The question it answers

> **Of the normative sentences in this publication, how many does the L1 graph account for — and
> for each one it does not capture, who decided it did not need capturing, and why?**

An L1 graph is extracted from prose by hand or by a tool, and either way the failure that matters
is silent: a recommendation that never became a node. The graph cannot report what it does not
contain. This report compares the graph against the publication, so a missing recommendation shows
up as a count.

The words *must*, *shall* and *should* below carry their RFC 2119 meaning.

---

## 1. What counts as a normative sentence

A sentence of the publication's body text is **normative** when it contains at least one of these
markers, matched case-insensitively on whole words:

| Group | Markers |
|---|---|
| Obligation | `should`, `shall`, `must` |
| Recommendation | `recommend*` — recommend, recommends, recommended, recommendation(s) |
| Negation | `should not`, `is not a reason`, `are not a contraindication` |
| Permission | `may be` followed by one of `given`, `administered`, `offered`, `considered`, `used`, `co-administered`, `implemented` |

Rules that make the count reproducible:

- **The list is closed.** A tool must not add markers of its own. A report produced with a different
  list is a different report and must say so in `definitionVersion` (§4).
- **A sentence counts once**, however many markers it carries. `should not` is not also counted as
  `should`.
- **Bare `may` is not a marker.** It is mostly epistemic ("may be associated with") and counting it
  would bury the permissive recommendations under background prose. Only the listed `may be <verb>`
  forms count.
- **Body text only.** Reference lists, tables of contents, running headers and footers, and figure
  axis labels are excluded before matching. Table cells and footnotes are body text.
- **Sentence boundaries** are the implementation's choice, but the report must give each counted
  sentence a stable location (page, and an offset or ordinal on that page) so that a reviewer can
  find it and two runs can be compared.
- The marker list is English. A report on another language edition must state its own list and is
  not comparable with an English one.

## 2. What happens to each normative sentence

Every counted sentence ends in exactly one of three states:

| State | Meaning |
|---|---|
| **captured** | An L1 node carries it — a `recommendation`'s verbatim `statement`, a `remark`'s `text`, or a `schedule-entry` — and the report names that node's id. |
| **excluded** | It is deliberately not in the graph, for one of the reasons below, and a person has signed that off. |
| **unaccounted** | Neither. This is the finding the report exists to surface. |

An exclusion carries exactly one reason from this **fixed list**:

| Reason | When it applies |
|---|---|
| `background-fact` | States what is or was the case rather than what to do — a past target reported as history ("all regions should have eliminated measles by 2020"), epidemiology, a description of current practice. |
| `manufacturer-statement` | Restates a product label or manufacturer instruction rather than making a WHO recommendation. |
| `duplicate-of:<id>` | Repeats a sentence already captured; `<id>` is the L1 node that captures it. The id must resolve in the graph. |
| `editorial` | About the document itself — "this paper should be read with…", "comments should be sent to…". |
| `research-question` | A research gap or call for further study, not guidance for practice. |

A report must not invent a reason outside this list. A sentence that fits none of them is either a
recommendation the graph is missing, or a reason this contract is missing. Both go to a person, not
to a sixth string.

**Exclusions require human sign-off.** An exclusion is a decision that a normative sentence does not
need capturing, and it is recorded the same way the graph records every other decision: who
decided, when, and the reason. A tool may *propose* an exclusion; until a person signs it off the
sentence stays **unaccounted**. A report that counts tool-proposed exclusions as accounted for has
measured how confident the tool is, not how much has been checked.

## 3. The numbers

For the whole publication **and for each page**:

| Field | Definition |
|---|---|
| `normative` | Count of normative sentences (§1) |
| `captured` | Count in state captured |
| `excluded` | Count in state excluded **with sign-off** |
| `unaccounted` | `normative − captured − excluded` |
| `capturedPct` | `captured / normative × 100` |
| `accountedForPct` | `(captured + excluded) / normative × 100` |

A page with `normative = 0` reports both percentages as `null`, not `100` and not `0`: an empty
denominator measured nothing.

**The target is 100 % accounted-for**, not 100 % captured. A publication legitimately contains
normative-looking sentences that are not recommendations, and forcing those into the graph would
make it a worse copy of the PDF. So `accountedForPct` is what is held to target, and `capturedPct`
is reported beside it so that a high accounted-for figure made mostly of exclusions is visible as
such.

Per-page figures are required, not optional. A whole-document 97 % hides the one page — often an
annex table — where every miss is concentrated, and the page is where a reviewer has to go to fix it.

## 4. Minimum report shape

A conforming report carries at least the following. The field names are part of the contract. The
serialisation is not: JSON is expected, and anything that round-trips to this shape conforms.

```text
publication        IRI of the l1:publication node the report is about
source             path and sha256 of the PDF or text the sentences were read from
graph              path and sha256 of the L1 graph document compared against
definitionVersion  identifies the marker list and rules of §1 — "folio-assistant-core/methodologies/l1-coverage.md@<commit>"
generatedAt        date-time
totals             { normative, captured, excluded, unaccounted, capturedPct, accountedForPct }
pages[]            { page, normative, captured, excluded, unaccounted, capturedPct, accountedForPct }
sentences[]        { location, text, markers[], state,
                     node?         -- when captured: the L1 node id
                     reason?       -- when excluded: one of the fixed list
                     signedOffBy?, signedOffAt?   -- when excluded
                   }
```

`text` is verbatim, as everywhere else in L1. `sha256` on both inputs means a report goes stale on
its own when either the publication or the graph changes, rather than quietly describing one that
no longer exists.

## 5. What this contract does not decide

- **How sentences are matched to nodes.** Exact substring, normalised whitespace, or a person's
  judgement are all acceptable, and the implementation must say which it used. A match that was not
  exact is a judgement, and the report should mark it the way the graph marks `inferred` edges.
- **Where the report is stored.** It is derived output about a DAK's L1 graph, so it lives with that
  graph's build, not in the layer that defines this contract.
- **Whether below-target coverage fails a build.** That is the consuming project's policy. This
  contract only makes the number mean the same thing everywhere it is computed.
