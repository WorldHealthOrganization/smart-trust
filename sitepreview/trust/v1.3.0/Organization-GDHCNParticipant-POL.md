# GDHCNParticipant-POL - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-POL**

## Organization: GDHCNParticipant-POL

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Poland

**endpoint**: 

* [Endpoint Poland Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:POL resolvable at https://tng-cdn.who.int/v2/trustlist/-/POL/did.json](Endpoint-GDHCNParticipantDID-POL-All.md)
* [Endpoint Poland Trustlist (DID v2) - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:POL:DSC resolvable at https://tng-cdn.who.int/v2/trustlist/-/POL/DSC/did.json](Endpoint-GDHCNParticipantDID-POL-DSC.md)
* [Endpoint Poland Trustlist (DID v2) - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:POL:SCA resolvable at https://tng-cdn.who.int/v2/trustlist/-/POL/SCA/did.json](Endpoint-GDHCNParticipantDID-POL-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-POL",
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
  "name" : "Poland",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-POL-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-POL-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-POL-SCA"
    }
  ]
}

```
