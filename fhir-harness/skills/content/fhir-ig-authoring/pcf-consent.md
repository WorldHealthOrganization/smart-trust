---
name: pcf-consent
description: >
  Model IHE Privacy Consent on FHIR (PCF 1.1.0, Trial Implementation) and HL7
  FHIR R4 `Consent` (Trial Use) resources referenced by canonical URL only,
  translate PCF Basic and Additional `PurposeOfUse` Consents plus the four IHE
  PCF Volume 1 §1:53.2.1 implicit-policy `Set`s into W3C ODRL 2.2 `Set`
  policies (`consentToOdrl()`), and evaluate three-valued access-control
  decisions (`permit` | `deny` | `unknown`) across `decide()` / `permits()`,
  `odrl:obtainConsent` duties, IHE ITI-108 Consent Registry reads, and PROV-O
  decision records citing `Consent.id` and `Consent.meta.versionId`.
---

# pcf-consent

> Skill id: `pcf-consent` · Package: `fhir-ig-authoring` · Layer:
> `fhir-harness` · Modules:
> [`schemas/pcf-consent.ts`](../../../schemas/pcf-consent.ts) (`consentToOdrl`,
> `decide`, `evaluatePcfPolicy`, `PCF_IMPLICIT_POLICY_SETS`),
> [`schemas/iti-108-consent-client.ts`](../../../schemas/iti-108-consent-client.ts)
> (`findAccessConsents`, `Iti108ConsentClient`),
> [`schemas/odrl-to-fhir-r5-permission.ts`](../../../schemas/odrl-to-fhir-r5-permission.ts).

Model patient privacy consent directives in FHIR Implementation Guides,
translate them into W3C ODRL 2.2 policies, and evaluate three-valued
access-control decisions (`permit` | `deny` | `unknown`).

> **Standards and scope:**
> - **Specifications:** **IHE IT Infrastructure Technical Framework
>   Supplement — Privacy Consent on FHIR (PCF) 1.1.0** (*Trial Implementation*,
>   2023-08-04) and **HL7 FHIR R4 `Consent`** (*Trial Use*, FMG maturity level 2).
> - **Profiles:** IHE PCF **Basic** (`IHE.PCF.consentBasic`) and **Additional
>   `PurposeOfUse`** (`IHE.PCF.consentIntermediate`: extended HL7
>   `PurposeOfUse` codes and nested `provision` exceptions). The translator
>   also handles `IHE.PCF.consentAdvanced` security-label sensitivity tags
>   when declared.
> - **Referenced by canonical URL only:** never copy or re-author IHE PCF
>   `StructureDefinition`s or `ValueSet`s in an IG; pin the upstream packages in
>   `sushi-config.yaml` and reference IHE profiles and value sets by their
>   canonical URLs.
> - **No IUA claim:** do not claim conformance to IHE Internet User
>   Authorization (IUA), and do not profile ITI-71 / ITI-103 OAuth token
>   exchange; HTTP `Authorization` headers on ITI-108 reads are
>   passed through opaque to the transport.
> - **Trust-anchor neutral:** any consent-bearing workflow or verifiable link
>   depends on an abstract trust anchor (a national PKI, a regional
>   federation, `did:web`, the Global Digital Health Certification Network
>   (GDHCN), …); none is hardcoded.

---

## 1. Model — Authoring IHE PCF 1.1.0 `Consent` in a FHIR IG

### 1.1 Package dependencies in `sushi-config.yaml`

An IG that profiles, instantiates, or references IHE PCF consent directives or
Verifiable Health Links pins the upstream IHE packages in `sushi-config.yaml`
and references their artefacts by canonical URL only:

```yaml
dependencies:
  ihe.iti.pcf:
    id: ihe_iti_pcf
    uri: https://profiles.ihe.net/ITI/PCF/ImplementationGuide/ihe.iti.pcf
    version: 1.1.0
  ihe.iti.vhl:
    id: ihe_iti_vhl
    uri: https://profiles.ihe.net/ITI/VHL/ImplementationGuide/ihe.iti.vhl
    version: 1.0.0-comment
```

