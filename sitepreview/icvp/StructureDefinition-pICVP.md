# pICVP - SMART ICVP v0.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **pICVP**

## Logical Model: pICVP ( Experimental ) 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/icvp/StructureDefinition/pICVP | *Version*:0.3.0 |
| Active as of 2025-10-17 | *Computable Name*:pICVP |

 
Data elements for the Paper Model International Certificate of Vaccination or Prophylaxis. 

**Usages:**

* This Logical Model is not used by any profiles in this Implementation Guide

You can also check for [usages in the FHIR IG Statistics](https://packages2.fhir.org/xig/smart.who.int.icvp|current/StructureDefinition/pICVP)

### Formal Views of Profile Content

 [Description of Profiles, Differentials, Snapshots and how the different presentations work](http://build.fhir.org/ig/FHIR/ig-guidance/readingIgs.html#structure-definitions). 

 

Other representations of profile: [CSV](StructureDefinition-pICVP.csv), [Excel](StructureDefinition-pICVP.xlsx) 



## Resource Content

```json
{
  "resourceType" : "StructureDefinition",
  "id" : "pICVP",
  "meta" : {
    "profile" : [
      "http://hl7.org/fhir/uv/crmi/StructureDefinition/crmi-shareablestructuredefinition",
      "http://hl7.org/fhir/uv/crmi/StructureDefinition/crmi-publishablestructuredefinition"
    ]
  },
  "extension" : [
    {
      "url" : "http://hl7.org/fhir/tools/StructureDefinition/logical-target",
      "valueBoolean" : true
    }
  ],
  "url" : "http://smart.who.int/icvp/StructureDefinition/pICVP",
  "version" : "0.3.0",
  "name" : "pICVP",
  "title" : "pICVP",
  "status" : "active",
  "experimental" : true,
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
  "description" : "Data elements for the Paper Model International Certificate of Vaccination or Prophylaxis.",
  "fhirVersion" : "4.0.1",
  "kind" : "logical",
  "abstract" : false,
  "type" : "http://smart.who.int/icvp/StructureDefinition/pICVP",
  "baseDefinition" : "http://smart.who.int/icvp/StructureDefinition/ICVP",
  "derivation" : "specialization",
  "differential" : {
    "element" : [
      {
        "id" : "pICVP",
        "path" : "pICVP",
        "short" : "pICVP",
        "definition" : "Data elements for the Paper Model International Certificate of Vaccination or Prophylaxis."
      }
    ]
  }
}

```
