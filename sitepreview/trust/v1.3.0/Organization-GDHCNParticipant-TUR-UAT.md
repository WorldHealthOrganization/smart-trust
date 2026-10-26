# GDHCNParticipant-TUR-UAT - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-TUR-UAT**

## Organization: GDHCNParticipant-TUR-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Türkiye

**endpoint**: 

* [Endpoint Türkiye Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:TUR resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/TUR/did.json](Endpoint-GDHCNParticipantDID-TUR-UAT-All.md)
* [Endpoint Türkiye Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:TUR:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/TUR/DSC/did.json](Endpoint-GDHCNParticipantDID-TUR-UAT-DSC.md)
* [Endpoint Türkiye Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:TUR:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/TUR/SCA/did.json](Endpoint-GDHCNParticipantDID-TUR-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-TUR-UAT",
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
  "name" : "Türkiye",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-TUR-UAT-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-TUR-UAT-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-TUR-UAT-SCA"
    }
  ]
}

```
