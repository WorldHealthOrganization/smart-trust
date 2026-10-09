# GDHCNParticipant-XXV-DEV - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-XXV-DEV**

## Organization: GDHCNParticipant-XXV-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: DEV Participant XXV

**endpoint**: 

* [Endpoint DEV Participant XXV Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXV resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXV/did.json](Endpoint-GDHCNParticipantDID-XXV-DEV-All.md)
* [Endpoint DEV Participant XXV Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:XXV:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXV/DSC/did.json](Endpoint-GDHCNParticipantDID-XXV-DEV-DSC.md)
* [Endpoint DEV Participant XXV Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:XXV:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXV/SCA/did.json](Endpoint-GDHCNParticipantDID-XXV-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-XXV-DEV",
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
  "name" : "DEV Participant XXV",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXV-DEV-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXV-DEV-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXV-DEV-SCA"
    }
  ]
}

```
