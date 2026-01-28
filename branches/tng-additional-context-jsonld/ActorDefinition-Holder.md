# Holder - WHO SMART Trust v1.1.6

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **Holder**

## ActorDefinition: Holder (Experimental) 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/trust/ActorDefinition/Holder | *Version*:1.1.6 |
| Active as of 2026-01-28 | *Computable Name*:Holder |

 
A Holder is an individual that has Verifiable Digtial Health Certificate in their possesion, received from an Issuer. The Holder may choose to share the Verifiable Digital Health Certificate with a Receiver. 

* Publisher: Contact Email
  * No publisher has been registered.: No contact email has been registered.
* Publisher: Jurisdiction
  * No publisher has been registered.: 
* Publisher: Requirements
  * No publisher has been registered.: This actor fulfills the following requirements:



## Resource Content

```json
{
  "resourceType" : "ActorDefinition",
  "id" : "Holder",
  "meta" : {
    "profile" : ["http://smart.who.int/base/StructureDefinition/SGActor"]
  },
  "url" : "http://smart.who.int/trust/ActorDefinition/Holder",
  "version" : "1.1.6",
  "name" : "Holder",
  "title" : "Holder",
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
  "description" : "A Holder is an individual that has Verifiable Digtial Health Certificate in their possesion, received from an Issuer.  The Holder may choose to share the Verifiable Digital Health Certificate with a Receiver.",
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
  "type" : "person"
}

```
