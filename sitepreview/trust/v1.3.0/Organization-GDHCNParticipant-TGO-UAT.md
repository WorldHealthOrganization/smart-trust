# GDHCNParticipant-TGO-UAT - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-TGO-UAT**

## Organization: GDHCNParticipant-TGO-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Togo

**endpoint**: 

* [Endpoint Togo Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:TGO resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/TGO/did.json](Endpoint-GDHCNParticipantDID-TGO-UAT-All.md)
* [Endpoint Togo Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:TGO:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/TGO/DSC/did.json](Endpoint-GDHCNParticipantDID-TGO-UAT-DSC.md)
* [Endpoint Togo Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:TGO:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/TGO/SCA/did.json](Endpoint-GDHCNParticipantDID-TGO-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-TGO-UAT",
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
  "name" : "Togo",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-TGO-UAT-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-TGO-UAT-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-TGO-UAT-SCA"
    }
  ]
}

```
