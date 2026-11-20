---
name: dsa-checksum
description: >
  Compute and record the SHA-256 cryptographic digest of a signed Data Sharing
  Agreement's legal text as a W3C DCAT 3 `spdx:checksum` (`spdx:Checksum` with
  `spdx:checksumAlgorithm_sha256` and 64-character lowercase hex
  `spdx:checksumValue`), verified by `check:dsa-hash` (DSA building block B3,
  process steps P2.2 `Task_Hash` and P2.2a `Task_HashSummary`).
---

# `dsa-checksum` — Compute and record the SHA-256 of the legal text (P2.2)

> Skill id: `dsa-checksum` · Package: `dsa` · Process:
> `folio-assistant-core/dsa/processes/dsa-document-lifecycle.bpmn`
> (`Task_Hash`, P2.2) · Checker: `folio-assistant-core/scripts/check-dsa-hash.ts`
> (`bun run cat check:dsa-hash`)

Every signed version of a Data Sharing Agreement (DSA) is published at its own
immutable URL and carries a cryptographic digest of the exact signed legal text
bytes. A change of even one byte to the legal text invalidates the recorded
digest and requires publishing a new version (`dcat:version`) with its own URL
and its own checksum.

## Existing specifications only

The `dsa` typology (`folio-assistant-core/typologies/dsa.json`) defines no
custom checksum fields. The digest is recorded on the legal text's
`dcat:Distribution` using the normative W3C DCAT 3 §6.8.12 `spdx:checksum`
property (`http://spdx.org/rdf/terms#checksum`):

- **`@type`:** `"spdx:Checksum"`
- **`spdx:algorithm`:** `{ "@id": "http://spdx.org/rdf/terms#checksumAlgorithm_sha256" }`
- **`spdx:checksumValue`:** 64-character lowercase hexadecimal SHA-256 digest
  (FIPS 180-4) of the legal text bytes as published at `dcat:downloadURL`.

## Procedure

1. **Freeze the signed legal text bytes** for the version (for example,
   `v1/agreement.md`). Never re-format or normalize line endings after
   computing the digest.
2. **Compute the SHA-256 hex digest** over the raw file bytes:
   ```bash
   shasum -a 256 <path/to/agreement.md>
   ```
3. **Record `spdx:checksum` on the legal text `dcat:Distribution`** in the
   version's `dcat.jsonld`:
   ```json
   {
     "@type": "dcat:Distribution",
     "@id": "https://example.org/dsa/042/v1/agreement.md",
     "dcterms:title": "Signed legal text of DSA-042 v1.0",
     "dcat:downloadURL": "https://example.org/dsa/042/v1/agreement.md",
     "dcat:mediaType": "text/markdown",
     "spdx:checksum": {
       "@type": "spdx:Checksum",
       "spdx:algorithm": {
         "@id": "http://spdx.org/rdf/terms#checksumAlgorithm_sha256"
       },
       "spdx:checksumValue": "909635085f5af64b7da8be004c051cf11af3662ff13aa9165b4c1d69b7adf22f"
     }
   }
   ```
4. **Verify with `check:dsa-hash`:**
   ```bash
   bun run cat check:dsa-hash <path/to/dsa-dir>
   ```
   The check recomputes SHA-256 over the legal text bytes, verifies that
   `spdx:checksumValue` matches, and verifies that a new version never reuses a
   previous version's hash.

## The plain-language summary (P2.2a, `Task_HashSummary`)

A consent-based agreement also publishes a plain-language summary (consent
rule 3). Record it the same way: one more `dcat:Distribution` in the same
version's `dcat.jsonld`, with its own `dcat:downloadURL` and its own
`spdx:checksum` over the summary's bytes. A changed summary is a new version,
like a changed text. `check:dsa-hash` verifies the legal text's checksum only;
check the summary's by recomputing it as in step 2.
