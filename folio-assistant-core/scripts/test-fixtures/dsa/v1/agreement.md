# Data Sharing Agreement DSA-042 — Version 1.0

**Agreement Identifier:** `https://example.org/dsa/042/v1`  
**Effective Date:** 2026-01-15  
**Expiration Date:** 2026-12-31T23:59:59Z  

## 1. Parties

- **Data Provider (Assigner):** Fictional National Public Health Institute (`https://example.org/org/fnphi`)
- **Data Recipient (Assignee):** Fictional Regional Epidemiology Centre (`https://example.org/org/frec`)

## 2. Covered Dataset

This agreement governs access to and use of the de-identified **Respiratory Surveillance Dataset 2026** (`https://example.org/datasets/respiratory-surveillance-2026`).

## 3. Permitted Use and Constraints

1. The Data Recipient may use (`odrl:use`) the covered dataset solely for public health activities (`PUBHLTH` under HL7 `v3-ActReason` `PurposeOfUse`).
2. Access and use under Version 1.0 are permitted only through `2026-12-31T23:59:59Z` (`odrl:dateTime` `odrl:lteq`).

## 4. Obligations and End-of-Agreement Duties

Upon expiration or termination of this Agreement, the Data Recipient shall delete (`odrl:delete`) all local copies and derived extracts of `https://example.org/datasets/respiratory-surveillance-2026`.
