# GDHCNParticipantDID-IRL-All - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipantDID-IRL-All**

## Endpoint: GDHCNParticipantDID-IRL-All

Profile: [mCSD Endpoint](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Endpoint.html)

**status**: Active

**connectionType**: [WHO GDHCN Connection Types http-get](CodeSystem-ConnectionTypes.md#ConnectionTypes-http-get): http-get

**name**: Ireland Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:IRL resolvable at https://tng-cdn.who.int/v2/trustlist/-/IRL/did.json

**managingOrganization**: [Organization Ireland](Organization-GDHCNParticipant-IRL.md)

**payloadType**: WHO GDHCN Trust List v2

**payloadMimeType**: application/did

**address**: did:web:tng-cdn.who.int:v2:trustlist:-:IRL



## Resource Content

```json
{
  "resourceType" : "Endpoint",
  "id" : "GDHCNParticipantDID-IRL-All",
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
  "name" : "Ireland Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:IRL\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/IRL/did.json",
  "managingOrganization" : {
    "reference" : "Organization/GDHCNParticipant-IRL"
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
  "address" : "did:web:tng-cdn.who.int:v2:trustlist:-:IRL"
}

```
