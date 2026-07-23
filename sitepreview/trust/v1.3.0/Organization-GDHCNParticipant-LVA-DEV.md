# GDHCNParticipant-LVA-DEV - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-LVA-DEV**

## Organization: GDHCNParticipant-LVA-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Latvia

**endpoint**: 

* [Endpoint Latvia Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:LVA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/LVA/did.json](Endpoint-GDHCNParticipantDID-LVA-DEV-All.md)
* [Endpoint Latvia Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:LVA:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/LVA/DSC/did.json](Endpoint-GDHCNParticipantDID-LVA-DEV-DSC.md)
* [Endpoint Latvia Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:LVA:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/LVA/SCA/did.json](Endpoint-GDHCNParticipantDID-LVA-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-LVA-DEV",
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
  "name" : "Latvia",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-LVA-DEV-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-LVA-DEV-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-LVA-DEV-SCA"
    }
  ]
}

```
