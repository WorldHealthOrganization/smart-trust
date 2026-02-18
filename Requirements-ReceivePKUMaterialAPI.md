# Receive PKI material via API - WHO SMART Trust v1.1.6

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **Receive PKI material via API**

## Requirements: Receive PKI material via API (Experimental) 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/trust/Requirements/ReceivePKUMaterialAPI | *Version*:1.1.6 |
| Active as of 2026-02-18 | *Computable Name*:Receive Public Keys via API |

 
Receive trust material from a Trust Network Participant, for distribution within the Trust Network via API 

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
  "id" : "ReceivePKUMaterialAPI",
  "meta" : {
    "profile" : [
      "http://smart.who.int/base/StructureDefinition/SGRequirements"
    ]
  },
  "extension" : [
    {
      "url" : "http://smart.who.int/base/StructureDefinition/Satisfies",
      "valueReference" : {
        "reference" : "Requirements/ReceivePKUMaterial"
      }
    }
  ],
  "url" : "http://smart.who.int/trust/Requirements/ReceivePKUMaterialAPI",
  "version" : "1.1.6",
  "name" : "Receive Public Keys via API",
  "title" : "Receive PKI material via API",
  "status" : "active",
  "experimental" : true,
  "date" : "2026-02-18T13:36:49+00:00",
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
  "description" : "Receive trust material from a Trust Network Participant, for distribution within the Trust Network via API",
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
    "http://smart.who.int/trust/ActorDefinition/TrustNetworkAnchor"
  ]
}

```
