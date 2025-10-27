# GDHCNParticipantDID-CAN-UAT-SCA - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipantDID-CAN-UAT-SCA**

## Endpoint: GDHCNParticipantDID-CAN-UAT-SCA

Profile: [mCSD Endpoint](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Endpoint.html)

**status**: Active

**connectionType**: [WHO GDHCN Connection Types http-get](CodeSystem-ConnectionTypes.md#ConnectionTypes-http-get): http-get

**name**: Canada Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:CAN:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/CAN/SCA/did.json

**managingOrganization**: [Organization Canada](Organization-GDHCNParticipant-CAN-UAT.md)

**payloadType**: WHO GDHCN Trust List v2

**payloadMimeType**: application/did

**address**: did:web:tng-cdn.who.int:v2:trustlist:-:CAN:SCA



## Resource Content

```json
{
  "resourceType" : "Endpoint",
  "id" : "GDHCNParticipantDID-CAN-UAT-SCA",
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
  "name" : "Canada Trustlist (DID v2) - UAT - Certificate Signing Authority\ndid:web:tng-cdn.who.int:v2:trustlist:-:CAN:SCA\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/CAN/SCA/did.json",
  "managingOrganization" : {
    "reference" : "Organization/GDHCNParticipant-CAN-UAT"
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
  "address" : "did:web:tng-cdn.who.int:v2:trustlist:-:CAN:SCA"
}

```
