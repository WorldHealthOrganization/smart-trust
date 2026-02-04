# ICVP HCERT Payload - SMART ICVP v0.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **ICVP HCERT Payload**

## Logical Model: ICVP HCERT Payload 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/icvp/StructureDefinition/ICVPMin | *Version*:0.3.0 |
| Active as of 2025-10-17 | *Computable Name*:ICVPMin |

 
Mininmial DVC payload for use within an HCERT Payload using the ICVP Product Catalogue 

**Usages:**

* This Logical Model is not used by any profiles in this Implementation Guide

You can also check for [usages in the FHIR IG Statistics](https://packages2.fhir.org/xig/smart.who.int.icvp|current/StructureDefinition/ICVPMin)

### Formal Views of Profile Content

 [Description of Profiles, Differentials, Snapshots and how the different presentations work](http://build.fhir.org/ig/FHIR/ig-guidance/readingIgs.html#structure-definitions). 

 

Other representations of profile: [CSV](StructureDefinition-ICVPMin.csv), [Excel](StructureDefinition-ICVPMin.xlsx) 



## Resource Content

```json
{
  "resourceType" : "StructureDefinition",
  "id" : "ICVPMin",
  "url" : "http://smart.who.int/icvp/StructureDefinition/ICVPMin",
  "version" : "0.3.0",
  "name" : "ICVPMin",
  "title" : "ICVP HCERT Payload",
  "status" : "active",
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
  "description" : "Mininmial DVC payload for use within an HCERT Payload using the ICVP Product Catalogue",
  "fhirVersion" : "4.0.1",
  "kind" : "logical",
  "abstract" : false,
  "type" : "http://smart.who.int/icvp/StructureDefinition/ICVPMin",
  "baseDefinition" : "http://smart.who.int/trust-phw/StructureDefinition/DVCMin",
  "derivation" : "specialization",
  "differential" : {
    "element" : [
      {
        "id" : "ICVPMin",
        "path" : "ICVPMin",
        "short" : "ICVP HCERT Payload",
        "definition" : "Mininmial DVC payload for use within an HCERT Payload using the ICVP Product Catalogue"
      },
      {
        "id" : "ICVPMin.v",
        "path" : "ICVPMin.v",
        "type" : [
          {
            "code" : "http://smart.who.int/icvp/StructureDefinition/ICVPMinVaccineDetails"
          }
        ]
      }
    ]
  }
}

```
