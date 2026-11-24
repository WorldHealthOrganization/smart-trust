# The WHO style guide

The **WHO house voices** and the **WHO glossary**: three editorial profiles,
each read rule by rule out of one publication in this instance's
[library](../library/), with every rule carrying the quote and the page it came
from. It is a subgraph of `who-iris`:

| part | where | graph typology |
|---|---|---|
| the voices | [`skills/voices/`](../skills/voices/) | `voices`, declared from within by `skills/skills.json` |
| the glossary | [`glossary/`](../glossary/) | `glossary` |
| this page | the `who-iris-docs` subgraph | `docs` |
| the rules for working on a voice | [`style-guide-agents.md`](style-guide-agents.md) | `docs` (not kept inside `skills/`, where any non-README `.md` is read as a skill) |

## The three

| voice | read from | rules |
|---|---|---|
| `who-editorial` | WHO Editorial Style Manual (`who-pub-tps-931`, 1993) | spelling, capitalization, eponym form, reference layout, non-discriminatory language |
| `who-guideline-development` | Handbook for guideline development, 2nd ed (`9789241548960-eng`, 2014) | how a recommendation is stated, graded and attributed |
| `who-publication-design` | WPRO publication style guide (`wpr-rdo-2020-003-eng`, 2020) | logo integrity, exclusion zone, brand colour, typeface, photo provenance |

## Derived from the library

A voice is **derived from** a publication; it is not the publication. So the
voices sit beside the library and not inside it, and no source text is copied
into them.

Each source is cited in the bare `{ libraryId, sectionId }` form, which resolves
against the citing instance. The cross-instance form
`{ instance, libraryId, sectionId }` is supported for a voice whose source lives
in another instance.

**A voice names its sources once, in `sources[]`**, and each rule says which
source it uses and where in that source, so a source's details are never
written twice.

## Checking it

```sh
bun run cat check:voices
bun run cat check:glossary
```

`check:voices` finds every instance with a `voices/` directory and resolves each
citation through the declaration of the instance that holds the source. It
reports four kinds of failure separately, because each needs a different fix:
unknown instance, no library graph, never ingested, and no such section.
