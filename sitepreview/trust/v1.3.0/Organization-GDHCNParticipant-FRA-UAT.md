# GDHCNParticipant-FRA-UAT - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-FRA-UAT**

## Organization: GDHCNParticipant-FRA-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: France

**endpoint**: 

* [Endpoint France Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:FRA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/FRA/did.json](Endpoint-GDHCNParticipantDID-FRA-UAT-All.md)
* [Endpoint France Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:FRA:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/FRA/DSC/did.json](Endpoint-GDHCNParticipantDID-FRA-UAT-DSC.md)
* [Endpoint France Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:FRA:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/FRA/SCA/did.json](Endpoint-GDHCNParticipantDID-FRA-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-FRA-UAT",
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
  "name" : "France",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-FRA-UAT-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-FRA-UAT-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-FRA-UAT-SCA"
    }
  ]
}

```
