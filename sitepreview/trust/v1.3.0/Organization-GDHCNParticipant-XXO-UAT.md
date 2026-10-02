# GDHCNParticipant-XXO-UAT - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-XXO-UAT**

## Organization: GDHCNParticipant-XXO-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: UAT Participant XXO

**endpoint**: 

* [Endpoint UAT Participant XXO Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXO resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXO/did.json](Endpoint-GDHCNParticipantDID-XXO-UAT-All.md)
* [Endpoint UAT Participant XXO Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:XXO:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXO/DSC/did.json](Endpoint-GDHCNParticipantDID-XXO-UAT-DSC.md)
* [Endpoint UAT Participant XXO Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:XXO:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXO/SCA/did.json](Endpoint-GDHCNParticipantDID-XXO-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-XXO-UAT",
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
  "name" : "UAT Participant XXO",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXO-UAT-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXO-UAT-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXO-UAT-SCA"
    }
  ]
}

```
