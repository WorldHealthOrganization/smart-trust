# Disease Targeted - SMART ICVP v0.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **Disease Targeted**

## ValueSet: Disease Targeted 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/icvp/ValueSet/DiseaseTargeted | *Version*:0.3.0 |
| Active as of 2025-10-17 | *Computable Name*:DiseaseTargeted |

 
Value set for all diseases 

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
  "id" : "DiseaseTargeted",
  "url" : "http://smart.who.int/icvp/ValueSet/DiseaseTargeted",
  "version" : "0.3.0",
  "name" : "DiseaseTargeted",
  "title" : "Disease Targeted",
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
  "description" : "Value set for all diseases",
  "compose" : {
    "include" : [
      {
        "system" : "http://id.who.int/icd/release/11/mms",
        "concept" : [
          {
            "code" : "1A07",
            "display" : "Typhoid"
          },
          {
            "code" : "1E32",
            "display" : "Influenza"
          },
          {
            "code" : "1F03",
            "display" : "Measles"
          },
          {
            "code" : "1C12",
            "display" : "Pertussis"
          },
          {
            "code" : "1D80",
            "display" : "Mumps"
          },
          {
            "code" : "1E90",
            "display" : "Varicella"
          },
          {
            "code" : "1E50.0",
            "display" : "Viral hepatitis A"
          },
          {
            "code" : "1B1Z",
            "display" : "Tuberculosis"
          },
          {
            "code" : "1E50.1",
            "display" : "Viral hepatitis B"
          },
          {
            "code" : "XN0FG",
            "display" : "Haemophilus influenzae type b"
          },
          {
            "code" : "1C13",
            "display" : "Tetanus"
          },
          {
            "code" : "XN6N7",
            "display" : "Rotavirus"
          },
          {
            "code" : "XN8JY",
            "display" : "Human papillomavirus"
          },
          {
            "code" : "1C85",
            "display" : "Japanese encephalitis"
          },
          {
            "code" : "1C81",
            "display" : "Poliomyelitis"
          },
          {
            "code" : "1C17",
            "display" : "Diphtheria"
          },
          {
            "code" : "CA40.07",
            "display" : "Pneumococcal disease"
          },
          {
            "code" : "1F02",
            "display" : "Rubella"
          },
          {
            "code" : "1D2Z",
            "display" : "Dengue"
          },
          {
            "code" : "1C82",
            "display" : "Rabies"
          },
          {
            "code" : "1C1C",
            "display" : "Meningococcal"
          },
          {
            "code" : "1A00",
            "display" : "Cholera"
          },
          {
            "code" : "1C80",
            "display" : "Tick-borne encephalitis"
          },
          {
            "code" : "1D47",
            "display" : "Yellow fever"
          },
          {
            "code" : "RA01",
            "display" : "COVID-19"
          }
        ]
      }
    ]
  }
}

```
