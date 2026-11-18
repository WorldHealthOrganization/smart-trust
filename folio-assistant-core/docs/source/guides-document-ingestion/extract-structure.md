The OCR branch is the one to know about. A document ingested that way keeps its
text in `ocr/page-*.txt` and only a **stub** in `sections/` — so the documented
`sections/` grep cannot see its mathematics at all. That asymmetry is why the
corpus-grep checklist has a fourth tier, and why a clean `sections/` grep is not
evidence that the library lacks a topic.

Each section file carries the document brief in its front-matter (contextual
retrieval), so a hit is interpretable without opening anything else.
