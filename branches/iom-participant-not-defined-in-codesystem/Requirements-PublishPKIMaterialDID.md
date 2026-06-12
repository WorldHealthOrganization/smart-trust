# Publish PKI material as DID - WHO SMART Trust v1.1.6

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **Publish PKI material as DID**

## Requirements: Publish PKI material as DID (Experimental) 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/trust/Requirements/PublishPKIMaterialDID | *Version*:1.1.6 |
| Active as of 2026-01-20 | *Computable Name*:Publish Public Keys as DID |

 
Publish trust material to a Trust Anchor as DID 

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
  "id" : "PublishPKIMaterialDID",
  "meta" : {
    "profile" : [
      "http://smart.who.int/base/StructureDefinition/SGRequirements"
    ]
  },
  "extension" : [
    {
      "url" : "http://smart.who.int/base/StructureDefinition/Satisfies",
      "valueReference" : {
        "reference" : "Requirements/PublishPKIMaterial"
      }
    }
  ],
  "url" : "http://smart.who.int/trust/Requirements/PublishPKIMaterialDID",
  "version" : "1.1.6",
  "name" : "Publish Public Keys as DID",
  "title" : "Publish PKI material as DID",
  "status" : "active",
  "experimental" : true,
  "date" : "2026-01-20T07:27:23+00:00",
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
  "description" : "Publish trust material to a Trust Anchor as DID",
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
    "http://smart.who.int/trust/ActorDefinition/TrustNetworkParticipant"
  ]
}

```
