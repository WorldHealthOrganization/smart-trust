# GDHCNParticipant-SVN-UAT - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-SVN-UAT**

## Organization: GDHCNParticipant-SVN-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Slovenia

**endpoint**: 

* [Endpoint Slovenia Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:SVN resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/SVN/did.json](Endpoint-GDHCNParticipantDID-SVN-UAT-All.md)
* [Endpoint Slovenia Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:SVN:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/SVN/DSC/did.json](Endpoint-GDHCNParticipantDID-SVN-UAT-DSC.md)
* [Endpoint Slovenia Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:SVN:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/SVN/SCA/did.json](Endpoint-GDHCNParticipantDID-SVN-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-SVN-UAT",
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
      "reference" : "Endpoint/GDHCNParticipantDID-SVN-UAT-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-SVN-UAT-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-SVN-UAT-SCA"
    }
  ]
}

```
