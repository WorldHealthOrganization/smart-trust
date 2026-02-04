# GDHCNParticipant-AND-DEV - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-AND-DEV**

## Organization: GDHCNParticipant-AND-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Andorra

**endpoint**: 

* [Endpoint Andorra Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:AND resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/AND/did.json](Endpoint-GDHCNParticipantDID-AND-DEV-All.md)
* [Endpoint Andorra Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:AND:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/AND/DSC/did.json](Endpoint-GDHCNParticipantDID-AND-DEV-DSC.md)
* [Endpoint Andorra Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:AND:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/AND/SCA/did.json](Endpoint-GDHCNParticipantDID-AND-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-AND-DEV",
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
  "name" : "Andorra",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-AND-DEV-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-AND-DEV-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-AND-DEV-SCA"
    }
  ]
}

```
