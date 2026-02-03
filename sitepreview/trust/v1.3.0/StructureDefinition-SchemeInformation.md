# Scheme Information - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **Scheme Information**

## Logical Model: Scheme Information ( Abstract ) 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/trust/StructureDefinition/SchemeInformation | *Version*:1.3.0 |
| Draft as of 2025-10-27 | *Computable Name*:SchemeInformation |

 
Logical Model for Information on the trusted list and its issuing scheme 

**Usages:**

* This Logical Model is not used by any profiles in this Implementation Guide

You can also check for [usages in the FHIR IG Statistics](https://packages2.fhir.org/xig/smart.who.int.trust|current/StructureDefinition/SchemeInformation)

### Formal Views of Profile Content

 [Description of Profiles, Differentials, Snapshots and how the different presentations work](http://build.fhir.org/ig/FHIR/ig-guidance/readingIgs.html#structure-definitions). 

 

Other representations of profile: [CSV](StructureDefinition-SchemeInformation.csv), [Excel](StructureDefinition-SchemeInformation.xlsx) 



## Resource Content

```json
{
  "resourceType" : "StructureDefinition",
  "id" : "SchemeInformation",
  "url" : "http://smart.who.int/trust/StructureDefinition/SchemeInformation",
  "version" : "1.3.0",
  "name" : "SchemeInformation",
  "title" : "Scheme Information",
  "status" : "draft",
  "date" : "2025-10-27T08:33:32+00:00",
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
  "description" : "Logical Model for Information on the trusted list and its issuing scheme",
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
  "fhirVersion" : "4.0.1",
  "kind" : "logical",
  "abstract" : true,
  "type" : "http://smart.who.int/trust/StructureDefinition/SchemeInformation",
  "baseDefinition" : "http://hl7.org/fhir/StructureDefinition/Base",
  "derivation" : "specialization",
  "differential" : {
    "element" : [
      {
        "id" : "SchemeInformation",
        "path" : "SchemeInformation",
        "short" : "Scheme Information",
        "definition" : "Logical Model for Information on the trusted list and its issuing scheme"
      },
      {
        "id" : "SchemeInformation.versionIdentifier",
        "path" : "SchemeInformation.versionIdentifier",
        "short" : "TSL version identifier (clause 5.3.1)",
        "definition" : "TSL version identifier (clause 5.3.1)",
        "min" : 1,
        "max" : "1",
        "type" : [
          {
            "code" : "integer"
          }
        ]
      },
      {
        "id" : "SchemeInformation.sequenceNumber",
        "path" : "SchemeInformation.sequenceNumber",
        "short" : "TSL sequence number (clause 5.3.2)",
        "definition" : "TSL sequence number (clause 5.3.2)",
        "min" : 1,
        "max" : "1",
        "type" : [
          {
            "code" : "integer"
          }
        ]
      },
      {
        "id" : "SchemeInformation.type",
        "path" : "SchemeInformation.type",
        "short" : "TSL type (clause 5.3.3)",
        "definition" : "TSL type (clause 5.3.3)",
        "min" : 1,
        "max" : "1",
        "type" : [
          {
            "code" : "uri"
          }
        ]
      },
      {
        "id" : "SchemeInformation.operatorName",
        "path" : "SchemeInformation.operatorName",
        "short" : "Scheme operator name (clause 5.3.4)",
        "definition" : "Scheme operator name (clause 5.3.4)",
        "min" : 1,
        "max" : "1",
        "type" : [
          {
            "code" : "string"
          }
        ]
      },
      {
        "id" : "SchemeInformation.operatorAddress",
        "path" : "SchemeInformation.operatorAddress",
        "short" : "Scheme operator address (clause 5.3.5)",
        "definition" : "Scheme operator address (clause 5.3.5)",
        "min" : 1,
        "max" : "*",
        "type" : [
          {
            "code" : "BackboneElement"
          }
        ]
      },
      {
        "id" : "SchemeInformation.operatorAddress.operatorPostalAddress",
        "path" : "SchemeInformation.operatorAddress.operatorPostalAddress",
        "short" : "Scheme Operator Postal Address",
        "definition" : "Scheme Operator Postal Address",
        "min" : 1,
        "max" : "*",
        "type" : [
          {
            "code" : "Address"
          }
        ]
      },
      {
        "id" : "SchemeInformation.operatorAddress.operatorElectronicAddress",
        "path" : "SchemeInformation.operatorAddress.operatorElectronicAddress",
        "short" : "Scheme Operator Electronic Address",
        "definition" : "Scheme Operator Electronic Address",
        "min" : 0,
        "max" : "*",
        "type" : [
          {
            "code" : "ContactPoint"
          }
        ]
      },
      {
        "id" : "SchemeInformation.name",
        "path" : "SchemeInformation.name",
        "short" : "Scheme name (clause 5.3.6)",
        "definition" : "Scheme name (clause 5.3.6) CC:EN_name_value",
        "min" : 1,
        "max" : "1",
        "type" : [
          {
            "code" : "string"
          }
        ]
      },
      {
        "id" : "SchemeInformation.informationURI",
        "path" : "SchemeInformation.informationURI",
        "short" : "Scheme information URI (clause 5.3.7)",
        "definition" : "Scheme information URI (clause 5.3.7)",
        "min" : 1,
        "max" : "1",
        "type" : [
          {
            "code" : "uri"
          }
        ]
      },
      {
        "id" : "SchemeInformation.statusDeterminiationApproach",
        "path" : "SchemeInformation.statusDeterminiationApproach",
        "short" : "Status determination approach (clause 5.3.8)",
        "definition" : "Status determination approach (clause 5.3.8)",
        "min" : 1,
        "max" : "1",
        "type" : [
          {
            "code" : "uri"
          }
        ]
      },
      {
        "id" : "SchemeInformation.schemeType",
        "path" : "SchemeInformation.schemeType",
        "short" : "Scheme type/community/rules (clause 5.3.9)",
        "definition" : "Scheme type/community/rules (clause 5.3.9)",
        "min" : 1,
        "max" : "1",
        "type" : [
          {
            "code" : "uri"
          }
        ]
      },
      {
        "id" : "SchemeInformation.territory",
        "path" : "SchemeInformation.territory",
        "short" : "Scheme territory (clause 5.3.10)",
        "definition" : "Scheme territory (clause 5.3.10)",
        "min" : 1,
        "max" : "1",
        "type" : [
          {
            "code" : "string"
          }
        ]
      },
      {
        "id" : "SchemeInformation.policy",
        "path" : "SchemeInformation.policy",
        "short" : "TSL policy/legal notice (clause 5.3.11)",
        "definition" : "TSL policy/legal notice (clause 5.3.11)",
        "min" : 1,
        "max" : "1",
        "type" : [
          {
            "code" : "uri"
          }
        ]
      },
      {
        "id" : "SchemeInformation.historicalInformationPeriod",
        "path" : "SchemeInformation.historicalInformationPeriod",
        "short" : "Historical information period (clause 5.3.12)",
        "definition" : "Historical information period (clause 5.3.12)",
        "min" : 1,
        "max" : "1",
        "type" : [
          {
            "code" : "integer"
          }
        ]
      },
      {
        "id" : "SchemeInformation.otherTSL",
        "path" : "SchemeInformation.otherTSL",
        "short" : "Pointers to other TSLs (clause 5.3.13)",
        "definition" : "Pointers to other TSLs (clause 5.3.13)",
        "min" : 0,
        "max" : "*",
        "type" : [
          {
            "code" : "string"
          }
        ]
      },
      {
        "id" : "SchemeInformation.issDateTime",
        "path" : "SchemeInformation.issDateTime",
        "short" : "List issue date and time (clause 5.3.14)",
        "definition" : "List issue date and time (clause 5.3.14)",
        "min" : 1,
        "max" : "1",
        "type" : [
          {
            "code" : "dateTime"
          }
        ]
      },
      {
        "id" : "SchemeInformation.nextUpdate",
        "path" : "SchemeInformation.nextUpdate",
        "short" : "Next update (clause 5.3.15)",
        "definition" : "Next update (clause 5.3.15)",
        "min" : 1,
        "max" : "1",
        "type" : [
          {
            "code" : "dateTime"
          }
        ]
      },
      {
        "id" : "SchemeInformation.distributionPoints",
        "path" : "SchemeInformation.distributionPoints",
        "short" : "Distribution points (clause 5.3.16)",
        "definition" : "Distribution points (clause 5.3.16)",
        "min" : 0,
        "max" : "*",
        "type" : [
          {
            "code" : "uri"
          }
        ]
      },
      {
        "id" : "SchemeInformation.extensions",
        "path" : "SchemeInformation.extensions",
        "short" : "Scheme extensions (clause 5.3.17)",
        "definition" : "Scheme extensions (clause 5.3.17)",
        "min" : 0,
        "max" : "*",
        "type" : [
          {
            "code" : "string"
          }
        ]
      }
    ]
  }
}

```
