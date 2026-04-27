# WHO GDHCN Trust Network Participant - DEV - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **WHO GDHCN Trust Network Participant - DEV**

## ValueSet: WHO GDHCN Trust Network Participant - DEV (Experimental) 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/trust/ValueSet/Participants-DEV | *Version*:1.3.0 |
| Active as of 2025-10-27 | *Computable Name*:Participants-DEV |

 
ValueSet of GDHCN Trust Network Participants for Development environment 

 **References** 

This value set is not used here; it may be used elsewhere (e.g. specifications and/or implementations that use this content)

### Logical Definition (CLD)

 

### Expansion

This value set contains 50 concepts

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
  "id" : "Participants-DEV",
  "url" : "http://smart.who.int/trust/ValueSet/Participants-DEV",
  "version" : "1.3.0",
  "name" : "Participants-DEV",
  "title" : "WHO GDHCN Trust Network Participant - DEV",
  "status" : "active",
  "experimental" : true,
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
  "description" : "ValueSet of GDHCN Trust Network Participants for Development environment",
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
  "compose" : {
    "include" : [
      {
        "system" : "http://smart.who.int/trust/CodeSystems/Participants-DEV"
      },
      {
        "system" : "http://smart.who.int/refmart/CodeSystems/REF_COUNTRY",
        "concept" : [
          {
            "code" : "AND"
          },
          {
            "code" : "ARG"
          },
          {
            "code" : "ARM"
          },
          {
            "code" : "BHS"
          },
          {
            "code" : "BLZ"
          },
          {
            "code" : "BRA"
          },
          {
            "code" : "BRB"
          },
          {
            "code" : "CHL"
          },
          {
            "code" : "COL"
          },
          {
            "code" : "CRI"
          },
          {
            "code" : "CYP"
          },
          {
            "code" : "DOM"
          },
          {
            "code" : "ECU"
          },
          {
            "code" : "EST"
          },
          {
            "code" : "GTM"
          },
          {
            "code" : "HND"
          },
          {
            "code" : "IDN"
          },
          {
            "code" : "LVA"
          },
          {
            "code" : "OMN"
          },
          {
            "code" : "PAN"
          },
          {
            "code" : "PER"
          },
          {
            "code" : "PRY"
          },
          {
            "code" : "SGP"
          },
          {
            "code" : "SLV"
          },
          {
            "code" : "SMR"
          },
          {
            "code" : "SUR"
          },
          {
            "code" : "SVN"
          },
          {
            "code" : "TGO"
          },
          {
            "code" : "URY"
          },
          {
            "code" : "USA"
          }
        ]
      },
      {
        "system" : "http://smart.who.int/trust/CodeSystems/Participants-DEV",
        "concept" : [
          {
            "code" : "WHO"
          },
          {
            "code" : "XCL"
          },
          {
            "code" : "XML"
          },
          {
            "code" : "XXA"
          },
          {
            "code" : "XXB"
          },
          {
            "code" : "XXC"
          },
          {
            "code" : "XXD"
          },
          {
            "code" : "XXE"
          },
          {
            "code" : "XXF"
          },
          {
            "code" : "XXG"
          },
          {
            "code" : "XXH"
          },
          {
            "code" : "XXI"
          },
          {
            "code" : "XXJ"
          },
          {
            "code" : "XXK"
          },
          {
            "code" : "XXO"
          },
          {
            "code" : "XXP"
          },
          {
            "code" : "XXU"
          },
          {
            "code" : "XXV"
          },
          {
            "code" : "XXX"
          },
          {
            "code" : "XYK"
          }
        ]
      }
    ]
  }
}

```
