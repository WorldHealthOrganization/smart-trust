# WHO GDHCN Trust Actors CodeSystem - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **WHO GDHCN Trust Actors CodeSystem**

## CodeSystem: WHO GDHCN Trust Actors CodeSystem (Experimental) 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/trust/CodeSystem/Actors | *Version*:1.3.0 |
| Active as of 2025-10-27 | *Computable Name*:Actors |

 
CodeSystem for SMART Trust actors that has usage codes for verification keys published to the Trust Network as defined by the[certificate governance](concepts_certificate_governance.md) 

 This Code system is referenced in the content logical definition of the following value sets: 

* [Actors](ValueSet-Actors.md)



## Resource Content

```json
{
  "resourceType" : "CodeSystem",
  "id" : "Actors",
  "url" : "http://smart.who.int/trust/CodeSystem/Actors",
  "version" : "1.3.0",
  "name" : "Actors",
  "title" : "WHO GDHCN Trust Actors CodeSystem",
  "status" : "active",
  "experimental" : true,
  "date" : "2025-10-27T07:48:32+00:00",
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
  "description" : "CodeSystem for SMART Trust actors that has usage codes for verification keys published to the Trust Network as defined by the [certificate governance](concepts_certificate_governance.html)",
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
  "count" : 5,
  "concept" : [
    {
      "code" : "credential-holder",
      "display" : "Holder of a Credential"
    },
    {
      "code" : "credential-issuer",
      "display" : "Issuer of a Credential"
    },
    {
      "code" : "gdhcn",
      "display" : "GDHCN",
      "definition" : "Global Digital Health Certification Network (GDHCN)"
    },
    {
      "code" : "TNG",
      "display" : "TNG",
      "definition" : "Trust Network Gateway"
    },
    {
      "code" : "TNP",
      "display" : "TNP",
      "definition" : "Trust Network Participant"
    }
  ]
}

```
