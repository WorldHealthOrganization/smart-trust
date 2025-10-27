# GDHCNParticipantDID-OMN-DEV-DSC - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipantDID-OMN-DEV-DSC**

## Endpoint: GDHCNParticipantDID-OMN-DEV-DSC

Profile: [mCSD Endpoint](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Endpoint.html)

**status**: Active

**connectionType**: [WHO GDHCN Connection Types http-get](CodeSystem-ConnectionTypes.md#ConnectionTypes-http-get): http-get

**name**: Oman Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:OMN:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/OMN/DSC/did.json

**managingOrganization**: [Organization Oman](Organization-GDHCNParticipant-OMN-DEV.md)

**payloadType**: WHO GDHCN Trust List v2

**payloadMimeType**: application/did

**address**: did:web:tng-cdn.who.int:v2:trustlist:-:OMN:DSC



## Resource Content

```json
{
  "resourceType" : "Endpoint",
  "id" : "GDHCNParticipantDID-OMN-DEV-DSC",
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
  "name" : "Oman Trustlist (DID v2) - DEV - Document Signing Certificates\ndid:web:tng-cdn.who.int:v2:trustlist:-:OMN:DSC\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/OMN/DSC/did.json",
  "managingOrganization" : {
    "reference" : "Organization/GDHCNParticipant-OMN-DEV"
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
  "address" : "did:web:tng-cdn.who.int:v2:trustlist:-:OMN:DSC"
}

```
