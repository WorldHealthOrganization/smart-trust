# Publish business rules - WHO SMART Trust v1.1.6

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **Publish business rules**

## Requirements: Publish business rules (Experimental) 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/trust/Requirements/PublishBusinessRules | *Version*:1.1.6 |
| Active as of 2026-01-28 | *Computable Name*:Publish Rules |

 
Publish business rules to a Trust Anchor 

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
  "id" : "PublishBusinessRules",
  "meta" : {
    "profile" : [
      "http://smart.who.int/base/StructureDefinition/SGRequirements"
    ]
  },
  "url" : "http://smart.who.int/trust/Requirements/PublishBusinessRules",
  "version" : "1.1.6",
  "name" : "Publish Rules",
  "title" : "Publish business rules",
  "status" : "active",
  "experimental" : true,
  "date" : "2026-01-28T07:28:33+00:00",
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
  "description" : "Publish business rules to a Trust Anchor",
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
  "actor" : ["http://smart.who.int/trust/ActorDefinition/Issuer"]
}

```
