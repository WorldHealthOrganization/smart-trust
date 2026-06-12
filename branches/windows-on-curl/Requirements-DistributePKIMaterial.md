# Distribute PKI material - WHO SMART Trust v1.1.6

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **Distribute PKI material**

## Requirements: Distribute PKI material (Experimental) 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/trust/Requirements/DistributePKIMaterial | *Version*:1.1.6 |
| Active as of 2025-12-03 | *Computable Name*:Distribute Public Keys |

 
Make received trust material available through a distrubution point to a Trust Network Participant 

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
  "id" : "DistributePKIMaterial",
  "meta" : {
    "profile" : [
      "http://smart.who.int/base/StructureDefinition/SGRequirements"
    ]
  },
  "url" : "http://smart.who.int/trust/Requirements/DistributePKIMaterial",
  "version" : "1.1.6",
  "name" : "Distribute Public Keys",
  "title" : "Distribute PKI material",
  "status" : "active",
  "experimental" : true,
  "date" : "2025-12-03T10:40:16+00:00",
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
  "description" : "Make received trust material available through a distrubution point to a Trust Network Participant",
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
