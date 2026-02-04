# ICVP - Vaccine Details - SMART ICVP v0.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **ICVP - Vaccine Details**

## Logical Model: ICVP - Vaccine Details ( Experimental ) 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/icvp/StructureDefinition/ICVPVaccineDetails | *Version*:0.3.0 |
| Active as of 2025-10-17 | *Computable Name*:ICVPVaccineDetails |

 
Vaccine Data elements for the International Certificate of Vaccination or Prophylaxis 

**Usages:**

* Derived from this Logical Model: [ICVP Vaccine Details with Selective Disclosure](StructureDefinition-ICVPVaccineDetailsSD.md) and [pICVP - Vaccine Details](StructureDefinition-pICVPVaccineDetails.md)
* Use this Logical Model: [ICVP](StructureDefinition-ICVP.md) and [DVC Icvp with Selective Disclosure](StructureDefinition-ICVPSD.md)

You can also check for [usages in the FHIR IG Statistics](https://packages2.fhir.org/xig/smart.who.int.icvp|current/StructureDefinition/ICVPVaccineDetails)

### Formal Views of Profile Content

 [Description of Profiles, Differentials, Snapshots and how the different presentations work](http://build.fhir.org/ig/FHIR/ig-guidance/readingIgs.html#structure-definitions). 

 

Other representations of profile: [CSV](StructureDefinition-ICVPVaccineDetails.csv), [Excel](StructureDefinition-ICVPVaccineDetails.xlsx) 



## Resource Content

```json
{
  "resourceType" : "StructureDefinition",
  "id" : "ICVPVaccineDetails",
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
  "url" : "http://smart.who.int/icvp/StructureDefinition/ICVPVaccineDetails",
  "version" : "0.3.0",
  "name" : "ICVPVaccineDetails",
  "title" : "ICVP - Vaccine Details",
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
  "description" : "Vaccine Data elements for the International Certificate of Vaccination or Prophylaxis",
  "fhirVersion" : "4.0.1",
  "kind" : "logical",
  "abstract" : false,
  "type" : "http://smart.who.int/icvp/StructureDefinition/ICVPVaccineDetails",
  "baseDefinition" : "http://smart.who.int/trust-phw/StructureDefinition/PreQualVaccineDetails",
  "derivation" : "specialization",
  "differential" : {
    "element" : [
      {
        "id" : "ICVPVaccineDetails",
        "path" : "ICVPVaccineDetails",
        "short" : "ICVP - Vaccine Details",
        "definition" : "Vaccine Data elements for the International Certificate of Vaccination or Prophylaxis"
      },
      {
        "id" : "ICVPVaccineDetails.productID",
        "path" : "ICVPVaccineDetails.productID",
        "constraint" : [
          {
            "key" : "is-an-icvp-product-id",
            "severity" : "error",
            "human" : "Product ID comes from the ICVP vaccines from the PreQual Databatase",
            "expression" : "\n\nsystem = 'http://smart.who.int/pcmt-vaxprequal/CodeSystem/PreQualProductIds'\n\n",
            "source" : "http://smart.who.int/icvp/StructureDefinition/ICVPVaccineDetails"
          }
        ]
      }
    ]
  }
}

```
