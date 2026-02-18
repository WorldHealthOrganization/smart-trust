# CBOR Web Token (CWT) Claim - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **CBOR Web Token (CWT) Claim**

## Logical Model: CBOR Web Token (CWT) Claim ( Abstract ) 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/trust/StructureDefinition/CWT | *Version*:1.3.0 |
| Active as of 2025-10-27 | *Computable Name*:CWT |

 
Logical Model for Data elements in CBOR Web Token (CWT) https://www.iana.org/assignments/cwt/cwt.xhtml 

**Usages:**

* This Logical Model is not used by any profiles in this Implementation Guide

You can also check for [usages in the FHIR IG Statistics](https://packages2.fhir.org/xig/smart.who.int.trust|current/StructureDefinition/CWT)

### Formal Views of Profile Content

 [Description of Profiles, Differentials, Snapshots and how the different presentations work](http://build.fhir.org/ig/FHIR/ig-guidance/readingIgs.html#structure-definitions). 

 

Other representations of profile: [CSV](StructureDefinition-CWT.csv), [Excel](StructureDefinition-CWT.xlsx) 



## Resource Content

```json
{
  "resourceType" : "StructureDefinition",
  "id" : "CWT",
  "url" : "http://smart.who.int/trust/StructureDefinition/CWT",
  "version" : "1.3.0",
  "name" : "CWT",
  "title" : "CBOR Web Token (CWT) Claim",
  "status" : "active",
  "date" : "2025-10-27T08:33:32+00:00",
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
  "description" : "Logical Model for Data elements in CBOR Web Token (CWT) https://www.iana.org/assignments/cwt/cwt.xhtml",
  "jurisdiction" : [
    {
      "coding" : [
        {
          "system" : "http://unstats.un.org/unsd/methods/m49/m49.htm",
          "code" : "001"
        }
      ]
    }
  ],
  "fhirVersion" : "4.0.1",
  "kind" : "logical",
  "abstract" : true,
  "type" : "http://smart.who.int/trust/StructureDefinition/CWT",
  "baseDefinition" : "http://hl7.org/fhir/StructureDefinition/Base",
  "derivation" : "specialization",
  "differential" : {
    "element" : [
      {
        "id" : "CWT",
        "path" : "CWT",
        "short" : "CBOR Web Token (CWT) Claim",
        "definition" : "Logical Model for Data elements in CBOR Web Token (CWT) https://www.iana.org/assignments/cwt/cwt.xhtml"
      },
      {
        "id" : "CWT.header",
        "path" : "CWT.header",
        "short" : "COSE Header",
        "definition" : "Header",
        "min" : 0,
        "max" : "1",
        "type" : [
          {
            "code" : "http://smart.who.int/trust/StructureDefinition/COSEHeader"
          }
        ]
      },
      {
        "id" : "CWT.payload",
        "path" : "CWT.payload",
        "short" : "CWT Payload",
        "definition" : "Payload",
        "min" : 0,
        "max" : "1",
        "type" : [
          {
            "code" : "http://smart.who.int/trust/StructureDefinition/CWTPayload"
          }
        ]
      },
      {
        "id" : "CWT.signature",
        "path" : "CWT.signature",
        "short" : "Signature",
        "definition" : "Signature",
        "min" : 0,
        "max" : "1",
        "type" : [
          {
            "code" : "string"
          }
        ]
      }
    ]
  }
}

```
