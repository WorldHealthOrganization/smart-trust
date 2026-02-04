# ICVP Immunization - SMART ICVP v0.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **ICVP Immunization**

## Resource Profile: ICVP Immunization 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/icvp/StructureDefinition/ICVPImmunization | *Version*:0.3.0 |
| Active as of 2025-10-17 | *Computable Name*:ICVPImmunization |

 
This profile represents Immunization record for Digital Vaccine Certificates for use in the International Certificate of Vaccination or Prophylaxis (ICVP). Such vaccine should be listed in the ICVP Product Catalogue 
The ICVP product catalogue consists of vaccines listed in the list of Prequalified Vaccines and the Emergency Use Listing. 
* https://extranet.who.int/prequal/vaccines/prequalified-vaccines
* https://www.who.int/teams/regulation-prequalification/eul
 
In FHIR R6, this could also be a reference to an InventoryItem 

**Usages:**

* This Profile is not used by any profiles in this Implementation Guide

You can also check for [usages in the FHIR IG Statistics](https://packages2.fhir.org/xig/smart.who.int.icvp|current/StructureDefinition/ICVPImmunization)

### Formal Views of Profile Content

 [Description of Profiles, Differentials, Snapshots and how the different presentations work](http://build.fhir.org/ig/FHIR/ig-guidance/readingIgs.html#structure-definitions). 

 

Other representations of profile: [CSV](StructureDefinition-ICVPImmunization.csv), [Excel](StructureDefinition-ICVPImmunization.xlsx), [Schematron](StructureDefinition-ICVPImmunization.sch) 



## Resource Content

```json
{
  "resourceType" : "StructureDefinition",
  "id" : "ICVPImmunization",
  "url" : "http://smart.who.int/icvp/StructureDefinition/ICVPImmunization",
  "version" : "0.3.0",
  "name" : "ICVPImmunization",
  "title" : "ICVP Immunization",
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
  "description" : "This profile represents Immunization record for Digital Vaccine Certificates for use in the International Certificate of Vaccination or Prophylaxis (ICVP).  Such vaccine should be listed in the ICVP Product Catalogue\n\nThe ICVP product catalogue consists of vaccines listed in the list of Prequalified Vaccines and the Emergency Use Listing.\n - https://extranet.who.int/prequal/vaccines/prequalified-vaccines\n - https://www.who.int/teams/regulation-prequalification/eul\n\nIn FHIR R6, this could also be a reference to an InventoryItem\n",
  "fhirVersion" : "4.0.1",
  "mapping" : [
    {
      "identity" : "workflow",
      "uri" : "http://hl7.org/fhir/workflow",
      "name" : "Workflow Pattern"
    },
    {
      "identity" : "v2",
      "uri" : "http://hl7.org/v2",
      "name" : "HL7 v2 Mapping"
    },
    {
      "identity" : "rim",
      "uri" : "http://hl7.org/v3",
      "name" : "RIM Mapping"
    },
    {
      "identity" : "w5",
      "uri" : "http://hl7.org/fhir/fivews",
      "name" : "FiveWs Pattern Mapping"
    },
    {
      "identity" : "cda",
      "uri" : "http://hl7.org/v3/cda",
      "name" : "CDA (R2)"
    }
  ],
  "kind" : "resource",
  "abstract" : false,
  "type" : "Immunization",
  "baseDefinition" : "http://smart.who.int/trust-phw/StructureDefinition/DVCImmunization",
  "derivation" : "constraint",
  "differential" : {
    "element" : [
      {
        "id" : "Immunization",
        "path" : "Immunization"
      },
      {
        "id" : "Immunization.vaccineCode",
        "path" : "Immunization.vaccineCode",
        "constraint" : [
          {
            "key" : "has-an-icvp-vaccine-type",
            "severity" : "error",
            "human" : "Ensure vaccine type is from the prequal vaccine database for ICVP vaccines",
            "expression" : "memberOf('http://smart.who.int/icvp/ValueSet/ICVPVaccineType')",
            "source" : "http://smart.who.int/icvp/StructureDefinition/ICVPImmunization"
          }
        ]
      }
    ]
  }
}

```
