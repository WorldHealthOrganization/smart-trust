# GDHCNParticipantDID-WHO-UAT-DSC - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipantDID-WHO-UAT-DSC**

## Endpoint: GDHCNParticipantDID-WHO-UAT-DSC

Profile: [mCSD Endpoint](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Endpoint.html)

**status**: Active

**connectionType**: [WHO GDHCN Connection Types http-get](CodeSystem-ConnectionTypes.md#ConnectionTypes-http-get): http-get

**name**: UAT Participant WHO Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:WHO:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/WHO/DSC/did.json

**managingOrganization**: [Organization UAT Participant WHO](Organization-GDHCNParticipant-WHO-UAT.md)

**payloadType**: WHO GDHCN Trust List v2

**payloadMimeType**: application/did

**address**: did:web:tng-cdn.who.int:v2:trustlist:-:WHO:DSC



## Resource Content

```json
{
  "resourceType" : "Endpoint",
  "id" : "GDHCNParticipantDID-WHO-UAT-DSC",
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
  "name" : "UAT Participant WHO Trustlist (DID v2) - UAT - Document Signing Certificates\ndid:web:tng-cdn.who.int:v2:trustlist:-:WHO:DSC\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/WHO/DSC/did.json",
  "managingOrganization" : {
    "reference" : "Organization/GDHCNParticipant-WHO-UAT"
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
  "address" : "did:web:tng-cdn.who.int:v2:trustlist:-:WHO:DSC"
}

```
