# GDHCNParticipant-IDN - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-IDN**

## Organization: GDHCNParticipant-IDN

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Indonesia

**endpoint**: 

* [Endpoint Indonesia Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:IDN resolvable at https://tng-cdn.who.int/v2/trustlist/-/IDN/did.json](Endpoint-GDHCNParticipantDID-IDN-All.md)
* [Endpoint Indonesia Trustlist (DID v2) - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:IDN:DSC resolvable at https://tng-cdn.who.int/v2/trustlist/-/IDN/DSC/did.json](Endpoint-GDHCNParticipantDID-IDN-DSC.md)
* [Endpoint Indonesia Trustlist (DID v2) - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:IDN:SCA resolvable at https://tng-cdn.who.int/v2/trustlist/-/IDN/SCA/did.json](Endpoint-GDHCNParticipantDID-IDN-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-IDN",
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
  "name" : "Indonesia",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-IDN-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-IDN-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-IDN-SCA"
    }
  ]
}

```
