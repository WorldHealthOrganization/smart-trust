# DID Trustlist v1 (deprecated) - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Data Models and Exchange**](data_exchange.md)
* [**DID Trustlist Specification**](concepts_did.md)
* **DID Trustlist v1 (deprecated)**

## DID Trustlist v1 (deprecated)

#### DID Document v1.0 (deprecated)

The unified format is based on the [Decentralized Identifiers (DIDs) v1.0](https://www.w3.org/TR/did-core/) specification. DIDs are globally unique identifier in the form of URIs. The URI scheme includes a method name which corresponds to a standard method by which a DID Document can be resolved. This DID Document is a structured JSON-LD which captures each existing public key (regardless of X.509 or JWK format used) by the members of a trust network in a common format. It allows additional metadata (such as intended purpose and key identifiers) to be added to existing keys with changing the underlying keys themselves​. It provides means to publish and cryptographically sign a master lists of keys recognized used by a trust network.

The unified format DID method selected is did:web, a method to retrieve DID Documents via existing web (https) infrastructure​. ​The did:web identifiers have the form `<DOMAIN NAME>:<PATH COMPONENT 1>:...: <PATH COMPONENT N>`​. Resolution is accomplished by https GET against the URL which is formed from this identifier by​ `https://​DOMAIN NAME/PATH COMPONENT 1/.../PATH COMPONENT N/did.json`. For example did:web:example.com:my:path would resolve a DID Document from the URL `https://example.com/my/path/did.json`​. Additional did methods may be supported in the future.

The DID Document itself should have:​

* an ‘id’ field which is the DID itself and represents the DID Subject, in this case the trust list
* a list of public keys within the ‘verificationMethod’ field​
* an optional signature via a ‘proof’ field​

The verificationMethod array represents the individual signing keys associated with issuers within the entity represented by the DID Subject, an includes:

* an `id` field which is a DID URL composed of the DID for this DID Document and key ID as ​DID#key
* controller of the public key, which can be current document (in case of publishing a key by a trust network member) or the source of the public key in case of an aggregator
* the public key JWK, including the key's x509 and chain of trust to Root Certificate Authority​

The DID Document itself can be signed with addition of a ‘proof’ block containing signature details and key used for verification.

For more information regarding the DID Document format for a Trust List specification, see [WHO DDCC Trust List Specification documentation](https://github.com/WorldHealthOrganization/ddcc-trust/blob/main/TrustListSpecification.md#leading-contender-did-document). For an example of a signed DID Document, see [Appendix A](https://github.com/WorldHealthOrganization/ddcc-trust/blob/main/TrustListSpecification.md#appendix-a-signed-did-document-for-x509-enabled-trust-lists-of-leaf-keys) of the documentation.

