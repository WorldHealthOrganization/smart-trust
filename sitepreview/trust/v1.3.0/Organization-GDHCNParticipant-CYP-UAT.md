# GDHCNParticipant-CYP-UAT - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-CYP-UAT**

## Organization: GDHCNParticipant-CYP-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Cyprus

**endpoint**: 

* [Endpoint Cyprus Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:CYP resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/CYP/did.json](Endpoint-GDHCNParticipantDID-CYP-UAT-All.md)
* [Endpoint Cyprus Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:CYP:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/CYP/DSC/did.json](Endpoint-GDHCNParticipantDID-CYP-UAT-DSC.md)
* [Endpoint Cyprus Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:CYP:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/CYP/SCA/did.json](Endpoint-GDHCNParticipantDID-CYP-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-CYP-UAT",
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
      "reference" : "Endpoint/GDHCNParticipantDID-CYP-UAT-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-CYP-UAT-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-CYP-UAT-SCA"
    }
  ]
}

```
