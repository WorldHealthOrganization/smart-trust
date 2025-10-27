# GDHCNParticipant-WHO-DEV - WHO SMART Trust v1.1.6

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-WHO-DEV**

## Organization: GDHCNParticipant-WHO-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: DEV Participant WHO

**endpoint**: 

* [Endpoint DEV Participant WHO Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:WHO resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/WHO/did.json](Endpoint-GDHCNParticipantDID-WHO-DEV-All.md)
* [Endpoint DEV Participant WHO Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:WHO:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/WHO/DSC/did.json](Endpoint-GDHCNParticipantDID-WHO-DEV-DSC.md)
* [Endpoint DEV Participant WHO Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:WHO:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/WHO/SCA/did.json](Endpoint-GDHCNParticipantDID-WHO-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-WHO-DEV",
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
  "name" : "DEV Participant WHO",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-WHO-DEV-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-WHO-DEV-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-WHO-DEV-SCA"
    }
  ]
}

```
