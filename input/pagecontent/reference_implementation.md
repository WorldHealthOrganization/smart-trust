### Trust Registry Network

The Digital TRUST Infrastructure for Discovery and Validation (Regi-TRUST) is a decentralized trust management infrastructure that bridges the gap between different certificate ecosystems and enables trust interoperability. It is a suite of endpoints that comprises a "network of networks" of trusted digital services operated by various stakeholders, collated with their independent governance policies, with support for root of trust architectures to allow interoperable verifications. Implementers of Regi-Trust can leverage tools provided to create purpose-sized networks of trusted digital services operated by all types of entities, using lightweight infrastucture and technical governance due to the decentralized federation approach. Regi-TRUST was originally started by the Linux Foundation in 2021 as the Global COVID-19 Certificate Network (GCCN), and is now sponsored and hosted by the United Nation Development Programme (UNDP). 

Within the health certificate context, verifiers can use this discovery mechanism to build a customized trust list based on their own entry policies, check health certificates from issuers participating in disparate trust networks against that list and access the issuer's public key for signature verification. The registry participants submit  service metadata, public keys, business rules and revocation data to the registry in a standardized format via trusted endpoints.

Regi-TRUST is built on the open-source [Trust mAnagement INfrastructure (TRAIN)](https://gitlab.grnet.gr/essif-lab/infrastructure/fraunhofer/train_project_summary), developed by the Fraunhofer IAO as a part of the European Self-Sovereign Identity Framework (ESSIF) Lab. TRAIN uses/supports several established standards and is flexible with existing architectures, providing technical accessibility and inclusivity for implementors. 

#### Proof of Concept

The original proof of concept involved 1) onboarding members to the network and 2) the verification of COVID certificates using the network. For more detail on execution of this proof of concept and results, [please follow this link.](https://www.lfph.io/2022/04/19/lfph-completes-the-proof-of-concept-of-its-gccn-trust-registry-network/)

#### Implementation Toolkit and Technical Specification

The UNDP project intends to develop and provide an implementation toolkit including an open source reference implementation for the specification, a governance and policy guideline for Regi-TRUST implementers, and technical and functional specifications. [Contents of the original implementation toolkit is stated here](https://www.lfph.io/2021/06/08/gccn/) ahead of completion of the pilot. Full technical specifications, implementation guides, and more are forthcoming.

### Trust Network Gateway

The Trust Network Gateway is an open source implementation of a centralized trust network solution available to potential implementers intending to create a local or regional network. This implementation is derived from the [European Union Digital COVID Certificate Gateway (EUDCCG)](https://github.com/ehn-dcc-development/eu-dcc-overview), which has been deployed in an operational setting within the European Union.

In addition to the core functionality of the EUDCCG, the Trust Network Gateway implementation also supports:
-	Federation and peer exchange of information between gateways
-	Access to metadata content (e.g. value sets/codings, business rules) with explicit adherence to the HL7 FHIR specification
-	Explicit means for revocation of digital COVID certificates
-	Optional support of online verification and validation workflows

The role of the Trust Network Gateway is to enable the creation of trust networks by additional
organizations beyond the EU Member States participating in the EUDCCG,
expanding the network of operators and trusted parties to form a federated and
documented network of trust gateways, supporting all major health credential certificates.

-	[Trust Network Gateway public repository](https://github.com/WorldHealthOrganization/ddcc-gateway)
-	[Architecture](./trust_gateway_architecture.html)
