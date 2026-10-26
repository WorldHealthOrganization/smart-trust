# GDHCNParticipantDID-WHO-UAT - WHO SMART Trust v1.7.5

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipantDID-WHO-UAT**

## Endpoint: GDHCNParticipantDID-WHO-UAT

Profile: [mCSD Endpoint](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Endpoint.html)

WHO Trust List (DID v2) - UAT (): http://tng-cdn-uat.who.int/v2/trustlist/-/WHO/did.json

-------

| | |
| :--- | :--- |
| Status: | Active |
| Address: | [http://tng-cdn-uat.who.int/v2/trustlist/-/WHO/did.json](http://tng-cdn-uat.who.int/v2/trustlist/-/WHO/did.json) |
| Connection Type: |  |
| Managed By: | [WHO (Government)](Organization-GDHCNParticipant-WHO.md) |



## Resource Content

```json
{
  "resourceType" : "Endpoint",
  "id" : "GDHCNParticipantDID-WHO-UAT",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Endpoint"]
  },
  "status" : "active",
  "connectionType" : [null],
  "name" : "WHO Trust List (DID v2) - UAT",
  "managingOrganization" : {
    "reference" : "Organization/GDHCNParticipant-WHO"
  },
  "address" : "http://tng-cdn-uat.who.int/v2/trustlist/-/WHO/did.json"
}

```
