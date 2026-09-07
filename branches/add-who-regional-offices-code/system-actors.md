# System Actors - WHO SMART Trust v1.1.6

* [**Table of Contents**](toc.md)
* [**Data Models and Exchange**](data_exchange.md)
* **System Actors**

## System Actors

### Actors

Actors produce, manage, or act on health information. Actors relevant to the SMART Trust Network are as follows.

#### Holder

A Holder is an individual that has Verifiable Digtial Health Certificate in their possesion, received from an Issuer. The Holder may choose to share the Verifiable Digital Health Certificate with a Receiver.

This actor fulfills the following requirements:

*  **[Provide Verifiable Digital Health Certificate](Requirements-ProvideVDHC.md)** 
*  **[Receive Verifiable Digital Health Certificate](Requirements-ReceiveVDHC.md)** 
*  **[Request Verifiable Digital Health Certificate](Requirements-RequestVDHC.md)** 

#### Issuer

An Issuer a system authorized by a Trust Network Participant to generate Verifiable Digital Health Certificates which are provided to a Holder. An Issuer is responsible for generating the content that is digitally signed within the Verifiable Digital Health Certificate. In order to sign this content, an Issuer should either itself be a Document Signer or utilize a Document Signer service, as authorized by the jurisdicitonal policy.

This actor fulfills the following requirements:

*  **[Issue Verifiable Digital Health Certificate](Requirements-IssuerVDHC.md)** 
*  **[Publish business rules](Requirements-PublishBusinessRules.md)** 
*  **[Publish Cert Logic business rules](Requirements-PublishBusinessRulesCertLogic.md)** 
*  **[Publish HL7 FHIR business rules](Requirements-PublishBusinessRulesFHIR.md)** 

#### Receiver

A Reciever is a system authorized by a Trust Network Participant to receive from a Holder a Veritifable, verify and utilize the content within.

This actor fulfills the following requirements:

*  **[Retrieve business rules](Requirements-RetrieveBusinessRules.md)** 
*  **[Retrieve Cert Logic compatible business rules](Requirements-RetrieveBusinessRulesCertLogic.md)** 
*  **[Retrieve HL7 FHIR compatible business rules](Requirements-RetrieveBusinessRulesFHIR.md)** 
*  **[Utilize a Verifiable Digital Health Certificate](Requirements-UtilizeVDHC.md)** 

#### Trust Network Anchor

Trust Anchor which receives and distributes PKI-material within a Trust Network

This actor fulfills the following requirements:

*  **[Distribute business rules](Requirements-DistributeBusinessRules.md)** 
*  **[Distribute CertLogic business rules](Requirements-DistributeBusinessRulesCertLogic.md)** 
*  **[Distribute FHIR business rules](Requirements-DistributeBusinessRulesFHIR.md)** 
*  **[Distribute PKI material](Requirements-DistributePKIMaterial.md)** 
*  **[Distribute PKI material via API](Requirements-DistributePKIMaterialAPI.md)** 
*  **[Distribute PKI material as DID](Requirements-DistributePKIMaterialDID.md)** 
*  **[Receive business rules](Requirements-ReceiveBusinessRules.md)** 
*  **[Receive CertLogic business rules](Requirements-ReceiveBusinessRulesCertLogic.md)** 
*  **[Receive HL7 FHIR business rules](Requirements-ReceiveBusinessRulesFHIR.md)** 
*  **[Receive PKI material](Requirements-ReceivePKUMaterial.md)** 
*  **[Receive PKI material via API](Requirements-ReceivePKUMaterialAPI.md)** 
*  **[Receive PKI material as DID](Requirements-ReceivePKUMaterialDID.md)** 
*  **[Retrieve PKI material](Requirements-RetrievePKIMaterial.md)** 
*  **[Retrieve PKI material via API](Requirements-RetrievePKIMaterialAPI.md)** 
*  **[Retrieve PKI material as DID](Requirements-RetrievePKIMaterialDID.md)** 

#### Trust Network Participant

Trust Network Participant which publishes and or receives PKI-material within a Trust Network

This actor fulfills the following requirements:

*  **[Publish PKI material](Requirements-PublishPKIMaterial.md)** 
*  **[Publish PKI material via API](Requirements-PublishPKIMaterialAPI.md)** 
*  **[Publish PKI material as DID](Requirements-PublishPKIMaterialDID.md)** 
*  **[Retrieve PKI material](Requirements-RetrievePKIMaterial.md)** 
*  **[Retrieve PKI material via API](Requirements-RetrievePKIMaterialAPI.md)** 
*  **[Retrieve PKI material as DID](Requirements-RetrievePKIMaterialDID.md)** 

#### Business Rules Library

Trusted service, provided by a node within a trust network, to share business rules using Clinical Quality Language (CQL) specification.

#### Product Catalogue

Used to manage and publish product master data for health products, devices and commodities that may be referenced in a Verifiable Digital Health Certificates.

#### Terminology Service

Used to manage and publish mappings between various local code systems and required vocabularies that are utilized Verifiable Digital Health Certificates.

