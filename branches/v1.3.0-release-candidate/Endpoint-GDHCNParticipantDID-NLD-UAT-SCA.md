# GDHCNParticipantDID-NLD-UAT-SCA - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipantDID-NLD-UAT-SCA**

## Endpoint: GDHCNParticipantDID-NLD-UAT-SCA

Profile: [mCSD Endpoint](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Endpoint.html)

**status**: Active

**connectionType**: [WHO GDHCN Connection Types http-get](CodeSystem-ConnectionTypes.md#ConnectionTypes-http-get): http-get

**name**: Netherlands (Kingdom of the) Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:NLD:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/NLD/SCA/did.json

**managingOrganization**: [Organization Netherlands (Kingdom of the)](Organization-GDHCNParticipant-NLD-UAT.md)

**payloadType**: WHO GDHCN Trust List v2

**payloadMimeType**: application/did

**address**: did:web:tng-cdn.who.int:v2:trustlist:-:NLD:SCA



## Resource Content

```json
{
  "resourceType" : "Endpoint",
  "id" : "GDHCNParticipantDID-NLD-UAT-SCA",
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
  "name" : "Netherlands (Kingdom of the) Trustlist (DID v2) - UAT - Certificate Signing Authority\ndid:web:tng-cdn.who.int:v2:trustlist:-:NLD:SCA\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/NLD/SCA/did.json",
  "managingOrganization" : {
    "reference" : "Organization/GDHCNParticipant-NLD-UAT"
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
  "address" : "did:web:tng-cdn.who.int:v2:trustlist:-:NLD:SCA"
}

```
