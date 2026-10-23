# GDHCNParticipantDID-MYS-All - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipantDID-MYS-All**

## Endpoint: GDHCNParticipantDID-MYS-All

Profile: [mCSD Endpoint](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Endpoint.html)

**status**: Active

**connectionType**: [WHO GDHCN Connection Types http-get](CodeSystem-ConnectionTypes.md#ConnectionTypes-http-get): http-get

**name**: Malaysia Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:MYS resolvable at https://tng-cdn.who.int/v2/trustlist/-/MYS/did.json

**managingOrganization**: [Organization Malaysia](Organization-GDHCNParticipant-MYS.md)

**payloadType**: WHO GDHCN Trust List v2

**payloadMimeType**: application/did

**address**: did:web:tng-cdn.who.int:v2:trustlist:-:MYS



## Resource Content

```json
{
  "resourceType" : "Endpoint",
  "id" : "GDHCNParticipantDID-MYS-All",
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
  "name" : "Malaysia Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:MYS\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/MYS/did.json",
  "managingOrganization" : {
    "reference" : "Organization/GDHCNParticipant-MYS"
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
  "address" : "did:web:tng-cdn.who.int:v2:trustlist:-:MYS"
}

```