> **FHIR R4 `Consent` in an R5 IG (`could-not-determine`):** `ihe.iti.pcf@1.1.0`
> is an R4 (4.0.1) package. When an R5 (`fhirVersion: 5.0.0`) IG compiles
> against it and SUSHI or the IG Publisher rejects cross-version R4-in-R5
> profile resolution, report that cross-version outcome explicitly as
> `could-not-determine` with the exact tool diagnostic rather than silently
> dropping the dependency or hand-copying the profile.

### 1.2 Canonical URLs (never re-declared locally)

Reference the IHE PCF profiles, value sets, and HL7 code systems by their
canonical URLs exported in `fhir-harness/schemas/pcf-consent.ts`:

| Artefact | Canonical URL | Constant in `schemas/pcf-consent.ts` |
|---|---|---|
| PCF Implementation Guide | `https://profiles.ihe.net/ITI/PCF` | `PCF_IG_CANONICAL` |
| PCF Basic Consent profile | `https://profiles.ihe.net/ITI/PCF/StructureDefinition/IHE.PCF.consentBasic` | `PCF_CONSENT_BASIC_PROFILE` |
| PCF Intermediate Consent profile | `https://profiles.ihe.net/ITI/PCF/StructureDefinition/IHE.PCF.consentIntermediate` | `PCF_CONSENT_INTERMEDIATE_PROFILE` |
| PCF Advanced Consent profile | `https://profiles.ihe.net/ITI/PCF/StructureDefinition/IHE.PCF.consentAdvanced` | `PCF_CONSENT_ADVANCED_PROFILE` |
| PCF Basic Purpose ValueSet | `https://profiles.ihe.net/ITI/PCF/ValueSet/BasicPurposeVS` | `PCF_BASIC_PURPOSE_VS` |
| PCF Advanced Security Tag ValueSet | `https://profiles.ihe.net/ITI/PCF/ValueSet/AdvancedSecurityTagVS` | `PCF_ADVANCED_SECURITY_TAG_VS` |
| HL7 v3 `ActReason` (`PurposeOfUse`) | `http://terminology.hl7.org/CodeSystem/v3-ActReason` | `HL7_ACT_REASON_SYSTEM` |
| HL7 v3 `Confidentiality` | `http://terminology.hl7.org/CodeSystem/v3-Confidentiality` | `HL7_CONFIDENTIALITY_SYSTEM` |
| HL7 v3 `ActCode` | `http://terminology.hl7.org/CodeSystem/v3-ActCode` | `HL7_ACT_CODE_SYSTEM` |
| HL7 v3 `ParticipationType` | `http://terminology.hl7.org/CodeSystem/v3-ParticipationType` | `HL7_PARTICIPATION_TYPE_SYSTEM` |
| HL7 `ConsentScope` | `http://terminology.hl7.org/CodeSystem/consentscope` | `HL7_CONSENT_SCOPE_SYSTEM` |
| LOINC Privacy policy / Consent | `http://loinc.org` (`59284-0`) | `LOINC_SYSTEM` / `LOINC_CONSENT_CODE` |

### 1.3 Required structure of a PCF `Consent` instance

Every conformant IHE PCF 1.1.0 `Consent` resource carries:

1. `meta.profile`: one of `IHE.PCF.consentBasic`, `IHE.PCF.consentIntermediate`,
   or `IHE.PCF.consentAdvanced` (`detectPcfProfile(consent)` inspects
   `meta.profile` and falls back to structural inspection).
2. `status`: `"active"` for an enforceable consent directive (`"draft"`,
   `"proposed"`, `"rejected"`, `"inactive"`, and `"entered-in-error"` carry no
   active permissions or prohibitions).
3. `scope`: `http://terminology.hl7.org/CodeSystem/consentscope#patient-privacy`.
4. `category`: includes `http://loinc.org#59284-0` (*Consent*).
5. `patient`: reference to the `Patient` subject (`Patient/<id>`).
6. `dateTime` and `performer` (the consenting patient or authorized
   representative, which becomes the ODRL `assigner`) and `organization` (the
   custodian organization).
7. `sourceReference` or `sourceAttachment`: the signed paper/electronic consent
   artifact or questionnaire response.
8. `policy`: `policy[].uri` naming the overarching privacy policy (such as one
   of the four IHE PCF Volume 1 §1:53.2.1 implicit policy URIs).
