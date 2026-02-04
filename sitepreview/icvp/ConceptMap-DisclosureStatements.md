# Discloure Statement maapings - SMART ICVP v0.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **Discloure Statement maapings**

## ConceptMap: Discloure Statement maapings 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/icvp/ConceptMap/DisclosureStatements | *Version*:0.3.0 |
| Active as of 2025-10-17 | *Computable Name*:DisclosureStatements |

 
Mapping from Disclosure Statements to itself to show relatiohships 

Mapping from (not specified) to (not specified)

**Group 1**Mapping from [Discloure Statement maapings](ConceptMap-DisclosureStatements.md) to [Discloure Statement maapings](ConceptMap-DisclosureStatements.md)

* **Source Code**: disclose-icvp-narrative
  * **Relationship**: [maps to wider concept](http://hl7.org/fhir/R5/codesystem-concept-map-relationship.html#wider)
  * **Target Code**: disclose-icvp
* **Source Code**: disclose-icvp-demographic
  * **Relationship**: [maps to wider concept](http://hl7.org/fhir/R5/codesystem-concept-map-relationship.html#wider)
  * **Target Code**: disclose-icvp
* **Source Code**: disclose-icvp-demographic-narrative
  * **Relationship**: [maps to wider concept](http://hl7.org/fhir/R5/codesystem-concept-map-relationship.html#wider)
  * **Target Code**: disclose-icvp-demographic
* **Source Code**: disclose-icvp-demographic-name
  * **Relationship**: [maps to wider concept](http://hl7.org/fhir/R5/codesystem-concept-map-relationship.html#wider)
  * **Target Code**: disclose-icvp-demographic
* **Source Code**: disclose-icvp-demographic-dob
  * **Relationship**: [maps to wider concept](http://hl7.org/fhir/R5/codesystem-concept-map-relationship.html#wider)
  * **Target Code**: disclose-icvp-demographic
* **Source Code**: disclose-icvp-demographic-nationality
  * **Relationship**: [maps to wider concept](http://hl7.org/fhir/R5/codesystem-concept-map-relationship.html#wider)
  * **Target Code**: disclose-icvp-demographic
* **Source Code**: disclose-icvp-demographic-national-id
  * **Relationship**: [maps to wider concept](http://hl7.org/fhir/R5/codesystem-concept-map-relationship.html#wider)
  * **Target Code**: disclose-icvp-demographic
* **Source Code**: disclose-icvp-vaccination
  * **Relationship**: [maps to wider concept](http://hl7.org/fhir/R5/codesystem-concept-map-relationship.html#wider)
  * **Target Code**: disclose-icvp
* **Source Code**: disclose-icvp-vaccination-narrative
  * **Relationship**: [maps to wider concept](http://hl7.org/fhir/R5/codesystem-concept-map-relationship.html#wider)
  * **Target Code**: disclose-icvp-vaccination
* **Source Code**: disclose-icvp-vaccination-clinician-name
  * **Relationship**: [maps to wider concept](http://hl7.org/fhir/R5/codesystem-concept-map-relationship.html#wider)
  * **Target Code**: disclose-icvp-vaccination
* **Source Code**: disclose-icvp-vaccination-issuer
  * **Relationship**: [maps to wider concept](http://hl7.org/fhir/R5/codesystem-concept-map-relationship.html#wider)
  * **Target Code**: disclose-icvp-vaccination



## Resource Content

```json
{
  "resourceType" : "ConceptMap",
  "id" : "DisclosureStatements",
  "url" : "http://smart.who.int/icvp/ConceptMap/DisclosureStatements",
  "version" : "0.3.0",
  "name" : "DisclosureStatements",
  "title" : "Discloure Statement maapings",
  "status" : "active",
  "experimental" : false,
  "date" : "2025-10-17T14:28:32+00:00",
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
  "description" : "Mapping from Disclosure Statements to itself to show relatiohships",
  "group" : [
    {
      "source" : "http://smart.who.int/icvp/ConceptMap/DisclosureStatements",
      "target" : "http://smart.who.int/icvp/ConceptMap/DisclosureStatements",
      "element" : [
        {
          "code" : "disclose-icvp-narrative",
          "target" : [
            {
              "code" : "disclose-icvp",
              "equivalence" : "wider"
            }
          ]
        },
        {
          "code" : "disclose-icvp-demographic",
          "target" : [
            {
              "code" : "disclose-icvp",
              "equivalence" : "wider"
            }
          ]
        },
        {
          "code" : "disclose-icvp-demographic-narrative",
          "target" : [
            {
              "code" : "disclose-icvp-demographic",
              "equivalence" : "wider"
            }
          ]
        },
        {
          "code" : "disclose-icvp-demographic-name",
          "target" : [
            {
              "code" : "disclose-icvp-demographic",
              "equivalence" : "wider"
            }
          ]
        },
        {
          "code" : "disclose-icvp-demographic-dob",
          "target" : [
            {
              "code" : "disclose-icvp-demographic",
              "equivalence" : "wider"
            }
          ]
        },
        {
          "code" : "disclose-icvp-demographic-nationality",
          "target" : [
            {
              "code" : "disclose-icvp-demographic",
              "equivalence" : "wider"
            }
          ]
        },
        {
          "code" : "disclose-icvp-demographic-national-id",
          "target" : [
            {
              "code" : "disclose-icvp-demographic",
              "equivalence" : "wider"
            }
          ]
        },
        {
          "code" : "disclose-icvp-vaccination",
          "target" : [
            {
              "code" : "disclose-icvp",
              "equivalence" : "wider"
            }
          ]
        },
        {
          "code" : "disclose-icvp-vaccination-narrative",
          "target" : [
            {
              "code" : "disclose-icvp-vaccination",
              "equivalence" : "wider"
            }
          ]
        },
        {
          "code" : "disclose-icvp-vaccination-clinician-name",
          "target" : [
            {
              "code" : "disclose-icvp-vaccination",
              "equivalence" : "wider"
            }
          ]
        },
        {
          "code" : "disclose-icvp-vaccination-issuer",
          "target" : [
            {
              "code" : "disclose-icvp-vaccination",
              "equivalence" : "wider"
            }
          ]
        }
      ]
    }
  ]
}

```
