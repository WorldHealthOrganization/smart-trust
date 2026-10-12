# GDHCNParticipant-XXK-DEV - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-XXK-DEV**

## Organization: GDHCNParticipant-XXK-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: DEV Participant XXK

**endpoint**: 

* [Endpoint DEV Participant XXK Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXK resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXK/did.json](Endpoint-GDHCNParticipantDID-XXK-DEV-All.md)
* [Endpoint DEV Participant XXK Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:XXK:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXK/DSC/did.json](Endpoint-GDHCNParticipantDID-XXK-DEV-DSC.md)
* [Endpoint DEV Participant XXK Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:XXK:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXK/SCA/did.json](Endpoint-GDHCNParticipantDID-XXK-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-XXK-DEV",
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
  "name" : "DEV Participant XXK",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXK-DEV-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXK-DEV-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXK-DEV-SCA"
    }
  ]
}

```
