# Artifact Index - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* **Artifact Index**

## Artifact Index

This page provides a list of the FHIR artifacts defined as part of this implementation guide.

### Requirements: Actor Definitions 

The following artifacts define the types of individuals and/or systems that will interact as part of the use cases covered by this implementation guide.

| | |
| :--- | :--- |
| [Holder](ActorDefinition-Holder.md) | A Holder is an individual that has Verifiable Digtial Health Certificate in their possesion, received from an Issuer. The Holder may choose to share the Verifiable Digital Health Certificate with a Receiver. |
| [Issuer](ActorDefinition-Issuer.md) | An Issuer a system authorized by a Trust Network Participant to generate Verifiable Digital Health Certificates which are provided to a Holder. An Issuer is responsible for generating the content that is digitally signed within the Verifiable Digital Health Certificate. In order to sign this content, an Issuer should either itself be a Document Signer or utilize a Document Signer service, as authorized by the jurisdicitonal policy. |
| [Receiver](ActorDefinition-Receiver.md) | A Reciever is a system authorized by a Trust Network Participant to receive from a Holder a Veritifable, verify and utilize the content within. |
| [Trust Network Anchor](ActorDefinition-TrustNetworkAnchor.md) | Trust Anchor which receives and distributes PKI-material within a Trust Network |
| [Trust Network Participant](ActorDefinition-TrustNetworkParticipant.md) | Trust Network Participant which publishes and or receives PKI-material within a Trust Network |

### Requirements: Formal Requirements 

The following artifacts describe the specific requirements to be met by systems compliant with the implementation guide.

| | |
| :--- | :--- |
| [Distribute CertLogic business rules](Requirements-DistributeBusinessRulesCertLogic.md) | Make received CertLoigc business rules available through a distrubution point to a Receiver |
| [Distribute FHIR business rules](Requirements-DistributeBusinessRulesFHIR.md) | Make received business rules available through a distrubution point to a Receiver through HL7 FHIR standards |
| [Distribute PKI material](Requirements-DistributePKIMaterial.md) | Make received trust material available through a distrubution point to a Trust Network Participant |
| [Distribute PKI material as DID](Requirements-DistributePKIMaterialDID.md) | Make received trust material available through a distrubution point to a Trust Network Participant as DID |
| [Distribute PKI material via API](Requirements-DistributePKIMaterialAPI.md) | Make received trust material available through a distrubution point to a Trust Network Participant via API |
| [Distribute business rules](Requirements-DistributeBusinessRules.md) | Make received business rules available through a distrubution point to a Receiver |
| [Issue Verifiable Digital Health Certificate](Requirements-IssuerVDHC.md) | Issue a Verifiable Digital Health Certificate to a Holder |
| [Provide Verifiable Digital Health Certificate](Requirements-ProvideVDHC.md) | Provide a Verifiable Digital Health Certificate to a Receiver |
| [Publish Cert Logic business rules](Requirements-PublishBusinessRulesCertLogic.md) | Publish Cert Logic business rules to a Trust Anchor |
| [Publish HL7 FHIR business rules](Requirements-PublishBusinessRulesFHIR.md) | Publish business rules to a Trust Anchor using HL7 FHIR |
| [Publish PKI material](Requirements-PublishPKIMaterial.md) | Publish trust material to a Trust Anchor |
| [Publish PKI material as DID](Requirements-PublishPKIMaterialDID.md) | Publish trust material to a Trust Anchor as DID |
| [Publish PKI material via API](Requirements-PublishPKIMaterialAPI.md) | Publish trust material to a Trust Anchor via API |
| [Publish business rules](Requirements-PublishBusinessRules.md) | Publish business rules to a Trust Anchor |
| [Receive CertLogic business rules](Requirements-ReceiveBusinessRulesCertLogic.md) | Receive CertLogic business rules from a Trust Network Participant, for distribution within the Trust Network |
| [Receive HL7 FHIR business rules](Requirements-ReceiveBusinessRulesFHIR.md) | Receive business rules from a Trust Network Participant, for distribution within the Trust Network using HL7 FHIR standard |
| [Receive PKI material](Requirements-ReceivePKUMaterial.md) | Receive trust material from a Trust Network Participant, for distribution within the Trust Network |
| [Receive PKI material as DID](Requirements-ReceivePKUMaterialDID.md) | Receive trust material from a Trust Network Participant, for distribution within the Trust Network as DID |
| [Receive PKI material via API](Requirements-ReceivePKUMaterialAPI.md) | Receive trust material from a Trust Network Participant, for distribution within the Trust Network via API |
| [Receive Verifiable Digital Health Certificate](Requirements-ReceiveVDHC.md) | Receive a Verifiable Digital Health Certificate from an Issuer |
| [Receive business rules](Requirements-ReceiveBusinessRules.md) | Receive business rules from a Trust Network Participant, for distribution within the Trust Network |
| [Request Verifiable Digital Health Certificate](Requirements-RequestVDHC.md) | Request a Verifiable Digital Health Certificate from an Issuer |
| [Retrieve Cert Logic compatible business rules](Requirements-RetrieveBusinessRulesCertLogic.md) | Retrieve Cert Logic business rules from a distribution point |
| [Retrieve HL7 FHIR compatible business rules](Requirements-RetrieveBusinessRulesFHIR.md) | Retrieve business rules from a distribution point using HL7 FHIR standards |
| [Retrieve PKI material](Requirements-RetrievePKIMaterial.md) | Retrieve PKI material from a distribution point |
| [Retrieve PKI material as DID](Requirements-RetrievePKIMaterialDID.md) | Retrieve PKI material from a distribution point as DID |
| [Retrieve PKI material via API](Requirements-RetrievePKIMaterialAPI.md) | Retrieve PKI material from a distribution point via API |
| [Retrieve business rules](Requirements-RetrieveBusinessRules.md) | Retrieve business rules from a distribution point using |
| [Utilize a Verifiable Digital Health Certificate](Requirements-UtilizeVDHC.md) | Utilize a Verifiable Digital Health Certificate that was provided by a Holder |

### Structures: Logical Models 

These define data models that represent the domain covered by this implementation guide in more business-friendly terms than the underlying FHIR resources.

| | |
| :--- | :--- |
| [CBOR Web Token (CWT) Claim](StructureDefinition-CWT.md) | Logical Model for Data elements in CBOR Web Token (CWT) https://www.iana.org/assignments/cwt/cwt.xhtml |
| [CBOR Web Token (CWT) Payload (Common)](StructureDefinition-CWTPayload.md) | Logical Model for CBOR Web Token (CWT) Payload Logical Modelin CWT Payload https://www.iana.org/assignments/cwt/cwt.xhtml |
| [COSE Headers (DRAFT)](StructureDefinition-COSEHeader.md) | Data elements for COSE Headers https://www.iana.org/assignments/cose/cose.xhtml#header-parameters |
| [Health Certificate](StructureDefinition-HCert.md) | Logical Model for the HCERT |
| [Scheme Information](StructureDefinition-SchemeInformation.md) | Logical Model for Information on the trusted list and its issuing scheme |

### Terminology: Value Sets 

These define sets of codes used by systems conforming to this implementation guide.

| | |
| :--- | :--- |
| [WHO GDHCN Key Usage ValueSet](ValueSet-KeyUsage.md) | ValueSet of codes for key usage codes for Production environment |
| [WHO GDHCN Key Usage ValueSet - DEV](ValueSet-KeyUsage-DEV.md) | ValueSet of codes for key usage codes for Development environment |
| [WHO GDHCN Key Usage ValueSet - UAT](ValueSet-KeyUsage-UAT.md) | ValueSet of codes for key usage codes for User Acceptance Testing environment |
| [WHO GDHCN Actor ValueSet of actor codes](ValueSet-Actors.md) | ValueSet of codes for actor codes |
| [WHO GDHCN Connection Types](ValueSet-ConnectionTypes.md) | ValueSet of GDHCN Trust Network Connection Types |
| [WHO GDHCN Payload Types](ValueSet-PayloadTypes.md) | ValueSet of GDHCN Trust Network Payload Types |
| [WHO GDHCN Transaction Codes](ValueSet-Transactions.md) | ValueSet of WHO GDHCN Transaction Codes |
| [WHO GDHCN Trust Domains](ValueSet-Domains.md) | ValueSet of WHO GDHCN Trust Domains for Production environment |
| [WHO GDHCN Trust Domains - DEV](ValueSet-Domains-DEV.md) | ValueSet of WHO GDHCN Trust Domains for Development environment |
| [WHO GDHCN Trust Domains - UAT](ValueSet-Domains-UAT.md) | ValueSet of WHO GDHCN Trust Domains for User Acceptance Testing environment |
| [WHO GDHCN Trust Network Participant](ValueSet-Participants.md) | ValueSet of GDHCN Trust Network Participants for Production environment |
| [WHO GDHCN Trust Network Participant - DEV](ValueSet-Participants-DEV.md) | ValueSet of GDHCN Trust Network Participants for Development environment |
| [WHO GDHCN Trust Network Participant - UAT](ValueSet-Participants-UAT.md) | ValueSet of GDHCN Trust Network Participants for User Acceptance Testing environment |

### Terminology: Code Systems 

These define new code systems used by systems conforming to this implementation guide.

| | |
| :--- | :--- |
| [WHO GDHCN Connection Types](CodeSystem-ConnectionTypes.md) | CodeSystem for GDHCN connection types |
| [WHO GDHCN Key Usage CodeSystem](CodeSystem-KeyUsage.md) | CodeSystem for GDHCN Key Usage that has usage codes for verification keys published to the Trust Network as defined by the[certificate governance](concepts_certificate_governance.md)for Production environment |
| [WHO GDHCN Key Usage CodeSystem - DEV](CodeSystem-KeyUsage-DEV.md) | CodeSystem for GDHCN Key Usage that has usage codes for verification keys published to the Trust Network as defined by the[certificate governance](concepts_certificate_governance.md)for Development environment |
| [WHO GDHCN Key Usage CodeSystem - UAT](CodeSystem-KeyUsage-UAT.md) | CodeSystem for GDHCN Key Usage that has usage codes for verification keys published to the Trust Network as defined by the[certificate governance](concepts_certificate_governance.md)for User Acceptance Testing environment |
| [WHO GDHCN Payload Types](CodeSystem-PayloadTypes.md) | CodeSystem for GDHCN Payload types |
| [WHO GDHCN Transactions CodeSystem](CodeSystem-Transactions.md) | CodeSystem for GDHCN transactions that has usage codes for verification keys published to the Trust Network as defined by the[certificate governance](concepts_certificate_governance.md) |
| [WHO GDHCN Trust Actors CodeSystem](CodeSystem-Actors.md) | CodeSystem for SMART Trust actors that has usage codes for verification keys published to the Trust Network as defined by the[certificate governance](concepts_certificate_governance.md) |
| [WHO GDHCN Trust Domains](CodeSystem-Domains.md) | CodeSystem for define WHO GDHCN Trust Domains for Production environment. |
| [WHO GDHCN Trust Domains - DEV](CodeSystem-Domains-DEV.md) | CodeSystem for define WHO GDHCN Trust Domains for Development environment. |
| [WHO GDHCN Trust Domains - UAT](CodeSystem-Domains-UAT.md) | CodeSystem for define WHO GDHCN Trust Domains for User Acceptance Testing environment. |
| [WHO GDHCN Trust Network Participant - DEV](CodeSystem-Participants-DEV.md) | CodeSystem for GDHCN Trust Network Participants for Development environment |
| [WHO GDHCN Trust Network Participant - UAT](CodeSystem-Participants-UAT.md) | CodeSystem for GDHCN Trust Network Participants for User Acceptance Testing environment |
| [WHO GDHCN Trust Network Participants CodeSystem](CodeSystem-Participants.md) | CodeSystem for GDHCN Trust Network Participants which are not already included in the ISO-3166 three letter code system for Production environment |
| [WHO RefMart Jurisidiction List](CodeSystem-RefMartCountryList.md) | CodeSystem for WHO Refmart Country and Jurisidiction List available at https://xmart-api-public.who.int/REFMART/REF_COUNTRY for Production environment |

