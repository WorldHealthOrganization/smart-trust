# GDHCNParticipant-XCL-DEV - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-XCL-DEV**

## Organization: GDHCNParticipant-XCL-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: DEV Participant XCL

**endpoint**: 

* [Endpoint DEV Participant XCL Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XCL resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XCL/did.json](Endpoint-GDHCNParticipantDID-XCL-DEV-All.md)
* [Endpoint DEV Participant XCL Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:XCL:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XCL/DSC/did.json](Endpoint-GDHCNParticipantDID-XCL-DEV-DSC.md)
* [Endpoint DEV Participant XCL Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:XCL:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XCL/SCA/did.json](Endpoint-GDHCNParticipantDID-XCL-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-XCL-DEV",
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
  "name" : "DEV Participant XCL",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XCL-DEV-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XCL-DEV-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XCL-DEV-SCA"
    }
  ]
}

```
