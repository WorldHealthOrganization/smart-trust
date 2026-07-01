# GDHCNParticipant-HRV-UAT - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-HRV-UAT**

## Organization: GDHCNParticipant-HRV-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Croatia

**endpoint**: 

* [Endpoint Croatia Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:HRV resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/HRV/did.json](Endpoint-GDHCNParticipantDID-HRV-UAT-All.md)
* [Endpoint Croatia Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:HRV:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/HRV/DSC/did.json](Endpoint-GDHCNParticipantDID-HRV-UAT-DSC.md)
* [Endpoint Croatia Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:HRV:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/HRV/SCA/did.json](Endpoint-GDHCNParticipantDID-HRV-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-HRV-UAT",
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
  "name" : "Croatia",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-HRV-UAT-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-HRV-UAT-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-HRV-UAT-SCA"
    }
  ]
}

```
