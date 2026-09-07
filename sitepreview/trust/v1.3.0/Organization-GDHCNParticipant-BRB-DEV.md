# GDHCNParticipant-BRB-DEV - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-BRB-DEV**

## Organization: GDHCNParticipant-BRB-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Barbados

**endpoint**: 

* [Endpoint Barbados Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:BRB resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/BRB/did.json](Endpoint-GDHCNParticipantDID-BRB-DEV-All.md)
* [Endpoint Barbados Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:BRB:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/BRB/DSC/did.json](Endpoint-GDHCNParticipantDID-BRB-DEV-DSC.md)
* [Endpoint Barbados Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:BRB:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/BRB/SCA/did.json](Endpoint-GDHCNParticipantDID-BRB-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-BRB-DEV",
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
  "name" : "Barbados",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-BRB-DEV-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-BRB-DEV-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-BRB-DEV-SCA"
    }
  ]
}

```
