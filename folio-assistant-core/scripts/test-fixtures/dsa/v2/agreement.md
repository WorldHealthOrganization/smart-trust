# Data Sharing Agreement DSA-042 — Version 2.0 (Amended)

**Agreement Identifier:** `https://example.org/dsa/042/v2`  
**Previous Version:** `https://example.org/dsa/042/v1`  
**Effective Date:** 2026-07-01  
**Expiration Date:** 2027-12-31T23:59:59Z  

## 1. Parties

- **Data Provider (Assigner):** Fictional National Public Health Institute (`https://example.org/org/fnphi`)
- **Data Recipient (Assignee):** Fictional Regional Epidemiology Centre (`https://example.org/org/frec`)

## 2. Covered Dataset

This amended agreement governs access to and use of the de-identified **Respiratory Surveillance Dataset 2026–2027** (`https://example.org/datasets/respiratory-surveillance-2026`), expanded in Version 2.0 to include aggregated viral genomic lineage counts.

## 3. Permitted Use and Constraints

1. The Data Recipient may use (`odrl:use`) the covered dataset solely for public health activities (`PUBHLTH` under HL7 `v3-ActReason` `PurposeOfUse`).
2. Access and use under Version 2.0 are extended through `2027-12-31T23:59:59Z` (`odrl:dateTime` `odrl:lteq`).

## 4. Obligations and End-of-Agreement Duties

Upon expiration or termination of this Agreement, the Data Recipient shall delete (`odrl:delete`) all local copies and derived extracts of `https://example.org/datasets/respiratory-surveillance-2026`.
