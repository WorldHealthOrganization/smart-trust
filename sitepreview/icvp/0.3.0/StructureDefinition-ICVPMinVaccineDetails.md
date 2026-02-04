# ICVP HCERT Payload - SMART ICVP v0.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **ICVP HCERT Payload**

## Logical Model: ICVP HCERT Payload 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/icvp/StructureDefinition/ICVPMinVaccineDetails | *Version*:0.3.0 |
| Active as of 2025-10-17 | *Computable Name*:ICVPMinVaccineDetails |

 
Mininmial vaccine detail in DVC payload for use within an HCERT Payload using the ICVP Product Catalogue 

**Usages:**

* Use this Logical Model: [ICVP HCERT Payload](StructureDefinition-ICVPMin.md)

You can also check for [usages in the FHIR IG Statistics](https://packages2.fhir.org/xig/smart.who.int.icvp|current/StructureDefinition/ICVPMinVaccineDetails)

### Formal Views of Profile Content

 [Description of Profiles, Differentials, Snapshots and how the different presentations work](http://build.fhir.org/ig/FHIR/ig-guidance/readingIgs.html#structure-definitions). 

 

Other representations of profile: [CSV](StructureDefinition-ICVPMinVaccineDetails.csv), [Excel](StructureDefinition-ICVPMinVaccineDetails.xlsx) 



## Resource Content

```json
{
  "resourceType" : "StructureDefinition",
  "id" : "ICVPMinVaccineDetails",
  "url" : "http://smart.who.int/icvp/StructureDefinition/ICVPMinVaccineDetails",
  "version" : "0.3.0",
  "name" : "ICVPMinVaccineDetails",
  "title" : "ICVP HCERT Payload",
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
  "description" : "Mininmial vaccine detail in DVC payload for use within an HCERT Payload using the ICVP Product Catalogue",
  "fhirVersion" : "4.0.1",
  "kind" : "logical",
  "abstract" : false,
  "type" : "http://smart.who.int/icvp/StructureDefinition/ICVPMinVaccineDetails",
  "baseDefinition" : "http://smart.who.int/trust-phw/StructureDefinition/DVCMinVaccineDetails",
  "derivation" : "specialization",
  "differential" : {
    "element" : [
      {
        "id" : "ICVPMinVaccineDetails",
        "path" : "ICVPMinVaccineDetails",
        "short" : "ICVP HCERT Payload",
        "definition" : "Mininmial vaccine detail in DVC payload for use within an HCERT Payload using the ICVP Product Catalogue"
      },
      {
        "id" : "ICVPMinVaccineDetails.vp",
        "path" : "ICVPMinVaccineDetails.vp",
        "binding" : {
          "strength" : "required",
          "valueSet" : "http://smart.who.int/icvp/ValueSet/ICVPProductIds"
        }
      }
    ]
  }
}

```
