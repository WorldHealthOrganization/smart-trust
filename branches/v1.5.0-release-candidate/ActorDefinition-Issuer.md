# Issuer - WHO SMART Trust v1.5.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **Issuer**

## ActorDefinition: Issuer (Experimental) 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/trust/ActorDefinition/Issuer | *Version*:1.5.0 |
| Active as of 2026-04-27 | *Computable Name*:Issuer |

 
An Issuer a system authorized by a Trust Network Participant to generate Verifiable Digital Health Certificates which are provided to a Holder. An Issuer is responsible for generating the content that is digitally signed within the Verifiable Digital Health Certificate. In order to sign this content, an Issuer should either itself be a Document Signer or utilize a Document Signer service, as authorized by the jurisdicitonal policy. 

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
  "id" : "Issuer",
  "meta" : {
    "profile" : ["http://smart.who.int/base/StructureDefinition/SGActor"]
  },
  "url" : "http://smart.who.int/trust/ActorDefinition/Issuer",
  "version" : "1.5.0",
  "name" : "Issuer",
  "title" : "Issuer",
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
  "description" : "An Issuer a system authorized by a Trust Network Participant to generate Verifiable Digital Health Certificates which are provided to a Holder.   An Issuer is responsible for generating the content that is digitally signed within the Verifiable Digital Health Certificate.   In order to sign this content, an Issuer should either itself be a Document Signer or utilize a Document Signer service, as authorized by the jurisdicitonal policy.",
  "jurisdiction" : [{
    "coding" : [{
      "system" : "http://unstats.un.org/unsd/methods/m49/m49.htm",
      "code" : "001"
    }]
  }],
  "type" : "system",
  "derivedFrom" : ["http://smart.who.int/trust/ActorDefinition/TrustNetworkParticipant"]
}

```
