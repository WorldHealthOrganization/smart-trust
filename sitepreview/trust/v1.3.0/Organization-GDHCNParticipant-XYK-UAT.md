# GDHCNParticipant-XYK-UAT - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-XYK-UAT**

## Organization: GDHCNParticipant-XYK-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: UAT Participant XYK

**endpoint**: 

* [Endpoint UAT Participant XYK Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XYK resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XYK/did.json](Endpoint-GDHCNParticipantDID-XYK-UAT-All.md)
* [Endpoint UAT Participant XYK Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:XYK:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XYK/DSC/did.json](Endpoint-GDHCNParticipantDID-XYK-UAT-DSC.md)
* [Endpoint UAT Participant XYK Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:XYK:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XYK/SCA/did.json](Endpoint-GDHCNParticipantDID-XYK-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-XYK-UAT",
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
  "name" : "UAT Participant XYK",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XYK-UAT-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XYK-UAT-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XYK-UAT-SCA"
    }
  ]
}

```
