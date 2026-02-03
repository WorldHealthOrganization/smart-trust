# GDHCNParticipant-XXP-DEV - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-XXP-DEV**

## Organization: GDHCNParticipant-XXP-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: DEV Participant XXP

**endpoint**: 

* [Endpoint DEV Participant XXP Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXP resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXP/did.json](Endpoint-GDHCNParticipantDID-XXP-DEV-All.md)
* [Endpoint DEV Participant XXP Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:XXP:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXP/DSC/did.json](Endpoint-GDHCNParticipantDID-XXP-DEV-DSC.md)
* [Endpoint DEV Participant XXP Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:XXP:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXP/SCA/did.json](Endpoint-GDHCNParticipantDID-XXP-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-XXP-DEV",
  "meta" : {
    "profile" : [
      "https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"
    ]
  },
  "type" : [
    {
      "coding" : [
        {
          "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
          "code" : "govt"
        }
      ]
    }
  ],
  "name" : "DEV Participant XXP",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXP-DEV-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXP-DEV-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXP-DEV-SCA"
    }
  ]
}

```
