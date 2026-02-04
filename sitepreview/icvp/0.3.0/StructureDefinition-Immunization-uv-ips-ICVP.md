# DVC - WHO ICVP Immunization for IPS - SMART ICVP v0.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **DVC - WHO ICVP Immunization for IPS**

## Resource Profile: DVC - WHO ICVP Immunization for IPS 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/icvp/StructureDefinition/Immunization-uv-ips-ICVP | *Version*:0.3.0 |
| Active as of 2025-10-17 | *Computable Name*:Immunization-uv-ips-ICVP |

 
This profile represents an IPS Immunization record that can be mapped onto a Digital Vaccine Certificates using the WHO PreQual Database 

**Usages:**

* Use this Profile: [DVC Certificate - IPS Bundle from WHO ICVP](StructureDefinition-Bundle-uv-ips-ICVP.md)
* Refer to this Profile: [DVC Certificate - IPS Composition for WHO ICVP](StructureDefinition-Composition-uv-ips-ICVP.md)

You can also check for [usages in the FHIR IG Statistics](https://packages2.fhir.org/xig/smart.who.int.icvp|current/StructureDefinition/Immunization-uv-ips-ICVP)

### Formal Views of Profile Content

 [Description of Profiles, Differentials, Snapshots and how the different presentations work](http://build.fhir.org/ig/FHIR/ig-guidance/readingIgs.html#structure-definitions). 

 

Other representations of profile: [CSV](StructureDefinition-Immunization-uv-ips-ICVP.csv), [Excel](StructureDefinition-Immunization-uv-ips-ICVP.xlsx), [Schematron](StructureDefinition-Immunization-uv-ips-ICVP.sch) 



## Resource Content

```json
{
  "resourceType" : "StructureDefinition",
  "id" : "Immunization-uv-ips-ICVP",
  "url" : "http://smart.who.int/icvp/StructureDefinition/Immunization-uv-ips-ICVP",
  "version" : "0.3.0",
  "name" : "Immunization-uv-ips-ICVP",
  "title" : "DVC - WHO ICVP Immunization for IPS",
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
  "description" : "This profile represents an IPS Immunization record that can be mapped onto a Digital Vaccine Certificates using the WHO PreQual Database",
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
  "baseDefinition" : "http://smart.who.int/trust-phw/StructureDefinition/Immunization-uv-ips-PreQual",
  "derivation" : "constraint",
  "differential" : {
    "element" : [
      {
        "id" : "Immunization.extension:productID",
        "path" : "Immunization.extension",
        "sliceName" : "productID",
        "constraint" : [
          {
            "key" : "has-an-icvp-vaccine-product-id-code",
            "severity" : "error",
            "human" : "Check if there is a business identifier of a vaccine product in the ICVP product catalogue,  The ICVP product catalogue consists of vaccines listed in the list of Prequalified Vaccines and the Emergency Use Listing.\n - https://extranet.who.int/prequal/vaccines/prequalified-vaccines\n - https://www.who.int/teams/regulation-prequalification/eul\n\nIn FHIR R6, this could also be a reference to an InventoryItem",
            "expression" : ".valueCoding.code.memberOf('http://smart.who.int/icvp/ValueSet/ICVPProductIds')",
            "source" : "http://smart.who.int/icvp/StructureDefinition/Immunization-uv-ips-ICVP"
          }
        ]
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
            "source" : "http://smart.who.int/icvp/StructureDefinition/Immunization-uv-ips-ICVP"
          }
        ]
      }
    ]
  }
}

```
