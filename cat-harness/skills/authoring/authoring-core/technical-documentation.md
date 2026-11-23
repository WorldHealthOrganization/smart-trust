---
name: technical-documentation
description: >
  Write and review technical documentation of standards, software and knowledge
  assets as an SDO writes. Carries the RFC 2119 requirement levels as RFC 8174
  constrains them, the three questions a first draft is measured against, and
  the rule that an ingested specification is checked for supersession before it
  is cited.
allowed-tools: Read Grep Glob AskUserQuestion
consulted: true
---

# Technical documentation

The register is an SDO's — W3C, IHE. The reader is an implementer who was not
in the room and will not have had the discussion that produced the document.

> **The voice is the enforceable half.**
> The technical-writer voice profile addressing the role carries the
> machine-checkable rules citing the ingested RFCs and this skill. It applies
> to DRAFTING and to REVIEW QA. This skill is how a person runs it; the voice
> profile (which points down at this skill) is what a checker reads.

## Requirement levels are RFC 2119's, and only in UPPERCASE

The key words are MUST, MUST NOT, REQUIRED, SHALL, SHALL NOT, SHOULD,
SHOULD NOT, RECOMMENDED, MAY and OPTIONAL.

**RFC 8174 is the constraint that makes them usable**: only all-capitals usage
carries the defined meaning. So `the parser must handle this` is narration and
`the parser MUST handle this` is a conformance requirement, and a reader can
tell which is which without asking. A writer who meant a requirement MUST
capitalise it; a reviewer reads lowercase `must` as prose.

**Use them sparingly.** RFC 2119 constrains its own key words to what is
actually required for interoperation, or to limit behaviour that can cause
harm — explicitly NOT to impose a preferred method. A MUST in every paragraph
makes the real requirements unfindable.

**State what departing costs.** RFC 2119 asks authors to elaborate the
implications of not following a requirement, because most implementers lack
the experience that produced it. A SHOULD whose cost is unstated is an
instruction the reader cannot weigh, and the commonest reason a correct
instruction is ignored.

Both RFCs are ingested — `library/corpus/content/rfc2119-key-words-requirement-levels/`
and `library/corpus/content/rfc8174-uppercase-vs-lowercase-2119-key-words/`.
Quote them from there, not from memory.

## Check whether the specification has been superseded

**Before citing an ingested specification, check whether a later one updates
it, and ASK the owner whether they want it.**

RFC 2119's own first page says *"This RFC was updated, see RFC 8174"*, and
that update is the UPPERCASE rule above. A voice built from RFC 2119 alone
would be internally consistent and superseded, which is the error hardest to
notice.

Read the front matter for `Updated by`, `Obsoleted by`, `Superseded`, an
errata note or a later edition. Where one exists, say so and ask; do not
silently cite the older document, and do not fetch the newer one uninvited.

## Three questions for a first draft

Run these on your own draft, before review: each is cheapest while the draft
is still yours.

1. **Have I repeated anything?** If so, consolidate: the same fact in two
   places is free to drift, and the copy a reader finds first is usually the
   one with no test behind it.
2. **Does the content flow in logical order?** If not, apply the detangler
   ([`graph-detanglement`](../../kg/graph-management/graph-detanglement.md))
   rather than reordering by taste — a candidate ordering is MEASURED, not
   chosen.
3. **Is this Term defined?** If not: is it defined later; is it in the
   Glossary; does it need a Glossary entry? A term used once and nowhere else
   does not earn one. Glossary Terms are Capitalized on every use, so a reader
   can tell a defined Term from the same word used loosely.

## Reference a schema by linking to it

When the prose names a schema, link to the **schema source** and to its **UML
documentation** where one exists, because a reader left to guess the file
guesses wrong exactly when the schema has moved. Resolve the reference, do not
compose it:
writing `schemas/foo.ts` in prose composes a path, while a link resolves one,
and a broken link is a finding a checker can raise.

## Documentation and skills share content

Where a skill states a rule correctly, `docs/` SHOULD point at the skill rather
than restate it; where they disagree, the skill wins. The **skill** carries the
discipline; `docs/` carries what a reader needs to find it and why it exists.

## What this skill does not cover

Glossary mechanics — the content kind, its coding and versioning — belong to
the glossary content kind and to the content layer's `glossary-build` skill.
Model-specific voices are the voice profiles' own. This skill governs the
WRITING; those govern the artefacts it writes about.
