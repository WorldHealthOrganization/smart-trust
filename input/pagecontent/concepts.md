



This digital health trust network is a network of stakeholders that securely exchange and uses health information based on trust, security, and privacy principles, and is designed to ensure that health information is handled in a secure, private, and compliant manner.  Through the GDHCN, WHO serves as the custodian of a digital health trust network.


### Document Signers
Document Signers utilize the private key of a private-public key pair to digitally sign Verifiable Digital Health Certificates.  A single private key is expected to sign a large quantity of Verifable Digital Health Certiciates.  The corresponing public key is referred to as a Document Signer Certificate (DSC). 

### Document Signer Certificates (DSCs)
Docuemnt Signer Certificates are the public key certificates associated to Document Signers which are issued or recogonzied by the Trust Network Participant.


### Public Key Infrastructure (PKI)
The Public Key Infrastructure (PKI) is the trust model based on public key certificates and certificate authorities.  It is the means for publishing and distribuing Trust Lists comprising the public keys that can be used to digitally verify the issuer of a Verfiiable Digial Health Certiciate.


###  Signing Certificate Authority (SCA)
Each Trust Network Participant maintains one or more Signing Certificate Authority (SCA), certificates of which are relatively long lived. The SCA issues public key certificates for the national, short lived, Document Signers.  The SCA acts as a trust anchor such that relying Trust Network Participants can use the SCA certificate to validate the authenticity and integrity of the regularly changing DSC certificates


### Terms of Participation (TOP)
The Trust Network Terms of Participation are comprised of the following components:
* ***TOP0*** Sharing of necessary credentials to establish an mTLS connection between Trust Network Participant backends and WHO Digital Health Trust Network infrastructure
* ***TOP1*** Compliance with technical and interoperability standards required for a Public Key Infrastructure (PKI);
* ***TOP2*** Standards for Verifiable Digital Health Certificates and APIs of Trusted Services; and
* ***TOP3*** Policy and regulatory standards that Trust Network Particpants are expected to comply with pertaining to Trusted Services that a Trust Participants operates or utilizes

### Trust Lists 
Universal verifier applications that support different credential standards are complicated by wide variability in format of the credential payloads, signatures, key formats, and key distribution methods. Public keys formats include x509 certificates, JSON Web Key Sets (JWKS), and DID documents. Signing key distribution methods include API gateways, hosted by issuer at a pre-defined URL, embedded in certificates, and by blockchain based resolution. Establishing root of trust by trust anchor or distributing trust list has been accomplished by API gateway, hosted URL, private dissemination and other bilateral sharing agreements.

While some variability is expected in an approach that preserves sovereignty, there are opportunities for alignment in key format and distribution for the sake of fostering interoperability. With that goal, we provide a unifying trust list format to assemble and share public key infrastructure for all credential specifications used by existing trust networks. Importantly, this format does not enforce a particular policy framework for participants of the trust network.

The GDHCN currently supports two means for key distribution of keys using trust lists
- [EU DCC API](concepts_certificate_governance.html) **required**
- [Decentralized Identifier (DID)](concepts_did.html) optional



### Trust Network

A digital trust network is the set of digital infrastructure, processes and governance framework which is used to manage a trusted set of actors.  This trust network operationalized through software infrastructure that enables verification of digital health records and health certificates through an interoperable trust architecture.  This is done by a trust anchor (a widely trusted central authority with a mandate and history of trustworthiness, eg. WHO) compiling a database of digital public key, provided to WHO by trust network participants. This database is made publicly available, allowing each Trust Network Participant to verify that digitally-signed credentials were issued by a recognized authority of a trust network participant.

{% include img.html img="trust_network.png" caption="Trust Network" width="70%" %}

#### Trust Network Custodian
The Trust Network Custodian defines the Terms of Participation within the trust network.  The custodian is responsible for: 
* establishing eligibility criteria for potential Trust Network Participants;  
* establishing (and maintaining) the organizational identity of Trust Network Participants; 
* establishing the Trust Network Terms of Participation within the trust network; and  
* defining the onboarding process for the Trust Network Participants to join the trust network within the established terms of participation. 


#### Trust Network Ecosystem
A Trust Network comprises the infrastructure, governance/policies and processes that are defined by a Trust Network Custodian and which characterize the trust relationships that Trust Network Participants have with the Trust Network Custodian and between themselves.   A core infrastructural component of a Trust Network is a Public Key Infrastructure (PKI). 



### Trust Network Gateway (TNG)
The Trust Network Gateway (TNG) is a service operated by the Trust Network Custodian which aggregates information related to the Public Key Infrastructure, Trusted Services for Verfiable Digital Health Certificates and other relevant metadata (e.g. validation rules for digital COVID certificates, terminolgies) coming from Trust Network Participants.  

#### Trust Network Gateway - Trust Anchor  (TNG<sub>TA</sub>) 
The Trust Anchor public key certificate of the TNG. The corresponding private key is used to sign the list of all SCA certificates offline.

#### Trust Network Gateway - Transport Layer Security  (TNG<sub>TLS</sub>) 
The TLS server public key certificate of the TNG.


### Trust Network Participant (TNP)
A Trust Network Participant is a participant of a Trust Network that adheres to the Terms of Participation and manages the necessary technical infrastructure and governance processes.  Trust Network Participants are responsible for making bilateral determinations related to the utilization of Trusted Services. 

#### Trust Network Participant Backend
A Trust Network Participant's backend system for managing the local part of information. The implementation of Trust Network Particiapnt's backend is not in the scope of this document. A national backend can be also understood as a trusted party onboarded in the Trust Network Gateway (can be a script, a proxy or a web server as well).

#### Trust Network Participant - Signing Certificate Authority  (TNP<sub>SCA) 
The SCA public key certificate of a Trust Network Partcipant (could be more than one).

#### Trust Network Participant - Transport Layer Security (TNP<sub>TLS</sub>) 
The TLS client authentication public key certificate of a Trust Network Participant's backend system.

#### Trust Network Participant - Transport Layer Security (TNP<sub>UP</sub>) 
The public key certificate that a Trust Network Participant uses to sign data packages that are uploaded to the TNG.

#### Trust Network Participant Verifier
A system utilzied by a Trust Network Participant to verifiy the digital signature of a Verifiable Digital Health Certificate.


### Trusted Service
A Trusted Service is a digital service operated by a Trust Network Participant related to the issuance, verification, revocation or similar function related to Verifiable Digital Health Certificates.    These trusted services utilize the PKI to validate the authenticity of the asserted issuer of Verifiable Digital Health Certificates.   




### Verifiable Digital Health Certificate
Verifiable Digital Health Certificate is a digital health certificate (or document) that is issued by a Trust Network Participant within an associated digital signature which can be verified by a Public Key that is distributed through the Trust Network and provided by the issuing Trust Network Participant.   Verifiable Digital Health Certificates are health documents defined by interoperable digtal health standards which contain or is associated to a digital singature which can be cerifed using a public key shared with a Trust Network Public Key Infrastructure.

The specific Verifiable Digital Health Certificates are defined in the [Content Profiles](content_profiles.html)







