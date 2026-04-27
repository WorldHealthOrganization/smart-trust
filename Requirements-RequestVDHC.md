# Request Verifiable Digital Health Certificate - WHO SMART Trust v1.6.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **Request Verifiable Digital Health Certificate**

## Requirements: Request Verifiable Digital Health Certificate (Experimental) 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/trust/Requirements/RequestVDHC | *Version*:1.6.0 |
| Active as of 2026-04-27 | *Computable Name*:Request VDHC |

 
Request a Verifiable Digital Health Certificate from an Issuer 

* Publisher: Contact Email
  * No publisher has been registered.: No contact email has been registered.
* Publisher: Jurisdiction
  * No publisher has been registered.: 
* Publisher: Statements
  * No publisher has been registered.: 
* Publisher: Derived from
  * No publisher has been registered.: This requirement is not derived from another requriement.
* Publisher: Derivatives
  * No publisher has been registered.: This requirement has the following derivatives:
* Publisher: Participating Actors
  * No publisher has been registered.: 



## Resource Content

```json
{
  "resourceType" : "Requirements",
  "id" : "RequestVDHC",
  "meta" : {
    "profile" : ["http://smart.who.int/base/StructureDefinition/SGRequirements"]
  },
  "url" : "http://smart.who.int/trust/Requirements/RequestVDHC",
  "version" : "1.6.0",
  "name" : "Request VDHC",
  "title" : "Request Verifiable Digital Health Certificate",
  "status" : "active",
  "experimental" : true,
  "date" : "2026-04-27T07:12:02+00:00",
  "publisher" : "WHO",
  "contact" : [{
    "name" : "WHO",
    "telecom" : [{
      "system" : "url",
      "value" : "http://who.int"
    }]
  }],
  "description" : "Request a Verifiable Digital Health Certificate from an Issuer",
  "jurisdiction" : [{
    "coding" : [{
      "system" : "http://unstats.un.org/unsd/methods/m49/m49.htm",
      "code" : "001"
    }]
  }],
  "actor" : ["http://smart.who.int/trust/ActorDefinition/Holder"]
}

```
