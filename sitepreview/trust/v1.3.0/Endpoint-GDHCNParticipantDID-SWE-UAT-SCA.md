# GDHCNParticipantDID-SWE-UAT-SCA - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipantDID-SWE-UAT-SCA**

## Endpoint: GDHCNParticipantDID-SWE-UAT-SCA

Profile: [mCSD Endpoint](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Endpoint.html)

**status**: Active

**connectionType**: [WHO GDHCN Connection Types http-get](CodeSystem-ConnectionTypes.md#ConnectionTypes-http-get): http-get

**name**: Sweden Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:SWE:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/SWE/SCA/did.json

**managingOrganization**: [Organization Sweden](Organization-GDHCNParticipant-SWE-UAT.md)

**payloadType**: WHO GDHCN Trust List v2

**payloadMimeType**: application/did

**address**: did:web:tng-cdn.who.int:v2:trustlist:-:SWE:SCA



## Resource Content

```json
{
  "resourceType" : "Endpoint",
  "id" : "GDHCNParticipantDID-SWE-UAT-SCA",
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
  "name" : "Sweden Trustlist (DID v2) - UAT - Certificate Signing Authority\ndid:web:tng-cdn.who.int:v2:trustlist:-:SWE:SCA\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/SWE/SCA/did.json",
  "managingOrganization" : {
    "reference" : "Organization/GDHCNParticipant-SWE-UAT"
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
  "address" : "did:web:tng-cdn.who.int:v2:trustlist:-:SWE:SCA"
}

```
