# IRIS CDN Exporter: signing options

How to sign an IRIS CDN release: a detached JWS (option A) or a W3C Data
Integrity proof (option C). **Option A is the one used**, as a detached JWS
(ES256) on each library item plus one over the release; what is signed and how
is in [`iris-cdn-signing`](../skills/iris-cdn-signing.md). This page is the
comparison behind that choice. The signing key is subordinate to WHO's signing
DID:

`did:web:raw.githubusercontent.com:WorldHealthOrganization:tng-participants-prod:main:WHO:signing:DID`
([did.json](https://github.com/WorldHealthOrganization/tng-participants-prod/blob/main/WHO/signing/DID/did.json))

## What WHO's DID document contains (read 2026-10-30)

| Field | Value |
|---|---|
| `@context` | `https://www.w3.org/ns/did/v1`, `https://w3id.org/security/suites/jws-2020/v1` |
| `verificationMethod[0].type` | `JsonWebKey2020` |
| key | `publicKeyJwk`, `kty: EC`, `crv: P-256`, which means ES256 |
| `controller` | itself |
| `assertionMethod` | **not present**. Only `verificationMethod` is listed |

Three things follow:

1. **The curve is P-256, not Ed25519.** A key that sits under WHO's should use
   the same curve, so one verifier library and one algorithm (`ES256`, RFC 7518)
   cover the whole chain.
2. **WHO's document uses the JWS-2020 vocabulary.** `JsonWebKey2020` and its
   context are a W3C Credentials Community Group report, not a W3C
   Recommendation. It is published, though, and WHO already uses it. Following
   the parent's form is the least surprising choice. The W3C Recommendation
   equivalent is `JsonWebKey` from Controlled Identifiers 1.0.
3. **No `assertionMethod`.** A verifier checking WHO's key directly can only
   use `verificationMethod`. Our own DID document should still list
   `assertionMethod`, because that is how DID Core says a key may sign
   statements.

## Option A: detached JWS over the BagIt tag manifest

The signed bytes are `tagmanifest-sha256.txt` (RFC 8493). The signature is a
compact JWS with a detached payload (RFC 7515 Appendix F), `alg: ES256`
(RFC 7518), and `kid` set to a DID URL.

| | |
|---|---|
| Standards | RFC 7515, RFC 7518, RFC 8493. All are IETF standards |
| Fits WHO's DID | **Yes.** JWS with a P-256 JWK is exactly what `JsonWebKey2020` / `jws-2020` describes |
| Fits WHO SMART Trust / GDHCN tooling | Yes. That ecosystem signs with ES256 over JOSE and COSE |
| What it covers | Every byte of the release, through the tag manifest and the payload manifest |
| Churn | One signature per release and one per changed item. An unchanged night has an identical tag manifest, so it gets no new signature. There is no timestamp in the header |
| Tooling | Everywhere: WebCrypto, `jose`, `openssl`, every language |
| Verifier effort | Fetch the DID document, run one `ES256` verify, then `sha256sum -c` |
| Weakness | It signs files, not meaning. Re-serializing the graph, for example re-ordering N-Quads, breaks the digest even when the data is the same. Sorted output prevents that on our side |

## Option C: W3C Data Integrity proof

The signed object is a JSON document, for example a manifest written as a
Verifiable Credential, carrying an embedded `proof` with
`type: DataIntegrityProof`.

| | |
|---|---|
| Standards | VC Data Integrity 1.0 and Data Integrity ECDSA Cryptosuites 1.0. Both are W3C Recommendations of 15 May 2025 |
| Cryptosuite | `ecdsa-jcs-2019` (JSON canonicalization) or `ecdsa-rdfc-2019` (RDF canonicalization). P-256 is supported |
| Fits WHO's DID | **Not directly.** The ECDSA cryptosuites define only `Multikey` verification methods. WHO's key is a `JsonWebKey2020`, so a Data Integrity verifier following the Recommendation would not accept WHO's key as it is published. WHO would need to add a `Multikey` form of the key |
| What it covers | A JSON document. The BagIt manifest is plain text, so it would have to be wrapped in a JSON or VC envelope, and **no published schema exists for a file manifest as a VC**. One would have to be invented, which conflicts with "no new schemas without approval" |
| The RDF option | `ecdsa-rdfc-2019` can sign the **graph itself**, so the signature survives re-serialization. RDF canonicalization (RDFC-1.0) of ~12 million quads is heavy, and cost grows with blank nodes. We have none, which helps |
| Churn | One proof per release. `created` is optional, so it can be left out to keep bytes stable |
| Tooling | Fewer libraries, mostly the Digital Bazaar stack. Portals such as Moodle or an intranet are unlikely to have a verifier |

## Comparison

| | A: JWS | C: Data Integrity |
|---|---|---|
| Works with WHO's key as published today | **Yes** | No (needs `Multikey`) |
| Signs the whole release, PDFs included | Yes | Only through an invented wrapper |
| New schema needed | No | Yes, a manifest-as-VC |
| Survives graph re-serialization | No (prevented by sorted output) | Yes, with `rdfc` |
| Verifier tooling | Universal | Specialist |
| Churn | None on unchanged nights | None if `created` is omitted |

## Why A

A works with WHO's key as published, `x5c` fits JWS, and it needs no new
schema. C's real advantage, a signature over meaning rather than bytes, can be
added later for the **graph alone**: a second, optional `ecdsa-rdfc-2019` proof
over the spine and partitions, once WHO publishes a `Multikey` form of its key.

## Making our key subordinate to WHO's

DID Core has no single "subordinate key" mechanism. The exporter's key carries
an **`x5c` certificate chain** (RFC 7517 §4.7) ending at a certificate issued
by WHO's signing key, so no edit to WHO's DID document is needed. The
alternatives considered were:

| Way | How | What WHO must do | Strength |
|---|---|---|---|
| S1. A key inside WHO's DID | Add our P-256 key to WHO's `did.json` as `#iris-cdn`. Releases are signed with `kid = <WHO DID>#iris-cdn` | Edit `tng-participants-prod` | Strongest and simplest to verify. It is WHO's own document |
| S2. Our own DID, controlled by WHO | Publish `did:web:<cdn-domain>` with `controller: <WHO DID>`, and have WHO's document point back to it, for example in `alsoKnownAs` or a `service` entry | Add one back-reference | A `controller` claim on its own is one-directional and proves nothing. The back-reference is what makes it checkable |
| S3. An endorsement signed by WHO | Our DID document holds our key. WHO's key signs, once, a JWS over our key's JWK thumbprint (RFC 7638) and our DID, published beside our `did.json` | Sign once with WHO's key. No edit to WHO's repo | Verifiable with the same JWS tooling. It needs re-signing when our key rotates |

The verifier's chain is: the JWS, then our key from our DID document, then its
`x5c` certificates, ending at WHO's P-256 key, which the verifier is given as
its trust anchor. GDHCN trust lists are not assumed anywhere in that chain.
