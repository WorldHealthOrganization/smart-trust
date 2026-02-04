# DVC Icvp with Selective Disclosure - SMART ICVP v0.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **DVC Icvp with Selective Disclosure**

## Logical Model: DVC Icvp with Selective Disclosure 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/icvp/StructureDefinition/ICVPSD | *Version*:0.3.0 |
| Active as of 2025-10-17 | *Computable Name*:ICVPSD |

 
DVC Icvp with Selective Disclosure 

**Usages:**

* This Logical Model Profile is not used by any profiles in this Implementation Guide

You can also check for [usages in the FHIR IG Statistics](https://packages2.fhir.org/xig/smart.who.int.icvp|current/StructureDefinition/ICVPSD)

### Formal Views of Profile Content

 [Description of Profiles, Differentials, Snapshots and how the different presentations work](http://build.fhir.org/ig/FHIR/ig-guidance/readingIgs.html#structure-definitions). 

 

Other representations of profile: [CSV](StructureDefinition-ICVPSD.csv), [Excel](StructureDefinition-ICVPSD.xlsx) 



## Resource Content

```json
{
  "resourceType" : "StructureDefinition",
  "id" : "ICVPSD",
  "extension" : [
    {
      "url" : "http://hl7.org/fhir/tools/StructureDefinition/logical-target",
      "valueBoolean" : true
    }
  ],
  "url" : "http://smart.who.int/icvp/StructureDefinition/ICVPSD",
  "version" : "0.3.0",
  "name" : "ICVPSD",
  "title" : "DVC Icvp with Selective Disclosure",
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
  "description" : "DVC Icvp with Selective Disclosure",
  "fhirVersion" : "4.0.1",
  "kind" : "logical",
  "abstract" : false,
  "type" : "http://smart.who.int/icvp/StructureDefinition/ICVP",
  "baseDefinition" : "http://smart.who.int/icvp/StructureDefinition/ICVP",
  "derivation" : "constraint",
  "differential" : {
    "element" : [
      {
        "id" : "ICVP",
        "path" : "ICVP"
      },
      {
        "id" : "ICVP.name.extension",
        "path" : "ICVP.name.extension",
        "slicing" : {
          "discriminator" : [
            {
              "type" : "value",
              "path" : "url"
            }
          ],
          "ordered" : false,
          "rules" : "open"
        }
      },
      {
        "id" : "ICVP.name.extension:SelectiveDisclosure",
        "path" : "ICVP.name.extension",
        "sliceName" : "SelectiveDisclosure",
        "min" : 0,
        "max" : "1",
        "type" : [
          {
            "code" : "Extension",
            "profile" : [
              "http://smart.who.int/trust-phw/StructureDefinition/SelectiveDisclosure"
            ]
          }
        ]
      },
      {
        "id" : "ICVP.dob.extension",
        "path" : "ICVP.dob.extension",
        "slicing" : {
          "discriminator" : [
            {
              "type" : "value",
              "path" : "url"
            }
          ],
          "ordered" : false,
          "rules" : "open"
        }
      },
      {
        "id" : "ICVP.dob.extension:SelectiveDisclosure",
        "path" : "ICVP.dob.extension",
        "sliceName" : "SelectiveDisclosure",
        "min" : 0,
        "max" : "1",
        "type" : [
          {
            "code" : "Extension",
            "profile" : [
              "http://smart.who.int/trust-phw/StructureDefinition/SelectiveDisclosure"
            ]
          }
        ]
      },
      {
        "id" : "ICVP.sex.extension",
        "path" : "ICVP.sex.extension",
        "slicing" : {
          "discriminator" : [
            {
              "type" : "value",
              "path" : "url"
            }
          ],
          "ordered" : false,
          "rules" : "open"
        }
      },
      {
        "id" : "ICVP.sex.extension:SelectiveDisclosure",
        "path" : "ICVP.sex.extension",
        "sliceName" : "SelectiveDisclosure",
        "min" : 0,
        "max" : "1",
        "type" : [
          {
            "code" : "Extension",
            "profile" : [
              "http://smart.who.int/trust-phw/StructureDefinition/SelectiveDisclosure"
            ]
          }
        ]
      },
      {
        "id" : "ICVP.nationality.extension",
        "path" : "ICVP.nationality.extension",
        "slicing" : {
          "discriminator" : [
            {
              "type" : "value",
              "path" : "url"
            }
          ],
          "ordered" : false,
          "rules" : "open"
        }
      },
      {
        "id" : "ICVP.nationality.extension:SelectiveDisclosure",
        "path" : "ICVP.nationality.extension",
        "sliceName" : "SelectiveDisclosure",
        "min" : 0,
        "max" : "1",
        "type" : [
          {
            "code" : "Extension",
            "profile" : [
              "http://smart.who.int/trust-phw/StructureDefinition/SelectiveDisclosure"
            ]
          }
        ]
      },
      {
        "id" : "ICVP.nid.extension:SelectiveDisclosure",
        "path" : "ICVP.nid.extension",
        "sliceName" : "SelectiveDisclosure",
        "min" : 0,
        "max" : "1",
        "type" : [
          {
            "code" : "Extension",
            "profile" : [
              "http://smart.who.int/trust-phw/StructureDefinition/SelectiveDisclosure"
            ]
          }
        ]
      },
      {
        "id" : "ICVP.guardian.extension",
        "path" : "ICVP.guardian.extension",
        "slicing" : {
          "discriminator" : [
            {
              "type" : "value",
              "path" : "url"
            }
          ],
          "ordered" : false,
          "rules" : "open"
        }
      },
      {
        "id" : "ICVP.guardian.extension:SelectiveDisclosure",
        "path" : "ICVP.guardian.extension",
        "sliceName" : "SelectiveDisclosure",
        "min" : 0,
        "max" : "1",
        "type" : [
          {
            "code" : "Extension",
            "profile" : [
              "http://smart.who.int/trust-phw/StructureDefinition/SelectiveDisclosure"
            ]
          }
        ]
      },
      {
        "id" : "ICVP.issuer.extension:SelectiveDisclosure",
        "path" : "ICVP.issuer.extension",
        "sliceName" : "SelectiveDisclosure",
        "min" : 0,
        "max" : "1",
        "type" : [
          {
            "code" : "Extension",
            "profile" : [
              "http://smart.who.int/trust-phw/StructureDefinition/SelectiveDisclosure"
            ]
          }
        ]
      },
      {
        "id" : "ICVP.vaccineDetails",
        "path" : "ICVP.vaccineDetails",
        "type" : [
          {
            "code" : "http://smart.who.int/icvp/StructureDefinition/ICVPVaccineDetails",
            "profile" : [
              "http://smart.who.int/icvp/StructureDefinition/ICVPVaccineDetailsSD"
            ]
          }
        ]
      }
    ]
  }
}

```
