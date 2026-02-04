# DVC Certificate - IPS Bundle from WHO ICVP - SMART ICVP v0.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **DVC Certificate - IPS Bundle from WHO ICVP**

## Resource Profile: DVC Certificate - IPS Bundle from WHO ICVP 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/icvp/StructureDefinition/Bundle-uv-ips-ICVP | *Version*:0.3.0 |
| Active as of 2025-10-17 | *Computable Name*:Bundle-uv-ips-ICVP |

 
Profile of the IPS Bundle for representing digital vaccination certificates from WHO ICVP 

**Usages:**

* This Profile is not used by any profiles in this Implementation Guide

You can also check for [usages in the FHIR IG Statistics](https://packages2.fhir.org/xig/smart.who.int.icvp|current/StructureDefinition/Bundle-uv-ips-ICVP)

### Formal Views of Profile Content

 [Description of Profiles, Differentials, Snapshots and how the different presentations work](http://build.fhir.org/ig/FHIR/ig-guidance/readingIgs.html#structure-definitions). 

 

Other representations of profile: [CSV](StructureDefinition-Bundle-uv-ips-ICVP.csv), [Excel](StructureDefinition-Bundle-uv-ips-ICVP.xlsx), [Schematron](StructureDefinition-Bundle-uv-ips-ICVP.sch) 



## Resource Content

```json
{
  "resourceType" : "StructureDefinition",
  "id" : "Bundle-uv-ips-ICVP",
  "url" : "http://smart.who.int/icvp/StructureDefinition/Bundle-uv-ips-ICVP",
  "version" : "0.3.0",
  "name" : "Bundle-uv-ips-ICVP",
  "title" : "DVC Certificate - IPS Bundle from WHO ICVP",
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
  "description" : "Profile of the IPS Bundle for representing digital vaccination certificates from WHO ICVP",
  "fhirVersion" : "4.0.1",
  "mapping" : [
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
      "identity" : "cda",
      "uri" : "http://hl7.org/v3/cda",
      "name" : "CDA (R2)"
    },
    {
      "identity" : "w5",
      "uri" : "http://hl7.org/fhir/fivews",
      "name" : "FiveWs Pattern Mapping"
    }
  ],
  "kind" : "resource",
  "abstract" : false,
  "type" : "Bundle",
  "baseDefinition" : "http://smart.who.int/trust-phw/StructureDefinition/Bundle-uv-ips-PreQual",
  "derivation" : "constraint",
  "differential" : {
    "element" : [
      {
        "id" : "Bundle",
        "path" : "Bundle"
      },
      {
        "id" : "Bundle.entry:composition",
        "path" : "Bundle.entry",
        "sliceName" : "composition"
      },
      {
        "id" : "Bundle.entry:composition.resource",
        "path" : "Bundle.entry.resource",
        "type" : [
          {
            "code" : "Composition",
            "profile" : [
              "http://smart.who.int/icvp/StructureDefinition/Composition-uv-ips-ICVP"
            ]
          }
        ]
      },
      {
        "id" : "Bundle.entry:immunization",
        "path" : "Bundle.entry",
        "sliceName" : "immunization"
      },
      {
        "id" : "Bundle.entry:immunization.resource",
        "path" : "Bundle.entry.resource",
        "type" : [
          {
            "code" : "Immunization",
            "profile" : [
              "http://smart.who.int/icvp/StructureDefinition/Immunization-uv-ips-ICVP"
            ]
          }
        ]
      }
    ]
  }
}

```
