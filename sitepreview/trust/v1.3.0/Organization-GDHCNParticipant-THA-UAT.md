# GDHCNParticipant-THA-UAT - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-THA-UAT**

## Organization: GDHCNParticipant-THA-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Thailand

**endpoint**: 

* [Endpoint Thailand Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:THA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/THA/did.json](Endpoint-GDHCNParticipantDID-THA-UAT-All.md)
* [Endpoint Thailand Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:THA:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/THA/DSC/did.json](Endpoint-GDHCNParticipantDID-THA-UAT-DSC.md)
* [Endpoint Thailand Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:THA:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/THA/SCA/did.json](Endpoint-GDHCNParticipantDID-THA-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-THA-UAT",
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
  "name" : "Thailand",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-THA-UAT-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-THA-UAT-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-THA-UAT-SCA"
    }
  ]
}

```
