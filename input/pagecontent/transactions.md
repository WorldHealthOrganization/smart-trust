### Mirror Local PKD {#mirror_keys}
#### Trigger Events
#### Message Semantics
#### Expected Actions

Steps include:
- Local PKD onboarding (one-time). Onboarding may include evaluating Local PKD format, providing the Federated PKD access, and signing of business agreements.
- Local PKD public keys are mirrored (periodic)
- Mirrored public keys are merged into a master list (periodic)
- Master list is digitally signed for distribution

Local PKDs participating in the Federated PKD are expected to:
- Have an existing public key infrastructure used for issuing trusted health documents (e.g. COVID credentials)
- Have permissions/policies in place that allow sharing the public keys
- Can share public keys in one of the following formats:
  - X.509
  - JSON Web Keys (JWK)
  - [Decentralized Identifiers](https://www.w3.org/TR/did-1.0/) (DID) according to the [GDHCN specification](concepts_did_gdhcn.html) specification.

Federated PKDs are expected to:
- Have a means for retrieving local public key directories / nodes members represented in the aggregation services
- Have permissions/policies in place that allow sharing the public keys from trust node members
- Have an existing public key infrastructure used for signing list of keys my node members
- Can share list of public keys in the following format:
  - [Decentralized Identifiers](https://www.w3.org/TR/did-1.0/) (DID) according to the [GDHCN specification](concepts_did_gdhcn.html) specification.
  


### Sign Health Certificate (HCERT)  Claim {#sign_claim}
#### Trigger Events
The claim payload of a [HCERT](hcert_spec.html) has been generated and is ready to be signed by an Issuer acting on behalf of a Trust Network Participant.
#### Message Semantics
The output should be a valid signed [HCERT](hcert_spec.html)
#### Expected Actions



<h4 id="put_keys_api} Publish Verification Keys - API 
#### Trigger Events

A Trust Network Partcipiant publish keys to the Trust Network Gateway for use by Verification Applications.  Keys may be coded for a variety of uses including following the [certificate governance](concepts_certificate_governance.html) according to their [**$usage**](ValueSet-TRUST.KEYUSAGE.html) and trust [**$domain**](ValueSet-TRUST.DOMAIN.html) 


#### Message Semantics
See [Swagger API](openapi/index.html)
#### Expected Actions


### Retrieve Verification Keys - DID {#get_keys_did}
#### Trigger Events

#### Message Semantics
Keys should be retrieved using the [GDHCN DID](concepts_did_gdhcn.html) specification. 
#### Expected Actions
Once a Verification Application has onboarded to the Trust Network it may retrieve verification keys.   The retrieved list of verificaiton keys may be used for the following busines processes:
- Onboarding a Federated PKD by retrieving the signing key used to sign the master list (one-time).
- Retrieving the master list from the Federated PKD and verifying the signature (periodic).
- Deserializing a Verifiable QR code (e.g.  vaccine credential 2D bar-code) to determine the key id.
- Retrieving the public key associated with the key id from the master list, or using a cached key.
- Verifying 
  - the cryptographic signature within the 2D barcode.
  - the authority of the issuer to issue this type of certificate with this key.
  - the expiration date of the keys.
  - the expiration date from the certificate.
  - the certificate is not part of revocation lists available.
  - the issuing key is still present on a trust list by the issuing authority (not revoked).
  - the issuing key is still present on the trust list of the verification authority.
  - the name/identity on the certificate matches an ID document.
  - the business rules of the verification jurisdiction pass for the certificate.  


### Retreive Verification Keys - API {#get_keys_api}
#### Trigger Events

#### Message Semantics
See [Swagger API](openapi/index.html)
#### Expected Actions

Once a Verification Application has onboarded to the Trust Network it may retrieve verification keys.   The retrieved list of verificaiton keys may be used for the following busines processes:
- Onboarding a Federated PKD by retrieving the signing key used to sign the master list (one-time).
- Retrieving the master list from the Federated PKD and verifying the signature (periodic).
- Deserializing a Verifiable QR code (e.g.  vaccine credential 2D bar-code) to determine the key id.
- Retrieving the public key associated with the key id from the master list, or using a cached key.
- Verifying 
  - the cryptographic signature within the 2D barcode.
  - the authority of the issuer to issue this type of certificate with this key.
  - the expiration date of the keys.
  - the expiration date from the certificate.
  - the certificate is not part of revocation lists available.
  - the issuing key is still present on a trust list by the issuing authority (not revoked).
  - the issuing key is still present on the trust list of the verification authority.
  - the name/identity on the certificate matches an ID document.
  - the business rules of the verification jurisdiction pass for the certificate.  

Keys should be retrieved using the [GDHCN DID](concepts_did_gdhcn.html) specification.  




### Request Business Rule Updates - API {#get_rules_api}
#### Trigger Events
#### Message Semantics
See [Swagger API](openapi/index.html)


#### Expected Actions

### Request Business Rule Updates - API {#get_rules_fhir}
#### Trigger Events
#### Message Semantics
Shall act as a Business Rules Library:
- Expresses health policies (e.g. “Needs full course of vaccine”) as executable business rule using the Clinical Quality Language (CQL) as a FHIR Library Resource
- Publishes business rules as FHIR Library resources with a trust health service

Optionally:
  - Provide digital signagure of business rule as FHIR Provenance resource
  - Provides public key to PKD

#### Expected Actions



### Execute Business {#execute_rule}
#### Trigger Events
#### Message Semantics
#### Expected Actions


Verification App:
- Pre-Condition: Perform Federated Verification workflow on one ore more QR-code
- Identify one (or more) business rule(s) to be exectued according to use case

Optionally:
  - Retrieves business rule signing public key from PKD (either Local PKD or via Aggregating/ Federated PKD)
  - Verifies authenticity of business rule
- Map QR-code content into requiste FHIR resources using FHIR Structure Maps
- Execute CQL businns rule on FHIR resource content




### Request Value Sets - API {#get_valuesets_api}
#### Trigger Events
#### Message Semantics
See [Swagger API](openapi/index.html)
#### Expected Actions



### Request Value Sets - FHIR {#get_valuesets_api}
#### Trigger Events
#### Message Semantics
See [IHE Sharing Value Sets and Concept Maps](https://profiles.ihe.net/ITI/SVCM/) for transactions against a Terminology Service.
#### Expected Actions



### Execute Business {#execute_rule}

#### Trigger Events
#### Message Semantics
#### Expected Actions

