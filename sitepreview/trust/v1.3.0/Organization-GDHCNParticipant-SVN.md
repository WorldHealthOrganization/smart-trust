# GDHCNParticipant-SVN - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-SVN**

## Organization: GDHCNParticipant-SVN

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Slovenia

**endpoint**: 

* [Endpoint Slovenia Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:SVN resolvable at https://tng-cdn.who.int/v2/trustlist/-/SVN/did.json](Endpoint-GDHCNParticipantDID-SVN-All.md)
* [Endpoint Slovenia Trustlist (DID v2) - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:SVN:DSC resolvable at https://tng-cdn.who.int/v2/trustlist/-/SVN/DSC/did.json](Endpoint-GDHCNParticipantDID-SVN-DSC.md)
* [Endpoint Slovenia Trustlist (DID v2) - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:SVN:SCA resolvable at https://tng-cdn.who.int/v2/trustlist/-/SVN/SCA/did.json](Endpoint-GDHCNParticipantDID-SVN-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-SVN",
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
  "name" : "Slovenia",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-SVN-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-SVN-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-SVN-SCA"
    }
  ]
}

```
