# GDHCNParticipantDID-FIN-All - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipantDID-FIN-All**

## Endpoint: GDHCNParticipantDID-FIN-All

Profile: [mCSD Endpoint](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Endpoint.html)

**status**: Active

**connectionType**: [WHO GDHCN Connection Types http-get](CodeSystem-ConnectionTypes.md#ConnectionTypes-http-get): http-get

**name**: Finland Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:FIN resolvable at https://tng-cdn.who.int/v2/trustlist/-/FIN/did.json

**managingOrganization**: [Organization Finland](Organization-GDHCNParticipant-FIN.md)

**payloadType**: WHO GDHCN Trust List v2

**payloadMimeType**: application/did

**address**: did:web:tng-cdn.who.int:v2:trustlist:-:FIN



## Resource Content

```json
{
  "resourceType" : "Endpoint",
  "id" : "GDHCNParticipantDID-FIN-All",
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
  "name" : "Finland Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:FIN\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/FIN/did.json",
  "managingOrganization" : {
    "reference" : "Organization/GDHCNParticipant-FIN"
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
  "address" : "did:web:tng-cdn.who.int:v2:trustlist:-:FIN"
}

```
