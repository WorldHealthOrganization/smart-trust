# GDHCNParticipantDID-AND-All - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipantDID-AND-All**

## Endpoint: GDHCNParticipantDID-AND-All

Profile: [mCSD Endpoint](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Endpoint.html)

**status**: Active

**connectionType**: [WHO GDHCN Connection Types http-get](CodeSystem-ConnectionTypes.md#ConnectionTypes-http-get): http-get

**name**: Andorra Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:AND resolvable at https://tng-cdn.who.int/v2/trustlist/-/AND/did.json

**managingOrganization**: [Organization Andorra](Organization-GDHCNParticipant-AND.md)

**payloadType**: WHO GDHCN Trust List v2

**payloadMimeType**: application/did

**address**: did:web:tng-cdn.who.int:v2:trustlist:-:AND



## Resource Content

```json
{
  "resourceType" : "Endpoint",
  "id" : "GDHCNParticipantDID-AND-All",
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
  "name" : "Andorra Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:AND\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/AND/did.json",
  "managingOrganization" : {
    "reference" : "Organization/GDHCNParticipant-AND"
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
  "address" : "did:web:tng-cdn.who.int:v2:trustlist:-:AND"
}

```
