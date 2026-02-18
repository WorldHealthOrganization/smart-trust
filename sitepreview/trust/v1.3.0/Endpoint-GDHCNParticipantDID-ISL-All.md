# GDHCNParticipantDID-ISL-All - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipantDID-ISL-All**

## Endpoint: GDHCNParticipantDID-ISL-All

Profile: [mCSD Endpoint](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Endpoint.html)

**status**: Active

**connectionType**: [WHO GDHCN Connection Types http-get](CodeSystem-ConnectionTypes.md#ConnectionTypes-http-get): http-get

**name**: Iceland Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:ISL resolvable at https://tng-cdn.who.int/v2/trustlist/-/ISL/did.json

**managingOrganization**: [Organization Iceland](Organization-GDHCNParticipant-ISL.md)

**payloadType**: WHO GDHCN Trust List v2

**payloadMimeType**: application/did

**address**: did:web:tng-cdn.who.int:v2:trustlist:-:ISL



## Resource Content

```json
{
  "resourceType" : "Endpoint",
  "id" : "GDHCNParticipantDID-ISL-All",
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
  "name" : "Iceland Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:ISL\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/ISL/did.json",
  "managingOrganization" : {
    "reference" : "Organization/GDHCNParticipant-ISL"
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
  "address" : "did:web:tng-cdn.who.int:v2:trustlist:-:ISL"
}

```
