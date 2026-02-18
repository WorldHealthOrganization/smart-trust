# GDHCNParticipant-BRA-DEV - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-BRA-DEV**

## Organization: GDHCNParticipant-BRA-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Brazil

**endpoint**: 

* [Endpoint Brazil Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:BRA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/BRA/did.json](Endpoint-GDHCNParticipantDID-BRA-DEV-All.md)
* [Endpoint Brazil Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:BRA:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/BRA/DSC/did.json](Endpoint-GDHCNParticipantDID-BRA-DEV-DSC.md)
* [Endpoint Brazil Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:BRA:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/BRA/SCA/did.json](Endpoint-GDHCNParticipantDID-BRA-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-BRA-DEV",
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
  "name" : "Brazil",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-BRA-DEV-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-BRA-DEV-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-BRA-DEV-SCA"
    }
  ]
}

```
