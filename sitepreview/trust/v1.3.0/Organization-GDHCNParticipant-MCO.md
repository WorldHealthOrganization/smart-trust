# GDHCNParticipant-MCO - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-MCO**

## Organization: GDHCNParticipant-MCO

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Monaco

**endpoint**: 

* [Endpoint Monaco Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:MCO resolvable at https://tng-cdn.who.int/v2/trustlist/-/MCO/did.json](Endpoint-GDHCNParticipantDID-MCO-All.md)
* [Endpoint Monaco Trustlist (DID v2) - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:MCO:DSC resolvable at https://tng-cdn.who.int/v2/trustlist/-/MCO/DSC/did.json](Endpoint-GDHCNParticipantDID-MCO-DSC.md)
* [Endpoint Monaco Trustlist (DID v2) - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:MCO:SCA resolvable at https://tng-cdn.who.int/v2/trustlist/-/MCO/SCA/did.json](Endpoint-GDHCNParticipantDID-MCO-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-MCO",
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
      "reference" : "Endpoint/GDHCNParticipantDID-MCO-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-MCO-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-MCO-SCA"
    }
  ]
}

```
