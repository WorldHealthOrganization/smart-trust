---
input: schemas/skills/normative-statements/input.schema.json
output: schemas/skills/normative-statements/output.schema.json
---

# normative-statements

Carry a **recommendation, requirement or rule** in a document folio — the
thing an L1 health-policy guidance note, a standard, or a terms-of-reference
document exists to state.

## The problem this addresses

A normative statement is the block readers cite, implementers trace to, and
reviewers sign off individually, so it needs a label, a stable identity and a
place in the dependency graph. It is **not a theorem**: nothing proves it, and
its authority is the issuing body's.

## What to do

Use a **`recommendation` block**: one statement per block, with a label, a
title, and its strength as a code.

```ts
// folio/<slug>/<chapter>/rec-cold-chain-audit.ts
import { recommendation } from "@folio/schemas/builders";

export default recommendation({
  label: "rec:cold-chain-audit",
  title: "Audit the cold chain quarterly",
  strength: { list: "grade-recommendation-strength", code: "conditional" },
  uses: ["rec:scope", "prose:cold-chain-terms"],
  about: ["hi:cold-chain-management"],
});
```

The block's `.md` holds the statement itself, and its label becomes the anchor
every cross-reference targets (`[see](#rec:cold-chain-audit)`).

- `label`: a prefix of your folio's own choosing, kept consistent across the
  corpus. The platform reserves none: the kind's node says
  `prefixEnforced: false`. `rec:` is recognised, never required. Pick a prefix
  once and write it down in the folio's own AGENTS.md.
- `title`: the short form the document's index and any cross-reference will
  show.
- `strength`: a **code in a declared code list**, not free text. Core
  declares two:
  - `grade-recommendation-strength`: `strong` or `conditional`, GRADE as the
    WHO handbook for guideline development applies it;
  - `rfc2119-requirement-level`: `must`, `must-not`, `should`, `should-not`,
    `may`, from BCP 14.

  A folio whose issuing body grades differently declares its own
  `folio-code-list/v1` in its `code-lists/` rather than editing these. The
  check is "resolves in the scheme": `strengthFinding` in
  `folio-assistant-core/schemas/recommendation-strength.ts`. State the
  strength in the prose too, in the issuing body's own words, because readers
  read the prose.
- `uses[]`: the blocks a reader must have read to act on this one. That means
  definitions of terms it uses, the scope statement it sits under, and the
  evidence summary it rests on. This is what makes "what else changes if this
  recommendation changes?" answerable.
- `about[]`: optional labels of the DAK `health-intervention`s this
  recommendation is about. It is a **link, not a merge**: the two
  vocabularies stay separate, and nothing in this one depends on the DAK
  adapter.

Keep **one statement per block**. A block holding three recommendations cannot
be cited, reviewed, superseded or traced individually, and splitting it later
means renumbering everything that referenced it.

**Converting a labelled `prose` block.** Change the builder call from `prose`
to `recommendation` and add `strength`. The label, title, `uses[]` and `.md`
stay as they are, so no reference breaks.

## When the statement comes from a source

A normative statement or requirement that a SOURCE makes is already a node in
that source's L1 entry (`l1-document-ingestion`, "Requirements and normative
statements"), with the source's own number in `meta.source_number`. Cite that
node from the block's `meta.source`, and keep the source's number in the
title or prose. Do not mint a new id that looks like the source's: a reader
cannot tell the two apart.

## What not to do

- **Do not use `definition`.** It is a math kind: its `lean` field is
  *required*, so the block will not validate in a document folio at all.
- **Do not use a bare `prose` block.** It validates, but no criterion can tell
  it is normative.
- **Do not use `theorem` or `proposition`** for a good-practice statement.
  They are outside this profile and `content_profile_check` rejects them.
- **Do not encode the recommendation number in the label alone.** Numbers are
  renumbered between editions; the label must survive that. Put the published
  number in the title or the prose.
