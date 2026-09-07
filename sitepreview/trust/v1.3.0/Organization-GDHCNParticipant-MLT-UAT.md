# GDHCNParticipant-MLT-UAT - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-MLT-UAT**

## Organization: GDHCNParticipant-MLT-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Malta

**endpoint**: 

* [Endpoint Malta Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:MLT resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/MLT/did.json](Endpoint-GDHCNParticipantDID-MLT-UAT-All.md)
* [Endpoint Malta Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:MLT:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/MLT/DSC/did.json](Endpoint-GDHCNParticipantDID-MLT-UAT-DSC.md)
* [Endpoint Malta Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:MLT:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/MLT/SCA/did.json](Endpoint-GDHCNParticipantDID-MLT-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-MLT-UAT",
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
  "name" : "Malta",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-MLT-UAT-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-MLT-UAT-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-MLT-UAT-SCA"
    }
  ]
}

```
