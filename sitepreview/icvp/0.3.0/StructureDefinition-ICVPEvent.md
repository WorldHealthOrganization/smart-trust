# ICVP (single) - SMART ICVP v0.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **ICVP (single)**

## Logical Model: ICVP (single) 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/icvp/StructureDefinition/ICVPEvent | *Version*:0.3.0 |
| Active as of 2025-10-17 | *Computable Name*:ICVPEvent |

 
ICVP for a single vaccincation event 

**Usages:**

* This Logical Model Profile is not used by any profiles in this Implementation Guide

You can also check for [usages in the FHIR IG Statistics](https://packages2.fhir.org/xig/smart.who.int.icvp|current/StructureDefinition/ICVPEvent)

### Formal Views of Profile Content

 [Description of Profiles, Differentials, Snapshots and how the different presentations work](http://build.fhir.org/ig/FHIR/ig-guidance/readingIgs.html#structure-definitions). 

 

Other representations of profile: [CSV](StructureDefinition-ICVPEvent.csv), [Excel](StructureDefinition-ICVPEvent.xlsx) 



## Resource Content

```json
{
  "resourceType" : "StructureDefinition",
  "id" : "ICVPEvent",
  "extension" : [
    {
      "url" : "http://hl7.org/fhir/tools/StructureDefinition/logical-target",
      "valueBoolean" : true
    }
  ],
  "url" : "http://smart.who.int/icvp/StructureDefinition/ICVPEvent",
  "version" : "0.3.0",
  "name" : "ICVPEvent",
  "title" : "ICVP (single)",
  "status" : "active",
  "date" : "2025-10-17T14:23:37+00:00",
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
  "description" : "ICVP for a single vaccincation event",
  "fhirVersion" : "4.0.1",
  "kind" : "logical",
  "abstract" : false,
  "type" : "http://smart.who.int/icvp/StructureDefinition/ICVP",
  "baseDefinition" : "http://smart.who.int/icvp/StructureDefinition/ICVP",
  "derivation" : "constraint",
  "differential" : {
    "element" : [
      {
        "id" : "ICVP",
        "path" : "ICVP"
      },
      {
        "id" : "ICVP.vaccineDetails",
        "path" : "ICVP.vaccineDetails",
        "max" : "1"
      }
    ]
  }
}

```
