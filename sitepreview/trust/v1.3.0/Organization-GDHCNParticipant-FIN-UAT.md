# GDHCNParticipant-FIN-UAT - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-FIN-UAT**

## Organization: GDHCNParticipant-FIN-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Finland

**endpoint**: 

* [Endpoint Finland Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:FIN resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/FIN/did.json](Endpoint-GDHCNParticipantDID-FIN-UAT-All.md)
* [Endpoint Finland Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:FIN:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/FIN/DSC/did.json](Endpoint-GDHCNParticipantDID-FIN-UAT-DSC.md)
* [Endpoint Finland Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:FIN:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/FIN/SCA/did.json](Endpoint-GDHCNParticipantDID-FIN-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-FIN-UAT",
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
  "name" : "Finland",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-FIN-UAT-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-FIN-UAT-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-FIN-UAT-SCA"
    }
  ]
}

```
