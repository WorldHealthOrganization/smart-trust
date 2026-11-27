Retrieval fans out across **three classes that are not interchangeable**, kept
apart by the parallel gateway:

**Trusted sources — L1.** Ingested primary literature under `library/`: the
`sections/*.md` tree and, where a document was scanned, `ocr/page-NNN.txt`.

> **Known blind spot.** A document that was OCR'd but never re-run through
> `pdf-structure.py` has only a stub in `sections/`, so a sections-only search
> misses it. See [Document ingestion](../guides/document-ingestion.html).

**Trusted content — L2 DAKs, L3 IGs.** Already-adjudicated guidance: WHO SMART
Digital Adaptation Kits at L2, FHIR Implementation Guides at L3. A
recommendation adopted in a published DAK is a *prior decision*, with its own
provenance and grading, and is cited as that — never as primary evidence.

**Data repositories and statistical datasets.** Indicator series and microdata.
The unit of evidence is a **measurement** with a population, a period and a
method attached — not a claim in prose.
