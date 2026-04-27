# GDHCNParticipant-XXX-DEV - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-XXX-DEV**

## Organization: GDHCNParticipant-XXX-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: DEV Participant XXX

**endpoint**: 

* [Endpoint DEV Participant XXX Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXX resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXX/did.json](Endpoint-GDHCNParticipantDID-XXX-DEV-All.md)
* [Endpoint DEV Participant XXX Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:XXX:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXX/DSC/did.json](Endpoint-GDHCNParticipantDID-XXX-DEV-DSC.md)
* [Endpoint DEV Participant XXX Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:XXX:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXX/SCA/did.json](Endpoint-GDHCNParticipantDID-XXX-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-XXX-DEV",
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
  "name" : "DEV Participant XXX",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXX-DEV-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXX-DEV-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXX-DEV-SCA"
    }
  ]
}

```
