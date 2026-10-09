# GDHCNParticipant-THA - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-THA**

## Organization: GDHCNParticipant-THA

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Thailand

**endpoint**: 

* [Endpoint Thailand Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:THA resolvable at https://tng-cdn.who.int/v2/trustlist/-/THA/did.json](Endpoint-GDHCNParticipantDID-THA-All.md)
* [Endpoint Thailand Trustlist (DID v2) - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:THA:DSC resolvable at https://tng-cdn.who.int/v2/trustlist/-/THA/DSC/did.json](Endpoint-GDHCNParticipantDID-THA-DSC.md)
* [Endpoint Thailand Trustlist (DID v2) - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:THA:SCA resolvable at https://tng-cdn.who.int/v2/trustlist/-/THA/SCA/did.json](Endpoint-GDHCNParticipantDID-THA-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-THA",
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
  "name" : "Thailand",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-THA-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-THA-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-THA-SCA"
    }
  ]
}

```
