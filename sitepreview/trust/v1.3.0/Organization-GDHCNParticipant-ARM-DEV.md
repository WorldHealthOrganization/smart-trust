# GDHCNParticipant-ARM-DEV - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-ARM-DEV**

## Organization: GDHCNParticipant-ARM-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Armenia

**endpoint**: 

* [Endpoint Armenia Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:ARM resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/ARM/did.json](Endpoint-GDHCNParticipantDID-ARM-DEV-All.md)
* [Endpoint Armenia Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:ARM:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/ARM/DSC/did.json](Endpoint-GDHCNParticipantDID-ARM-DEV-DSC.md)
* [Endpoint Armenia Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:ARM:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/ARM/SCA/did.json](Endpoint-GDHCNParticipantDID-ARM-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-ARM-DEV",
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
  "name" : "Armenia",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-ARM-DEV-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-ARM-DEV-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-ARM-DEV-SCA"
    }
  ]
}

```
