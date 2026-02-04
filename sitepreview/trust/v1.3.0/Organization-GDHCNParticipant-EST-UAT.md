# GDHCNParticipant-EST-UAT - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-EST-UAT**

## Organization: GDHCNParticipant-EST-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Estonia

**endpoint**: 

* [Endpoint Estonia Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:EST resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/EST/did.json](Endpoint-GDHCNParticipantDID-EST-UAT-All.md)
* [Endpoint Estonia Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:EST:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/EST/DSC/did.json](Endpoint-GDHCNParticipantDID-EST-UAT-DSC.md)
* [Endpoint Estonia Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:EST:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/EST/SCA/did.json](Endpoint-GDHCNParticipantDID-EST-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-EST-UAT",
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
  "name" : "Estonia",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-EST-UAT-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-EST-UAT-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-EST-UAT-SCA"
    }
  ]
}

```
