# Functional Requirements - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Business Requirements**](business_requirements.md)
* **Functional Requirements**

## Functional Requirements

### Requirements

There are a number of requirements that must be met in the process of exchanging trusted health documents.

#### Health content​ interoperability

**Is the correct content included in the certificate/credential or health document?​**

Consensus data models, controlled vocabularies and data transformations allow consumers of health documents to understand content of a health document in a computable manner. Shared formats for expressing health policies in executable business rule libraries further allow consumers to validate the content against their own public health policies. Here these artifacts are defined using healthcare data specifications aligned with [Health Level Seven International (HL7)](https://www.hl7.org/). HL7 is a not-for-profit, ANSI-accredited standards developing organization dedicated to providing a comprehensive framework and related standards for the exchange, integration, sharing and retrieval of electronic health information.

#### Trust interoperability and trust networks​

**Is the vaccine credential, COVID certificate or other trusted health document verifiably from the purported issuer?​**
 **Has the certificate remained unaltered since it was issued?​**

Existing health data certificate standards use various well-defined methods of providing digital signatures in health documents based on public key cryptography methods. Public key distribution within the federated registry is standardized to allow actors across networks to retrieve and process public keys, metadata, business rules, revocation data from any other actor. Universal verifier applications can use the content shared within the federated registry to extract digital signatures from health documents and verify issuer and integrity of the document content according to the specifications established by the credential standard.

**Is the certificate issuer trusted by the verifier?​**

The federated registry facilitates determination of trust through services for verifiers to discover issuers from within other networks and access governance policies for those networks. It provides infrastructure for technical governance of participating networks.

#### Identity authentication and identity binding

**Is the individual person who they purport to be?​**
 **Is the certificate about this person?​**

Identity authentication and identity binding is out of scope for this framework and is determined by policies established at the individual verifier level.

