# Working on the WHO style guide's voices

What binds everywhere is who-iris's [`AGENTS.md`](../AGENTS.md), and through
it the harness's; what the style guide *is* is
[`style-guide.md`](style-guide.md). These rules govern the voices in
[`skills/voices/`](../skills/voices/).

## A voice is DERIVED FROM a publication; it is not the publication

The source documents live in this instance's [`library/`](../library/), and
they stay there. Every rule in a voice cites `{ libraryId, sectionId }` and
resolves against that library.

**Do not copy source text into a voice.** A rule carries its quote and its page
so a reader can check it; a copied document is a second copy of a catalogued
corpus, free to drift from it, with nothing to say which is authoritative.

## Every rule carries its quote and its page

That is what makes a voice auditable. A rule without them is unsourced: a
reader cannot tell whether it came from the publication or from an agent's
impression of it.

If you cannot find the page, mark the rule as un-located rather than dropping
the citation: that is a different fact from a rule that never needed one.

## Adding a voice

Derive it from **one** publication, read rule by rule. A voice assembled from
several is a synthesis, not a house voice: a reader can no longer check a rule
against the document it came from.

---

*Kept in `docs/` rather than beside the voices because any `.md` other than a
README inside a skills directory is read as a skill.*
