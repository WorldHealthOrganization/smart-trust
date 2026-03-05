# GDHCNParticipantDID-FRA-All - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipantDID-FRA-All**

## Endpoint: GDHCNParticipantDID-FRA-All

Profile: [mCSD Endpoint](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Endpoint.html)

**status**: Active

**connectionType**: [WHO GDHCN Connection Types http-get](CodeSystem-ConnectionTypes.md#ConnectionTypes-http-get): http-get

**name**: France Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:FRA resolvable at https://tng-cdn.who.int/v2/trustlist/-/FRA/did.json

**managingOrganization**: [Organization France](Organization-GDHCNParticipant-FRA.md)

**payloadType**: WHO GDHCN Trust List v2

**payloadMimeType**: application/did

**address**: did:web:tng-cdn.who.int:v2:trustlist:-:FRA



## Resource Content

```json
{
  "resourceType" : "Endpoint",
  "id" : "GDHCNParticipantDID-FRA-All",
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
  "name" : "France Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:FRA\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/FRA/did.json",
  "managingOrganization" : {
    "reference" : "Organization/GDHCNParticipant-FRA"
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
  "address" : "did:web:tng-cdn.who.int:v2:trustlist:-:FRA"
}

```
