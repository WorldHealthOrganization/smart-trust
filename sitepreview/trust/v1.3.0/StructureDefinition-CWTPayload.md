# CBOR Web Token (CWT) Payload (Common) - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **CBOR Web Token (CWT) Payload (Common)**

## Logical Model: CBOR Web Token (CWT) Payload (Common) 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/trust/StructureDefinition/CWTPayload | *Version*:1.3.0 |
| Active as of 2025-10-27 | *Computable Name*:CWTPayload |

 
Logical Model for CBOR Web Token (CWT) Payload Logical Modelin CWT Payload https://www.iana.org/assignments/cwt/cwt.xhtml 

**Usages:**

* Use this Logical Model: [CBOR Web Token (CWT) Claim](StructureDefinition-CWT.md)

You can also check for [usages in the FHIR IG Statistics](https://packages2.fhir.org/xig/smart.who.int.trust|current/StructureDefinition/CWTPayload)

### Formal Views of Profile Content

 [Description of Profiles, Differentials, Snapshots and how the different presentations work](http://build.fhir.org/ig/FHIR/ig-guidance/readingIgs.html#structure-definitions). 

 

Other representations of profile: [CSV](StructureDefinition-CWTPayload.csv), [Excel](StructureDefinition-CWTPayload.xlsx) 



## Resource Content

```json
{
  "resourceType" : "StructureDefinition",
  "id" : "CWTPayload",
  "url" : "http://smart.who.int/trust/StructureDefinition/CWTPayload",
  "version" : "1.3.0",
  "name" : "CWTPayload",
  "title" : "CBOR Web Token (CWT) Payload (Common)",
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
  "description" : "Logical Model for CBOR Web Token (CWT) Payload Logical Modelin CWT Payload https://www.iana.org/assignments/cwt/cwt.xhtml ",
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
  "type" : "http://smart.who.int/trust/StructureDefinition/CWTPayload",
  "baseDefinition" : "http://hl7.org/fhir/StructureDefinition/Base",
  "derivation" : "specialization",
  "differential" : {
    "element" : [
      {
        "id" : "CWTPayload",
        "path" : "CWTPayload",
        "short" : "CBOR Web Token (CWT) Payload (Common)",
        "definition" : "Logical Model for CBOR Web Token (CWT) Payload Logical Modelin CWT Payload https://www.iana.org/assignments/cwt/cwt.xhtml "
      },
      {
        "id" : "CWTPayload.1",
        "path" : "CWTPayload.1",
        "short" : "Issuer Code (iss)",
        "definition" : "Issuer",
        "min" : 0,
        "max" : "1",
        "type" : [
          {
            "code" : "Coding"
          }
        ]
      },
      {
        "id" : "CWTPayload.4",
        "path" : "CWTPayload.4",
        "short" : "Expiration Date Time(exp)",
        "definition" : "Expiration Time",
        "min" : 0,
        "max" : "1",
        "type" : [
          {
            "code" : "dateTime"
          }
        ]
      },
      {
        "id" : "CWTPayload.6",
        "path" : "CWTPayload.6",
        "short" : "Issued At (iat)",
        "definition" : "Issued At",
        "min" : 0,
        "max" : "1",
        "type" : [
          {
            "code" : "dateTime"
          }
        ]
      },
      {
        "id" : "CWTPayload.-260",
        "path" : "CWTPayload.-260",
        "short" : "Health Certificate",
        "definition" : "HCert",
        "min" : 0,
        "max" : "1",
        "type" : [
          {
            "code" : "http://smart.who.int/trust/StructureDefinition/HCert"
          }
        ]
      }
    ]
  }
}

```
