"""The published content @context, for the Python ingest arms — bean `yh6u`.

`tabular-records.py` and `archive-contents.py` write `.jsonld` records. Until
2026-09-23 neither carried an `@context`, so a JSON-LD processor dropped every
key they wrote. They now reference the one context every other content
document references.

The URL is DEFINED in `schemas/jsonld.ts` (`CONTENT_CONTEXT_URL`). Python
cannot import that, so it is restated here ONCE, for both arms, and
`scripts/tests/content-context-py.test.ts` fails if the two ever disagree —
a restated constant with a test is a copy; one without is a second answer.
"""

CONTENT_CONTEXT_URL = "https://litlfred.github.io/folio-assistant/ns/content/v1.jsonld"
