# GDHCNParticipantDID-SMR-DEV-SCA - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipantDID-SMR-DEV-SCA**

## Endpoint: GDHCNParticipantDID-SMR-DEV-SCA

Profile: [mCSD Endpoint](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Endpoint.html)

**status**: Active

**connectionType**: [WHO GDHCN Connection Types http-get](CodeSystem-ConnectionTypes.md#ConnectionTypes-http-get): http-get

**name**: San Marino Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:SMR:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/SMR/SCA/did.json

**managingOrganization**: [Organization San Marino](Organization-GDHCNParticipant-SMR-DEV.md)

**payloadType**: WHO GDHCN Trust List v2

**payloadMimeType**: application/did

**address**: did:web:tng-cdn.who.int:v2:trustlist:-:SMR:SCA



## Resource Content

```json
{
  "resourceType" : "Endpoint",
  "id" : "GDHCNParticipantDID-SMR-DEV-SCA",
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
  "name" : "San Marino Trustlist (DID v2) - DEV - Certificate Signing Authority\ndid:web:tng-cdn.who.int:v2:trustlist:-:SMR:SCA\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/SMR/SCA/did.json",
  "managingOrganization" : {
    "reference" : "Organization/GDHCNParticipant-SMR-DEV"
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
  "address" : "did:web:tng-cdn.who.int:v2:trustlist:-:SMR:SCA"
}

```
