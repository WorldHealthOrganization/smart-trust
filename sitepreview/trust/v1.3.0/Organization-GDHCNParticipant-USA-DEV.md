# GDHCNParticipant-USA-DEV - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-USA-DEV**

## Organization: GDHCNParticipant-USA-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: United States of America

**endpoint**: 

* [Endpoint United States of America Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:USA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/USA/did.json](Endpoint-GDHCNParticipantDID-USA-DEV-All.md)
* [Endpoint United States of America Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:USA:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/USA/DSC/did.json](Endpoint-GDHCNParticipantDID-USA-DEV-DSC.md)
* [Endpoint United States of America Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:USA:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/USA/SCA/did.json](Endpoint-GDHCNParticipantDID-USA-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-USA-DEV",
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
  "name" : "United States of America",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-USA-DEV-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-USA-DEV-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-USA-DEV-SCA"
    }
  ]
}

```
