# COSE Headers (DRAFT) - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **COSE Headers (DRAFT)**

## Logical Model: COSE Headers (DRAFT) 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/trust/StructureDefinition/COSEHeader | *Version*:1.3.0 |
| Active as of 2025-10-27 | *Computable Name*:COSEHeader |

 
Data elements for COSE Headers https://www.iana.org/assignments/cose/cose.xhtml#header-parameters 

**Usages:**

* Use this Logical Model: [CBOR Web Token (CWT) Claim](StructureDefinition-CWT.md)

You can also check for [usages in the FHIR IG Statistics](https://packages2.fhir.org/xig/smart.who.int.trust|current/StructureDefinition/COSEHeader)

### Formal Views of Profile Content

 [Description of Profiles, Differentials, Snapshots and how the different presentations work](http://build.fhir.org/ig/FHIR/ig-guidance/readingIgs.html#structure-definitions). 

 

Other representations of profile: [CSV](StructureDefinition-COSEHeader.csv), [Excel](StructureDefinition-COSEHeader.xlsx) 



## Resource Content

```json
{
  "resourceType" : "StructureDefinition",
  "id" : "COSEHeader",
  "url" : "http://smart.who.int/trust/StructureDefinition/COSEHeader",
  "version" : "1.3.0",
  "name" : "COSEHeader",
  "title" : "COSE Headers (DRAFT)",
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
  "description" : "Data elements for COSE Headers https://www.iana.org/assignments/cose/cose.xhtml#header-parameters",
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
  "abstract" : false,
  "type" : "http://smart.who.int/trust/StructureDefinition/COSEHeader",
  "baseDefinition" : "http://hl7.org/fhir/StructureDefinition/Base",
  "derivation" : "specialization",
  "differential" : {
    "element" : [
      {
        "id" : "COSEHeader",
        "path" : "COSEHeader",
        "short" : "COSE Headers (DRAFT)",
        "definition" : "Data elements for COSE Headers https://www.iana.org/assignments/cose/cose.xhtml#header-parameters"
      },
      {
        "id" : "COSEHeader.1",
        "path" : "COSEHeader.1",
        "short" : "Encryption Algorithm",
        "definition" : "alg(1)",
        "min" : 0,
        "max" : "1",
        "type" : [
          {
            "code" : "string"
          }
        ]
      },
      {
        "id" : "COSEHeader.4",
        "path" : "COSEHeader.4",
        "short" : "Key ID used to verify the signature of the certificate",
        "definition" : "keyid (4)",
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
