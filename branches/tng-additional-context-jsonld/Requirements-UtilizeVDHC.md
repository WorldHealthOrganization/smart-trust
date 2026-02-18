# Utilize a Verifiable Digital Health Certificate - WHO SMART Trust v1.1.6

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **Utilize a Verifiable Digital Health Certificate**

## Requirements: Utilize a Verifiable Digital Health Certificate (Experimental) 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/trust/Requirements/UtilizeVDHC | *Version*:1.1.6 |
| Active as of 2026-01-28 | *Computable Name*:Utilize VDHC |

 
Utilize a Verifiable Digital Health Certificate that was provided by a Holder 

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
  "id" : "UtilizeVDHC",
  "meta" : {
    "profile" : [
      "http://smart.who.int/base/StructureDefinition/SGRequirements"
    ]
  },
  "url" : "http://smart.who.int/trust/Requirements/UtilizeVDHC",
  "version" : "1.1.6",
  "name" : "Utilize VDHC",
  "title" : "Utilize a Verifiable Digital Health Certificate",
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
  "description" : "Utilize a Verifiable Digital Health Certificate that was provided by a Holder",
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
  "actor" : ["http://smart.who.int/trust/ActorDefinition/Receiver"],
  "statement" : [
    {
      "key" : "UtilizeVDHC-reveive",
      "label" : "Ingest VDHC",
      "requirement" : "A user of a Receiver system receives a Verfiable Digital Health Certificate from a Holder. The user ingests the Verifiable Digital Health Certificate into the Receiver system.  The means of conveyance and how the Verifiable Digital Health Certificate is rendered is depedent on the use context."
    },
    {
      "key" : "UtilizeVDHC-retreive-keys",
      "label" : "Retrieve matching keys",
      "requirement" : "Retrieve and/or filter from an apporopriate PKI material distribution endpoint the set of public keys that match the key identifier (kid), trust domain code, participant code, and/or key usage code as applicable to the context of use of the Verfiable Digital Health Certificate."
    },
    {
      "key" : "UtilizeVDHC-validate-hash",
      "label" : "Compute Hash",
      "requirement" : "As appropriate  to the content type of the Verfiable Digtial Health Certificate, compute the hash of the content, and use the retrieved public keys(s) to try to verify the signature against the hashed value."
    },
    {
      "key" : "UtilizeVDHC-display-verified-content",
      "label" : "Display verified content",
      "requirement" : "Display verified cotent to the user of the Reciever system."
    },
    {
      "key" : "UtilizeVDHC-execute-business-rule",
      "label" : "Execute business rules",
      "requirement" : "Execute zero or more business rules against the Verifiable Digital Health Certificate that was provided by a Holder.  Results of the execution of the business rules are displayed to the user of the Receiver system."
    }
  ]
}

```
