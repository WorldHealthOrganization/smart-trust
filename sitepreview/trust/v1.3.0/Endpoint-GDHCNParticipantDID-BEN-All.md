# GDHCNParticipantDID-BEN-All - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipantDID-BEN-All**

## Endpoint: GDHCNParticipantDID-BEN-All

Profile: [mCSD Endpoint](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Endpoint.html)

**status**: Active

**connectionType**: [WHO GDHCN Connection Types http-get](CodeSystem-ConnectionTypes.md#ConnectionTypes-http-get): http-get

**name**: Benin Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:BEN resolvable at https://tng-cdn.who.int/v2/trustlist/-/BEN/did.json

**managingOrganization**: [Organization Benin](Organization-GDHCNParticipant-BEN.md)

**payloadType**: WHO GDHCN Trust List v2

**payloadMimeType**: application/did

**address**: did:web:tng-cdn.who.int:v2:trustlist:-:BEN



## Resource Content

```json
{
  "resourceType" : "Endpoint",
  "id" : "GDHCNParticipantDID-BEN-All",
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
  "name" : "Benin Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:BEN\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/BEN/did.json",
  "managingOrganization" : {
    "reference" : "Organization/GDHCNParticipant-BEN"
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
  "address" : "did:web:tng-cdn.who.int:v2:trustlist:-:BEN"
}

```
