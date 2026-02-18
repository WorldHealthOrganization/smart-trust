# GDHCNParticipant-CYP - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-CYP**

## Organization: GDHCNParticipant-CYP

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Cyprus

**endpoint**: 

* [Endpoint Cyprus Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:CYP resolvable at https://tng-cdn.who.int/v2/trustlist/-/CYP/did.json](Endpoint-GDHCNParticipantDID-CYP-All.md)
* [Endpoint Cyprus Trustlist (DID v2) - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:CYP:DSC resolvable at https://tng-cdn.who.int/v2/trustlist/-/CYP/DSC/did.json](Endpoint-GDHCNParticipantDID-CYP-DSC.md)
* [Endpoint Cyprus Trustlist (DID v2) - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:CYP:SCA resolvable at https://tng-cdn.who.int/v2/trustlist/-/CYP/SCA/did.json](Endpoint-GDHCNParticipantDID-CYP-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-CYP",
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
      "reference" : "Endpoint/GDHCNParticipantDID-CYP-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-CYP-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-CYP-SCA"
    }
  ]
}

```
