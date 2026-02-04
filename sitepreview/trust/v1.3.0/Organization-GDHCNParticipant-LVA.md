# GDHCNParticipant-LVA - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-LVA**

## Organization: GDHCNParticipant-LVA

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Latvia

**endpoint**: 

* [Endpoint Latvia Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:LVA resolvable at https://tng-cdn.who.int/v2/trustlist/-/LVA/did.json](Endpoint-GDHCNParticipantDID-LVA-All.md)
* [Endpoint Latvia Trustlist (DID v2) - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:LVA:DSC resolvable at https://tng-cdn.who.int/v2/trustlist/-/LVA/DSC/did.json](Endpoint-GDHCNParticipantDID-LVA-DSC.md)
* [Endpoint Latvia Trustlist (DID v2) - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:LVA:SCA resolvable at https://tng-cdn.who.int/v2/trustlist/-/LVA/SCA/did.json](Endpoint-GDHCNParticipantDID-LVA-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-LVA",
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
      "reference" : "Endpoint/GDHCNParticipantDID-LVA-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-LVA-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-LVA-SCA"
    }
  ]
}

```
