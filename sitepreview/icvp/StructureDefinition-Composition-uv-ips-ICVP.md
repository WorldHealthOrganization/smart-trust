# DVC Certificate - IPS Composition for WHO ICVP - SMART ICVP v0.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **DVC Certificate - IPS Composition for WHO ICVP**

## Resource Profile: DVC Certificate - IPS Composition for WHO ICVP 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/icvp/StructureDefinition/Composition-uv-ips-ICVP | *Version*:0.3.0 |
| Active as of 2025-10-17 | *Computable Name*:Composition-uv-ips-ICVP |

 
Profile of the IPS Composition for representing digital vaccination certificates with WHO PreQual Database for ICVP 

**Usages:**

* Use this Profile: [DVC Certificate - IPS Bundle from WHO ICVP](StructureDefinition-Bundle-uv-ips-ICVP.md)

You can also check for [usages in the FHIR IG Statistics](https://packages2.fhir.org/xig/smart.who.int.icvp|current/StructureDefinition/Composition-uv-ips-ICVP)

### Formal Views of Profile Content

 [Description of Profiles, Differentials, Snapshots and how the different presentations work](http://build.fhir.org/ig/FHIR/ig-guidance/readingIgs.html#structure-definitions). 

 

Other representations of profile: [CSV](StructureDefinition-Composition-uv-ips-ICVP.csv), [Excel](StructureDefinition-Composition-uv-ips-ICVP.xlsx), [Schematron](StructureDefinition-Composition-uv-ips-ICVP.sch) 



## Resource Content

```json
{
  "resourceType" : "StructureDefinition",
  "id" : "Composition-uv-ips-ICVP",
  "url" : "http://smart.who.int/icvp/StructureDefinition/Composition-uv-ips-ICVP",
  "version" : "0.3.0",
  "name" : "Composition-uv-ips-ICVP",
  "title" : "DVC Certificate - IPS Composition for WHO ICVP",
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
  "description" : "Profile of the IPS Composition for representing digital vaccination certificates with WHO PreQual Database for ICVP",
  "fhirVersion" : "4.0.1",
  "mapping" : [
    {
      "identity" : "workflow",
      "uri" : "http://hl7.org/fhir/workflow",
      "name" : "Workflow Pattern"
    },
    {
      "identity" : "rim",
      "uri" : "http://hl7.org/v3",
      "name" : "RIM Mapping"
    },
    {
      "identity" : "cda",
      "uri" : "http://hl7.org/v3/cda",
      "name" : "CDA (R2)"
    },
    {
      "identity" : "fhirdocumentreference",
      "uri" : "http://hl7.org/fhir/documentreference",
      "name" : "FHIR DocumentReference"
    },
    {
      "identity" : "w5",
      "uri" : "http://hl7.org/fhir/fivews",
      "name" : "FiveWs Pattern Mapping"
    }
  ],
  "kind" : "resource",
  "abstract" : false,
  "type" : "Composition",
  "baseDefinition" : "http://smart.who.int/trust-phw/StructureDefinition/Composition-uv-ips-PreQual",
  "derivation" : "constraint",
  "differential" : {
    "element" : [
      {
        "id" : "Composition.section:sectionImmunizations",
        "path" : "Composition.section",
        "sliceName" : "sectionImmunizations"
      },
      {
        "id" : "Composition.section:sectionImmunizations.entry",
        "path" : "Composition.section.entry",
        "type" : [
          {
            "code" : "Reference",
            "targetProfile" : [
              "http://smart.who.int/icvp/StructureDefinition/Immunization-uv-ips-ICVP"
            ]
          }
        ]
      },
      {
        "id" : "Composition.section:sectionImmunizations.entry:immunization",
        "path" : "Composition.section.entry",
        "sliceName" : "immunization",
        "type" : [
          {
            "code" : "Reference",
            "targetProfile" : [
              "http://smart.who.int/icvp/StructureDefinition/Immunization-uv-ips-ICVP"
            ]
          }
        ]
      }
    ]
  }
}

```
