### Data Sharing Agreement Processes

This page is implementation guidance for data sharing agreements (DSAs). It
describes the technical processes that carry out a DSA between two
organisations. It covers only the trust-network processes. Other processes are
planned in other guides (see [Where the other processes are](#elsewhere)).

> **Draft.** This page is in the litlfred fork. It is not WHO guidance. The
> process list (P1 to P15) is our own structure; no standard defines "the DSA
> processes". Items marked **unverified** were not checked against the source
> specification.

#### Key points

- A DSA needs the same technical processes whether or not it is computable.
  Keys are still registered. Access is still decided, logged and revoked.
- "Computable" changes one thing: where the access rule comes from.
  - **Computable DSA:** an [ODRL 2.2](https://www.w3.org/TR/odrl-model/)
    `Agreement` derived from the legal text. A program evaluates it on each
    request.
  - **Document-only DSA:** a signed PDF. A person reads it and configures the
    systems by hand.
- **GDHCN is one possible trust anchor, not the only one.** A DSA may name a
  national PKI, a party's own did:web, or a local list instead. Nothing on
  this page requires GDHCN.

#### Roles {#roles}

These are roles, not organisations. One organisation can play several.

| Role | Maps to |
|---|---|
| Data provider | ODRL `assigner` (ODRL 2.2 §2.1.3, §2.3) |
| Data recipient | ODRL `assignee` (ODRL 2.2 §2.1.3) |
| Trust anchor | [Trust Network Anchor](ActorDefinition-TrustNetworkAnchor.html); or an X.509 root CA ([RFC 5280](https://www.rfc-editor.org/rfc/rfc5280) §6) |
| Party with keys | [Trust Network Participant](ActorDefinition-TrustNetworkParticipant.html), [Issuer](ActorDefinition-Issuer.html) |
| Verifier | [Receiver](ActorDefinition-Receiver.html); any system that checks a party's signature or TLS certificate |

"Data provider" and "data recipient" are our words. No actor in this guide has
those names.

#### Trust anchor choices {#anchors}

A DSA, or the policy of the system that enforces it, says which anchors it
accepts. The accepted list is either a DID document or a set of X.509 roots.
No new format is needed.

| Anchor | What it is | Standard | Paperwork to join |
|---|---|---|---|
| **GDHCN** | WHO's trust list, published as did:web DID documents and fed by the Trust Network Gateway | [DID Core 1.0](https://www.w3.org/TR/did-core/), did:web, JsonWebSignature2020 proof ([DID Trustlist v2](concepts_did_gdhcn.html)) | [Onboarding Process](concepts_onboarding.html) |
| **National PKI** | A country's X.509 root CA | RFC 5280 path validation (§6) and CRLs (§5) | National rules |
| **Own did:web** | A ministry or institute publishes its own DID document | DID Core 1.0, did:web | None. Trust comes from the domain and its TLS certificate |
| **Local list** | The deploying system's own list of accepted keys or roots | A DID document, or PEM roots checked by RFC 5280 | Whatever the system owner decides |

Two more options exist and are **not** recommended here:

- UDAP (HL7 FAST UDAP Security, STU): a trial-use standard. Needs approval
  before use.
- OpenID Federation: not a final specification. Left out.

[RFC 5914](https://www.rfc-editor.org/rfc/rfc5914) (Trust Anchor Format)
states "this root is trusted" in ASN.1 only. It has no JSON form. A local list
of X.509 roots is therefore kept as PEM files plus RFC 5280 checks.

#### P3. Register parties and keys with a trust anchor {#p3}

<figure>
 {% include dsa_register_keys.svg %}
</figure>

- **Roles.** Each party; the trust anchor operator.
- **Trigger.** A party will sign something others verify (tokens,
  credentials, QR codes), or will connect by mutual TLS.
- **Steps.**
  1. Choose the anchor or anchors the DSA accepts ([above](#anchors)). Both
     parties record the choice in the agreement.
  2. Do the anchor's paperwork.
     - GDHCN: Letter of Application, Terms of Participation, technical
       evaluation, acceptance testing, go-live
       ([Onboarding Process](concepts_onboarding.html)).
     - National PKI: national rules.
     - Own did:web, or a local list: none.
  3. Generate keys for each usage needed.
     - GDHCN: the usages in the [KeyUsage](ValueSet-KeyUsage.html) value set
       (for example SCA, DSC, UP, TLS). See
       [Certificate Governance](concepts_certificate_governance.html).
     - Other anchors: the key usage the certificate or verification method
       allows.
  4. Publish the public keys.
     - GDHCN: [Publish Keys](transactions.html#publish_keys) through the
       Trust Network Gateway.
     - did:web: add a `verificationMethod` entry to the party's DID document
       (DID Core 1.0 §5.2, **unverified** section number).
     - X.509: the CA issues the certificate.
     - Local list: hand the key or root to the other party.
  5. The verifier fetches the list and checks its signature.
     - GDHCN: [Retrieve Verification Keys - DID](transactions.html#get_keys_did).
       The trust list proof is `JsonWebSignature2020`
       ([Verifying a trust list document](concepts_did_gdhcn.html)).
     - X.509: RFC 5280 path validation to the accepted root.
     - did:web: resolve the DID document over HTTPS.
- **In.** Key pairs; for GDHCN, application letters.
- **Out.** A DID document entry, or an X.509 certificate; for GDHCN, a signed
  trust list entry.
- **Standards.** DID Core 1.0 (W3C Recommendation). did:web and
  JsonWebSignature2020 (not final; approved by the owner for this work).
  RFC 5280. IHE VHL transactions "Submit PKI Material with DID" (ITI-YY1) and
  "Retrieve Trust List with DID" (ITI-YY2) describe the same steps (ballot;
  transaction names **unverified** this session).
- **Computable?** Partly. Step 2 is done by people. Steps 4 and 5 are done by
  programs.
- **Document-only DSA.** Identical. A PDF-only DSA still needs keys when any
  system signs or connects by mutual TLS.

##### If the anchor is GDHCN {#p3-gdhcn}

This note applies only when the parties choose GDHCN.

- GDHCN groups keys by [trust domain](trust_domains.html), such as DDCC,
  ICVP, IPS-PILGRIMAGE and PH4H. It has **no trust domain for DSAs**.
- Using a key from another domain to sign DSA material works technically. It
  is outside that key's stated purpose.
- A DSA trust domain would be WHO's decision. This guide does not propose one.
- GDHCN joining is itself governed by documents (Terms of Participation, the
  Administrative and Operational Framework). It is a working example of a
  document-only agreement with technical processes on top. See
  [Concepts](concepts.html).

#### P15. Dispute and breach handling {#p15}

<figure>
 {% include dsa_breach.svg %}
</figure>

- **Roles.** Both parties; regulators; the courts or arbiters the legal text
  names.
- **Trigger.** A suspected breach: data used beyond the purpose, a missed
  duty, a leak.
- **Steps.**
  1. **Contain.** Suspend grants, clients and keys (P13, smart-trust-phw process H).
     - GDHCN key: remove the DSC from the trust list (see "DSC generation and
       deletion" in the [Onboarding Checklist](concepts_onboarding_checklist.html)).
     - X.509 certificate: revoke it and publish a CRL (RFC 5280 §5). This
       guide advises CRLs over OCSP for privacy
       ([Certificate Governance](concepts_certificate_governance.html)).
     - did:web key: remove the `verificationMethod` from the DID document.
  2. **Gather evidence.** The audit records (P12, smart-trust-phw process G), the log's hash
     chain if it has one, and the hash of the agreement version both sides
     signed (P2).
  3. **Follow the dispute clause** in the legal text.
  4. **Resolve.** Reinstate (lift the suspension), amend (P14) or terminate
     (P14, then revoke by P13).
  5. **Notify** those the law requires, for example a data protection
     authority. This depends on national law and is outside this guide.
- **Standards.** None for the process itself. In a computable DSA, ODRL 2.2
  `consequence` (§2.6.6) and `remedy` (§2.6.7) can state what follows when a
  duty is not met. The dispute itself is a legal matter.
- **Computable?** No: people decide. The evidence is produced by programs.
  This is the main value a computable DSA adds here.
- **Document-only DSA.** Same. The evidence is logs plus hashes.

#### When the agreement is only a signed PDF {#signed-pdf}

A worked example. The names are fictional. Ministry M shares a dataset with
Institute I under a signed PDF. There is no ODRL.

<figure>
 {% include dsa_signed_pdf.svg %}
</figure>

| Step | What happens | Process | Done by a program |
|---|---|---|---|
| 1 | M and I negotiate and sign a PDF. An annex with security controls stays private | P1 | nothing |
| 2 | M publishes the PDF at an immutable URL (for example `/dsa/42/v3`), its SHA-256, and a [DCAT 3](https://www.w3.org/TR/vocab-dcat-3/) record with the checksum (§6.8.20). If the PDF is confidential, M publishes only the hash | P2 | hash, catalogue |
| 3 | I's server certificate is issued by the national PKI, or I publishes a did:web | [P3](#p3) | key publication |
| 4 | M's admin registers I's client by hand: client id, mutual TLS certificate, and scopes that match the PDF. The admin's change record cites the PDF URL and hash | P4 | registration |
| 5 | I's server gets tokens by client credentials over mutual TLS ([RFC 8705](https://www.rfc-editor.org/rfc/rfc8705)) and calls the API | P5 | all transport |
| 6 | Where consent is needed, consents are paper forms, scanned into FHIR `Consent.source[x]`, with `Consent.policy.uri` set to the PDF URL ([FHIR R4 Consent](https://hl7.org/fhir/R4/consent.html)) | P9 | storage, lookup |
| 7 | M's server allows or refuses each call from its configuration | P11 | the check (the rule is set by hand) |
| 8 | Every call is logged with the PDF URL and hash. A person reviews the log against the PDF's clauses. At the end, I sends a signed deletion letter; M keeps it with its hash | P12 | records |
| 9 | If I breaches the PDF, M's admin disables the client and revokes the certificate | P13, [P15](#p15) | mechanism |
| 10 | On expiry a reminder fires. The admin disables the client. I returns or deletes the data | P14 | mechanism |

**What a person does by hand here, that a computable DSA would check:**
turning clauses into scopes (step 4); checking the purpose of each request
(possible only if the client states it); expiry (step 10); duty checks
(step 8).

**What is the same in both kinds of DSA:** keys, transport, tokens, logs and
revocation. That is why these processes are worth documenting for every DSA.

FHIR R4 `Consent` is shown because IHE PCF uses it. This guide is FHIR R4
4.0.1, as smart-base and smart-trust-phw are (owner, 2026-11-07), so the
Consent is the guide's own version. smart-trust-phw's
[Consent](http://smart.who.int/trust-phw/consent.html) page describes
explicit and implied consent.

#### Where the other processes are {#elsewhere}

The DSA processes are split by layer. Only P3 and P15 are on this page.

| # | Process | Where | Status |
|---|---|---|---|
| P1 | Draft and negotiate the agreement | folio-assistant-core (document life cycle) | planned |
| P2 | Publish: version, hash, catalogue | folio-assistant-core (document life cycle) | planned |
| P3 | Register parties and keys with a trust anchor | [this page](#p3) | draft |
| P4 | Register a server client | [smart-trust-phw, process D](https://github.com/litlfred/smart-trust-phw/blob/main/input/business-processes/PHW.D.bpmn) | draft |
| P5 | Server-to-server access | [smart-trust-phw, process E](https://github.com/litlfred/smart-trust-phw/blob/main/input/business-processes/PHW.E.bpmn) | draft |
| P6 | Wallet issuance | [smart-trust-phw](https://github.com/litlfred/smart-trust-phw) | planned |
| P7 | Wallet presentation | [smart-trust-phw](https://github.com/litlfred/smart-trust-phw) | planned |
| P8 | QR and paper | [smart-trust-phw](https://github.com/litlfred/smart-trust-phw) | planned |
| P9 | Individual consent, linked to the agreement | [smart-trust-phw](https://github.com/litlfred/smart-trust-phw) | planned |
| P10 | Agent delegation | [smart-trust-phw](https://github.com/litlfred/smart-trust-phw) | planned |
| P11 | Access decision | [smart-trust-phw, process F](https://github.com/litlfred/smart-trust-phw/blob/main/input/business-processes/PHW.F.bpmn) | draft |
| P12 | Audit, provenance and duty checks | [smart-trust-phw, process G](https://github.com/litlfred/smart-trust-phw/blob/main/input/business-processes/PHW.G.bpmn) | draft |
| P13 | Revocation and suspension | [smart-trust-phw, process H](https://github.com/litlfred/smart-trust-phw/blob/main/input/business-processes/PHW.H.bpmn) | draft |
| P14 | Amendment, renewal, termination, expiry | folio-assistant-core (document life cycle) | planned |
| P15 | Dispute and breach handling | [this page](#p15) | draft |

The server-to-server processes (P4, P5, P11, P12, P13) are BPMN processes D
to H in smart-trust-phw. Tracked in
[litlfred/folio-assistant#2702](https://github.com/litlfred/folio-assistant/issues/2702).

#### Not verified {#unverified}

- DID Core 1.0 section number for verification methods (§5.2).
- IHE VHL transaction numbers and names (ITI-YY1, ITI-YY2), taken from an
  analysis and not re-checked.
- RFC 5280 and RFC 8705 section numbers are cited from standing knowledge.
