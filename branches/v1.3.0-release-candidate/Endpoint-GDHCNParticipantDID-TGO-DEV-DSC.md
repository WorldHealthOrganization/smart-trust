# GDHCNParticipantDID-TGO-DEV-DSC - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipantDID-TGO-DEV-DSC**

## Endpoint: GDHCNParticipantDID-TGO-DEV-DSC

Profile: [mCSD Endpoint](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Endpoint.html)

**status**: Active

**connectionType**: [WHO GDHCN Connection Types http-get](CodeSystem-ConnectionTypes.md#ConnectionTypes-http-get): http-get

**name**: Togo Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:TGO:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/TGO/DSC/did.json

**managingOrganization**: [Organization Togo](Organization-GDHCNParticipant-TGO-DEV.md)

**payloadType**: WHO GDHCN Trust List v2

**payloadMimeType**: application/did

**address**: did:web:tng-cdn.who.int:v2:trustlist:-:TGO:DSC



## Resource Content

```json
{
  "resourceType" : "Endpoint",
  "id" : "GDHCNParticipantDID-TGO-DEV-DSC",
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
  "name" : "Togo Trustlist (DID v2) - DEV - Document Signing Certificates\ndid:web:tng-cdn.who.int:v2:trustlist:-:TGO:DSC\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/TGO/DSC/did.json",
  "managingOrganization" : {
    "reference" : "Organization/GDHCNParticipant-TGO-DEV"
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
  "address" : "did:web:tng-cdn.who.int:v2:trustlist:-:TGO:DSC"
}

```