9. `provision`: root provision (`type: "permit"` or `"deny"`), `purpose`
   codings from `http://terminology.hl7.org/CodeSystem/v3-ActReason` (`TREAT`,
   `HPAYMT`, `HOPERAT` in `BasicPurposeVS`, or extended `PurposeOfUse` codes
   such as `HRESCH`, `CLINTRCH`, `BIORCH`, `PUBHLTH`, `ETREAT`, `BTG`, `PATRQT`),
   optional `period`, `actor`, `action`, `dataPeriod`, `data`, `securityLabel`,
   and optional nested `provision.provision` exceptions.

> **No draft purpose vocabularies:** W3C DPV is a Community Group report and is
> **refused** (`dpv:*` or `/dpv` returns `false` in `isKnownHl7PurposeOfUse`).
> Always use HL7 v3 `ActReason` `PurposeOfUse` codes.

---

## 2. Translate — `consentToOdrl()` and the Four Implicit Policies

`consentToOdrl(consent, options)` in `fhir-harness/schemas/pcf-consent.ts`
translates a FHIR R4 `Consent` into a W3C ODRL 2.2
`Set` policy (`PcfOdrlSet`).

### 2.1 Field-by-field mapping (`Consent` → ODRL `Set`)

| FHIR R4 `Consent` element | ODRL 2.2 `Set` element | Translation rule |
|---|---|---|
| `id` + `meta.versionId` | `uid` | `consentPolicyUid(consent)` → `urn:ihe:pcf:consent:<id>:v<versionId>` (or `urn:ihe:pcf:consent:<id>` when unversioned). |
| `performer[0]` (fallback `patient`) | `assigner` | The party granting or withholding consent. |
| `status !== "active"` | `permission: []`, `prohibition: []` | Non-active consents emit an empty `Set`, which evaluates to `"unknown"` (or defers to `implicitPolicy`). |
| `provision.type` (`"permit"` / `"deny"`) | `permission` / `prohibition` | Root provision defaults to `"permit"` when `provision.type` is omitted, per FHIR R4 `Consent.provision.type`. |
| `provision.purpose[]` (`v3-ActReason`) | `constraint` (`odrl:purpose`) | Each HL7 `PurposeOfUse` code becomes `{ leftOperand: "odrl:purpose", operator: "odrl:isA", rightOperand: code }`, so ontological parent codes (`TREAT`, `HRESCH`, `ETREAT`, …) permit their sub-concepts (`CLINTRL`, `BTG`, `CLINTRCH`, `BIORCH`, …) via `broaderOrSelf` over `HL7_PURPOSE_OF_USE` (IHE PCF Vol 3 §3:5.8.2). Non-HL7 local project codes become `odrl:eq`. Multiple `purpose` codings expand into one rule per purpose (logical OR). |
| `provision.period` (`start`, `end`) | `constraint` (`odrl:dateTime`) | `period.start` → `{ leftOperand: "odrl:dateTime", operator: "odrl:gteq", rightOperand: start }`; `period.end` → `{ leftOperand: "odrl:dateTime", operator: "odrl:lteq", rightOperand: end }`. Date-only bounds (`YYYY-MM-DD`) expand to `00:00:00.000Z` (`start`) and `23:59:59.999Z` (`end`). |
| `provision.actor[].reference` | `assignee` | One rule per actor reference; defaults to `ANYONE` (`"*"`) when `actor` is omitted. |
| `provision.action[]` | `action` | `"read"` → `"odrl:display"`, `"correct"` → `"odrl:modify"`, `"access"` / `"collect"` / `"use"` / `"disclose"` (and default) → `"odrl:use"`. |
| `provision.data[]` (`meaning: "instance"`) | `target` | Direct resource references (`DocumentReference/ex-doc`, `Observation/ex-obs`) become rule `target`s. |
| `provision.data[]` (`"authoredby"` / `"related"`) | `constraint` (`pcf:author` / `pcf:encounter`) | `meaning: "authoredby"` → `leftOperand: "pcf:author"`; `meaning: "related"` → `leftOperand: "pcf:encounter"`. |
| `provision.dataPeriod` | `constraint` (`pcf:dataPeriod`) | Clinical data creation/effective period (`odrl:gteq` / `odrl:lteq` on `pcf:dataPeriod`). |
| `provision.securityLabel[]` | `constraint` (`pcf:securityLabel`) | Confidentiality / sensitivity tags (`R`, `V`, `ETH`, `PSY`, `SDV`, `HIV`, …) become `odrl:eq` or `odrl:isAnyOf` on `pcf:securityLabel`. |
| Nested `provision.provision[]` | `permission` / `prohibition` + `conflict` | Child provisions inherit parent `period` (intersected via `mergePeriods`). A root `permit` with nested `deny` exceptions sets `conflict: "odrl:prohibit"`. A root `deny` with nested `permit` exceptions (e.g. dissent except for Break-Glass `BTG`) sets `conflict: "odrl:perm"`. |

