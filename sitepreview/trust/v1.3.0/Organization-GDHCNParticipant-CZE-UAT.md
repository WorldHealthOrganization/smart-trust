# GDHCNParticipant-CZE-UAT - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-CZE-UAT**

## Organization: GDHCNParticipant-CZE-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Czechia

**endpoint**: 

* [Endpoint Czechia Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:CZE resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/CZE/did.json](Endpoint-GDHCNParticipantDID-CZE-UAT-All.md)
* [Endpoint Czechia Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:CZE:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/CZE/DSC/did.json](Endpoint-GDHCNParticipantDID-CZE-UAT-DSC.md)
* [Endpoint Czechia Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:CZE:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/CZE/SCA/did.json](Endpoint-GDHCNParticipantDID-CZE-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-CZE-UAT",
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
  "name" : "Czechia",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-CZE-UAT-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-CZE-UAT-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-CZE-UAT-SCA"
    }
  ]
}

```
