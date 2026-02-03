# GDHCNParticipant-BEL - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-BEL**

## Organization: GDHCNParticipant-BEL

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Belgium

**endpoint**: 

* [Endpoint Belgium Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:BEL resolvable at https://tng-cdn.who.int/v2/trustlist/-/BEL/did.json](Endpoint-GDHCNParticipantDID-BEL-All.md)
* [Endpoint Belgium Trustlist (DID v2) - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:BEL:DSC resolvable at https://tng-cdn.who.int/v2/trustlist/-/BEL/DSC/did.json](Endpoint-GDHCNParticipantDID-BEL-DSC.md)
* [Endpoint Belgium Trustlist (DID v2) - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:BEL:SCA resolvable at https://tng-cdn.who.int/v2/trustlist/-/BEL/SCA/did.json](Endpoint-GDHCNParticipantDID-BEL-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-BEL",
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
  "name" : "Belgium",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-BEL-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-BEL-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-BEL-SCA"
    }
  ]
}

```