### 2.2 The four IHE PCF Volume 1 §1:53.2.1 implicit-policy `Set`s

When a patient has no explicit active `Consent` on file (or when their explicit
`Consent` has expired), IHE PCF Volume 1 §1:53.2.1 and §1:53.4.2.4 define four
overarching jurisdictional baseline policies, exported in
`PCF_IMPLICIT_POLICY_SETS` and resolved by `getImplicitPolicySet(uriOrAlias)`:

| Canonical URI (`PCF_POLICY_*_URI`) | Alias(es) | Constant | Semantics |
|---|---|---|---|
| `https://profiles.ihe.net/ITI/PCF/Policy-basic-normal` | `"basic-normal"` | `PCF_IMPLICIT_BASIC_NORMAL_SET` | **Permit Clinical Treatment:** permits `odrl:use` when `odrl:purpose isA TREAT` (including `ETREAT`, `BTG`, `CLINTRL`, `POPHLTH`); non-treatment purposes return `deny`. |
| `https://profiles.ihe.net/ITI/PCF/Policy-all-normal` | `"all-normal"`, `"opt-out"` | `PCF_IMPLICIT_ALL_NORMAL_SET` | **Permit All Authorized (opt-out baseline):** permits `odrl:use` when `odrl:purpose isA PurposeOfUse`. |
| `https://profiles.ihe.net/ITI/PCF/Policy-break-glass-only` | `"break-glass-only"` | `PCF_IMPLICIT_BREAK_GLASS_ONLY_SET` | **Break-Glass Only:** prohibits all uses except when `odrl:purpose isA BTG` (medical patient-safety override). |
| `https://profiles.ihe.net/ITI/PCF/Policy-deny` | `"deny"`, `"opt-in"` | `PCF_IMPLICIT_DENY_SET` | **Deny All (opt-in baseline):** prohibits all `odrl:use` until an explicit active `Consent` permits access. |

---

## 3. Decide — Three-Valued Evaluation, ITI-108 Reads, `obtainConsent`, and PROV Citations

### 3.1 `decide()` and `evaluatePcfPolicy()` (`permit` | `deny` | `unknown`)

`decide(consentOrPolicy, req, options)` in `fhir-harness/schemas/pcf-consent.ts`
evaluates a `PcfDecisionRequest` (`actor`, `actorRoles`, `actorGroups`,
`action`, and `scope` / top-level `purpose`, `dateTime`, `target`,
`securityLabel`, `dataPeriod`, `author`, `encounter`):

1. **Active explicit `Consent` governs:** if one or more active, non-expired
   `Consent` resources (or translated `PcfOdrlSet`s) are supplied, any `deny`
   across them returns `"deny"` (`odrl:prohibit`), any `"permit"` (with no
   `"deny"`) returns `"permit"`, and unresolved scope operands return
   `"unknown"`.
2. **Missing Scope Operand is `"unknown"`, never `"permit"`:** if a rule
   constrains `odrl:purpose`, `odrl:dateTime`, `pcf:securityLabel`, `target`,
   or `assignee` and the request omits that dimension, evaluation yields
   `"unknown"`. Under `conflict: "odrl:perm"` (such as a root `deny` with a
   Break-Glass `permit` exception), if the exception's constraint is
   unresolved, `evaluatePcfPolicy()` returns `"unknown"` rather than
   prematurely denying before purpose is supplied.
