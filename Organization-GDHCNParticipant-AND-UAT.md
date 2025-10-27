# GDHCNParticipant-AND-UAT - WHO SMART Trust v1.1.6

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-AND-UAT**

## Organization: GDHCNParticipant-AND-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Andorra

**endpoint**: 

* [Endpoint Andorra Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:AND resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/AND/did.json](Endpoint-GDHCNParticipantDID-AND-UAT-All.md)
* [Endpoint Andorra Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:AND:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/AND/DSC/did.json](Endpoint-GDHCNParticipantDID-AND-UAT-DSC.md)
* [Endpoint Andorra Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:AND:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/AND/SCA/did.json](Endpoint-GDHCNParticipantDID-AND-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-AND-UAT",
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
      "reference" : "Endpoint/GDHCNParticipantDID-AND-UAT-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-AND-UAT-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-AND-UAT-SCA"
    }
  ]
}

```
