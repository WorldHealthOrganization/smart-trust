# GDHCNParticipant-SMR-UAT - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-SMR-UAT**

## Organization: GDHCNParticipant-SMR-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: San Marino

**endpoint**: 

* [Endpoint San Marino Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:SMR resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/SMR/did.json](Endpoint-GDHCNParticipantDID-SMR-UAT-All.md)
* [Endpoint San Marino Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:SMR:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/SMR/DSC/did.json](Endpoint-GDHCNParticipantDID-SMR-UAT-DSC.md)
* [Endpoint San Marino Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:SMR:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/SMR/SCA/did.json](Endpoint-GDHCNParticipantDID-SMR-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-SMR-UAT",
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
  "name" : "San Marino",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-SMR-UAT-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-SMR-UAT-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-SMR-UAT-SCA"
    }
  ]
}

```
