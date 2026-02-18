# Receiver - WHO SMART Trust v1.1.6

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **Receiver**

## ActorDefinition: Receiver (Experimental) 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/trust/ActorDefinition/Receiver | *Version*:1.1.6 |
| Active as of 2025-12-03 | *Computable Name*:Receiver |

 
A Reciever is a system authorized by a Trust Network Participant to receive from a Holder a Veritifable, verify and utilize the content within. 

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
  "id" : "Receiver",
  "meta" : {
    "profile" : ["http://smart.who.int/base/StructureDefinition/SGActor"]
  },
  "url" : "http://smart.who.int/trust/ActorDefinition/Receiver",
  "version" : "1.1.6",
  "name" : "Receiver",
  "title" : "Receiver",
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
  "description" : "A Reciever is a system authorized by a Trust Network Participant to receive from a Holder a Veritifable, verify and utilize the content within.",
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
  "type" : "system",
  "derivedFrom" : [
    "http://smart.who.int/trust/ActorDefinition/TrustNetworkParticipant"
  ]
}

```
