# GDHCNParticipant-MCO-UAT - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-MCO-UAT**

## Organization: GDHCNParticipant-MCO-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Monaco

**endpoint**: 

* [Endpoint Monaco Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:MCO resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/MCO/did.json](Endpoint-GDHCNParticipantDID-MCO-UAT-All.md)
* [Endpoint Monaco Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:MCO:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/MCO/DSC/did.json](Endpoint-GDHCNParticipantDID-MCO-UAT-DSC.md)
* [Endpoint Monaco Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:MCO:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/MCO/SCA/did.json](Endpoint-GDHCNParticipantDID-MCO-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-MCO-UAT",
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
  "name" : "Monaco",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-MCO-UAT-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-MCO-UAT-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-MCO-UAT-SCA"
    }
  ]
}

```