3. **Expired or absent `Consent`:**
   - If `options.implicitPolicy` is provided, `decide()` falls back to the
     configured implicit-policy `Set` (IHE PCF Vol 1 §1:53.2.2 & §1:53.4.2.5).
   - If no `implicitPolicy` is configured: an expired active `Consent` returns
     `"deny"`, and an absent or non-active `Consent` returns `"unknown"` —
     **never a silent `"permit"`**.

### 3.2 Reading consents via IHE ITI-108 (`findAccessConsents`)

`findAccessConsents(query)` and `Iti108ConsentClient` in
`fhir-harness/schemas/iti-108-consent-client.ts` implement the **IHE ITI-108** (*Find Access Consent*, `[ITI-108]`) RESTful
search transaction (`GET <baseUrl>/Consent`) as a **Consent Consumer**:

- **Search parameters (`buildIti108SearchUrl`):** `patient` /
  `patient.identifier`, `status` (defaults to `"active"`), `actor`, `purpose`,
  `security-label`, `period`, `date`, `data`, `_profile`, and `_count`.
- **Client-side validity filtering (`evaluateConsentValidity` / `filterIti108Bundle`):**
  every `Bundle.entry.resource` of type `Consent` is verified against
  `FhirConsentSchema`. Entries whose `status !== "active"`, whose `patient`
  does not match the queried patient, or whose `provision.period` is expired
  (`end < now`) or future-dated (`start > now`) are excluded from `consents`
  and recorded in `ignored[]` with a structured `Iti108IgnoredReason`
  (`"not-active"`, `"expired"`, `"not-yet-valid"`, `"patient-mismatch"`,
  `"invalid-period"`, `"invalid-consent"`).
- **Third-state failure handling (`status: "unknown"`):** network failures,
  DNS errors, request timeouts, non-2xx HTTP responses, malformed JSON,
  non-`searchset` payloads, or `OperationOutcome` errors return
  `{ status: "unknown", reason, detail }` — **never** an empty `consents: []`
  that a caller could mistake for "no consent on file". When passing an
  ITI-108 result into `decide()`, check `result.status === "unknown"` first and
  propagate `"unknown"`.

### 3.3 Fulfilling `odrl:obtainConsent` duties on DSAs via injected `createPcfConsentEvaluator`

`cat-harness/schemas/content/odrl.ts` holds no FHIR resource types or `pcf:*`
keys. A Data Sharing Agreement (`@type: "Agreement"`) carrying an
`{ action: "odrl:obtainConsent" }` duty evaluates consent through an injected
`consentEvaluator: createPcfConsentEvaluator(consents, options)` callback from
`fhir-harness/schemas/pcf-consent.ts`, which returns
`{ verdict, consent: { id, versionId, uid } }` to `permits()` /
`permitsWithConsent()` / `decideWithConsent()`:

- **DSA + no `Consent` (or unreachable ITI-108 registry) → `"unknown"`:** when
  `odrl:obtainConsent` is due and no active matching PCF `Consent` (or
  consent-verification record) is provided, `permits()` returns `"unknown"`.
- **DSA + matching `deny` `Consent` (or expired `Consent`) → `"deny"`:** when
  the patient's PCF `Consent` denies the requested actor, action, purpose, or
  target, the decision is `"deny"`.
- **DSA + matching active `permit` `Consent` → `"permit"`:** when an active,
  in-period PCF `Consent` permits the request's actor, action, purpose, and
  target (and any other DSA constraints and duties hold), `permits()` returns
  `"permit"`.

### 3.3a Consent rules for agreements

Four rules govern consent-based agreements. Rules 2 and 4 are enforced here;
rules 1 and 3 are authored in the agreement itself (the `dsa` document kind
and its lifecycle process in folio-assistant-core).

1. **Legal basis.** An agreement carries `odrl:obtainConsent` only when
   consent is its legal basis. Agreements resting on treatment, public-health
   law or a research waiver carry no such duty, and this evaluator is never
   asked.
