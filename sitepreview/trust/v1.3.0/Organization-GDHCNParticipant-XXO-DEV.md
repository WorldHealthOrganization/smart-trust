# GDHCNParticipant-XXO-DEV - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-XXO-DEV**

## Organization: GDHCNParticipant-XXO-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: DEV Participant XXO

**endpoint**: 

* [Endpoint DEV Participant XXO Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXO resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXO/did.json](Endpoint-GDHCNParticipantDID-XXO-DEV-All.md)
* [Endpoint DEV Participant XXO Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:XXO:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXO/DSC/did.json](Endpoint-GDHCNParticipantDID-XXO-DEV-DSC.md)
* [Endpoint DEV Participant XXO Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:XXO:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXO/SCA/did.json](Endpoint-GDHCNParticipantDID-XXO-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-XXO-DEV",
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
  "name" : "DEV Participant XXO",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXO-DEV-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXO-DEV-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXO-DEV-SCA"
    }
  ]
}

```
