# GDHCNParticipant-SAU-UAT - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-SAU-UAT**

## Organization: GDHCNParticipant-SAU-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Saudi Arabia

**endpoint**: 

* [Endpoint Saudi Arabia Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:SAU resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/SAU/did.json](Endpoint-GDHCNParticipantDID-SAU-UAT-All.md)
* [Endpoint Saudi Arabia Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:SAU:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/SAU/DSC/did.json](Endpoint-GDHCNParticipantDID-SAU-UAT-DSC.md)
* [Endpoint Saudi Arabia Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:SAU:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/SAU/SCA/did.json](Endpoint-GDHCNParticipantDID-SAU-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-SAU-UAT",
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
  "name" : "Saudi Arabia",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-SAU-UAT-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-SAU-UAT-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-SAU-UAT-SCA"
    }
  ]
}

```
