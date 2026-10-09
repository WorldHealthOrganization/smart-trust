# GDHCNParticipant-XXB-UAT - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-XXB-UAT**

## Organization: GDHCNParticipant-XXB-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: UAT Participant XXB

**endpoint**: 

* [Endpoint UAT Participant XXB Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXB resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXB/did.json](Endpoint-GDHCNParticipantDID-XXB-UAT-All.md)
* [Endpoint UAT Participant XXB Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:XXB:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXB/DSC/did.json](Endpoint-GDHCNParticipantDID-XXB-UAT-DSC.md)
* [Endpoint UAT Participant XXB Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:XXB:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXB/SCA/did.json](Endpoint-GDHCNParticipantDID-XXB-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-XXB-UAT",
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
  "name" : "UAT Participant XXB",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXB-UAT-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXB-UAT-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXB-UAT-SCA"
    }
  ]
}

```
