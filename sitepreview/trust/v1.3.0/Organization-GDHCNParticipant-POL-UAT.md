# GDHCNParticipant-POL-UAT - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-POL-UAT**

## Organization: GDHCNParticipant-POL-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Poland

**endpoint**: 

* [Endpoint Poland Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:POL resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/POL/did.json](Endpoint-GDHCNParticipantDID-POL-UAT-All.md)
* [Endpoint Poland Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:POL:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/POL/DSC/did.json](Endpoint-GDHCNParticipantDID-POL-UAT-DSC.md)
* [Endpoint Poland Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:POL:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/POL/SCA/did.json](Endpoint-GDHCNParticipantDID-POL-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-POL-UAT",
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
  "name" : "Poland",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-POL-UAT-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-POL-UAT-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-POL-UAT-SCA"
    }
  ]
}

```
