# Distribute FHIR business rules - WHO SMART Trust v1.1.6

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **Distribute FHIR business rules**

## Requirements: Distribute FHIR business rules (Experimental) 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/trust/Requirements/DistributeBusinessRulesFHIR | *Version*:1.1.6 |
| Active as of 2025-10-26 | *Computable Name*:Distribute FHIR Business Rules |

 
Make received business rules available through a distrubution point to a Receiver through HL7 FHIR standards 

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
  "id" : "DistributeBusinessRulesFHIR",
  "meta" : {
    "profile" : [
      "http://smart.who.int/base/StructureDefinition/SGRequirements"
    ]
  },
  "extension" : [
    {
      "url" : "http://smart.who.int/base/StructureDefinition/Satisfies",
      "valueReference" : {
        "reference" : "Requirements/DistributeBusinessRules"
      }
    }
  ],
  "url" : "http://smart.who.int/trust/Requirements/DistributeBusinessRulesFHIR",
  "version" : "1.1.6",
  "name" : "Distribute FHIR Business Rules",
  "title" : "Distribute FHIR business rules",
  "status" : "active",
  "experimental" : true,
  "date" : "2025-10-26T07:45:42+00:00",
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
  "description" : "Make received business rules available through a distrubution point to a Receiver through HL7 FHIR standards",
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
