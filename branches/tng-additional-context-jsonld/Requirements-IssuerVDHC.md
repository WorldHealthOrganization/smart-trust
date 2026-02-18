# Issue Verifiable Digital Health Certificate - WHO SMART Trust v1.1.6

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **Issue Verifiable Digital Health Certificate**

## Requirements: Issue Verifiable Digital Health Certificate (Experimental) 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/trust/Requirements/IssuerVDHC | *Version*:1.1.6 |
| Active as of 2026-01-28 | *Computable Name*:Issue VDHC |

 
Issue a Verifiable Digital Health Certificate to a Holder 

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
  "id" : "IssuerVDHC",
  "meta" : {
    "profile" : [
      "http://smart.who.int/base/StructureDefinition/SGRequirements"
    ]
  },
  "url" : "http://smart.who.int/trust/Requirements/IssuerVDHC",
  "version" : "1.1.6",
  "name" : "Issue VDHC",
  "title" : "Issue Verifiable Digital Health Certificate",
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
  "description" : "Issue a Verifiable Digital Health Certificate to a Holder",
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
  "actor" : ["http://smart.who.int/trust/ActorDefinition/Issuer"],
  "statement" : [
    {
      "key" : "IssuerVDHC-generate",
      "label" : "Generate Verifiable Digital Health Certificate",
      "requirement" : "Generate the content that will be signed as part of a Verifiable Digital Health Certificate"
    },
    {
      "key" : "IssuerVDHC-sign",
      "label" : "Sign Verifiable Digital Health Certificate",
      "requirement" : "Sign content to produce a Verifiable Digital Health Certificate."
    }
  ]
}

```
