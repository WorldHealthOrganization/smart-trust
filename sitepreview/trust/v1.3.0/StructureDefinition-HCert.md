# Health Certificate - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **Health Certificate**

## Logical Model: Health Certificate 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/trust/StructureDefinition/HCert | *Version*:1.3.0 |
| Active as of 2025-10-27 | *Computable Name*:HCert |

 
Logical Model for the HCERT 

**Usages:**

* Use this Logical Model: [CBOR Web Token (CWT) Payload (Common)](StructureDefinition-CWTPayload.md)

You can also check for [usages in the FHIR IG Statistics](https://packages2.fhir.org/xig/smart.who.int.trust|current/StructureDefinition/HCert)

### Formal Views of Profile Content

 [Description of Profiles, Differentials, Snapshots and how the different presentations work](http://build.fhir.org/ig/FHIR/ig-guidance/readingIgs.html#structure-definitions). 

 

Other representations of profile: [CSV](StructureDefinition-HCert.csv), [Excel](StructureDefinition-HCert.xlsx) 



## Resource Content

```json
{
  "resourceType" : "StructureDefinition",
  "id" : "HCert",
  "url" : "http://smart.who.int/trust/StructureDefinition/HCert",
  "version" : "1.3.0",
  "name" : "HCert",
  "title" : "Health Certificate",
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
  "description" : "Logical Model for the HCERT",
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
  "type" : "http://smart.who.int/trust/StructureDefinition/HCert",
  "baseDefinition" : "http://hl7.org/fhir/StructureDefinition/Base",
  "derivation" : "specialization",
  "differential" : {
    "element" : [
      {
        "id" : "HCert",
        "path" : "HCert",
        "short" : "Health Certificate",
        "definition" : "Logical Model for the HCERT"
      },
      {
        "id" : "HCert.1",
        "path" : "HCert.1",
        "short" : "HCERT EU DCC",
        "definition" : "HCERT EU DCC",
        "min" : 0,
        "max" : "1",
        "type" : [
          {
            "code" : "http://smart.who.int/ddcc/StructureDefinition/HCertDCC"
          }
        ]
      },
      {
        "id" : "HCert.3",
        "path" : "HCert.3",
        "short" : "Vaccination Core Data Set claim",
        "definition" : "DDCC Vaccination claim (PROPOSED)",
        "min" : 0,
        "max" : "*",
        "type" : [
          {
            "code" : "http://smart.who.int/ddcc/StructureDefinition/DDCCCoreDataSet",
            "profile" : [
              "http://smart.who.int/ddcc/StructureDefinition/DDCCCoreDataSetVS"
            ]
          }
        ]
      },
      {
        "id" : "HCert.4",
        "path" : "HCert.4",
        "short" : "Test Result Core Data Set claim",
        "definition" : "DDCC Test Result claim (PROPOSED)",
        "min" : 0,
        "max" : "*",
        "type" : [
          {
            "code" : "http://smart.who.int/ddcc/StructureDefinition/DDCCCoreDataSet",
            "profile" : [
              "http://smart.who.int/ddcc/StructureDefinition/DDCCCoreDataSetTR"
            ]
          }
        ]
      },
      {
        "id" : "HCert.5",
        "path" : "HCert.5",
        "short" : "VHL",
        "definition" : "URI of a Verifiable Health Link.  Of the form 'vhlink:/eyJ1cmwiOiJodHRwczovL2Vo....' ",
        "min" : 0,
        "max" : "*",
        "type" : [
          {
            "code" : "string"
          }
        ]
      },
      {
        "id" : "HCert.-6",
        "path" : "HCert.-6",
        "short" : "DVC",
        "definition" : "Digital Vaccination Certificate (Proposed)",
        "min" : 0,
        "max" : "*",
        "type" : [
          {
            "code" : "http://smart.who.int/trust-phw/StructureDefinition/DVC"
          }
        ]
      }
    ]
  }
}

```
