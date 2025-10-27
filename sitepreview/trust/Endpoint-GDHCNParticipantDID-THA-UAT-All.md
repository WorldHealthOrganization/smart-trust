# GDHCNParticipantDID-THA-UAT-All - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipantDID-THA-UAT-All**

## Endpoint: GDHCNParticipantDID-THA-UAT-All

Profile: [mCSD Endpoint](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Endpoint.html)

**status**: Active

**connectionType**: [WHO GDHCN Connection Types http-get](CodeSystem-ConnectionTypes.md#ConnectionTypes-http-get): http-get

**name**: Thailand Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:THA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/THA/did.json

**managingOrganization**: [Organization Thailand](Organization-GDHCNParticipant-THA-UAT.md)

**payloadType**: WHO GDHCN Trust List v2

**payloadMimeType**: application/did

**address**: did:web:tng-cdn.who.int:v2:trustlist:-:THA



## Resource Content

```json
{
  "resourceType" : "Endpoint",
  "id" : "GDHCNParticipantDID-THA-UAT-All",
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
  "name" : "Thailand Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:THA\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/THA/did.json",
  "managingOrganization" : {
    "reference" : "Organization/GDHCNParticipant-THA-UAT"
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
  "address" : "did:web:tng-cdn.who.int:v2:trustlist:-:THA"
}

```
