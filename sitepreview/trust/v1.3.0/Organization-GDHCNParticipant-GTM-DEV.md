# GDHCNParticipant-GTM-DEV - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-GTM-DEV**

## Organization: GDHCNParticipant-GTM-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Guatemala

**endpoint**: 

* [Endpoint Guatemala Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:GTM resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/GTM/did.json](Endpoint-GDHCNParticipantDID-GTM-DEV-All.md)
* [Endpoint Guatemala Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:GTM:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/GTM/DSC/did.json](Endpoint-GDHCNParticipantDID-GTM-DEV-DSC.md)
* [Endpoint Guatemala Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:GTM:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/GTM/SCA/did.json](Endpoint-GDHCNParticipantDID-GTM-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-GTM-DEV",
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
  "name" : "Guatemala",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-GTM-DEV-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-GTM-DEV-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-GTM-DEV-SCA"
    }
  ]
}

```
