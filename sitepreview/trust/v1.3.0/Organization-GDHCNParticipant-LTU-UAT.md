# GDHCNParticipant-LTU-UAT - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-LTU-UAT**

## Organization: GDHCNParticipant-LTU-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Lithuania

**endpoint**: 

* [Endpoint Lithuania Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:LTU resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/LTU/did.json](Endpoint-GDHCNParticipantDID-LTU-UAT-All.md)
* [Endpoint Lithuania Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:LTU:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/LTU/DSC/did.json](Endpoint-GDHCNParticipantDID-LTU-UAT-DSC.md)
* [Endpoint Lithuania Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:LTU:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/LTU/SCA/did.json](Endpoint-GDHCNParticipantDID-LTU-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-LTU-UAT",
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
  "name" : "Lithuania",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-LTU-UAT-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-LTU-UAT-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-LTU-UAT-SCA"
    }
  ]
}

```
