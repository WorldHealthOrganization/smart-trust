Some of it. The answer decides whether a field is a `dcterms` term or one in
this project's own namespace.

**Dublin Core covers the bibliographic layer well** — `dcterms:title`,
`creator`, `date`, `language`, `identifier`, `hasPart`, `format`, `extent`. The
per-folder record and the archive's part/whole structure sit comfortably there.

**It does not cover the derived layer.** A narrative description of a figure, a
transcript, a back-translation confidence, a sheet's column headers, and above
all the **provenance of a generated narrative** are not `dcterms` terms, and a
published vocabulary is the wrong place to guess an IRI.

The house rule already in `schemas/jsonld.ts` decides the shape: *generalising
is sound; inventing is not.* Where an existing vocabulary has the term, use it;
where it does not, the term goes in this project's own namespace rather than
being bent into an approximate `dcterms` one. Which vocabularies to reach for
first — PROV-O for provenance is the obvious candidate — is **not yet decided**
and must be settled against the published specifications rather than from
memory.
