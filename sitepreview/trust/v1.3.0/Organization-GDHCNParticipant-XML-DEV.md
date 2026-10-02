# GDHCNParticipant-XML-DEV - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-XML-DEV**

## Organization: GDHCNParticipant-XML-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: DEV Participant XML

**endpoint**: 

* [Endpoint DEV Participant XML Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XML resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XML/did.json](Endpoint-GDHCNParticipantDID-XML-DEV-All.md)
* [Endpoint DEV Participant XML Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:XML:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XML/DSC/did.json](Endpoint-GDHCNParticipantDID-XML-DEV-DSC.md)
* [Endpoint DEV Participant XML Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:XML:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XML/SCA/did.json](Endpoint-GDHCNParticipantDID-XML-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-XML-DEV",
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
  "name" : "DEV Participant XML",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XML-DEV-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XML-DEV-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XML-DEV-SCA"
    }
  ]
}

```
