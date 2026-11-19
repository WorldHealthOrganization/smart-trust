They are not the same directory under two names:

| | `uploads/` | `library/<bib-slug>/` |
|---|---|---|
| what it holds | raw files as dropped | ingested, structured, described |
| stage | incoming queue | **L1 source content** |
| greppable by the corpus checklist | **no** | yes |

The corpus-grep checklist searches `library/` only, so a source still sitting
in `uploads/` makes a **clean grep** read as *"nobody has done this"*. An
un-ingested source is worse than an absent one: it produces false confidence
rather than a gap.
