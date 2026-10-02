# GDHCNParticipant-XXF-DEV - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-XXF-DEV**

## Organization: GDHCNParticipant-XXF-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: DEV Participant XXF

**endpoint**: 

* [Endpoint DEV Participant XXF Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXF resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXF/did.json](Endpoint-GDHCNParticipantDID-XXF-DEV-All.md)
* [Endpoint DEV Participant XXF Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:XXF:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXF/DSC/did.json](Endpoint-GDHCNParticipantDID-XXF-DEV-DSC.md)
* [Endpoint DEV Participant XXF Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:XXF:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXF/SCA/did.json](Endpoint-GDHCNParticipantDID-XXF-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-XXF-DEV",
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
  "name" : "DEV Participant XXF",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXF-DEV-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXF-DEV-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXF-DEV-SCA"
    }
  ]
}

```
