# GDHCNParticipantDID-MLT-SCA - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipantDID-MLT-SCA**

## Endpoint: GDHCNParticipantDID-MLT-SCA

Profile: [mCSD Endpoint](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Endpoint.html)

**status**: Active

**connectionType**: [WHO GDHCN Connection Types http-get](CodeSystem-ConnectionTypes.md#ConnectionTypes-http-get): http-get

**name**: Malta Trustlist (DID v2) - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:MLT:SCA resolvable at https://tng-cdn.who.int/v2/trustlist/-/MLT/SCA/did.json

**managingOrganization**: [Organization Malta](Organization-GDHCNParticipant-MLT.md)

**payloadType**: WHO GDHCN Trust List v2

**payloadMimeType**: application/did

**address**: did:web:tng-cdn.who.int:v2:trustlist:-:MLT:SCA



## Resource Content

```json
{
  "resourceType" : "Endpoint",
  "id" : "GDHCNParticipantDID-MLT-SCA",
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
  "name" : "Malta Trustlist (DID v2) - Certificate Signing Authority\ndid:web:tng-cdn.who.int:v2:trustlist:-:MLT:SCA\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/MLT/SCA/did.json",
  "managingOrganization" : {
    "reference" : "Organization/GDHCNParticipant-MLT"
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
  "address" : "did:web:tng-cdn.who.int:v2:trustlist:-:MLT:SCA"
}

```
