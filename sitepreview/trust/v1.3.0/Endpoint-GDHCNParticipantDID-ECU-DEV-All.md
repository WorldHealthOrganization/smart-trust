# GDHCNParticipantDID-ECU-DEV-All - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipantDID-ECU-DEV-All**

## Endpoint: GDHCNParticipantDID-ECU-DEV-All

Profile: [mCSD Endpoint](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Endpoint.html)

**status**: Active

**connectionType**: [WHO GDHCN Connection Types http-get](CodeSystem-ConnectionTypes.md#ConnectionTypes-http-get): http-get

**name**: Ecuador Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:ECU resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/ECU/did.json

**managingOrganization**: [Organization Ecuador](Organization-GDHCNParticipant-ECU-DEV.md)

**payloadType**: WHO GDHCN Trust List v2

**payloadMimeType**: application/did

**address**: did:web:tng-cdn.who.int:v2:trustlist:-:ECU



## Resource Content

```json
{
  "resourceType" : "Endpoint",
  "id" : "GDHCNParticipantDID-ECU-DEV-All",
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
  "name" : "Ecuador Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:ECU\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/ECU/did.json",
  "managingOrganization" : {
    "reference" : "Organization/GDHCNParticipant-ECU-DEV"
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
  "address" : "did:web:tng-cdn.who.int:v2:trustlist:-:ECU"
}

```
