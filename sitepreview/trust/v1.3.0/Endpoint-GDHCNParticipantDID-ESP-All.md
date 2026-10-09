# GDHCNParticipantDID-ESP-All - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipantDID-ESP-All**

## Endpoint: GDHCNParticipantDID-ESP-All

Profile: [mCSD Endpoint](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Endpoint.html)

**status**: Active

**connectionType**: [WHO GDHCN Connection Types http-get](CodeSystem-ConnectionTypes.md#ConnectionTypes-http-get): http-get

**name**: Spain Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:ESP resolvable at https://tng-cdn.who.int/v2/trustlist/-/ESP/did.json

**managingOrganization**: [Organization Spain](Organization-GDHCNParticipant-ESP.md)

**payloadType**: WHO GDHCN Trust List v2

**payloadMimeType**: application/did

**address**: did:web:tng-cdn.who.int:v2:trustlist:-:ESP



## Resource Content

```json
{
  "resourceType" : "Endpoint",
  "id" : "GDHCNParticipantDID-ESP-All",
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
  "name" : "Spain Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:ESP\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/ESP/did.json",
  "managingOrganization" : {
    "reference" : "Organization/GDHCNParticipant-ESP"
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
  "address" : "did:web:tng-cdn.who.int:v2:trustlist:-:ESP"
}

```
