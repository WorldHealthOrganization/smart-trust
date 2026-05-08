# GDHCNParticipant-XXD-DEV - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-XXD-DEV**

## Organization: GDHCNParticipant-XXD-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: DEV Participant XXD

**endpoint**: 

* [Endpoint DEV Participant XXD Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXD resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXD/did.json](Endpoint-GDHCNParticipantDID-XXD-DEV-All.md)
* [Endpoint DEV Participant XXD Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:XXD:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXD/DSC/did.json](Endpoint-GDHCNParticipantDID-XXD-DEV-DSC.md)
* [Endpoint DEV Participant XXD Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:XXD:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXD/SCA/did.json](Endpoint-GDHCNParticipantDID-XXD-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-XXD-DEV",
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
  "name" : "DEV Participant XXD",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXD-DEV-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXD-DEV-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXD-DEV-SCA"
    }
  ]
}

```
