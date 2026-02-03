# GDHCNParticipant-BLZ-DEV - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-BLZ-DEV**

## Organization: GDHCNParticipant-BLZ-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Belize

**endpoint**: 

* [Endpoint Belize Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:BLZ resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/BLZ/did.json](Endpoint-GDHCNParticipantDID-BLZ-DEV-All.md)
* [Endpoint Belize Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:BLZ:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/BLZ/DSC/did.json](Endpoint-GDHCNParticipantDID-BLZ-DEV-DSC.md)
* [Endpoint Belize Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:BLZ:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/BLZ/SCA/did.json](Endpoint-GDHCNParticipantDID-BLZ-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-BLZ-DEV",
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
  "name" : "Belize",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-BLZ-DEV-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-BLZ-DEV-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-BLZ-DEV-SCA"
    }
  ]
}

```
