# GDHCNParticipant-XXC-UAT - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-XXC-UAT**

## Organization: GDHCNParticipant-XXC-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: UAT Participant XXC

**endpoint**: 

* [Endpoint UAT Participant XXC Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXC/did.json](Endpoint-GDHCNParticipantDID-XXC-UAT-All.md)
* [Endpoint UAT Participant XXC Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:XXC:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXC/DSC/did.json](Endpoint-GDHCNParticipantDID-XXC-UAT-DSC.md)
* [Endpoint UAT Participant XXC Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:XXC:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXC/SCA/did.json](Endpoint-GDHCNParticipantDID-XXC-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-XXC-UAT",
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
  "name" : "UAT Participant XXC",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXC-UAT-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXC-UAT-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXC-UAT-SCA"
    }
  ]
}

```
