# GDHCNParticipant-XXE-DEV - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-XXE-DEV**

## Organization: GDHCNParticipant-XXE-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: DEV Participant XXE

**endpoint**: 

* [Endpoint DEV Participant XXE Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXE resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXE/did.json](Endpoint-GDHCNParticipantDID-XXE-DEV-All.md)
* [Endpoint DEV Participant XXE Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:XXE:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXE/DSC/did.json](Endpoint-GDHCNParticipantDID-XXE-DEV-DSC.md)
* [Endpoint DEV Participant XXE Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:XXE:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXE/SCA/did.json](Endpoint-GDHCNParticipantDID-XXE-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-XXE-DEV",
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
  "name" : "DEV Participant XXE",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXE-DEV-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXE-DEV-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXE-DEV-SCA"
    }
  ]
}

```
