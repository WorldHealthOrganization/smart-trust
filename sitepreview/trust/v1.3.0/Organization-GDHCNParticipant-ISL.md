# GDHCNParticipant-ISL - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-ISL**

## Organization: GDHCNParticipant-ISL

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Iceland

**endpoint**: 

* [Endpoint Iceland Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:ISL resolvable at https://tng-cdn.who.int/v2/trustlist/-/ISL/did.json](Endpoint-GDHCNParticipantDID-ISL-All.md)
* [Endpoint Iceland Trustlist (DID v2) - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:ISL:DSC resolvable at https://tng-cdn.who.int/v2/trustlist/-/ISL/DSC/did.json](Endpoint-GDHCNParticipantDID-ISL-DSC.md)
* [Endpoint Iceland Trustlist (DID v2) - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:ISL:SCA resolvable at https://tng-cdn.who.int/v2/trustlist/-/ISL/SCA/did.json](Endpoint-GDHCNParticipantDID-ISL-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-ISL",
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
  "name" : "Iceland",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-ISL-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-ISL-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-ISL-SCA"
    }
  ]
}

```
