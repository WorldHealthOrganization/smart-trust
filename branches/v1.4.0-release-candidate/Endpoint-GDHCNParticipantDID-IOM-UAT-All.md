# GDHCNParticipantDID-IOM-UAT-All - WHO SMART Trust v1.4.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipantDID-IOM-UAT-All**

## Endpoint: GDHCNParticipantDID-IOM-UAT-All

Profile: [mCSD Endpoint](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Endpoint.html)

**status**: Active

**connectionType**: [WHO GDHCN Connection Types: http-get](CodeSystem-ConnectionTypes.md#ConnectionTypes-http-get) (http-get)

**name**: UAT Participant IOM Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:IOM resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/IOM/did.json

**managingOrganization**: [Organization UAT Participant IOM](Organization-GDHCNParticipant-IOM-UAT.md)

**payloadType**: WHO GDHCN Trust List v2

**payloadMimeType**: application/did

**address**: did:web:tng-cdn.who.int:v2:trustlist:-:IOM



## Resource Content

```json
{
  "resourceType" : "Endpoint",
  "id" : "GDHCNParticipantDID-IOM-UAT-All",
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
  "name" : "UAT Participant IOM Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:IOM\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/IOM/did.json",
  "managingOrganization" : {
    "reference" : "Organization/GDHCNParticipant-IOM-UAT"
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
  "address" : "did:web:tng-cdn.who.int:v2:trustlist:-:IOM"
}

```
