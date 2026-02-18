# GDHCNParticipant-LVA-UAT - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-LVA-UAT**

## Organization: GDHCNParticipant-LVA-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Latvia

**endpoint**: 

* [Endpoint Latvia Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:LVA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/LVA/did.json](Endpoint-GDHCNParticipantDID-LVA-UAT-All.md)
* [Endpoint Latvia Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:LVA:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/LVA/DSC/did.json](Endpoint-GDHCNParticipantDID-LVA-UAT-DSC.md)
* [Endpoint Latvia Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:LVA:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/LVA/SCA/did.json](Endpoint-GDHCNParticipantDID-LVA-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-LVA-UAT",
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
      "reference" : "Endpoint/GDHCNParticipantDID-LVA-UAT-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-LVA-UAT-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-LVA-UAT-SCA"
    }
  ]
}

```
