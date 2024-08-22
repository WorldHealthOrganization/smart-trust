### DID Trustlists

This specification describes the publication of Global Digital Health Certification Network (GDHCN) key material as Decentralized Identifier (DID) documents. DIDs are specified by the [W3C DID Core Specification](https://www.w3.org/TR/did-core/).
A key to real interoperability among existing trust networks is to find alignment on trust list formats.

| Version | Status   | Description                                                   |
|---------|----------|---------------------------------------------------------------|
| 2.0.0   | Draft    | 2.0.0 is in pre-released state for verification and feedback. |
| 1.0.0   | Released | 1.0.0 is deprecated and will be replaced by version 2.0.0     |

#### Trustlists 2.0.0

Version 2.0.0 introduces two variants of the trust lists - embedded and by reference.

The embedded type of trustlist carries the key material directly within the DID documents' verificationMethod property and supports immediate verification.
The reference type lists references to other DID documents, which contain the actual key material. This helps to keep the main trustlist documents concise and easier to manage and supports the dynamic discovery of actual key material.
The root trustlist contains all keys available on the TNG or the respective entrypoint for DID references.

| Trustlist           | URL                                                                                                            |
|---------------------|----------------------------------------------------------------------------------------------------------------|
| Embedded Trustlist  | [https://tng-cdn.who.int/v2.0.0/trustlist/did.json](https://tng-cdn.who.int/v2.0.0/trustlist/did.json)         |
| Reference Trustlist | [https://tng-cdn.who.int/v2.0.0/trustlist-ref/did.json](https://tng-cdn.who.int/v2.0.0/trustlist-ref/did.json) |

Version 2.0.0 also introduced substructures for DID documents, to support more fine grained resolution of key material. 

##### Path Structure for filtering

To support more fine grained resolution of key material, the following path structure is applied:

* tng-cdn.who.int/v2.0.0/trustlist/<DOMAIN>/<PARTICIPANT_CODE> matches all key usages (DSC, SCA, etc) for a specific domain or participant code
* tng-cdn.who.int/v2.0.0/trustlist/<DOMAIN>/<PARTICIPANT_CODE>/<USAGE> matches all keys for a specific usage for a specific domain or participant code
* tng-cdn.who.int//v2.0.0/trustlist/-/<PARTICIPANT_CODE> matches all domains for a specific participant for all usage codes
* tng-cdn.who.int//v2.0.0/trustlist/-/<PARTICIPANT_CODE>/<USAGE> matches all domains for a specific participant and usage code
* tng-cdn.who.int//v2.0.0/trustlist/<DOMAIN>/-/<USAGE> matches all participants for a specific domain

Note that "-" character is used as a wildcard.

##### Folder Structure with filtered DID documents

 The following folder structure is applied to the repository:

* {version}
    * trustlist
        * did.json contains all keys embedded
            * DDCC
                * did.json contains all keys for DDCC domain embedded
                    * FRA
                        * did.json contains all keys for France for DDCC Domain embedded
                            * DSC
                                * did.json contains DSCs for France for DDCC Domain
                            * SCA
                                * did.json contains DSCs for France for DDCC Domain
                    * IND
                        * did.json contains all keys for Indonesia for DDCC Domain
                        * IPS
                            * did.json contains all keys for IPS domain embedded
                    * FRA
                        * did.json contains all keys for France for IPS Domain embedded
                        * DSC
                            * did.json contains DSCs for France for IPS Domain
                        * SCA
                            * did.json contains DSCs for France for IPS Domain
            * "-"
                * FRA
                    * did.json contains all keys for France for all domains embedded
                * IND
                    * did.json contains all keys for Indonesia for all domain embedded

* {version}
    * trustlist-ref
        * contains all keys by reference
            * ...same structure as above...

##### Environments & Repositories

The trustlists version controlled and published via GitHub pages.

| Environment | Repository Link                                                                                                  | Pages Link                                                                                                    |
|-------------|------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------|
| Development | [https://github.com/WorldHealthOrganization/tng-cdn-dev](https://github.com/WorldHealthOrganization/tng-cdn-dev) | [https://worldhealthorganization.github.io/tng-cdn-dev](https://worldhealthorganization.github.io/tng-cdn-dev) |
| UAT         | [https://github.com/WorldHealthOrganization/tng-cdn-uat](https://github.com/WorldHealthOrganization/tng-cdn-uat) | [https://tng-cdn-uat.who.int](https://tng-cdn-uat.who.int)                                                    |
| Production  | ?                                                                                                                | [https://tng-cdn.who.int](https://tng-cdn.who.int)                                                            |


#### Trustlist Specification 1.0.0

[Initial specification](https://github.com/WorldHealthOrganization/ddcc-trust/blob/main/TrustListSpecification.md#leading-contender-did-document)
