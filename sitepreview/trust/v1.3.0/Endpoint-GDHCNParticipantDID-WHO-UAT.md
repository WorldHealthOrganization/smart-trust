# GDHCNParticipantDID-WHO-UAT - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipantDID-WHO-UAT**

## Endpoint: GDHCNParticipantDID-WHO-UAT

Profile: [mCSD Endpoint](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Endpoint.html)

**status**: Active

**connectionType**: [WHO GDHCN Connection Types http-get](CodeSystem-ConnectionTypes.md#ConnectionTypes-http-get): http-get

**name**: WHO Trust List (DID v2) - UAT

**managingOrganization**: [Organization WHO](Organization-GDHCNParticipant-WHO.md)

**payloadType**: WHO GDHCN Trust List v2

**payloadMimeType**: application/did

**address**: [http://tng-cdn-uat.who.int/v2/trustlist/-/WHO/did.json](http://tng-cdn-uat.who.int/v2/trustlist/-/WHO/did.json)



## Resource Content

```json
{
  "resourceType" : "Endpoint",
  "id" : "GDHCNParticipantDID-WHO-UAT",
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
  "name" : "WHO Trust List (DID v2) - UAT",
  "managingOrganization" : {
    "reference" : "Organization/GDHCNParticipant-WHO"
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
  "address" : "http://tng-cdn-uat.who.int/v2/trustlist/-/WHO/did.json"
}

```
