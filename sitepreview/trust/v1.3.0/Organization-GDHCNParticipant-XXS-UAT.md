# GDHCNParticipant-XXS-UAT - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-XXS-UAT**

## Organization: GDHCNParticipant-XXS-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: UAT Participant XXS

**endpoint**: 

* [Endpoint UAT Participant XXS Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXS resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXS/did.json](Endpoint-GDHCNParticipantDID-XXS-UAT-All.md)
* [Endpoint UAT Participant XXS Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:XXS:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXS/DSC/did.json](Endpoint-GDHCNParticipantDID-XXS-UAT-DSC.md)
* [Endpoint UAT Participant XXS Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:XXS:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXS/SCA/did.json](Endpoint-GDHCNParticipantDID-XXS-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-XXS-UAT",
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
  "name" : "UAT Participant XXS",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXS-UAT-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXS-UAT-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXS-UAT-SCA"
    }
  ]
}

```
