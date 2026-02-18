# GDHCNParticipant-XXV-UAT - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-XXV-UAT**

## Organization: GDHCNParticipant-XXV-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: UAT Participant XXV

**endpoint**: 

* [Endpoint UAT Participant XXV Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXV resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXV/did.json](Endpoint-GDHCNParticipantDID-XXV-UAT-All.md)
* [Endpoint UAT Participant XXV Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:XXV:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXV/DSC/did.json](Endpoint-GDHCNParticipantDID-XXV-UAT-DSC.md)
* [Endpoint UAT Participant XXV Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:XXV:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXV/SCA/did.json](Endpoint-GDHCNParticipantDID-XXV-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-XXV-UAT",
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
  "name" : "UAT Participant XXV",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXV-UAT-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXV-UAT-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXV-UAT-SCA"
    }
  ]
}

```
