
### Actors

Actors produce, manage, or act on health information. Actors relevant to the SMARTx Trust Network are as follows.

#### Credential Issuers
Credential Issuers generate digital vaccine certificates which may be issued to individuals. Issuers may generate 
vaccine certificates using one or more representations including DCC, VDS-NC, DIVOC, SHC, or other formats.

#### Credential Holders
Credential Holders are individuals or applications which possess a vaccine certificate.

#### Local Public Key Directory (PKD)
Local PKDs provides access to public keys used to validate vaccine certificates. Many Local PKDs may exist and be associated with one or more jurisdictions or specifications. Format and access mechanisms may vary across Local PKDs.

#### Federated PKD
The Federated PKD provides a signed master list of keys aggregated across one or more Local PKDs.

#### Verification Application
Verification Applications are capable of verifying cryptographic signatures of vaccine credentials by using public keys. Public keys may be retrieved from either a Local or Federated PKD.

#### Business Rules Library
Trusted service, provided by a node within a trust network, to share business rules using Clinical Quality Language (CQL) specification.
