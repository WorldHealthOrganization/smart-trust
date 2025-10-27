# WHO GDHCN Key Usage CodeSystem - WHO SMART Trust v1.1.6

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **WHO GDHCN Key Usage CodeSystem**

## CodeSystem: WHO GDHCN Key Usage CodeSystem (Experimental) 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/trust/CodeSystem/KeyUsage | *Version*:1.1.6 |
| Active as of 2025-10-26 | *Computable Name*:KeyUsage |

 
CodeSystem for GDHCN Key Usage that has usage codes for verification keys published to the Trust Network as defined by the[certificate governance](concepts_certificate_governance.md)for Production environment 

 This Code system is referenced in the content logical definition of the following value sets: 

* [KeyUsage](ValueSet-KeyUsage.md)



## Resource Content

```json
{
  "resourceType" : "CodeSystem",
  "id" : "KeyUsage",
  "url" : "http://smart.who.int/trust/CodeSystem/KeyUsage",
  "version" : "1.1.6",
  "name" : "KeyUsage",
  "title" : "WHO GDHCN Key Usage CodeSystem",
  "status" : "active",
  "experimental" : true,
  "date" : "2025-10-26T07:45:42+00:00",
  "publisher" : "WHO",
  "contact" : [
    {
      "name" : "WHO",
      "telecom" : [
        {
          "system" : "url",
          "value" : "http://who.int"
        }
      ]
    }
  ],
  "description" : "CodeSystem for GDHCN Key Usage that has usage codes for verification keys published to the Trust Network as defined by the [certificate governance](concepts_certificate_governance.html) for Production environment",
  "jurisdiction" : [
    {
      "coding" : [
        {
          "system" : "http://unstats.un.org/unsd/methods/m49/m49.htm",
          "code" : "001"
        }
      ]
    }
  ],
  "caseSensitive" : false,
  "content" : "complete",
  "count" : 6,
  "concept" : [
    {
      "code" : "SCA",
      "display" : "Signer Certificate Authority (SCA)",
      "definition" : "A certificate which acts a trust anchor in the verification of the certificate chain for the DSCs issued by a Trust Network participant"
    },
    {
      "code" : "DSC",
      "display" : "Document Signing Certificate (DSC)",
      "definition" : "A certificate which may be used to verify a digital signature within a Verfifiable Digital Health Certificate"
    },
    {
      "code" : "DECA",
      "display" : "Data Exchange Certificate Authority (DECA)",
      "definition" : "A certificate which acts a trust anchor in the verification of the certificate chain for the DESCs issued by a Trust Network Participant"
    },
    {
      "code" : "DESC",
      "display" : "Data Exchange Signing Certificate (DESC)",
      "definition" : "A certificate which may be used to initiate a secure data exchange connection (e.g. mTLS) between Trust Network Participants"
    },
    {
      "code" : "TLS",
      "display" : "Transport Layer Security (TLS)",
      "definition" : "Used for establishing (m)TLS connections with systems, in particular between the Trust Network Gateway and backend systems of a Trust Network Participant"
    },
    {
      "code" : "UP",
      "display" : "Upload (UP)",
      "definition" : "Used to verify digital signature of cryptographically signed content uploaded to services within the Global Digital Health Certification Network, in particular the Trust Network Gateway"
    }
  ]
}

```
