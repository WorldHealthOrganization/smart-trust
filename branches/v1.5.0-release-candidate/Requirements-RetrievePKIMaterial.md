# Retrieve PKI material - WHO SMART Trust v1.5.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **Retrieve PKI material**

## Requirements: Retrieve PKI material (Experimental) 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/trust/Requirements/RetrievePKIMaterial | *Version*:1.5.0 |
| Active as of 2026-04-27 | *Computable Name*:Retrieve Public Keys |

 
Retrieve PKI material from a distribution point 

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
  "id" : "RetrievePKIMaterial",
  "meta" : {
    "profile" : ["http://smart.who.int/base/StructureDefinition/SGRequirements"]
  },
  "url" : "http://smart.who.int/trust/Requirements/RetrievePKIMaterial",
  "version" : "1.5.0",
  "name" : "Retrieve Public Keys",
  "title" : "Retrieve PKI material",
  "status" : "active",
  "experimental" : true,
  "date" : "2026-04-27T07:07:17+00:00",
  "publisher" : "WHO",
  "contact" : [{
    "name" : "WHO",
    "telecom" : [{
      "system" : "url",
      "value" : "http://who.int"
    }]
  }],
  "description" : "Retrieve PKI material from a distribution point",
  "jurisdiction" : [{
    "coding" : [{
      "system" : "http://unstats.un.org/unsd/methods/m49/m49.htm",
      "code" : "001"
    }]
  }],
  "actor" : ["http://smart.who.int/trust/ActorDefinition/TrustNetworkParticipant",
  "http://smart.who.int/trust/ActorDefinition/TrustNetworkAnchor"]
}

```
