# ICVP - SMART ICVP v0.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **ICVP**

## Logical Model: ICVP ( Experimental ) 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/icvp/StructureDefinition/ICVP | *Version*:0.3.0 |
| Active as of 2025-10-17 | *Computable Name*:ICVP |

 
Data elements for the Model International Certificate of Vaccination or Prophylaxis. 

**Usages:**

* Derived from this Logical Model: [ICVP (single)](StructureDefinition-ICVPEvent.md), [DVC Icvp with Selective Disclosure](StructureDefinition-ICVPSD.md) and [pICVP](StructureDefinition-pICVP.md)

You can also check for [usages in the FHIR IG Statistics](https://packages2.fhir.org/xig/smart.who.int.icvp|current/StructureDefinition/ICVP)

### Formal Views of Profile Content

 [Description of Profiles, Differentials, Snapshots and how the different presentations work](http://build.fhir.org/ig/FHIR/ig-guidance/readingIgs.html#structure-definitions). 

 

Other representations of profile: [CSV](StructureDefinition-ICVP.csv), [Excel](StructureDefinition-ICVP.xlsx) 



## Resource Content

```json
{
  "resourceType" : "StructureDefinition",
  "id" : "ICVP",
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
  "url" : "http://smart.who.int/icvp/StructureDefinition/ICVP",
  "version" : "0.3.0",
  "name" : "ICVP",
  "title" : "ICVP",
  "status" : "active",
  "experimental" : true,
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
  "description" : "Data elements for the Model International Certificate of Vaccination or Prophylaxis.",
  "fhirVersion" : "4.0.1",
  "kind" : "logical",
  "abstract" : false,
  "type" : "http://smart.who.int/icvp/StructureDefinition/ICVP",
  "baseDefinition" : "http://smart.who.int/trust-phw/StructureDefinition/PreQualDVC",
  "derivation" : "specialization",
  "differential" : {
    "element" : [
      {
        "id" : "ICVP",
        "path" : "ICVP",
        "short" : "ICVP",
        "definition" : "Data elements for the Model International Certificate of Vaccination or Prophylaxis."
      },
      {
        "id" : "ICVP.vaccineDetails",
        "path" : "ICVP.vaccineDetails",
        "type" : [
          {
            "code" : "http://smart.who.int/icvp/StructureDefinition/ICVPVaccineDetails"
          }
        ]
      }
    ]
  }
}

```
