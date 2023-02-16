### Mirror Local PKD

Steps include:
- Local PKD onboarding (one-time). Onboarding may include evaluating Local PKD
format, providing the Federated PKD access, and signing of business agreements.
- Local PKD public keys are mirrored (periodic)
- Mirrored public keys are merged into a master list (periodic)
- Master list is digitally signed for distribution

Local PKDs participating in the Federated PKD are expected to:
- Have an existing public key infrastructure used for issuing trusted health documents (e.g. COVID credentials)
- Have permissions/policies in place that allow sharing the public keys
- Can share public keys in one of the following formats:
  - X.509
  - JSON Web Keys (JWK)
  - Decentralized Identifiers (DID)

Federated PKDs are expected to:
- Have a means for retrieving local public key directories / nodes members represented in the aggregation services
- Have permissions/policies in place that allow sharing the public keys from trust node members
- Have an existing public key infrastructure used for signing list of keys my node members
- Can share list of public keys in the following format:
  - Decentralized Identifiers (DID)

### Request PKD

Universal Verification Application steps:
- Onboarding a Federated PKD by retrieving the signing key used to sign
the master list (one-time).
- Retrieving the master list from the Federated PKD and verifying the signature (periodic).
- Deserializing the vaccine credential 2D bar-code to determine the key id.
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

### Request Business Rule Updates

Business Rules Library:​
- Expresses health policies (e.g. “Needs full course of vaccine”) as executable business​
rule using the Clinical Quality Language (CQL)​
- Publishes business rules as FHIR Library resources with a trust health service​

Optionally:​
  - Provide digital signagure of business rule as FHIR Provenance resource​
  - Provides public key to PKD​

### Execute Business Rule​  

Universal Verification App:​
- Pre-Condition: Perform Federated Verification workflow on one ore more QR-code​
- Identify one (or more) business rule(s) to be exectued according to use case​

Optionally:​
  - Retrieves business rule signing public key from PKD (either Local PKD or via Aggregating/ Federated PKD)​
  - Verifies authenticity of business rule​
- Map QR-code content into requiste FHIR resources using FHIR Structure Maps​
- Execute CQL businns rule on FHIR resource content
