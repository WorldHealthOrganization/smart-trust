# Generic Personas - SMART ICVP v0.3.0

* [**Table of Contents**](toc.md)
* [**Business Requirements**](business-requirements.md)
* **Generic Personas**

## Generic Personas

This page includes a depiction of end-users and related stakeholders as introduced in the WHO Digital Adaptation Kit for Digital ICVP.

### Targeted generic personas

**Descriptions of key generic personas**

| | | | |
| :--- | :--- | :--- | :--- |
| Certificate Holder | A person who holds the ICVP certificate and wants to assert a claim related to a vaccination. This person could be the same as the Subject of Care or, for example, could be a caregiver who may hold the certificate for a child or other dependant. | Traveller |  |
| Verifier | The person or entity that wants to verify the vaccination status claim, i.e. verify the vaccination status shown on an ICVP |  |  |
| National Public Health Authority (PHA) | The entity that has overall responsibility for vaccinating the country’s population. The National PHA is also responsible for the ICVP Generation Service and the ICVP Registry Service. |  |  |
| International PHA | Any external PHA to which the National PHA might defer to verify certificates not issued by the National PHA. This could be a PHA in another country, but it could also be any regional level or international organization. |  |  |

### Digital services

| | | | |
| :--- | :--- | :--- | :--- |
| Certificate Identifier (CID) | CID is the key identifier present on the model ICVP. The CID may be provided by an existing national system or alternatively, it could also be issued directly by the Certificate Generation Service which will then encode the ID in the DICVP. An index that associates the CID with metadata about the DICVP is stored in the Certificate Registry Service. |  |  |
| Status Checking Application | A digital solution that can inspect and cryptographically verify the validity of the ICVP. This can be an application on a mobile phone or another device. |  |  |
| Certificate Generation Service | The service that is responsible for taking data about a vaccination event, converting that data to use the FHIR standard, signing that HL7 FHIR document, and returning it to the Digital Health Solution. The signed HL7 FHIR document is the DICVP. The Digital Health Solution is in turn responsible for distributing the DICVP and any associated representation of the data, such as a QR code, to the Certificate Holder based on PHA policy. |  |  |
| Certificate Registry Service | A service that is an index that is able to return metadata related to the DICVP (the signed FHIR document), such as its signature. This metadata may include the location from which the DICVP may be retrieved from the Certificate Repository, if one exists. The Certificate Registry Service can be utilized to determine whether a DICVP has been revoked, for example, due to revocation of a key within the PKI, a compromised batch of vaccinations, or issues within the supply chain. It is important to note that a Certificate Registry Service is not the same as an electronic immunization registry, which is commonly used for routine immunization programmes. |  |  |
| Certificate Repository Service | The optional service that has a repository, or database, of all the DICVP and which is able to return a copy of the DICVP (the signed FHIR document) and potentially the one dimensional or two dimensional barcode representation (such as a QR code) of the signed FHIR document. This can be architected in a centralized or decentralized manner. Regardless, it is a mechanism that stores and persists the DICVP information. |  |  |
| WHO GDHCN | WHO Global Digital Health Certification Network for management of public keys through National HIEs for verification of digital signatures | GDHCN, Trust Network Gateway, TNG, PKD, Public Key Directory |  |
| WHO Terminology Service | WHO hosted terminology service used for handling codesystems and valuesets used by national systems | WHO TS, TS |  |

