# WHO GDHCN Trust Network Participant - UAT - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **WHO GDHCN Trust Network Participant - UAT**

## ValueSet: WHO GDHCN Trust Network Participant - UAT (Experimental) 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/trust/ValueSet/Participants-UAT | *Version*:1.3.0 |
| Active as of 2025-10-27 | *Computable Name*:Participants-UAT |

 
ValueSet of GDHCN Trust Network Participants for User Acceptance Testing environment 

 **References** 

This value set is not used here; it may be used elsewhere (e.g. specifications and/or implementations that use this content)

### Logical Definition (CLD)

 

### Expansion

This value set contains 47 concepts

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
  "id" : "Participants-UAT",
  "url" : "http://smart.who.int/trust/ValueSet/Participants-UAT",
  "version" : "1.3.0",
  "name" : "Participants-UAT",
  "title" : "WHO GDHCN Trust Network Participant - UAT",
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
  "description" : "ValueSet of GDHCN Trust Network Participants for User Acceptance Testing environment",
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
        "system" : "http://smart.who.int/trust/CodeSystems/Participants-UAT"
      },
      {
        "system" : "http://smart.who.int/refmart/CodeSystems/REF_COUNTRY",
        "concept" : [
          {
            "code" : "ALB"
          },
          {
            "code" : "AND"
          },
          {
            "code" : "ARM"
          },
          {
            "code" : "BEL"
          },
          {
            "code" : "BEN"
          },
          {
            "code" : "BRA"
          },
          {
            "code" : "CAN"
          },
          {
            "code" : "CYP"
          },
          {
            "code" : "CZE"
          },
          {
            "code" : "ESP"
          },
          {
            "code" : "EST"
          },
          {
            "code" : "FIN"
          },
          {
            "code" : "FRA"
          },
          {
            "code" : "FRO"
          },
          {
            "code" : "HRV"
          },
          {
            "code" : "IDN"
          },
          {
            "code" : "IRL"
          },
          {
            "code" : "LTU"
          },
          {
            "code" : "LVA"
          },
          {
            "code" : "MCO"
          },
          {
            "code" : "MLT"
          },
          {
            "code" : "MYS"
          },
          {
            "code" : "NLD"
          },
          {
            "code" : "NZL"
          },
          {
            "code" : "OMN"
          },
          {
            "code" : "POL"
          },
          {
            "code" : "PRT"
          },
          {
            "code" : "SAU"
          },
          {
            "code" : "SGP"
          },
          {
            "code" : "SMR"
          },
          {
            "code" : "SVK"
          },
          {
            "code" : "SVN"
          },
          {
            "code" : "SWE"
          },
          {
            "code" : "TGO"
          },
          {
            "code" : "THA"
          },
          {
            "code" : "TUR"
          }
        ]
      },
      {
        "system" : "http://smart.who.int/trust/CodeSystems/Participants-UAT",
        "concept" : [
          {
            "code" : "WHO"
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
            "code" : "XXO"
          },
          {
            "code" : "XXS"
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
