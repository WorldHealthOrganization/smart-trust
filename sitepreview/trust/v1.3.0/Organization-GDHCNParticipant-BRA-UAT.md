# GDHCNParticipant-BRA-UAT - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-BRA-UAT**

## Organization: GDHCNParticipant-BRA-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Brazil

**endpoint**: 

* [Endpoint Brazil Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:BRA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/BRA/did.json](Endpoint-GDHCNParticipantDID-BRA-UAT-All.md)
* [Endpoint Brazil Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:BRA:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/BRA/DSC/did.json](Endpoint-GDHCNParticipantDID-BRA-UAT-DSC.md)
* [Endpoint Brazil Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:BRA:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/BRA/SCA/did.json](Endpoint-GDHCNParticipantDID-BRA-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-BRA-UAT",
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
      "reference" : "Endpoint/GDHCNParticipantDID-BRA-UAT-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-BRA-UAT-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-BRA-UAT-SCA"
    }
  ]
}

```
