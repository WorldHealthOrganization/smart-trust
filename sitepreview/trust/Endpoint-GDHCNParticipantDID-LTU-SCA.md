# GDHCNParticipantDID-LTU-SCA - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipantDID-LTU-SCA**

## Endpoint: GDHCNParticipantDID-LTU-SCA

Profile: [mCSD Endpoint](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Endpoint.html)

**status**: Active

**connectionType**: [WHO GDHCN Connection Types http-get](CodeSystem-ConnectionTypes.md#ConnectionTypes-http-get): http-get

**name**: Lithuania Trustlist (DID v2) - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:LTU:SCA resolvable at https://tng-cdn.who.int/v2/trustlist/-/LTU/SCA/did.json

**managingOrganization**: [Organization Lithuania](Organization-GDHCNParticipant-LTU.md)

**payloadType**: WHO GDHCN Trust List v2

**payloadMimeType**: application/did

**address**: did:web:tng-cdn.who.int:v2:trustlist:-:LTU:SCA



## Resource Content

```json
{
  "resourceType" : "Endpoint",
  "id" : "GDHCNParticipantDID-LTU-SCA",
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
  "name" : "Lithuania Trustlist (DID v2) - Certificate Signing Authority\ndid:web:tng-cdn.who.int:v2:trustlist:-:LTU:SCA\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/LTU/SCA/did.json",
  "managingOrganization" : {
    "reference" : "Organization/GDHCNParticipant-LTU"
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
  "address" : "did:web:tng-cdn.who.int:v2:trustlist:-:LTU:SCA"
}

```
