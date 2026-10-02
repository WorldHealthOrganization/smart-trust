# GDHCNParticipant-XXA-UAT - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-XXA-UAT**

## Organization: GDHCNParticipant-XXA-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: UAT Participant XXA

**endpoint**: 

* [Endpoint UAT Participant XXA Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXA/did.json](Endpoint-GDHCNParticipantDID-XXA-UAT-All.md)
* [Endpoint UAT Participant XXA Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:XXA:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXA/DSC/did.json](Endpoint-GDHCNParticipantDID-XXA-UAT-DSC.md)
* [Endpoint UAT Participant XXA Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:XXA:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXA/SCA/did.json](Endpoint-GDHCNParticipantDID-XXA-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-XXA-UAT",
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
  "name" : "UAT Participant XXA",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXA-UAT-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXA-UAT-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXA-UAT-SCA"
    }
  ]
}

```
