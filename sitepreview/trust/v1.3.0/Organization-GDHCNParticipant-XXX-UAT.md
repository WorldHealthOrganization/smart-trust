# GDHCNParticipant-XXX-UAT - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-XXX-UAT**

## Organization: GDHCNParticipant-XXX-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: UAT Participant XXX

**endpoint**: 

* [Endpoint UAT Participant XXX Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXX resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXX/did.json](Endpoint-GDHCNParticipantDID-XXX-UAT-All.md)
* [Endpoint UAT Participant XXX Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:XXX:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXX/DSC/did.json](Endpoint-GDHCNParticipantDID-XXX-UAT-DSC.md)
* [Endpoint UAT Participant XXX Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:XXX:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXX/SCA/did.json](Endpoint-GDHCNParticipantDID-XXX-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-XXX-UAT",
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
  "name" : "UAT Participant XXX",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXX-UAT-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXX-UAT-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXX-UAT-SCA"
    }
  ]
}

```
