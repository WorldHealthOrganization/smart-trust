# GDHCNParticipant-OMN-UAT - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-OMN-UAT**

## Organization: GDHCNParticipant-OMN-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Oman

**endpoint**: 

* [Endpoint Oman Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:OMN resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/OMN/did.json](Endpoint-GDHCNParticipantDID-OMN-UAT-All.md)
* [Endpoint Oman Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:OMN:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/OMN/DSC/did.json](Endpoint-GDHCNParticipantDID-OMN-UAT-DSC.md)
* [Endpoint Oman Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:OMN:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/OMN/SCA/did.json](Endpoint-GDHCNParticipantDID-OMN-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-OMN-UAT",
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
  "name" : "Oman",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-OMN-UAT-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-OMN-UAT-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-OMN-UAT-SCA"
    }
  ]
}

```
