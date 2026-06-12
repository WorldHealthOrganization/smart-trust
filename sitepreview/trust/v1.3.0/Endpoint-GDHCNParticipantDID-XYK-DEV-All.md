# GDHCNParticipantDID-XYK-DEV-All - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipantDID-XYK-DEV-All**

## Endpoint: GDHCNParticipantDID-XYK-DEV-All

Profile: [mCSD Endpoint](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Endpoint.html)

**status**: Active

**connectionType**: [WHO GDHCN Connection Types http-get](CodeSystem-ConnectionTypes.md#ConnectionTypes-http-get): http-get

**name**: DEV Participant XYK Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XYK resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XYK/did.json

**managingOrganization**: [Organization DEV Participant XYK](Organization-GDHCNParticipant-XYK-DEV.md)

**payloadType**: WHO GDHCN Trust List v2

**payloadMimeType**: application/did

**address**: did:web:tng-cdn.who.int:v2:trustlist:-:XYK



## Resource Content

```json
{
  "resourceType" : "Endpoint",
  "id" : "GDHCNParticipantDID-XYK-DEV-All",
  "meta" : {
    "profile" : [
      "https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Endpoint"
    ]
  },
  "status" : "active",
  "connectionType" : {
    "system" : "http://smart.who.int/trust/CodeSystem/ConnectionTypes",
    "code" : "http-get"
  },
  "name" : "DEV Participant XYK Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:XYK\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XYK/did.json",
  "managingOrganization" : {
    "reference" : "Organization/GDHCNParticipant-XYK-DEV"
  },
  "payloadType" : [
    {
      "coding" : [
        {
          "system" : "http://smart.who.int/trust/CodeSystem/PayloadTypes",
          "code" : "urn:who:trust:trustlist:v2"
        }
      ]
    }
  ],
  "payloadMimeType" : ["application/did"],
  "address" : "did:web:tng-cdn.who.int:v2:trustlist:-:XYK"
}

```