### Other 

These are resources that are used within this implementation guide that do not fit into one of the other categories.

| | |
| :--- | :--- |
| [GDHCNParticipant-ALB](Organization-GDHCNParticipant-ALB.md) |  |
| [GDHCNParticipant-ALB-UAT](Organization-GDHCNParticipant-ALB-UAT.md) |  |
| [GDHCNParticipant-AND](Organization-GDHCNParticipant-AND.md) |  |
| [GDHCNParticipant-AND-DEV](Organization-GDHCNParticipant-AND-DEV.md) |  |
| [GDHCNParticipant-AND-UAT](Organization-GDHCNParticipant-AND-UAT.md) |  |
| [GDHCNParticipant-ARG-DEV](Organization-GDHCNParticipant-ARG-DEV.md) |  |
| [GDHCNParticipant-ARM](Organization-GDHCNParticipant-ARM.md) |  |
| [GDHCNParticipant-ARM-DEV](Organization-GDHCNParticipant-ARM-DEV.md) |  |
| [GDHCNParticipant-ARM-UAT](Organization-GDHCNParticipant-ARM-UAT.md) |  |
| [GDHCNParticipant-BEL](Organization-GDHCNParticipant-BEL.md) |  |
| [GDHCNParticipant-BEL-UAT](Organization-GDHCNParticipant-BEL-UAT.md) |  |
| [GDHCNParticipant-BEN](Organization-GDHCNParticipant-BEN.md) |  |
| [GDHCNParticipant-BEN-UAT](Organization-GDHCNParticipant-BEN-UAT.md) |  |
| [GDHCNParticipant-BHS-DEV](Organization-GDHCNParticipant-BHS-DEV.md) |  |
| [GDHCNParticipant-BLZ-DEV](Organization-GDHCNParticipant-BLZ-DEV.md) |  |
| [GDHCNParticipant-BRA](Organization-GDHCNParticipant-BRA.md) |  |
| [GDHCNParticipant-BRA-DEV](Organization-GDHCNParticipant-BRA-DEV.md) |  |
| [GDHCNParticipant-BRA-UAT](Organization-GDHCNParticipant-BRA-UAT.md) |  |
| [GDHCNParticipant-BRB-DEV](Organization-GDHCNParticipant-BRB-DEV.md) |  |
| [GDHCNParticipant-CAN-UAT](Organization-GDHCNParticipant-CAN-UAT.md) |  |
| [GDHCNParticipant-CHL-DEV](Organization-GDHCNParticipant-CHL-DEV.md) |  |
| [GDHCNParticipant-COL-DEV](Organization-GDHCNParticipant-COL-DEV.md) |  |
| [GDHCNParticipant-CRI-DEV](Organization-GDHCNParticipant-CRI-DEV.md) |  |
| [GDHCNParticipant-CYP](Organization-GDHCNParticipant-CYP.md) |  |
| [GDHCNParticipant-CYP-DEV](Organization-GDHCNParticipant-CYP-DEV.md) |  |
| [GDHCNParticipant-CYP-UAT](Organization-GDHCNParticipant-CYP-UAT.md) |  |
| [GDHCNParticipant-CZE](Organization-GDHCNParticipant-CZE.md) |  |
| [GDHCNParticipant-CZE-UAT](Organization-GDHCNParticipant-CZE-UAT.md) |  |
| [GDHCNParticipant-DOM-DEV](Organization-GDHCNParticipant-DOM-DEV.md) |  |
| [GDHCNParticipant-ECU-DEV](Organization-GDHCNParticipant-ECU-DEV.md) |  |
| [GDHCNParticipant-ESP](Organization-GDHCNParticipant-ESP.md) |  |
| [GDHCNParticipant-ESP-UAT](Organization-GDHCNParticipant-ESP-UAT.md) |  |
| [GDHCNParticipant-EST](Organization-GDHCNParticipant-EST.md) |  |
| [GDHCNParticipant-EST-DEV](Organization-GDHCNParticipant-EST-DEV.md) |  |
| [GDHCNParticipant-EST-UAT](Organization-GDHCNParticipant-EST-UAT.md) |  |
| [GDHCNParticipant-FIN](Organization-GDHCNParticipant-FIN.md) |  |
| [GDHCNParticipant-FIN-UAT](Organization-GDHCNParticipant-FIN-UAT.md) |  |
| [GDHCNParticipant-FRA](Organization-GDHCNParticipant-FRA.md) |  |
| [GDHCNParticipant-FRA-UAT](Organization-GDHCNParticipant-FRA-UAT.md) |  |
| [GDHCNParticipant-FRO](Organization-GDHCNParticipant-FRO.md) |  |
| [GDHCNParticipant-FRO-UAT](Organization-GDHCNParticipant-FRO-UAT.md) |  |
| [GDHCNParticipant-GTM-DEV](Organization-GDHCNParticipant-GTM-DEV.md) |  |
| [GDHCNParticipant-HND-DEV](Organization-GDHCNParticipant-HND-DEV.md) |  |
| [GDHCNParticipant-HRV-UAT](Organization-GDHCNParticipant-HRV-UAT.md) |  |
| [GDHCNParticipant-IDN](Organization-GDHCNParticipant-IDN.md) |  |
| [GDHCNParticipant-IDN-DEV](Organization-GDHCNParticipant-IDN-DEV.md) |  |
| [GDHCNParticipant-IDN-UAT](Organization-GDHCNParticipant-IDN-UAT.md) |  |
| [GDHCNParticipant-IRL](Organization-GDHCNParticipant-IRL.md) |  |
| [GDHCNParticipant-IRL-UAT](Organization-GDHCNParticipant-IRL-UAT.md) |  |
| [GDHCNParticipant-ISL](Organization-GDHCNParticipant-ISL.md) |  |
| [GDHCNParticipant-LTU](Organization-GDHCNParticipant-LTU.md) |  |
| [GDHCNParticipant-LTU-UAT](Organization-GDHCNParticipant-LTU-UAT.md) |  |
| [GDHCNParticipant-LVA](Organization-GDHCNParticipant-LVA.md) |  |
| [GDHCNParticipant-LVA-DEV](Organization-GDHCNParticipant-LVA-DEV.md) |  |
| [GDHCNParticipant-LVA-UAT](Organization-GDHCNParticipant-LVA-UAT.md) |  |
| [GDHCNParticipant-MCO](Organization-GDHCNParticipant-MCO.md) |  |
| [GDHCNParticipant-MCO-UAT](Organization-GDHCNParticipant-MCO-UAT.md) |  |
| [GDHCNParticipant-MLT](Organization-GDHCNParticipant-MLT.md) |  |
| [GDHCNParticipant-MLT-UAT](Organization-GDHCNParticipant-MLT-UAT.md) |  |
| [GDHCNParticipant-MYS](Organization-GDHCNParticipant-MYS.md) |  |
| [GDHCNParticipant-MYS-UAT](Organization-GDHCNParticipant-MYS-UAT.md) |  |
| [GDHCNParticipant-NLD](Organization-GDHCNParticipant-NLD.md) |  |
| [GDHCNParticipant-NLD-UAT](Organization-GDHCNParticipant-NLD-UAT.md) |  |
| [GDHCNParticipant-NZL](Organization-GDHCNParticipant-NZL.md) |  |
| [GDHCNParticipant-NZL-UAT](Organization-GDHCNParticipant-NZL-UAT.md) |  |
| [GDHCNParticipant-OMN](Organization-GDHCNParticipant-OMN.md) |  |
| [GDHCNParticipant-OMN-DEV](Organization-GDHCNParticipant-OMN-DEV.md) |  |
| [GDHCNParticipant-OMN-UAT](Organization-GDHCNParticipant-OMN-UAT.md) |  |
| [GDHCNParticipant-PAN-DEV](Organization-GDHCNParticipant-PAN-DEV.md) |  |
| [GDHCNParticipant-PER-DEV](Organization-GDHCNParticipant-PER-DEV.md) |  |
| [GDHCNParticipant-POL](Organization-GDHCNParticipant-POL.md) |  |
| [GDHCNParticipant-POL-UAT](Organization-GDHCNParticipant-POL-UAT.md) |  |
| [GDHCNParticipant-PRT](Organization-GDHCNParticipant-PRT.md) |  |
| [GDHCNParticipant-PRT-UAT](Organization-GDHCNParticipant-PRT-UAT.md) |  |
| [GDHCNParticipant-PRY-DEV](Organization-GDHCNParticipant-PRY-DEV.md) |  |
| [GDHCNParticipant-SAU-UAT](Organization-GDHCNParticipant-SAU-UAT.md) |  |
| [GDHCNParticipant-SGP](Organization-GDHCNParticipant-SGP.md) |  |
| [GDHCNParticipant-SGP-DEV](Organization-GDHCNParticipant-SGP-DEV.md) |  |
| [GDHCNParticipant-SGP-UAT](Organization-GDHCNParticipant-SGP-UAT.md) |  |
| [GDHCNParticipant-SLV-DEV](Organization-GDHCNParticipant-SLV-DEV.md) |  |
| [GDHCNParticipant-SMR](Organization-GDHCNParticipant-SMR.md) |  |
| [GDHCNParticipant-SMR-DEV](Organization-GDHCNParticipant-SMR-DEV.md) |  |
| [GDHCNParticipant-SMR-UAT](Organization-GDHCNParticipant-SMR-UAT.md) |  |
| [GDHCNParticipant-SUR-DEV](Organization-GDHCNParticipant-SUR-DEV.md) |  |
| [GDHCNParticipant-SVK](Organization-GDHCNParticipant-SVK.md) |  |
| [GDHCNParticipant-SVK-UAT](Organization-GDHCNParticipant-SVK-UAT.md) |  |
| [GDHCNParticipant-SVN](Organization-GDHCNParticipant-SVN.md) |  |
| [GDHCNParticipant-SVN-DEV](Organization-GDHCNParticipant-SVN-DEV.md) |  |
| [GDHCNParticipant-SVN-UAT](Organization-GDHCNParticipant-SVN-UAT.md) |  |
| [GDHCNParticipant-SWE](Organization-GDHCNParticipant-SWE.md) |  |
| [GDHCNParticipant-SWE-UAT](Organization-GDHCNParticipant-SWE-UAT.md) |  |
| [GDHCNParticipant-TGO](Organization-GDHCNParticipant-TGO.md) |  |
| [GDHCNParticipant-TGO-DEV](Organization-GDHCNParticipant-TGO-DEV.md) |  |
| [GDHCNParticipant-TGO-UAT](Organization-GDHCNParticipant-TGO-UAT.md) |  |
| [GDHCNParticipant-THA](Organization-GDHCNParticipant-THA.md) |  |
| [GDHCNParticipant-THA-UAT](Organization-GDHCNParticipant-THA-UAT.md) |  |
| [GDHCNParticipant-TUR](Organization-GDHCNParticipant-TUR.md) |  |
| [GDHCNParticipant-TUR-UAT](Organization-GDHCNParticipant-TUR-UAT.md) |  |
| [GDHCNParticipant-URY-DEV](Organization-GDHCNParticipant-URY-DEV.md) |  |
| [GDHCNParticipant-USA-DEV](Organization-GDHCNParticipant-USA-DEV.md) |  |
| [GDHCNParticipant-WHO](Organization-GDHCNParticipant-WHO.md) |  |
| [GDHCNParticipant-WHO-DEV](Organization-GDHCNParticipant-WHO-DEV.md) |  |
| [GDHCNParticipant-WHO-UAT](Organization-GDHCNParticipant-WHO-UAT.md) |  |
| [GDHCNParticipant-XCL-DEV](Organization-GDHCNParticipant-XCL-DEV.md) |  |
| [GDHCNParticipant-XML-DEV](Organization-GDHCNParticipant-XML-DEV.md) |  |
| [GDHCNParticipant-XXA-DEV](Organization-GDHCNParticipant-XXA-DEV.md) |  |
| [GDHCNParticipant-XXA-UAT](Organization-GDHCNParticipant-XXA-UAT.md) |  |
| [GDHCNParticipant-XXB-DEV](Organization-GDHCNParticipant-XXB-DEV.md) |  |
| [GDHCNParticipant-XXB-UAT](Organization-GDHCNParticipant-XXB-UAT.md) |  |
| [GDHCNParticipant-XXC-DEV](Organization-GDHCNParticipant-XXC-DEV.md) |  |
| [GDHCNParticipant-XXC-UAT](Organization-GDHCNParticipant-XXC-UAT.md) |  |
| [GDHCNParticipant-XXD-DEV](Organization-GDHCNParticipant-XXD-DEV.md) |  |
| [GDHCNParticipant-XXD-UAT](Organization-GDHCNParticipant-XXD-UAT.md) |  |
| [GDHCNParticipant-XXE-DEV](Organization-GDHCNParticipant-XXE-DEV.md) |  |
| [GDHCNParticipant-XXF-DEV](Organization-GDHCNParticipant-XXF-DEV.md) |  |
| [GDHCNParticipant-XXG-DEV](Organization-GDHCNParticipant-XXG-DEV.md) |  |
| [GDHCNParticipant-XXH-DEV](Organization-GDHCNParticipant-XXH-DEV.md) |  |
| [GDHCNParticipant-XXI-DEV](Organization-GDHCNParticipant-XXI-DEV.md) |  |
| [GDHCNParticipant-XXJ-DEV](Organization-GDHCNParticipant-XXJ-DEV.md) |  |
| [GDHCNParticipant-XXK-DEV](Organization-GDHCNParticipant-XXK-DEV.md) |  |
| [GDHCNParticipant-XXO-DEV](Organization-GDHCNParticipant-XXO-DEV.md) |  |
| [GDHCNParticipant-XXO-UAT](Organization-GDHCNParticipant-XXO-UAT.md) |  |
| [GDHCNParticipant-XXP-DEV](Organization-GDHCNParticipant-XXP-DEV.md) |  |
| [GDHCNParticipant-XXS-UAT](Organization-GDHCNParticipant-XXS-UAT.md) |  |
| [GDHCNParticipant-XXU-DEV](Organization-GDHCNParticipant-XXU-DEV.md) |  |
| [GDHCNParticipant-XXU-UAT](Organization-GDHCNParticipant-XXU-UAT.md) |  |
| [GDHCNParticipant-XXV-DEV](Organization-GDHCNParticipant-XXV-DEV.md) |  |
| [GDHCNParticipant-XXV-UAT](Organization-GDHCNParticipant-XXV-UAT.md) |  |
| [GDHCNParticipant-XXX-DEV](Organization-GDHCNParticipant-XXX-DEV.md) |  |
| [GDHCNParticipant-XXX-UAT](Organization-GDHCNParticipant-XXX-UAT.md) |  |
| [GDHCNParticipant-XYK-DEV](Organization-GDHCNParticipant-XYK-DEV.md) |  |
| [GDHCNParticipant-XYK-UAT](Organization-GDHCNParticipant-XYK-UAT.md) |  |
| [GDHCNParticipantDID-ALB-All](Endpoint-GDHCNParticipantDID-ALB-All.md) | Albania Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:ALB resolvable at https://tng-cdn.who.int/v2/trustlist/-/ALB/did.json |
| [GDHCNParticipantDID-ALB-DSC](Endpoint-GDHCNParticipantDID-ALB-DSC.md) |  |
| [GDHCNParticipantDID-ALB-SCA](Endpoint-GDHCNParticipantDID-ALB-SCA.md) |  |
| [GDHCNParticipantDID-ALB-UAT-All](Endpoint-GDHCNParticipantDID-ALB-UAT-All.md) | Albania Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:ALB resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/ALB/did.json |
| [GDHCNParticipantDID-ALB-UAT-DSC](Endpoint-GDHCNParticipantDID-ALB-UAT-DSC.md) |  |
| [GDHCNParticipantDID-ALB-UAT-SCA](Endpoint-GDHCNParticipantDID-ALB-UAT-SCA.md) |  |
| [GDHCNParticipantDID-AND-All](Endpoint-GDHCNParticipantDID-AND-All.md) | Andorra Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:AND resolvable at https://tng-cdn.who.int/v2/trustlist/-/AND/did.json |
| [GDHCNParticipantDID-AND-DEV-All](Endpoint-GDHCNParticipantDID-AND-DEV-All.md) | Andorra Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:AND resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/AND/did.json |
| [GDHCNParticipantDID-AND-DEV-DSC](Endpoint-GDHCNParticipantDID-AND-DEV-DSC.md) |  |
| [GDHCNParticipantDID-AND-DEV-SCA](Endpoint-GDHCNParticipantDID-AND-DEV-SCA.md) |  |
| [GDHCNParticipantDID-AND-DSC](Endpoint-GDHCNParticipantDID-AND-DSC.md) |  |
| [GDHCNParticipantDID-AND-SCA](Endpoint-GDHCNParticipantDID-AND-SCA.md) |  |
| [GDHCNParticipantDID-AND-UAT-All](Endpoint-GDHCNParticipantDID-AND-UAT-All.md) | Andorra Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:AND resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/AND/did.json |
| [GDHCNParticipantDID-AND-UAT-DSC](Endpoint-GDHCNParticipantDID-AND-UAT-DSC.md) |  |
| [GDHCNParticipantDID-AND-UAT-SCA](Endpoint-GDHCNParticipantDID-AND-UAT-SCA.md) |  |
| [GDHCNParticipantDID-ARG-DEV-All](Endpoint-GDHCNParticipantDID-ARG-DEV-All.md) | Argentina Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:ARG resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/ARG/did.json |
| [GDHCNParticipantDID-ARG-DEV-DSC](Endpoint-GDHCNParticipantDID-ARG-DEV-DSC.md) |  |
| [GDHCNParticipantDID-ARG-DEV-SCA](Endpoint-GDHCNParticipantDID-ARG-DEV-SCA.md) |  |
| [GDHCNParticipantDID-ARM-All](Endpoint-GDHCNParticipantDID-ARM-All.md) | Armenia Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:ARM resolvable at https://tng-cdn.who.int/v2/trustlist/-/ARM/did.json |
| [GDHCNParticipantDID-ARM-DEV-All](Endpoint-GDHCNParticipantDID-ARM-DEV-All.md) | Armenia Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:ARM resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/ARM/did.json |
| [GDHCNParticipantDID-ARM-DEV-DSC](Endpoint-GDHCNParticipantDID-ARM-DEV-DSC.md) |  |
| [GDHCNParticipantDID-ARM-DEV-SCA](Endpoint-GDHCNParticipantDID-ARM-DEV-SCA.md) |  |
| [GDHCNParticipantDID-ARM-DSC](Endpoint-GDHCNParticipantDID-ARM-DSC.md) |  |
| [GDHCNParticipantDID-ARM-SCA](Endpoint-GDHCNParticipantDID-ARM-SCA.md) |  |
| [GDHCNParticipantDID-ARM-UAT-All](Endpoint-GDHCNParticipantDID-ARM-UAT-All.md) | Armenia Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:ARM resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/ARM/did.json |
| [GDHCNParticipantDID-ARM-UAT-DSC](Endpoint-GDHCNParticipantDID-ARM-UAT-DSC.md) |  |
| [GDHCNParticipantDID-ARM-UAT-SCA](Endpoint-GDHCNParticipantDID-ARM-UAT-SCA.md) |  |
| [GDHCNParticipantDID-BEL-All](Endpoint-GDHCNParticipantDID-BEL-All.md) | Belgium Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:BEL resolvable at https://tng-cdn.who.int/v2/trustlist/-/BEL/did.json |
| [GDHCNParticipantDID-BEL-DSC](Endpoint-GDHCNParticipantDID-BEL-DSC.md) |  |
| [GDHCNParticipantDID-BEL-SCA](Endpoint-GDHCNParticipantDID-BEL-SCA.md) |  |
| [GDHCNParticipantDID-BEL-UAT-All](Endpoint-GDHCNParticipantDID-BEL-UAT-All.md) | Belgium Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:BEL resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/BEL/did.json |
| [GDHCNParticipantDID-BEL-UAT-DSC](Endpoint-GDHCNParticipantDID-BEL-UAT-DSC.md) |  |
| [GDHCNParticipantDID-BEL-UAT-SCA](Endpoint-GDHCNParticipantDID-BEL-UAT-SCA.md) |  |
| [GDHCNParticipantDID-BEN-All](Endpoint-GDHCNParticipantDID-BEN-All.md) | Benin Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:BEN resolvable at https://tng-cdn.who.int/v2/trustlist/-/BEN/did.json |
| [GDHCNParticipantDID-BEN-DSC](Endpoint-GDHCNParticipantDID-BEN-DSC.md) |  |
| [GDHCNParticipantDID-BEN-SCA](Endpoint-GDHCNParticipantDID-BEN-SCA.md) |  |
| [GDHCNParticipantDID-BEN-UAT-All](Endpoint-GDHCNParticipantDID-BEN-UAT-All.md) | Benin Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:BEN resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/BEN/did.json |
| [GDHCNParticipantDID-BEN-UAT-DSC](Endpoint-GDHCNParticipantDID-BEN-UAT-DSC.md) |  |
| [GDHCNParticipantDID-BEN-UAT-SCA](Endpoint-GDHCNParticipantDID-BEN-UAT-SCA.md) |  |
| [GDHCNParticipantDID-BHS-DEV-All](Endpoint-GDHCNParticipantDID-BHS-DEV-All.md) | Bahamas Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:BHS resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/BHS/did.json |
| [GDHCNParticipantDID-BHS-DEV-DSC](Endpoint-GDHCNParticipantDID-BHS-DEV-DSC.md) |  |
| [GDHCNParticipantDID-BHS-DEV-SCA](Endpoint-GDHCNParticipantDID-BHS-DEV-SCA.md) |  |
| [GDHCNParticipantDID-BLZ-DEV-All](Endpoint-GDHCNParticipantDID-BLZ-DEV-All.md) | Belize Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:BLZ resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/BLZ/did.json |
| [GDHCNParticipantDID-BLZ-DEV-DSC](Endpoint-GDHCNParticipantDID-BLZ-DEV-DSC.md) |  |
| [GDHCNParticipantDID-BLZ-DEV-SCA](Endpoint-GDHCNParticipantDID-BLZ-DEV-SCA.md) |  |
| [GDHCNParticipantDID-BRA-All](Endpoint-GDHCNParticipantDID-BRA-All.md) | Brazil Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:BRA resolvable at https://tng-cdn.who.int/v2/trustlist/-/BRA/did.json |
| [GDHCNParticipantDID-BRA-DEV-All](Endpoint-GDHCNParticipantDID-BRA-DEV-All.md) | Brazil Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:BRA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/BRA/did.json |
| [GDHCNParticipantDID-BRA-DEV-DSC](Endpoint-GDHCNParticipantDID-BRA-DEV-DSC.md) |  |
| [GDHCNParticipantDID-BRA-DEV-SCA](Endpoint-GDHCNParticipantDID-BRA-DEV-SCA.md) |  |
| [GDHCNParticipantDID-BRA-DSC](Endpoint-GDHCNParticipantDID-BRA-DSC.md) |  |
| [GDHCNParticipantDID-BRA-SCA](Endpoint-GDHCNParticipantDID-BRA-SCA.md) |  |
| [GDHCNParticipantDID-BRA-UAT-All](Endpoint-GDHCNParticipantDID-BRA-UAT-All.md) | Brazil Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:BRA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/BRA/did.json |
| [GDHCNParticipantDID-BRA-UAT-DSC](Endpoint-GDHCNParticipantDID-BRA-UAT-DSC.md) |  |
| [GDHCNParticipantDID-BRA-UAT-SCA](Endpoint-GDHCNParticipantDID-BRA-UAT-SCA.md) |  |
| [GDHCNParticipantDID-BRB-DEV-All](Endpoint-GDHCNParticipantDID-BRB-DEV-All.md) | Barbados Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:BRB resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/BRB/did.json |
| [GDHCNParticipantDID-BRB-DEV-DSC](Endpoint-GDHCNParticipantDID-BRB-DEV-DSC.md) |  |
| [GDHCNParticipantDID-BRB-DEV-SCA](Endpoint-GDHCNParticipantDID-BRB-DEV-SCA.md) |  |
| [GDHCNParticipantDID-CAN-UAT-All](Endpoint-GDHCNParticipantDID-CAN-UAT-All.md) | Canada Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:CAN resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/CAN/did.json |
| [GDHCNParticipantDID-CAN-UAT-DSC](Endpoint-GDHCNParticipantDID-CAN-UAT-DSC.md) |  |
| [GDHCNParticipantDID-CAN-UAT-SCA](Endpoint-GDHCNParticipantDID-CAN-UAT-SCA.md) |  |
| [GDHCNParticipantDID-CHL-DEV-All](Endpoint-GDHCNParticipantDID-CHL-DEV-All.md) | Chile Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:CHL resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/CHL/did.json |
| [GDHCNParticipantDID-CHL-DEV-DSC](Endpoint-GDHCNParticipantDID-CHL-DEV-DSC.md) |  |
| [GDHCNParticipantDID-CHL-DEV-SCA](Endpoint-GDHCNParticipantDID-CHL-DEV-SCA.md) |  |
| [GDHCNParticipantDID-COL-DEV-All](Endpoint-GDHCNParticipantDID-COL-DEV-All.md) | Colombia Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:COL resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/COL/did.json |
| [GDHCNParticipantDID-COL-DEV-DSC](Endpoint-GDHCNParticipantDID-COL-DEV-DSC.md) |  |
| [GDHCNParticipantDID-COL-DEV-SCA](Endpoint-GDHCNParticipantDID-COL-DEV-SCA.md) |  |
| [GDHCNParticipantDID-CRI-DEV-All](Endpoint-GDHCNParticipantDID-CRI-DEV-All.md) | Costa Rica Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:CRI resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/CRI/did.json |
| [GDHCNParticipantDID-CRI-DEV-DSC](Endpoint-GDHCNParticipantDID-CRI-DEV-DSC.md) |  |
| [GDHCNParticipantDID-CRI-DEV-SCA](Endpoint-GDHCNParticipantDID-CRI-DEV-SCA.md) |  |
| [GDHCNParticipantDID-CYP-All](Endpoint-GDHCNParticipantDID-CYP-All.md) | Cyprus Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:CYP resolvable at https://tng-cdn.who.int/v2/trustlist/-/CYP/did.json |
| [GDHCNParticipantDID-CYP-DEV-All](Endpoint-GDHCNParticipantDID-CYP-DEV-All.md) | Cyprus Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:CYP resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/CYP/did.json |
| [GDHCNParticipantDID-CYP-DEV-DSC](Endpoint-GDHCNParticipantDID-CYP-DEV-DSC.md) |  |
| [GDHCNParticipantDID-CYP-DEV-SCA](Endpoint-GDHCNParticipantDID-CYP-DEV-SCA.md) |  |
| [GDHCNParticipantDID-CYP-DSC](Endpoint-GDHCNParticipantDID-CYP-DSC.md) |  |
| [GDHCNParticipantDID-CYP-SCA](Endpoint-GDHCNParticipantDID-CYP-SCA.md) |  |
| [GDHCNParticipantDID-CYP-UAT-All](Endpoint-GDHCNParticipantDID-CYP-UAT-All.md) | Cyprus Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:CYP resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/CYP/did.json |
| [GDHCNParticipantDID-CYP-UAT-DSC](Endpoint-GDHCNParticipantDID-CYP-UAT-DSC.md) |  |
| [GDHCNParticipantDID-CYP-UAT-SCA](Endpoint-GDHCNParticipantDID-CYP-UAT-SCA.md) |  |
| [GDHCNParticipantDID-CZE-All](Endpoint-GDHCNParticipantDID-CZE-All.md) | Czechia Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:CZE resolvable at https://tng-cdn.who.int/v2/trustlist/-/CZE/did.json |
| [GDHCNParticipantDID-CZE-DSC](Endpoint-GDHCNParticipantDID-CZE-DSC.md) |  |
| [GDHCNParticipantDID-CZE-SCA](Endpoint-GDHCNParticipantDID-CZE-SCA.md) |  |
| [GDHCNParticipantDID-CZE-UAT-All](Endpoint-GDHCNParticipantDID-CZE-UAT-All.md) | Czechia Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:CZE resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/CZE/did.json |
| [GDHCNParticipantDID-CZE-UAT-DSC](Endpoint-GDHCNParticipantDID-CZE-UAT-DSC.md) |  |
| [GDHCNParticipantDID-CZE-UAT-SCA](Endpoint-GDHCNParticipantDID-CZE-UAT-SCA.md) |  |
| [GDHCNParticipantDID-DOM-DEV-All](Endpoint-GDHCNParticipantDID-DOM-DEV-All.md) | Dominican Republic Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:DOM resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/DOM/did.json |
| [GDHCNParticipantDID-DOM-DEV-DSC](Endpoint-GDHCNParticipantDID-DOM-DEV-DSC.md) |  |
| [GDHCNParticipantDID-DOM-DEV-SCA](Endpoint-GDHCNParticipantDID-DOM-DEV-SCA.md) |  |
| [GDHCNParticipantDID-ECU-DEV-All](Endpoint-GDHCNParticipantDID-ECU-DEV-All.md) | Ecuador Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:ECU resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/ECU/did.json |
| [GDHCNParticipantDID-ECU-DEV-DSC](Endpoint-GDHCNParticipantDID-ECU-DEV-DSC.md) |  |
| [GDHCNParticipantDID-ECU-DEV-SCA](Endpoint-GDHCNParticipantDID-ECU-DEV-SCA.md) |  |
| [GDHCNParticipantDID-ESP-All](Endpoint-GDHCNParticipantDID-ESP-All.md) | Spain Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:ESP resolvable at https://tng-cdn.who.int/v2/trustlist/-/ESP/did.json |
| [GDHCNParticipantDID-ESP-DSC](Endpoint-GDHCNParticipantDID-ESP-DSC.md) |  |
| [GDHCNParticipantDID-ESP-SCA](Endpoint-GDHCNParticipantDID-ESP-SCA.md) |  |
| [GDHCNParticipantDID-ESP-UAT-All](Endpoint-GDHCNParticipantDID-ESP-UAT-All.md) | Spain Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:ESP resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/ESP/did.json |
| [GDHCNParticipantDID-ESP-UAT-DSC](Endpoint-GDHCNParticipantDID-ESP-UAT-DSC.md) |  |
| [GDHCNParticipantDID-ESP-UAT-SCA](Endpoint-GDHCNParticipantDID-ESP-UAT-SCA.md) |  |
| [GDHCNParticipantDID-EST-All](Endpoint-GDHCNParticipantDID-EST-All.md) | Estonia Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:EST resolvable at https://tng-cdn.who.int/v2/trustlist/-/EST/did.json |
| [GDHCNParticipantDID-EST-DEV-All](Endpoint-GDHCNParticipantDID-EST-DEV-All.md) | Estonia Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:EST resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/EST/did.json |
| [GDHCNParticipantDID-EST-DEV-DSC](Endpoint-GDHCNParticipantDID-EST-DEV-DSC.md) |  |
| [GDHCNParticipantDID-EST-DEV-SCA](Endpoint-GDHCNParticipantDID-EST-DEV-SCA.md) |  |
| [GDHCNParticipantDID-EST-DSC](Endpoint-GDHCNParticipantDID-EST-DSC.md) |  |
| [GDHCNParticipantDID-EST-SCA](Endpoint-GDHCNParticipantDID-EST-SCA.md) |  |
| [GDHCNParticipantDID-EST-UAT-All](Endpoint-GDHCNParticipantDID-EST-UAT-All.md) | Estonia Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:EST resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/EST/did.json |
| [GDHCNParticipantDID-EST-UAT-DSC](Endpoint-GDHCNParticipantDID-EST-UAT-DSC.md) |  |
| [GDHCNParticipantDID-EST-UAT-SCA](Endpoint-GDHCNParticipantDID-EST-UAT-SCA.md) |  |
| [GDHCNParticipantDID-FIN-All](Endpoint-GDHCNParticipantDID-FIN-All.md) | Finland Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:FIN resolvable at https://tng-cdn.who.int/v2/trustlist/-/FIN/did.json |
| [GDHCNParticipantDID-FIN-DSC](Endpoint-GDHCNParticipantDID-FIN-DSC.md) |  |
| [GDHCNParticipantDID-FIN-SCA](Endpoint-GDHCNParticipantDID-FIN-SCA.md) |  |
| [GDHCNParticipantDID-FIN-UAT-All](Endpoint-GDHCNParticipantDID-FIN-UAT-All.md) | Finland Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:FIN resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/FIN/did.json |
| [GDHCNParticipantDID-FIN-UAT-DSC](Endpoint-GDHCNParticipantDID-FIN-UAT-DSC.md) |  |
| [GDHCNParticipantDID-FIN-UAT-SCA](Endpoint-GDHCNParticipantDID-FIN-UAT-SCA.md) |  |
| [GDHCNParticipantDID-FRA-All](Endpoint-GDHCNParticipantDID-FRA-All.md) | France Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:FRA resolvable at https://tng-cdn.who.int/v2/trustlist/-/FRA/did.json |
| [GDHCNParticipantDID-FRA-DSC](Endpoint-GDHCNParticipantDID-FRA-DSC.md) |  |
| [GDHCNParticipantDID-FRA-SCA](Endpoint-GDHCNParticipantDID-FRA-SCA.md) |  |
| [GDHCNParticipantDID-FRA-UAT-All](Endpoint-GDHCNParticipantDID-FRA-UAT-All.md) | France Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:FRA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/FRA/did.json |
| [GDHCNParticipantDID-FRA-UAT-DSC](Endpoint-GDHCNParticipantDID-FRA-UAT-DSC.md) |  |
| [GDHCNParticipantDID-FRA-UAT-SCA](Endpoint-GDHCNParticipantDID-FRA-UAT-SCA.md) |  |
| [GDHCNParticipantDID-FRO-All](Endpoint-GDHCNParticipantDID-FRO-All.md) | Faroe Islands Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:FRO resolvable at https://tng-cdn.who.int/v2/trustlist/-/FRO/did.json |
| [GDHCNParticipantDID-FRO-DSC](Endpoint-GDHCNParticipantDID-FRO-DSC.md) |  |
| [GDHCNParticipantDID-FRO-SCA](Endpoint-GDHCNParticipantDID-FRO-SCA.md) |  |
| [GDHCNParticipantDID-FRO-UAT-All](Endpoint-GDHCNParticipantDID-FRO-UAT-All.md) | Faroe Islands Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:FRO resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/FRO/did.json |
| [GDHCNParticipantDID-FRO-UAT-DSC](Endpoint-GDHCNParticipantDID-FRO-UAT-DSC.md) |  |
| [GDHCNParticipantDID-FRO-UAT-SCA](Endpoint-GDHCNParticipantDID-FRO-UAT-SCA.md) |  |
| [GDHCNParticipantDID-GTM-DEV-All](Endpoint-GDHCNParticipantDID-GTM-DEV-All.md) | Guatemala Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:GTM resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/GTM/did.json |
| [GDHCNParticipantDID-GTM-DEV-DSC](Endpoint-GDHCNParticipantDID-GTM-DEV-DSC.md) |  |
| [GDHCNParticipantDID-GTM-DEV-SCA](Endpoint-GDHCNParticipantDID-GTM-DEV-SCA.md) |  |
| [GDHCNParticipantDID-HND-DEV-All](Endpoint-GDHCNParticipantDID-HND-DEV-All.md) | Honduras Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:HND resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/HND/did.json |
| [GDHCNParticipantDID-HND-DEV-DSC](Endpoint-GDHCNParticipantDID-HND-DEV-DSC.md) |  |
| [GDHCNParticipantDID-HND-DEV-SCA](Endpoint-GDHCNParticipantDID-HND-DEV-SCA.md) |  |
| [GDHCNParticipantDID-HRV-UAT-All](Endpoint-GDHCNParticipantDID-HRV-UAT-All.md) | Croatia Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:HRV resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/HRV/did.json |
| [GDHCNParticipantDID-HRV-UAT-DSC](Endpoint-GDHCNParticipantDID-HRV-UAT-DSC.md) |  |
| [GDHCNParticipantDID-HRV-UAT-SCA](Endpoint-GDHCNParticipantDID-HRV-UAT-SCA.md) |  |
| [GDHCNParticipantDID-IDN-All](Endpoint-GDHCNParticipantDID-IDN-All.md) | Indonesia Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:IDN resolvable at https://tng-cdn.who.int/v2/trustlist/-/IDN/did.json |
| [GDHCNParticipantDID-IDN-DEV-All](Endpoint-GDHCNParticipantDID-IDN-DEV-All.md) | Indonesia Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:IDN resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/IDN/did.json |
| [GDHCNParticipantDID-IDN-DEV-DSC](Endpoint-GDHCNParticipantDID-IDN-DEV-DSC.md) |  |
| [GDHCNParticipantDID-IDN-DEV-SCA](Endpoint-GDHCNParticipantDID-IDN-DEV-SCA.md) |  |
| [GDHCNParticipantDID-IDN-DSC](Endpoint-GDHCNParticipantDID-IDN-DSC.md) |  |
| [GDHCNParticipantDID-IDN-SCA](Endpoint-GDHCNParticipantDID-IDN-SCA.md) |  |
| [GDHCNParticipantDID-IDN-UAT-All](Endpoint-GDHCNParticipantDID-IDN-UAT-All.md) | Indonesia Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:IDN resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/IDN/did.json |
| [GDHCNParticipantDID-IDN-UAT-DSC](Endpoint-GDHCNParticipantDID-IDN-UAT-DSC.md) |  |
| [GDHCNParticipantDID-IDN-UAT-SCA](Endpoint-GDHCNParticipantDID-IDN-UAT-SCA.md) |  |
| [GDHCNParticipantDID-IRL-All](Endpoint-GDHCNParticipantDID-IRL-All.md) | Ireland Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:IRL resolvable at https://tng-cdn.who.int/v2/trustlist/-/IRL/did.json |
| [GDHCNParticipantDID-IRL-DSC](Endpoint-GDHCNParticipantDID-IRL-DSC.md) |  |
| [GDHCNParticipantDID-IRL-SCA](Endpoint-GDHCNParticipantDID-IRL-SCA.md) |  |
| [GDHCNParticipantDID-IRL-UAT-All](Endpoint-GDHCNParticipantDID-IRL-UAT-All.md) | Ireland Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:IRL resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/IRL/did.json |
| [GDHCNParticipantDID-IRL-UAT-DSC](Endpoint-GDHCNParticipantDID-IRL-UAT-DSC.md) |  |
| [GDHCNParticipantDID-IRL-UAT-SCA](Endpoint-GDHCNParticipantDID-IRL-UAT-SCA.md) |  |
| [GDHCNParticipantDID-ISL-All](Endpoint-GDHCNParticipantDID-ISL-All.md) | Iceland Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:ISL resolvable at https://tng-cdn.who.int/v2/trustlist/-/ISL/did.json |
| [GDHCNParticipantDID-ISL-DSC](Endpoint-GDHCNParticipantDID-ISL-DSC.md) |  |
| [GDHCNParticipantDID-ISL-SCA](Endpoint-GDHCNParticipantDID-ISL-SCA.md) |  |
| [GDHCNParticipantDID-LTU-All](Endpoint-GDHCNParticipantDID-LTU-All.md) | Lithuania Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:LTU resolvable at https://tng-cdn.who.int/v2/trustlist/-/LTU/did.json |
| [GDHCNParticipantDID-LTU-DSC](Endpoint-GDHCNParticipantDID-LTU-DSC.md) |  |
| [GDHCNParticipantDID-LTU-SCA](Endpoint-GDHCNParticipantDID-LTU-SCA.md) |  |
| [GDHCNParticipantDID-LTU-UAT-All](Endpoint-GDHCNParticipantDID-LTU-UAT-All.md) | Lithuania Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:LTU resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/LTU/did.json |
| [GDHCNParticipantDID-LTU-UAT-DSC](Endpoint-GDHCNParticipantDID-LTU-UAT-DSC.md) |  |
| [GDHCNParticipantDID-LTU-UAT-SCA](Endpoint-GDHCNParticipantDID-LTU-UAT-SCA.md) |  |
| [GDHCNParticipantDID-LVA-All](Endpoint-GDHCNParticipantDID-LVA-All.md) | Latvia Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:LVA resolvable at https://tng-cdn.who.int/v2/trustlist/-/LVA/did.json |
| [GDHCNParticipantDID-LVA-DEV-All](Endpoint-GDHCNParticipantDID-LVA-DEV-All.md) | Latvia Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:LVA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/LVA/did.json |
| [GDHCNParticipantDID-LVA-DEV-DSC](Endpoint-GDHCNParticipantDID-LVA-DEV-DSC.md) |  |
| [GDHCNParticipantDID-LVA-DEV-SCA](Endpoint-GDHCNParticipantDID-LVA-DEV-SCA.md) |  |
| [GDHCNParticipantDID-LVA-DSC](Endpoint-GDHCNParticipantDID-LVA-DSC.md) |  |
| [GDHCNParticipantDID-LVA-SCA](Endpoint-GDHCNParticipantDID-LVA-SCA.md) |  |
| [GDHCNParticipantDID-LVA-UAT-All](Endpoint-GDHCNParticipantDID-LVA-UAT-All.md) | Latvia Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:LVA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/LVA/did.json |
| [GDHCNParticipantDID-LVA-UAT-DSC](Endpoint-GDHCNParticipantDID-LVA-UAT-DSC.md) |  |
| [GDHCNParticipantDID-LVA-UAT-SCA](Endpoint-GDHCNParticipantDID-LVA-UAT-SCA.md) |  |
| [GDHCNParticipantDID-MCO-All](Endpoint-GDHCNParticipantDID-MCO-All.md) | Monaco Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:MCO resolvable at https://tng-cdn.who.int/v2/trustlist/-/MCO/did.json |
| [GDHCNParticipantDID-MCO-DSC](Endpoint-GDHCNParticipantDID-MCO-DSC.md) |  |
| [GDHCNParticipantDID-MCO-SCA](Endpoint-GDHCNParticipantDID-MCO-SCA.md) |  |
| [GDHCNParticipantDID-MCO-UAT-All](Endpoint-GDHCNParticipantDID-MCO-UAT-All.md) | Monaco Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:MCO resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/MCO/did.json |
| [GDHCNParticipantDID-MCO-UAT-DSC](Endpoint-GDHCNParticipantDID-MCO-UAT-DSC.md) |  |
| [GDHCNParticipantDID-MCO-UAT-SCA](Endpoint-GDHCNParticipantDID-MCO-UAT-SCA.md) |  |
| [GDHCNParticipantDID-MLT-All](Endpoint-GDHCNParticipantDID-MLT-All.md) | Malta Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:MLT resolvable at https://tng-cdn.who.int/v2/trustlist/-/MLT/did.json |
| [GDHCNParticipantDID-MLT-DSC](Endpoint-GDHCNParticipantDID-MLT-DSC.md) |  |
| [GDHCNParticipantDID-MLT-SCA](Endpoint-GDHCNParticipantDID-MLT-SCA.md) |  |
| [GDHCNParticipantDID-MLT-UAT-All](Endpoint-GDHCNParticipantDID-MLT-UAT-All.md) | Malta Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:MLT resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/MLT/did.json |
| [GDHCNParticipantDID-MLT-UAT-DSC](Endpoint-GDHCNParticipantDID-MLT-UAT-DSC.md) |  |
| [GDHCNParticipantDID-MLT-UAT-SCA](Endpoint-GDHCNParticipantDID-MLT-UAT-SCA.md) |  |
| [GDHCNParticipantDID-MYS-All](Endpoint-GDHCNParticipantDID-MYS-All.md) | Malaysia Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:MYS resolvable at https://tng-cdn.who.int/v2/trustlist/-/MYS/did.json |
| [GDHCNParticipantDID-MYS-DSC](Endpoint-GDHCNParticipantDID-MYS-DSC.md) |  |
| [GDHCNParticipantDID-MYS-SCA](Endpoint-GDHCNParticipantDID-MYS-SCA.md) |  |
| [GDHCNParticipantDID-MYS-UAT-All](Endpoint-GDHCNParticipantDID-MYS-UAT-All.md) | Malaysia Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:MYS resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/MYS/did.json |
| [GDHCNParticipantDID-MYS-UAT-DSC](Endpoint-GDHCNParticipantDID-MYS-UAT-DSC.md) |  |
| [GDHCNParticipantDID-MYS-UAT-SCA](Endpoint-GDHCNParticipantDID-MYS-UAT-SCA.md) |  |
| [GDHCNParticipantDID-NLD-All](Endpoint-GDHCNParticipantDID-NLD-All.md) | Netherlands (Kingdom of the) Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:NLD resolvable at https://tng-cdn.who.int/v2/trustlist/-/NLD/did.json |
| [GDHCNParticipantDID-NLD-DSC](Endpoint-GDHCNParticipantDID-NLD-DSC.md) |  |
| [GDHCNParticipantDID-NLD-SCA](Endpoint-GDHCNParticipantDID-NLD-SCA.md) |  |
| [GDHCNParticipantDID-NLD-UAT-All](Endpoint-GDHCNParticipantDID-NLD-UAT-All.md) | Netherlands (Kingdom of the) Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:NLD resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/NLD/did.json |
| [GDHCNParticipantDID-NLD-UAT-DSC](Endpoint-GDHCNParticipantDID-NLD-UAT-DSC.md) |  |
| [GDHCNParticipantDID-NLD-UAT-SCA](Endpoint-GDHCNParticipantDID-NLD-UAT-SCA.md) |  |
| [GDHCNParticipantDID-NZL-All](Endpoint-GDHCNParticipantDID-NZL-All.md) | New Zealand Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:NZL resolvable at https://tng-cdn.who.int/v2/trustlist/-/NZL/did.json |
| [GDHCNParticipantDID-NZL-DSC](Endpoint-GDHCNParticipantDID-NZL-DSC.md) |  |
| [GDHCNParticipantDID-NZL-SCA](Endpoint-GDHCNParticipantDID-NZL-SCA.md) |  |
| [GDHCNParticipantDID-NZL-UAT-All](Endpoint-GDHCNParticipantDID-NZL-UAT-All.md) | New Zealand Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:NZL resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/NZL/did.json |
| [GDHCNParticipantDID-NZL-UAT-DSC](Endpoint-GDHCNParticipantDID-NZL-UAT-DSC.md) |  |
| [GDHCNParticipantDID-NZL-UAT-SCA](Endpoint-GDHCNParticipantDID-NZL-UAT-SCA.md) |  |
| [GDHCNParticipantDID-OMN-All](Endpoint-GDHCNParticipantDID-OMN-All.md) | Oman Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:OMN resolvable at https://tng-cdn.who.int/v2/trustlist/-/OMN/did.json |
| [GDHCNParticipantDID-OMN-DEV-All](Endpoint-GDHCNParticipantDID-OMN-DEV-All.md) | Oman Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:OMN resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/OMN/did.json |
| [GDHCNParticipantDID-OMN-DEV-DSC](Endpoint-GDHCNParticipantDID-OMN-DEV-DSC.md) |  |
| [GDHCNParticipantDID-OMN-DEV-SCA](Endpoint-GDHCNParticipantDID-OMN-DEV-SCA.md) |  |
| [GDHCNParticipantDID-OMN-DSC](Endpoint-GDHCNParticipantDID-OMN-DSC.md) |  |
| [GDHCNParticipantDID-OMN-SCA](Endpoint-GDHCNParticipantDID-OMN-SCA.md) |  |
| [GDHCNParticipantDID-OMN-UAT-All](Endpoint-GDHCNParticipantDID-OMN-UAT-All.md) | Oman Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:OMN resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/OMN/did.json |
| [GDHCNParticipantDID-OMN-UAT-DSC](Endpoint-GDHCNParticipantDID-OMN-UAT-DSC.md) |  |
| [GDHCNParticipantDID-OMN-UAT-SCA](Endpoint-GDHCNParticipantDID-OMN-UAT-SCA.md) |  |
| [GDHCNParticipantDID-PAN-DEV-All](Endpoint-GDHCNParticipantDID-PAN-DEV-All.md) | Panama Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:PAN resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/PAN/did.json |
| [GDHCNParticipantDID-PAN-DEV-DSC](Endpoint-GDHCNParticipantDID-PAN-DEV-DSC.md) |  |
| [GDHCNParticipantDID-PAN-DEV-SCA](Endpoint-GDHCNParticipantDID-PAN-DEV-SCA.md) |  |
| [GDHCNParticipantDID-PER-DEV-All](Endpoint-GDHCNParticipantDID-PER-DEV-All.md) | Peru Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:PER resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/PER/did.json |
| [GDHCNParticipantDID-PER-DEV-DSC](Endpoint-GDHCNParticipantDID-PER-DEV-DSC.md) |  |
| [GDHCNParticipantDID-PER-DEV-SCA](Endpoint-GDHCNParticipantDID-PER-DEV-SCA.md) |  |
| [GDHCNParticipantDID-POL-All](Endpoint-GDHCNParticipantDID-POL-All.md) | Poland Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:POL resolvable at https://tng-cdn.who.int/v2/trustlist/-/POL/did.json |
| [GDHCNParticipantDID-POL-DSC](Endpoint-GDHCNParticipantDID-POL-DSC.md) |  |
| [GDHCNParticipantDID-POL-SCA](Endpoint-GDHCNParticipantDID-POL-SCA.md) |  |
| [GDHCNParticipantDID-POL-UAT-All](Endpoint-GDHCNParticipantDID-POL-UAT-All.md) | Poland Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:POL resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/POL/did.json |
| [GDHCNParticipantDID-POL-UAT-DSC](Endpoint-GDHCNParticipantDID-POL-UAT-DSC.md) |  |
| [GDHCNParticipantDID-POL-UAT-SCA](Endpoint-GDHCNParticipantDID-POL-UAT-SCA.md) |  |
| [GDHCNParticipantDID-PRT-All](Endpoint-GDHCNParticipantDID-PRT-All.md) | Portugal Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:PRT resolvable at https://tng-cdn.who.int/v2/trustlist/-/PRT/did.json |
| [GDHCNParticipantDID-PRT-DSC](Endpoint-GDHCNParticipantDID-PRT-DSC.md) |  |
| [GDHCNParticipantDID-PRT-SCA](Endpoint-GDHCNParticipantDID-PRT-SCA.md) |  |
| [GDHCNParticipantDID-PRT-UAT-All](Endpoint-GDHCNParticipantDID-PRT-UAT-All.md) | Portugal Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:PRT resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/PRT/did.json |
| [GDHCNParticipantDID-PRT-UAT-DSC](Endpoint-GDHCNParticipantDID-PRT-UAT-DSC.md) |  |
| [GDHCNParticipantDID-PRT-UAT-SCA](Endpoint-GDHCNParticipantDID-PRT-UAT-SCA.md) |  |
| [GDHCNParticipantDID-PRY-DEV-All](Endpoint-GDHCNParticipantDID-PRY-DEV-All.md) | Paraguay Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:PRY resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/PRY/did.json |
| [GDHCNParticipantDID-PRY-DEV-DSC](Endpoint-GDHCNParticipantDID-PRY-DEV-DSC.md) |  |
| [GDHCNParticipantDID-PRY-DEV-SCA](Endpoint-GDHCNParticipantDID-PRY-DEV-SCA.md) |  |
| [GDHCNParticipantDID-SAU-UAT-All](Endpoint-GDHCNParticipantDID-SAU-UAT-All.md) | Saudi Arabia Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:SAU resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/SAU/did.json |
| [GDHCNParticipantDID-SAU-UAT-DSC](Endpoint-GDHCNParticipantDID-SAU-UAT-DSC.md) |  |
| [GDHCNParticipantDID-SAU-UAT-SCA](Endpoint-GDHCNParticipantDID-SAU-UAT-SCA.md) |  |
| [GDHCNParticipantDID-SGP-All](Endpoint-GDHCNParticipantDID-SGP-All.md) | Singapore Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:SGP resolvable at https://tng-cdn.who.int/v2/trustlist/-/SGP/did.json |
| [GDHCNParticipantDID-SGP-DEV-All](Endpoint-GDHCNParticipantDID-SGP-DEV-All.md) | Singapore Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:SGP resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/SGP/did.json |
| [GDHCNParticipantDID-SGP-DEV-DSC](Endpoint-GDHCNParticipantDID-SGP-DEV-DSC.md) |  |
| [GDHCNParticipantDID-SGP-DEV-SCA](Endpoint-GDHCNParticipantDID-SGP-DEV-SCA.md) |  |
| [GDHCNParticipantDID-SGP-DSC](Endpoint-GDHCNParticipantDID-SGP-DSC.md) |  |
| [GDHCNParticipantDID-SGP-SCA](Endpoint-GDHCNParticipantDID-SGP-SCA.md) |  |
| [GDHCNParticipantDID-SGP-UAT-All](Endpoint-GDHCNParticipantDID-SGP-UAT-All.md) | Singapore Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:SGP resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/SGP/did.json |
| [GDHCNParticipantDID-SGP-UAT-DSC](Endpoint-GDHCNParticipantDID-SGP-UAT-DSC.md) |  |
| [GDHCNParticipantDID-SGP-UAT-SCA](Endpoint-GDHCNParticipantDID-SGP-UAT-SCA.md) |  |
| [GDHCNParticipantDID-SLV-DEV-All](Endpoint-GDHCNParticipantDID-SLV-DEV-All.md) | El Salvador Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:SLV resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/SLV/did.json |
| [GDHCNParticipantDID-SLV-DEV-DSC](Endpoint-GDHCNParticipantDID-SLV-DEV-DSC.md) |  |
| [GDHCNParticipantDID-SLV-DEV-SCA](Endpoint-GDHCNParticipantDID-SLV-DEV-SCA.md) |  |
| [GDHCNParticipantDID-SMR-All](Endpoint-GDHCNParticipantDID-SMR-All.md) | San Marino Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:SMR resolvable at https://tng-cdn.who.int/v2/trustlist/-/SMR/did.json |
| [GDHCNParticipantDID-SMR-DEV-All](Endpoint-GDHCNParticipantDID-SMR-DEV-All.md) | San Marino Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:SMR resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/SMR/did.json |
| [GDHCNParticipantDID-SMR-DEV-DSC](Endpoint-GDHCNParticipantDID-SMR-DEV-DSC.md) |  |
| [GDHCNParticipantDID-SMR-DEV-SCA](Endpoint-GDHCNParticipantDID-SMR-DEV-SCA.md) |  |
| [GDHCNParticipantDID-SMR-DSC](Endpoint-GDHCNParticipantDID-SMR-DSC.md) |  |
| [GDHCNParticipantDID-SMR-SCA](Endpoint-GDHCNParticipantDID-SMR-SCA.md) |  |
| [GDHCNParticipantDID-SMR-UAT-All](Endpoint-GDHCNParticipantDID-SMR-UAT-All.md) | San Marino Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:SMR resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/SMR/did.json |
| [GDHCNParticipantDID-SMR-UAT-DSC](Endpoint-GDHCNParticipantDID-SMR-UAT-DSC.md) |  |
| [GDHCNParticipantDID-SMR-UAT-SCA](Endpoint-GDHCNParticipantDID-SMR-UAT-SCA.md) |  |
| [GDHCNParticipantDID-SUR-DEV-All](Endpoint-GDHCNParticipantDID-SUR-DEV-All.md) | Suriname Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:SUR resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/SUR/did.json |
| [GDHCNParticipantDID-SUR-DEV-DSC](Endpoint-GDHCNParticipantDID-SUR-DEV-DSC.md) |  |
| [GDHCNParticipantDID-SUR-DEV-SCA](Endpoint-GDHCNParticipantDID-SUR-DEV-SCA.md) |  |
| [GDHCNParticipantDID-SVK-All](Endpoint-GDHCNParticipantDID-SVK-All.md) | Slovakia Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:SVK resolvable at https://tng-cdn.who.int/v2/trustlist/-/SVK/did.json |
| [GDHCNParticipantDID-SVK-DSC](Endpoint-GDHCNParticipantDID-SVK-DSC.md) |  |
| [GDHCNParticipantDID-SVK-SCA](Endpoint-GDHCNParticipantDID-SVK-SCA.md) |  |
| [GDHCNParticipantDID-SVK-UAT-All](Endpoint-GDHCNParticipantDID-SVK-UAT-All.md) | Slovakia Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:SVK resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/SVK/did.json |
| [GDHCNParticipantDID-SVK-UAT-DSC](Endpoint-GDHCNParticipantDID-SVK-UAT-DSC.md) |  |
| [GDHCNParticipantDID-SVK-UAT-SCA](Endpoint-GDHCNParticipantDID-SVK-UAT-SCA.md) |  |
| [GDHCNParticipantDID-SVN-All](Endpoint-GDHCNParticipantDID-SVN-All.md) | Slovenia Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:SVN resolvable at https://tng-cdn.who.int/v2/trustlist/-/SVN/did.json |
| [GDHCNParticipantDID-SVN-DEV-All](Endpoint-GDHCNParticipantDID-SVN-DEV-All.md) | Slovenia Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:SVN resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/SVN/did.json |
| [GDHCNParticipantDID-SVN-DEV-DSC](Endpoint-GDHCNParticipantDID-SVN-DEV-DSC.md) |  |
| [GDHCNParticipantDID-SVN-DEV-SCA](Endpoint-GDHCNParticipantDID-SVN-DEV-SCA.md) |  |
| [GDHCNParticipantDID-SVN-DSC](Endpoint-GDHCNParticipantDID-SVN-DSC.md) |  |
| [GDHCNParticipantDID-SVN-SCA](Endpoint-GDHCNParticipantDID-SVN-SCA.md) |  |
| [GDHCNParticipantDID-SVN-UAT-All](Endpoint-GDHCNParticipantDID-SVN-UAT-All.md) | Slovenia Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:SVN resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/SVN/did.json |
| [GDHCNParticipantDID-SVN-UAT-DSC](Endpoint-GDHCNParticipantDID-SVN-UAT-DSC.md) |  |
| [GDHCNParticipantDID-SVN-UAT-SCA](Endpoint-GDHCNParticipantDID-SVN-UAT-SCA.md) |  |
| [GDHCNParticipantDID-SWE-All](Endpoint-GDHCNParticipantDID-SWE-All.md) | Sweden Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:SWE resolvable at https://tng-cdn.who.int/v2/trustlist/-/SWE/did.json |
| [GDHCNParticipantDID-SWE-DSC](Endpoint-GDHCNParticipantDID-SWE-DSC.md) |  |
| [GDHCNParticipantDID-SWE-SCA](Endpoint-GDHCNParticipantDID-SWE-SCA.md) |  |
| [GDHCNParticipantDID-SWE-UAT-All](Endpoint-GDHCNParticipantDID-SWE-UAT-All.md) | Sweden Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:SWE resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/SWE/did.json |
| [GDHCNParticipantDID-SWE-UAT-DSC](Endpoint-GDHCNParticipantDID-SWE-UAT-DSC.md) |  |
| [GDHCNParticipantDID-SWE-UAT-SCA](Endpoint-GDHCNParticipantDID-SWE-UAT-SCA.md) |  |
| [GDHCNParticipantDID-TGO-All](Endpoint-GDHCNParticipantDID-TGO-All.md) | Togo Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:TGO resolvable at https://tng-cdn.who.int/v2/trustlist/-/TGO/did.json |
| [GDHCNParticipantDID-TGO-DEV-All](Endpoint-GDHCNParticipantDID-TGO-DEV-All.md) | Togo Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:TGO resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/TGO/did.json |
| [GDHCNParticipantDID-TGO-DEV-DSC](Endpoint-GDHCNParticipantDID-TGO-DEV-DSC.md) |  |
| [GDHCNParticipantDID-TGO-DEV-SCA](Endpoint-GDHCNParticipantDID-TGO-DEV-SCA.md) |  |
| [GDHCNParticipantDID-TGO-DSC](Endpoint-GDHCNParticipantDID-TGO-DSC.md) |  |
| [GDHCNParticipantDID-TGO-SCA](Endpoint-GDHCNParticipantDID-TGO-SCA.md) |  |
| [GDHCNParticipantDID-TGO-UAT-All](Endpoint-GDHCNParticipantDID-TGO-UAT-All.md) | Togo Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:TGO resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/TGO/did.json |
| [GDHCNParticipantDID-TGO-UAT-DSC](Endpoint-GDHCNParticipantDID-TGO-UAT-DSC.md) |  |
| [GDHCNParticipantDID-TGO-UAT-SCA](Endpoint-GDHCNParticipantDID-TGO-UAT-SCA.md) |  |
| [GDHCNParticipantDID-THA-All](Endpoint-GDHCNParticipantDID-THA-All.md) | Thailand Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:THA resolvable at https://tng-cdn.who.int/v2/trustlist/-/THA/did.json |
| [GDHCNParticipantDID-THA-DSC](Endpoint-GDHCNParticipantDID-THA-DSC.md) |  |
| [GDHCNParticipantDID-THA-SCA](Endpoint-GDHCNParticipantDID-THA-SCA.md) |  |
| [GDHCNParticipantDID-THA-UAT-All](Endpoint-GDHCNParticipantDID-THA-UAT-All.md) | Thailand Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:THA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/THA/did.json |
| [GDHCNParticipantDID-THA-UAT-DSC](Endpoint-GDHCNParticipantDID-THA-UAT-DSC.md) |  |
| [GDHCNParticipantDID-THA-UAT-SCA](Endpoint-GDHCNParticipantDID-THA-UAT-SCA.md) |  |
| [GDHCNParticipantDID-TUR-All](Endpoint-GDHCNParticipantDID-TUR-All.md) | Türkiye Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:TUR resolvable at https://tng-cdn.who.int/v2/trustlist/-/TUR/did.json |
| [GDHCNParticipantDID-TUR-DSC](Endpoint-GDHCNParticipantDID-TUR-DSC.md) |  |
| [GDHCNParticipantDID-TUR-SCA](Endpoint-GDHCNParticipantDID-TUR-SCA.md) |  |
| [GDHCNParticipantDID-TUR-UAT-All](Endpoint-GDHCNParticipantDID-TUR-UAT-All.md) | Türkiye Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:TUR resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/TUR/did.json |
| [GDHCNParticipantDID-TUR-UAT-DSC](Endpoint-GDHCNParticipantDID-TUR-UAT-DSC.md) |  |
| [GDHCNParticipantDID-TUR-UAT-SCA](Endpoint-GDHCNParticipantDID-TUR-UAT-SCA.md) |  |
| [GDHCNParticipantDID-URY-DEV-All](Endpoint-GDHCNParticipantDID-URY-DEV-All.md) | Uruguay Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:URY resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/URY/did.json |
| [GDHCNParticipantDID-URY-DEV-DSC](Endpoint-GDHCNParticipantDID-URY-DEV-DSC.md) |  |
| [GDHCNParticipantDID-URY-DEV-SCA](Endpoint-GDHCNParticipantDID-URY-DEV-SCA.md) |  |
| [GDHCNParticipantDID-USA-DEV-All](Endpoint-GDHCNParticipantDID-USA-DEV-All.md) | United States of America Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:USA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/USA/did.json |
| [GDHCNParticipantDID-USA-DEV-DSC](Endpoint-GDHCNParticipantDID-USA-DEV-DSC.md) |  |
| [GDHCNParticipantDID-USA-DEV-SCA](Endpoint-GDHCNParticipantDID-USA-DEV-SCA.md) |  |
| [GDHCNParticipantDID-WHO](Endpoint-GDHCNParticipantDID-WHO.md) |  |
| [GDHCNParticipantDID-WHO-DEV](Endpoint-GDHCNParticipantDID-WHO-DEV.md) |  |
| [GDHCNParticipantDID-WHO-DEV-All](Endpoint-GDHCNParticipantDID-WHO-DEV-All.md) | DEV Participant WHO Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:WHO resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/WHO/did.json |
| [GDHCNParticipantDID-WHO-DEV-DSC](Endpoint-GDHCNParticipantDID-WHO-DEV-DSC.md) |  |
| [GDHCNParticipantDID-WHO-DEV-SCA](Endpoint-GDHCNParticipantDID-WHO-DEV-SCA.md) |  |
| [GDHCNParticipantDID-WHO-UAT](Endpoint-GDHCNParticipantDID-WHO-UAT.md) |  |
| [GDHCNParticipantDID-WHO-UAT-All](Endpoint-GDHCNParticipantDID-WHO-UAT-All.md) | UAT Participant WHO Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:WHO resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/WHO/did.json |
| [GDHCNParticipantDID-WHO-UAT-DSC](Endpoint-GDHCNParticipantDID-WHO-UAT-DSC.md) |  |
| [GDHCNParticipantDID-WHO-UAT-SCA](Endpoint-GDHCNParticipantDID-WHO-UAT-SCA.md) |  |
| [GDHCNParticipantDID-XCL-DEV-All](Endpoint-GDHCNParticipantDID-XCL-DEV-All.md) | DEV Participant XCL Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XCL resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XCL/did.json |
| [GDHCNParticipantDID-XCL-DEV-DSC](Endpoint-GDHCNParticipantDID-XCL-DEV-DSC.md) |  |
| [GDHCNParticipantDID-XCL-DEV-SCA](Endpoint-GDHCNParticipantDID-XCL-DEV-SCA.md) |  |
| [GDHCNParticipantDID-XML-DEV-All](Endpoint-GDHCNParticipantDID-XML-DEV-All.md) | DEV Participant XML Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XML resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XML/did.json |
| [GDHCNParticipantDID-XML-DEV-DSC](Endpoint-GDHCNParticipantDID-XML-DEV-DSC.md) |  |
| [GDHCNParticipantDID-XML-DEV-SCA](Endpoint-GDHCNParticipantDID-XML-DEV-SCA.md) |  |
| [GDHCNParticipantDID-XXA-DEV-All](Endpoint-GDHCNParticipantDID-XXA-DEV-All.md) | DEV Participant XXA Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXA/did.json |
| [GDHCNParticipantDID-XXA-DEV-DSC](Endpoint-GDHCNParticipantDID-XXA-DEV-DSC.md) |  |
| [GDHCNParticipantDID-XXA-DEV-SCA](Endpoint-GDHCNParticipantDID-XXA-DEV-SCA.md) |  |
| [GDHCNParticipantDID-XXA-UAT-All](Endpoint-GDHCNParticipantDID-XXA-UAT-All.md) | UAT Participant XXA Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXA/did.json |
| [GDHCNParticipantDID-XXA-UAT-DSC](Endpoint-GDHCNParticipantDID-XXA-UAT-DSC.md) |  |
| [GDHCNParticipantDID-XXA-UAT-SCA](Endpoint-GDHCNParticipantDID-XXA-UAT-SCA.md) |  |
| [GDHCNParticipantDID-XXB-DEV-All](Endpoint-GDHCNParticipantDID-XXB-DEV-All.md) | DEV Participant XXB Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXB resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXB/did.json |
| [GDHCNParticipantDID-XXB-DEV-DSC](Endpoint-GDHCNParticipantDID-XXB-DEV-DSC.md) |  |
| [GDHCNParticipantDID-XXB-DEV-SCA](Endpoint-GDHCNParticipantDID-XXB-DEV-SCA.md) |  |
| [GDHCNParticipantDID-XXB-UAT-All](Endpoint-GDHCNParticipantDID-XXB-UAT-All.md) | UAT Participant XXB Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXB resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXB/did.json |
| [GDHCNParticipantDID-XXB-UAT-DSC](Endpoint-GDHCNParticipantDID-XXB-UAT-DSC.md) |  |
| [GDHCNParticipantDID-XXB-UAT-SCA](Endpoint-GDHCNParticipantDID-XXB-UAT-SCA.md) |  |
| [GDHCNParticipantDID-XXC-DEV-All](Endpoint-GDHCNParticipantDID-XXC-DEV-All.md) | DEV Participant XXC Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXC/did.json |
| [GDHCNParticipantDID-XXC-DEV-DSC](Endpoint-GDHCNParticipantDID-XXC-DEV-DSC.md) |  |
| [GDHCNParticipantDID-XXC-DEV-SCA](Endpoint-GDHCNParticipantDID-XXC-DEV-SCA.md) |  |
| [GDHCNParticipantDID-XXC-UAT-All](Endpoint-GDHCNParticipantDID-XXC-UAT-All.md) | UAT Participant XXC Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXC/did.json |
| [GDHCNParticipantDID-XXC-UAT-DSC](Endpoint-GDHCNParticipantDID-XXC-UAT-DSC.md) |  |
| [GDHCNParticipantDID-XXC-UAT-SCA](Endpoint-GDHCNParticipantDID-XXC-UAT-SCA.md) |  |
| [GDHCNParticipantDID-XXD-DEV-All](Endpoint-GDHCNParticipantDID-XXD-DEV-All.md) | DEV Participant XXD Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXD resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXD/did.json |
| [GDHCNParticipantDID-XXD-DEV-DSC](Endpoint-GDHCNParticipantDID-XXD-DEV-DSC.md) |  |
| [GDHCNParticipantDID-XXD-DEV-SCA](Endpoint-GDHCNParticipantDID-XXD-DEV-SCA.md) |  |
| [GDHCNParticipantDID-XXD-UAT-All](Endpoint-GDHCNParticipantDID-XXD-UAT-All.md) | UAT Participant XXD Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXD resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXD/did.json |
| [GDHCNParticipantDID-XXD-UAT-DSC](Endpoint-GDHCNParticipantDID-XXD-UAT-DSC.md) |  |
| [GDHCNParticipantDID-XXD-UAT-SCA](Endpoint-GDHCNParticipantDID-XXD-UAT-SCA.md) |  |
| [GDHCNParticipantDID-XXE-DEV-All](Endpoint-GDHCNParticipantDID-XXE-DEV-All.md) | DEV Participant XXE Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXE resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXE/did.json |
| [GDHCNParticipantDID-XXE-DEV-DSC](Endpoint-GDHCNParticipantDID-XXE-DEV-DSC.md) |  |
| [GDHCNParticipantDID-XXE-DEV-SCA](Endpoint-GDHCNParticipantDID-XXE-DEV-SCA.md) |  |
| [GDHCNParticipantDID-XXF-DEV-All](Endpoint-GDHCNParticipantDID-XXF-DEV-All.md) | DEV Participant XXF Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXF resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXF/did.json |
| [GDHCNParticipantDID-XXF-DEV-DSC](Endpoint-GDHCNParticipantDID-XXF-DEV-DSC.md) |  |
| [GDHCNParticipantDID-XXF-DEV-SCA](Endpoint-GDHCNParticipantDID-XXF-DEV-SCA.md) |  |
| [GDHCNParticipantDID-XXG-DEV-All](Endpoint-GDHCNParticipantDID-XXG-DEV-All.md) | DEV Participant XXG Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXG resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXG/did.json |
| [GDHCNParticipantDID-XXG-DEV-DSC](Endpoint-GDHCNParticipantDID-XXG-DEV-DSC.md) |  |
| [GDHCNParticipantDID-XXG-DEV-SCA](Endpoint-GDHCNParticipantDID-XXG-DEV-SCA.md) |  |
| [GDHCNParticipantDID-XXH-DEV-All](Endpoint-GDHCNParticipantDID-XXH-DEV-All.md) | DEV Participant XXH Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXH resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXH/did.json |
| [GDHCNParticipantDID-XXH-DEV-DSC](Endpoint-GDHCNParticipantDID-XXH-DEV-DSC.md) |  |
| [GDHCNParticipantDID-XXH-DEV-SCA](Endpoint-GDHCNParticipantDID-XXH-DEV-SCA.md) |  |
| [GDHCNParticipantDID-XXI-DEV-All](Endpoint-GDHCNParticipantDID-XXI-DEV-All.md) | DEV Participant XXI Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXI resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXI/did.json |
| [GDHCNParticipantDID-XXI-DEV-DSC](Endpoint-GDHCNParticipantDID-XXI-DEV-DSC.md) |  |
| [GDHCNParticipantDID-XXI-DEV-SCA](Endpoint-GDHCNParticipantDID-XXI-DEV-SCA.md) |  |
| [GDHCNParticipantDID-XXJ-DEV-All](Endpoint-GDHCNParticipantDID-XXJ-DEV-All.md) | DEV Participant XXJ Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXJ resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXJ/did.json |
| [GDHCNParticipantDID-XXJ-DEV-DSC](Endpoint-GDHCNParticipantDID-XXJ-DEV-DSC.md) |  |
| [GDHCNParticipantDID-XXJ-DEV-SCA](Endpoint-GDHCNParticipantDID-XXJ-DEV-SCA.md) |  |
| [GDHCNParticipantDID-XXK-DEV-All](Endpoint-GDHCNParticipantDID-XXK-DEV-All.md) | DEV Participant XXK Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXK resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXK/did.json |
| [GDHCNParticipantDID-XXK-DEV-DSC](Endpoint-GDHCNParticipantDID-XXK-DEV-DSC.md) |  |
| [GDHCNParticipantDID-XXK-DEV-SCA](Endpoint-GDHCNParticipantDID-XXK-DEV-SCA.md) |  |
| [GDHCNParticipantDID-XXO-DEV-All](Endpoint-GDHCNParticipantDID-XXO-DEV-All.md) | DEV Participant XXO Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXO resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXO/did.json |
| [GDHCNParticipantDID-XXO-DEV-DSC](Endpoint-GDHCNParticipantDID-XXO-DEV-DSC.md) |  |
| [GDHCNParticipantDID-XXO-DEV-SCA](Endpoint-GDHCNParticipantDID-XXO-DEV-SCA.md) |  |
| [GDHCNParticipantDID-XXO-UAT-All](Endpoint-GDHCNParticipantDID-XXO-UAT-All.md) | UAT Participant XXO Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXO resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXO/did.json |
| [GDHCNParticipantDID-XXO-UAT-DSC](Endpoint-GDHCNParticipantDID-XXO-UAT-DSC.md) |  |
| [GDHCNParticipantDID-XXO-UAT-SCA](Endpoint-GDHCNParticipantDID-XXO-UAT-SCA.md) |  |
| [GDHCNParticipantDID-XXP-DEV-All](Endpoint-GDHCNParticipantDID-XXP-DEV-All.md) | DEV Participant XXP Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXP resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXP/did.json |
| [GDHCNParticipantDID-XXP-DEV-DSC](Endpoint-GDHCNParticipantDID-XXP-DEV-DSC.md) |  |
| [GDHCNParticipantDID-XXP-DEV-SCA](Endpoint-GDHCNParticipantDID-XXP-DEV-SCA.md) |  |
| [GDHCNParticipantDID-XXS-UAT-All](Endpoint-GDHCNParticipantDID-XXS-UAT-All.md) | UAT Participant XXS Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXS resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXS/did.json |
| [GDHCNParticipantDID-XXS-UAT-DSC](Endpoint-GDHCNParticipantDID-XXS-UAT-DSC.md) |  |
| [GDHCNParticipantDID-XXS-UAT-SCA](Endpoint-GDHCNParticipantDID-XXS-UAT-SCA.md) |  |
| [GDHCNParticipantDID-XXU-DEV-All](Endpoint-GDHCNParticipantDID-XXU-DEV-All.md) | DEV Participant XXU Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXU resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXU/did.json |
| [GDHCNParticipantDID-XXU-DEV-DSC](Endpoint-GDHCNParticipantDID-XXU-DEV-DSC.md) |  |
| [GDHCNParticipantDID-XXU-DEV-SCA](Endpoint-GDHCNParticipantDID-XXU-DEV-SCA.md) |  |
| [GDHCNParticipantDID-XXU-UAT-All](Endpoint-GDHCNParticipantDID-XXU-UAT-All.md) | UAT Participant XXU Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXU resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXU/did.json |
| [GDHCNParticipantDID-XXU-UAT-DSC](Endpoint-GDHCNParticipantDID-XXU-UAT-DSC.md) |  |
| [GDHCNParticipantDID-XXU-UAT-SCA](Endpoint-GDHCNParticipantDID-XXU-UAT-SCA.md) |  |
| [GDHCNParticipantDID-XXV-DEV-All](Endpoint-GDHCNParticipantDID-XXV-DEV-All.md) | DEV Participant XXV Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXV resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXV/did.json |
| [GDHCNParticipantDID-XXV-DEV-DSC](Endpoint-GDHCNParticipantDID-XXV-DEV-DSC.md) |  |
| [GDHCNParticipantDID-XXV-DEV-SCA](Endpoint-GDHCNParticipantDID-XXV-DEV-SCA.md) |  |
| [GDHCNParticipantDID-XXV-UAT-All](Endpoint-GDHCNParticipantDID-XXV-UAT-All.md) | UAT Participant XXV Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXV resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXV/did.json |
| [GDHCNParticipantDID-XXV-UAT-DSC](Endpoint-GDHCNParticipantDID-XXV-UAT-DSC.md) |  |
| [GDHCNParticipantDID-XXV-UAT-SCA](Endpoint-GDHCNParticipantDID-XXV-UAT-SCA.md) |  |
| [GDHCNParticipantDID-XXX-DEV-All](Endpoint-GDHCNParticipantDID-XXX-DEV-All.md) | DEV Participant XXX Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXX resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXX/did.json |
| [GDHCNParticipantDID-XXX-DEV-DSC](Endpoint-GDHCNParticipantDID-XXX-DEV-DSC.md) |  |
| [GDHCNParticipantDID-XXX-DEV-SCA](Endpoint-GDHCNParticipantDID-XXX-DEV-SCA.md) |  |
| [GDHCNParticipantDID-XXX-UAT-All](Endpoint-GDHCNParticipantDID-XXX-UAT-All.md) | UAT Participant XXX Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXX resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXX/did.json |
| [GDHCNParticipantDID-XXX-UAT-DSC](Endpoint-GDHCNParticipantDID-XXX-UAT-DSC.md) |  |
| [GDHCNParticipantDID-XXX-UAT-SCA](Endpoint-GDHCNParticipantDID-XXX-UAT-SCA.md) |  |
| [GDHCNParticipantDID-XYK-DEV-All](Endpoint-GDHCNParticipantDID-XYK-DEV-All.md) | DEV Participant XYK Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XYK resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XYK/did.json |
| [GDHCNParticipantDID-XYK-DEV-DSC](Endpoint-GDHCNParticipantDID-XYK-DEV-DSC.md) |  |
| [GDHCNParticipantDID-XYK-DEV-SCA](Endpoint-GDHCNParticipantDID-XYK-DEV-SCA.md) |  |
| [GDHCNParticipantDID-XYK-UAT-All](Endpoint-GDHCNParticipantDID-XYK-UAT-All.md) | UAT Participant XYK Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XYK resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XYK/did.json |
| [GDHCNParticipantDID-XYK-UAT-DSC](Endpoint-GDHCNParticipantDID-XYK-UAT-DSC.md) |  |
| [GDHCNParticipantDID-XYK-UAT-SCA](Endpoint-GDHCNParticipantDID-XYK-UAT-SCA.md) |  |