2. **Version pinning.** A Consent names the agreement's fixed-version URL in
   R4 `Consent.policy.uri`. `createPcfConsentEvaluator` counts a Consent only
   when that URI equals the agreement's version (the agreement policy's
   `uid`, or `agreementPolicyUri`); `consentsCitingAgreement()` is the filter.
   An amendment that widens use is a new version URL, so the old Consent no
   longer counts. An amendment that narrows use needs no new consent: pass
   the agreement's DCAT 3 version chain as `agreementVersions` (each
   version's ODRL policy and its `dcat:previousVersion`), and an older Consent
   still counts while every step back to its version is a narrowing
   amendment. `isNarrowingAmendment()` decides that from the ODRL rules
   alone: every newer permission sits inside an older one (same or narrower
   action, same target and assignee, each older constraint matched by one at
   least as tight, each older duty kept), and every older prohibition and
   obligation remains. A widening step, a missing version or anything it
   cannot compare (such as `inheritFrom`) stops the walk, and new consent is
   needed.
3. **Plain language.** Every agreement that needs consent publishes a
   plain-language summary, hashed with the agreement. That summary is what
   the person consents to.
4. **Scale.** The jurisdiction picks one of PCF's implicit default policies
   (opt-in or opt-out) and passes it as `implicitPolicy`. Registry reads may
   be cached: `new Iti108ConsentClient(base, defaults, { ttlMs })`. An entry
   ends at its TTL, at the earliest `provision.period.end` of its Consents, or
   when `consentWithdrawn(id)` is called for one of its Consents.

### 3.4 Citing `Consent.id` + `Consent.meta.versionId` in PROV-O decision records

Every consent-based access decision recorded in the hash-chained W3C PROV-O
decision log (`cat-harness/schemas/content/prov.ts`,
`cat-harness-tools/src/workflow/prov-record.ts`) must cite the exact `Consent` resource version used:

- Use `extractConsentCitation(consent)` / `consentPolicyUid(consent)` from
  `fhir-harness/schemas/pcf-consent.ts` to obtain `{ id, versionId, uid, status, patient, performer, policyUris }`.
- Include the translated consent policy `uid`
  (`urn:ihe:pcf:consent:<id>:v<versionId>`) in `"cat-harness:underPolicy"` on
  the `prov:Activity` decision record alongside the governing DSA `Agreement`
  `uid`, and record the `Consent`'s `id` and `meta.versionId` citation so any
  auditor can verify which version of the patient's consent directive was in
  force when the decision hash (`cat-harness:recordHash` chained via
  `cat-harness:previousHash`) was computed.

### 3.5 One-way renderer: ODRL 2.2 Agreement to FHIR R5 `Permission` (output only)

HL7 FHIR R5 `Permission` (Trial Use) is **output only**: W3C ODRL 2.2 is the
source of truth and nothing reads `Permission` back.
[`schemas/odrl-to-fhir-r5-permission.ts`](../../../schemas/odrl-to-fhir-r5-permission.ts)
provides `odrlAgreementToFhirR5Permission(agreement, options)` and
`fhirR5PermissionToFsh(permission, options)`:

- `FhirR5PermissionSchema` and its required value-set code lists are built from
  `hl7.fhir.r5.core#5.0.0`'s `StructureDefinition-Permission.json` and
  `CodeSystem-*.json` (`permission-status`, `permission-rule-combining`,
  `consent-provision-type`, `consent-data-meaning`), so no field outside FHIR R5
  `Permission` is ever invented.
- Maps `conflict` (`prohibit` / `perm`) to `combining` (`deny-overrides` /
  `permit-overrides`); `assigner` to `asserter`; shared `dateTime` constraints
  to `validity`; the agreement's fixed-version `uid` and `dcterms:source` to
  `justification.evidence` / `justification.basis`; `permission` / `prohibition`
  to `rule.type` (`permit` / `deny`); `target` to `rule.data.resource`;
  `assignee`, `action` (`consentaction`), and `purpose` (HL7 `v3-ActReason`
  `PurposeOfUse`) to `rule.activity`; and `delete` duty roughly to `rule.limit`
  (`v3-ActCode#DELAU`).
- Every ODRL 2.2, DCAT 3, or SPDX term with no exact home in FHIR R5
  `Permission` (including `@type`, `profile`, `inheritFrom`, `spdx:checksum`,
  `isA`, exclusive `lt`/`gt` bounds, `elapsedTime`, `refinement`, and duties or
  duty constraints) is returned explicitly in `dropped: DroppedOdrlTerm[]`
  rather than dropped silently.
