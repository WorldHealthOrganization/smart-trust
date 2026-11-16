// The three-part definition of a Trust Domain is from Section II of the
// GDHCN Administrative and Operational Framework 1.2 (glossary term
// trust-domain; L1 library/gdhcn-administrative-and-operational-framework/).
// Owner, 2026-11-01: the parts are 0..* but an empty one is a QA error, and so
// is a terms-of-use ValueSet that no BPMN business process uses.

Invariant: gdhcn-td-1
Description: "A Trust Domain defines its use cases and business processes (GDHCN Administrative and Operational Framework, Section II, Trust Domain)."
Severity: #error
Expression: "useCase.exists()"

Invariant: gdhcn-td-2
Description: "A Trust Domain names the open, interoperable technical specifications that identify or define its Trusted Services and Verifiable Digital Health Certificates (Framework, Section II, Trust Domain)."
Severity: #error
Expression: "technicalSpecification.exists()"

Invariant: gdhcn-td-3
Description: "A Trust Domain has a set of policy and regulatory standards (Framework, Section II, Trust Domain)."
Severity: #error
Expression: "policyStandard.exists()"

Invariant: gdhcn-td-4
Description: "A Trust Domain's terms-of-use ValueSet is tied to at least one BPMN business process that uses it."
Severity: #error
Expression: "termsOfUse.exists() implies termsOfUse.process.exists()"

Logical: TrustDomain
Title: "GDHCN Trust Domain"
Description: """A GDHCN Trust Domain. Its parts follow the definition in Section II of the GDHCN Administrative and Operational Framework, which says a Trust Domain consists of:

- defined use cases and business processes related to the utilization of Verifiable Digital Health Certificates;
- the open, interoperable technical specifications that identify or define the applicable Trusted Services and Verifiable Digital Health Certificates; and
- a set of policy and regulatory standards describing expected behavior of GDHCN Participants.

A Trust Domain also names its terms of use. This is the ValueSet of policies a participant may say it acts under, for example in the `termsOfUse` of a VHL Receiver's Verifiable Credential (see [TrustDomainPolicy](StructureDefinition-TrustDomainPolicy.html))."""
Characteristics: #can-be-target
* ^status = #draft
* obeys gdhcn-td-1 and gdhcn-td-2 and gdhcn-td-3 and gdhcn-td-4
* code 1..1 code "Trust Domain code" "The Trust Domain's code in the GDHCN Trust Domains CodeSystem."
* code from Domains (required)
* name 0..1 string "Name"
* description 0..1 markdown "Description" "What the Trust Domain covers. Records whether the Framework defines the domain in an annex."
* useCase 0..* BackboneElement "Use case" "A use case of the Trust Domain, modelled by the components of the domain's Digital Adaptation Kit (DAK)."
  * title 1..1 string "Title"
  * description 0..1 markdown "Description"
  * dakComponent 0..* BackboneElement "DAK component" "A DAK component that models this use case, such as a user scenario or a business process."
    * component 1..1 code "Which DAK component"
    * component from DAKComponents (required)
    * reference 1..1 uri "The component's artefact: a canonical URL or a page of the domain's IG."
* technicalSpecification 0..* uri "Technical specification" "The canonical URL of an open, interoperable technical specification (an IG) for the domain."
* policyStandard 0..* BackboneElement "Policy and regulatory standard" "A policy and regulatory standard that GDHCN Participants confirm their readiness and intent to follow."
  * code 0..1 Coding "Code" "The standard's code, when it has one."
  * text 1..1 markdown "Text" "The standard's text, quoted from its source."
* termsOfUse 0..1 BackboneElement "Terms of use" "The policies a participant may say it acts under."
  * valueSet 1..1 canonical "Terms-of-use ValueSet" "The ValueSet of the domain's policies. A VC names one of them in a termsOfUse entry (TrustDomainPolicy)."
  * process 0..* uri "Business process" "A BPMN business process that uses the terms of use."

Logical: TrustDomainPolicy
Title: "GDHCN Trust Domain policy (VC termsOfUse entry)"
Description: """One entry of a W3C Verifiable Credentials Data Model 2.0 `termsOfUse` (section 5.5) naming a policy of a GDHCN Trust Domain that the credential's issuer acts under. One example is a VHL Receiver's self-issued credential under the Verifiable Credential Option of IHE ITI VHL ITI-YY5.

VC 2.0 requires each `termsOfUse` value to have a `type` and allows an `id`. The `type` is this logical model's canonical URL. The `id` is the policy: a code in a Trust Domain's terms-of-use ValueSet, written as `{CodeSystem canonical}#{code}`. A verifier finds the Trust Domain from the ValueSet that holds the policy.

```json
"termsOfUse": [{
  "type": "http://smart.who.int/trust/StructureDefinition/TrustDomainPolicy",
  "id": "http://smart.who.int/ips-pilgrimage/CodeSystem/IPS.HAJJ.CONSENT#CONSENT-KSA"
}]
```"""
* ^status = #draft
* type 1..1 uri "Type" "Always this logical model's canonical URL."
* type = "http://smart.who.int/trust/StructureDefinition/TrustDomainPolicy" (exactly)
* id 1..1 uri "Policy" "{CodeSystem canonical}#{code}, where the code is in a Trust Domain's terms-of-use ValueSet."
