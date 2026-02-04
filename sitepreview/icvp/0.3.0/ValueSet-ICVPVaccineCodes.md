# ICVP - Vaccine Codes - SMART ICVP v0.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **ICVP - Vaccine Codes**

## ValueSet: ICVP - Vaccine Codes 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/icvp/ValueSet/ICVPVaccineCodes | *Version*:0.3.0 |
| Active as of 2025-10-17 | *Computable Name*:ICVPVaccineCodes |

 
This value set includes codes from ICVP 

 **References** 

This value set is not used here; it may be used elsewhere (e.g. specifications and/or implementations that use this content)

### Logical Definition (CLD)

 

### Expansion

No Expansion for this valueset (Unknown Code System)

-------

 Explanation of the columns that may appear on this page: 

| | |
| :--- | :--- |
| Level | A few code lists that FHIR defines are hierarchical - each code is assigned a level. In this scheme, some codes are under other codes, and imply that the code they are under also applies |
| System | The source of the definition of the code (when the value set draws in codes defined elsewhere) |
| Code | The code (used as the code in the resource instance) |
| Display | The display (used in the*display*element of a[Coding](http://hl7.org/fhir/R4/datatypes.html#Coding)). If there is no display, implementers should not simply display the code, but map the concept into their application |
| Definition | An explanation of the meaning of the concept |
| Comments | Additional notes about how to use the code |



## Resource Content

```json
{
  "resourceType" : "ValueSet",
  "id" : "ICVPVaccineCodes",
  "url" : "http://smart.who.int/icvp/ValueSet/ICVPVaccineCodes",
  "version" : "0.3.0",
  "name" : "ICVPVaccineCodes",
  "title" : "ICVP - Vaccine Codes",
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
  "description" : "This value set includes codes from ICVP",
  "compose" : {
    "include" : [
      {
        "system" : "http://id.who.int/icd/release/11/mms",
        "concept" : [
          {
            "code" : "XM0N24",
            "display" : "Yellow fever vaccines"
          },
          {
            "code" : "XM3418",
            "display" : "Yellow fever, live attenuated"
          },
          {
            "code" : "XM0N50",
            "display" : "Poliomyelitis vaccines"
          },
          {
            "code" : "XM1LX9",
            "display" : "Diphtheria, hemophilus influenzae B, pertussis, poliomyelitis, tetanus vaccines"
          },
          {
            "code" : "XM09Q7",
            "display" : "Diphtheria, pertussis, poliomyelitis, tetanus vaccines"
          },
          {
            "code" : "XM0LT9",
            "display" : "Diphtheria, pertussis, poliomyelitis, tetanus, hepatitis B vaccines"
          },
          {
            "code" : "XM8AW1",
            "display" : "Diphtheria, poliomyelitis, tetanus vaccines"
          },
          {
            "code" : "XM01H1",
            "display" : "Hemophilus influenzae B and poliomyelitis vaccines"
          },
          {
            "code" : "XM21E6",
            "display" : "Diphtheria tetanus, acellular pertussis, inactivated polio virus, haemophilus Influenzae type B vaccines"
          },
          {
            "code" : "XM84S1",
            "display" : "Diphtheria, hepatitis B, tetanus, acellular pertussis, inactivated polio virus, haemophilus Influenzae type B vaccines"
          },
          {
            "code" : "XM9JP8",
            "display" : "Diphtheria, tetanus, acellular pertussis, inactivated polio virus vaccines"
          },
          {
            "code" : "XM5V19",
            "display" : "Poliomyelitis, trivalent, inactivated, whole virus"
          },
          {
            "code" : "XM79H3",
            "display" : "Poliomyelitis oral, bivalent, live attenuated"
          },
          {
            "code" : "XM0VX8",
            "display" : "Poliomyelitis oral, monovalent live attenuated"
          },
          {
            "code" : "XM0KZ1",
            "display" : "Poliomyelitis oral, trivalent, live attenuated"
          }
        ]
      }
    ]
  }
}

```
