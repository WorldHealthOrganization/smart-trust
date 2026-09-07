# GDHCNParticipant-SWE - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-SWE**

## Organization: GDHCNParticipant-SWE

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Sweden

**endpoint**: 

* [Endpoint Sweden Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:SWE resolvable at https://tng-cdn.who.int/v2/trustlist/-/SWE/did.json](Endpoint-GDHCNParticipantDID-SWE-All.md)
* [Endpoint Sweden Trustlist (DID v2) - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:SWE:DSC resolvable at https://tng-cdn.who.int/v2/trustlist/-/SWE/DSC/did.json](Endpoint-GDHCNParticipantDID-SWE-DSC.md)
* [Endpoint Sweden Trustlist (DID v2) - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:SWE:SCA resolvable at https://tng-cdn.who.int/v2/trustlist/-/SWE/SCA/did.json](Endpoint-GDHCNParticipantDID-SWE-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-SWE",
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
  "name" : "Sweden",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-SWE-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-SWE-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-SWE-SCA"
    }
  ]
}

```
