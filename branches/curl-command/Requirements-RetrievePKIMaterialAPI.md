# Retrieve PKI material via API - WHO SMART Trust v1.1.6

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **Retrieve PKI material via API**

## Requirements: Retrieve PKI material via API (Experimental) 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/trust/Requirements/RetrievePKIMaterialAPI | *Version*:1.1.6 |
| Active as of 2025-11-19 | *Computable Name*:Retrieve Public Keys via API |

 
Retrieve PKI material from a distribution point via API 

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
  "id" : "RetrievePKIMaterialAPI",
  "meta" : {
    "profile" : [
      "http://smart.who.int/base/StructureDefinition/SGRequirements"
    ]
  },
  "extension" : [
    {
      "url" : "http://smart.who.int/base/StructureDefinition/Satisfies",
      "valueReference" : {
        "reference" : "Requirements/RetrievePKIMaterial"
      }
    }
  ],
  "url" : "http://smart.who.int/trust/Requirements/RetrievePKIMaterialAPI",
  "version" : "1.1.6",
  "name" : "Retrieve Public Keys via API",
  "title" : "Retrieve PKI material via API",
  "status" : "active",
  "experimental" : true,
  "date" : "2025-11-19T10:45:54+00:00",
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
  "description" : "Retrieve PKI material from a distribution point via API",
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
  "actor" : [
    "http://smart.who.int/trust/ActorDefinition/TrustNetworkParticipant",
    "http://smart.who.int/trust/ActorDefinition/TrustNetworkAnchor"
  ]
}

```
