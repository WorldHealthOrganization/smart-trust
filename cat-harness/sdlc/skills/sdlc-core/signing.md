---
name: signing
description: >
  What any signature in the harness must answer, whatever it covers: who
  signs, what bytes are signed, which signature suites are accepted and who
  decides that, where the key is kept, which route signs (API or person, by
  reach), and what a verifier must check and record. Suites are named by the
  identifiers the standards already define. Signing is done by the parties'
  own systems; the harness verifies. Read before you add a signature slot, a
  trust anchor, a verifier, or a process that signs anything.
---

# Signing — the process, not the code

A signature is evidence only when a reader can establish **who** signed,
**what** they signed, **under which suite**, and **against which key and trust
anchor** it was checked. This skill is the rule set for that, for any subject:
a QA report, a mounted declaration, a materialised source, a data sharing
grant. [`qa-report-signing`](qa-report-signing.md) is this skill applied to one
subject, and keeps only what is particular to QA reports.

The skill (this file) and the tool are different things. The tool is **verify
only**, wrapping an existing open-source library, plus key lookup. There is no
`sign` tool unless the harness itself must issue grants or sign its own logs.

## The split: this skill, and the tools

| | what it is | where it lives |
|---|---|---|
| **the signing skill** (this file) | who, what, which suite, key custody, route, what a verifier checks | `cat-harness`, a definition |
| **verify** and **resolve-key** tool contracts | the Tool's input and output, naming this skill in `satisfies` | `cat-harness/tools/<id>/<id>.ts`, when written |
| their code | a thin wrapper over a maintained library | the tools layer (https://github.com/litlfred/cat-harness-tools), or the layer whose library it wraps (see *Where verification is implemented*) |

**Definitions there, implementations here.** Nothing in this skill is code,
and it names no library as chosen. The cryptography is never written in this
repository: a maintained, open-source library does it
([`finding-software`](finding-software.md)).

## 1. Who signs

Signing is done **by the parties' own systems**: a ministry's HSM, a PKI, the
GDHCN onboarding tools, a release manager's hardware key. The harness does not
hold their keys and does not sign on their behalf. What this skill states is
**what they must sign, and with which suite**.

Record whether the signer is a **person** or a **machine**. They attest
different things and are not interchangeable:

- a **machine** attests that a service holding a key saw these bytes;
- a **person** attests that someone with authority approved them.

The role that signs is named by the process that asks for the signature, as a
lane in its BPMN. A process never leaves "who signs" to the moment of signing.

The harness signs **only** where it is itself the party: issuing a grant it
is accountable for, or signing its own logs. Each such case is decided by the
owner before a `sign` tool exists.

## 2. What is signed

The exact bytes, or a digest of them, stated before anything is signed:

- the hash algorithm and the canonicalisation, where the suite has one (`rdfc`
  suites canonicalise as RDF, `jcs` suites as JSON);
- the subject's identity: which commit, which pin, which run;
- for an enveloping signature (JWS, COSE), the payload itself.

A signature kept apart from the bytes it covers attests nothing a reader can
check. Keep it **with** its subject, or record a digest that a reader can
recompute and compare.

## 3. Which suites are accepted

**Which suites are accepted is policy, and it differs by jurisdiction.** It is
not a constant in code. The code supports a set of suites, and a policy picks
which of them a given check accepts.

- **Each accepted trust anchor lists the suites it accepts.** GDHCN is one
  possible trust anchor among others: a ministry's own `did:web`, an X.509
  root, or a local key list may be anchors too, each with its own list.
- **An agreement may narrow that list, but never widen it.** A data sharing
  agreement can say "only `ecdsa-rdfc-2019`". It cannot accept a suite that
  its anchor does not accept. A suite outside the anchor's list is
  **refused**, whatever the agreement says.
- A verifier accepts a signature only if its suite is in the list for that
  anchor, after any agreement has narrowed it. An empty result is a refusal,
  never "anything goes".

### The values are identifiers the standards already define

No new code list. Store each suite under the name its own standard gives it:

| family | identifier stored | defined by |
|---|---|---|
| Data Integrity | the `cryptosuite` value: `ecdsa-rdfc-2019`, `ecdsa-jcs-2019`, `ecdsa-sd-2023`, `eddsa-rdfc-2022`, `eddsa-jcs-2022` | W3C Data Integrity ECDSA and EdDSA Cryptosuites v1.0 (Recommendations, 15 May 2025) |
| older Linked Data proofs | the proof `type`: `JsonWebSignature2020` | W3C `vc-jws-2020`, a Discontinued Draft since 2 July 2024 |
| VC-JOSE-COSE | the media type: `application/vc+jwt`, `application/vc+sd-jwt`, `application/vc+cose` (and the `vp+` forms) | W3C Securing Verifiable Credentials using JOSE and COSE (Recommendation, 15 May 2025) |
| plain JOSE / COSE | the `alg`, e.g. `ES256`, `EdDSA` | IANA JOSE and COSE algorithm registries |

**`JsonWebSignature2020` is accepted.** W3C
discontinued it, but WHO GDHCN signs its trust list with it, so a verifier
that trusts GDHCN must accept it for that list. When it is dropped, that is a
policy edit to an anchor's list. It is not a code change.

The same identifiers fit the existing `format` of `SignatureSchema` in
`schemas/library/source-provenance.ts` ("a media type or a named scheme").
`MountSignatureSchema` in `schemas/kg/mount-trust.ts` has no suite field yet.
Without one, a mount signature cannot be checked by any verifier.

## 4. Key custody

- **A private key never goes in a repository**, in a configuration file, or in
  anything this harness publishes. A deployment names a key by its mechanism
  or secret name, never by its value (`Placement.credentials` in
  `schemas/process/deployment-description.ts`).
- The private key stays with its holder. A remote signing step sends the
  digest to the holder and gets back a signature. It never sends the key to
  the signer.
- An air-gapped key needs a **person** to carry the bytes to it and the
  signature back. That is the human route below, not an exception to it.
- A public key is found through its trust anchor (did:web, an X.509 chain, a
  local list). It is never found from a key inside the document being
  checked. DEV, UAT and PROD trust lists are kept apart, and a key from one
  never verifies a document meant for another.

## 5. The route: API or person, by reach

This is already decided. Do not write a second table for it.

- **Reach is a property of the actor**: `schemas/process/actor-reach.ts`.
  `effectiveReach(deployment, actor)` gives `internet`, `egress-restricted`,
  `air-gapped` or `unknown`. An undeclared actor in a connected deployment is
  `unknown`, not `internet`.
- **The route is computed** by `sdlc/processes/decisions/signing-route.dmn`
  from that reach and the `signing-api` capability probe. It gives `api` or
  `human`. `unknown` and `air-gapped` both go to `human`.
- A process that signs a new kind of subject **reuses that table** for its
  route gateway, as `qa-report-signing.bpmn` does. It does not decide the
  route by hand, and it does not copy the table.

Record **which route signed it**. A reader who cannot tell an API signature
from a human one cannot tell which trust assumption they are relying on.

## 6. What a verifier must check, and record

A verifier returns one of three results: **valid**, **invalid**, or **could
not determine**. Could-not-determine is never treated as trusted. This rule
already appears in `SignatureSchema`, `mount-trust.ts` and `ci-health`.

Before it returns *valid*, a verifier checks:

1. **The suite is accepted.** It is in the anchor's list, narrowed by the
   agreement if there is one (section 3).
2. **The key belongs to the anchor.** The key resolves through the anchor, for
   the right environment, and is not revoked or expired at the time that
   matters.
3. **The key may be used for this.** The key's declared purpose, such as a
   GDHCN key usage or `proofPurpose`, permits this kind of signature.
4. **The signature is over these bytes.** Recompute the digest with the
   suite's canonicalisation, and verify the signature with the library.
5. **The anchor's own list is trusted.** For example, the GDHCN trust list's
   `JsonWebSignature2020` proof is checked before any key in that list is
   used.

Record, beside the subject: the suite, the key id, the anchor, the route that
signed it, the result, and **when it was checked** (`verifiedAt`, never the
time it was recorded). If any of these cannot be found out, the result is
*could not determine*, and the record says which one.

A recorded signature is not a verified one. A slot that holds a signature
nothing has checked must not be read as coverage.

## Where verification is implemented

**`litlfred/smart-trust-tools`** is the likely home for verification and key
lookup for **COSE/HCERT** documents and the **GDHCN trust list's
`JsonWebSignature2020` proof**. As checked at `bad1e36`, it has:

- the skills `hcert-verify`, `hcert-trust-list` and `hcert-sign-cose`. The
  last is two-phase, so the private key stays with its holder;
- requirement `stt-tru-006`, which verifies the trust list's detached
  `b64:false` ES256 JWS over URDNA2015;
- a trust store that loads DSCs from PEM, DER and the GDHCN DID trust list v2;
- Kotlin and Rust/WASM libraries.

**What it does not yet cover:** the VC 2.0 family, that is SD-JWT VC,
VC-JOSE-COSE and the 2025 Data Integrity cryptosuites.

This harness **does not import it**. smart-trust-tools sits above this layer
and needs the FHIR layer, and a lower layer naming a higher one is the wrong
direction. This skill only names it. A `verify` Tool contract here would be
implemented by whichever layer wraps the chosen library.

## Open questions for the owner

These are not decided. Do not settle them in code.

1. **Whose jurisdiction does "up to jurisdiction" mean?** It could be (a) the
   **signer's**, which picks the suite it signs with; (b) the **verifier's**,
   which picks the suites it accepts; or both. The model above covers both. If
   only one is meant, one of the two lists can be dropped.
2. **Should the deployment's `Jurisdiction` carry a minimum suite list?**
   `Jurisdiction` in `schemas/process/deployment-description.ts` has four
   optional fields today (`publicationBase`, `audience`, `retention`,
   `residency`). A fifth would hold the suites this deployment will ever
   accept, beneath every anchor and agreement. The other option is to keep the
   policy only on trust anchors and agreements. No field is added until this
   is decided.
3. **Which libraries to adopt** for JOSE, COSE and Data Integrity, beyond what
   smart-trust-tools already uses. Each needs an entry in the software-library
   registry before any tool code depends on it.

## What this skill does not decide

- The QA-report specifics: the `folio-test-run/v1` hashes, the `qa-reports`
  branch, and attestation versus certification. Those are in
  [`qa-report-signing`](qa-report-signing.md).
- Which trust anchors a given agreement accepts. That is the agreement's data.
- The Tool contracts themselves. They come after the library decision, and
  each one names this skill in `satisfies`.
