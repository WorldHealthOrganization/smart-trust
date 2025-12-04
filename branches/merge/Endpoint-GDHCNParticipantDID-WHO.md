# GDHCNParticipantDID-WHO - WHO SMART Trust v1.1.6

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipantDID-WHO**

## Endpoint: GDHCNParticipantDID-WHO

Profile: [mCSD Endpoint](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Endpoint.html)

**status**: Active

**connectionType**: 

**name**: WHO Trust List (DID v2)

**managingOrganization**: [Organization WHO](Organization-GDHCNParticipant-WHO.md)

**address**: [http://tng-cdn.who.int/v2/trustlist/-/WHO/did.json](http://tng-cdn.who.int/v2/trustlist/-/WHO/did.json)



## Resource Content

```json
{
  "resourceType" : "Endpoint",
  "id" : "GDHCNParticipantDID-WHO",
  "meta" : {
    "profile" : [
      "https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Endpoint"
    ]
  },
  "status" : "active",
  "connectionType" : [null],
  "name" : "WHO Trust List (DID v2)",
  "managingOrganization" : {
    "reference" : "Organization/GDHCNParticipant-WHO"
  },
  "address" : "http://tng-cdn.who.int/v2/trustlist/-/WHO/did.json"
}

```
