---
name: voice-overlay-review
description: >
  Review a block against the active voices' rules and record the verdict on its
  QA sidecar. The human/agent half of the voice overlay; the mechanical half is
  whatever `patterns` and `terminology` a rule carries.
allowed-tools: Read Edit Bash Grep Glob
---

# Voice overlay review

## What you are reviewing, and against what

One block, against the rules of the voices the folio has **activated** — not
every voice it ships. The layer's config (its `index.config.json` entry) holds the list; an empty list means
there is nothing for this skill to do and that is a pass, not a gap.

```sh
bun run cat check:voices    # the voices, their rule counts, and that every citation resolves
```

## The rule's citation is the argument, so open it

Every voice rule carries a `source` that resolves to a real file — a
`library/<doc>/sections/<section>.md` for a rule read from an ingested document,
or a `path` for a house standard. It also carries the `quote` the rule was read
from.

**Open the citation before upholding a finding.**

1. A reviewer who has read the source can say *why* the rule applies to this
   block.
2. **The rule may be wrong.** A rule derived from a document can misread it. If
   the quote does not support the rule, the rule is the defect and the work item
   goes against the voice, not against the block.

## Three outcomes, as with the house voice axis

Identical to `voice-editorial-review`:

1. **The finding stands** — the register is wrong for this block. Fix the prose.
2. **The rule does not apply to this content** — record it, and consider whether
   the rule needs `appliesTo` scoping on the voice. One scoping edit beats many
   per-block overrules.
3. **The rule applies and this block is an exception** — a reviewer entry on the
   sidecar saying why. It leads the criterion, so the block reads `pass` with the
   reasoning attached and nothing is silently rewritten.

## A mechanical match is a question

A `pattern` is a regex over text; it does not know what the block is about.
Examples of non-defects it matches:

- `voice-scholarly-default` on documentation pages whose register is correctly
  second-person.
- `voice-editorializing` on `merely` inside a comparative, where the contrast
  is the block's claim.
- `voice-editorializing` on `clearly` used as proof economy.

**Verify before upholding**, and when a rule fires repeatedly across a
corpus on the same non-defect, that is evidence about the RULE.

## Recording the verdict

Voice findings go on the block's QA sidecar like any other, through the same
writer, so the icon and the published witness agree with what you decided:

```sh
bun run pipeline/qa-merge-findings.ts --file findings.json
```

`insertAdjudication` places your entry ahead of the script entry, because
`list[0]` is a criterion's effective verdict. The script's entry is kept
beneath yours, because the disagreement between a checker and a reviewer is
information.

## Do not

- **Do not uphold a finding you have not traced to its quote.** A rule that
  misreads its source is the failure this design exists to prevent.
- **Do not review against a voice the folio has not activated.**
- **Do not delete a script finding from a sidecar.** The sweep rewrites its own
  entries; a hand-removed one returns with no record that anyone looked.
- **Do not resolve a conflict between two active voices in the prose.** Both
  rules stand: name them and let the editor decide.
