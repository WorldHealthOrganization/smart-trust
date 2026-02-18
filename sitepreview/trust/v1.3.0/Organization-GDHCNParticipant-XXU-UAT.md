# GDHCNParticipant-XXU-UAT - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-XXU-UAT**

## Organization: GDHCNParticipant-XXU-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: UAT Participant XXU

**endpoint**: 

* [Endpoint UAT Participant XXU Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXU resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXU/did.json](Endpoint-GDHCNParticipantDID-XXU-UAT-All.md)
* [Endpoint UAT Participant XXU Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:XXU:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXU/DSC/did.json](Endpoint-GDHCNParticipantDID-XXU-UAT-DSC.md)
* [Endpoint UAT Participant XXU Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:XXU:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXU/SCA/did.json](Endpoint-GDHCNParticipantDID-XXU-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-XXU-UAT",
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
  "name" : "UAT Participant XXU",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXU-UAT-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXU-UAT-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXU-UAT-SCA"
    }
  ]
}

```
