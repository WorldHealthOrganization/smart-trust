# GDHCNParticipant-CYP-DEV - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-CYP-DEV**

## Organization: GDHCNParticipant-CYP-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Cyprus

**endpoint**: 

* [Endpoint Cyprus Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:CYP resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/CYP/did.json](Endpoint-GDHCNParticipantDID-CYP-DEV-All.md)
* [Endpoint Cyprus Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:CYP:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/CYP/DSC/did.json](Endpoint-GDHCNParticipantDID-CYP-DEV-DSC.md)
* [Endpoint Cyprus Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:CYP:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/CYP/SCA/did.json](Endpoint-GDHCNParticipantDID-CYP-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-CYP-DEV",
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
  "name" : "Cyprus",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-CYP-DEV-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-CYP-DEV-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-CYP-DEV-SCA"
    }
  ]
}

```
