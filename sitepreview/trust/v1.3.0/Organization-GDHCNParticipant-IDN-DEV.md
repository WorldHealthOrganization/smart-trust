# GDHCNParticipant-IDN-DEV - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-IDN-DEV**

## Organization: GDHCNParticipant-IDN-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Indonesia

**endpoint**: 

* [Endpoint Indonesia Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:IDN resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/IDN/did.json](Endpoint-GDHCNParticipantDID-IDN-DEV-All.md)
* [Endpoint Indonesia Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:IDN:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/IDN/DSC/did.json](Endpoint-GDHCNParticipantDID-IDN-DEV-DSC.md)
* [Endpoint Indonesia Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:IDN:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/IDN/SCA/did.json](Endpoint-GDHCNParticipantDID-IDN-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-IDN-DEV",
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
  "name" : "Indonesia",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-IDN-DEV-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-IDN-DEV-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-IDN-DEV-SCA"
    }
  ]
}

```
