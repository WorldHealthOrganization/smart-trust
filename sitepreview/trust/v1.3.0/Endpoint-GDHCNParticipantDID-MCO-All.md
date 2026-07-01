# GDHCNParticipantDID-MCO-All - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipantDID-MCO-All**

## Endpoint: GDHCNParticipantDID-MCO-All

Profile: [mCSD Endpoint](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Endpoint.html)

**status**: Active

**connectionType**: [WHO GDHCN Connection Types http-get](CodeSystem-ConnectionTypes.md#ConnectionTypes-http-get): http-get

**name**: Monaco Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:MCO resolvable at https://tng-cdn.who.int/v2/trustlist/-/MCO/did.json

**managingOrganization**: [Organization Monaco](Organization-GDHCNParticipant-MCO.md)

**payloadType**: WHO GDHCN Trust List v2

**payloadMimeType**: application/did

**address**: did:web:tng-cdn.who.int:v2:trustlist:-:MCO



## Resource Content

```json
{
  "resourceType" : "Endpoint",
  "id" : "GDHCNParticipantDID-MCO-All",
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
  "name" : "Monaco Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:MCO\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/MCO/did.json",
  "managingOrganization" : {
    "reference" : "Organization/GDHCNParticipant-MCO"
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
  "address" : "did:web:tng-cdn.who.int:v2:trustlist:-:MCO"
}

```
