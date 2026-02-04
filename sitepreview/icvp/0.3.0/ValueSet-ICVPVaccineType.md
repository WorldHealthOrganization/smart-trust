# Vaccine Types for use in the ICVP - SMART ICVP v0.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **Vaccine Types for use in the ICVP**

## ValueSet: Vaccine Types for use in the ICVP 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/icvp/ValueSet/ICVPVaccineType | *Version*:0.3.0 |
| Active as of 2025-10-17 | *Computable Name*:ICVPVaccineType |

 
WHO PreQualificaiton Vaccine Type for use in the ICVP 

 **References** 

This value set is not used here; it may be used elsewhere (e.g. specifications and/or implementations that use this content)

### Logical Definition (CLD)

 

### Expansion

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
  "id" : "ICVPVaccineType",
  "url" : "http://smart.who.int/icvp/ValueSet/ICVPVaccineType",
  "version" : "0.3.0",
  "name" : "ICVPVaccineType",
  "title" : "Vaccine Types for use in the ICVP",
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
  "description" : "WHO PreQualificaiton Vaccine Type for use in the ICVP",
  "compose" : {
    "include" : [
      {
        "system" : "http://smart.who.int/pcmt-vaxprequal/CodeSystem/PreQualVaccineType",
        "concept" : [
          {
            "code" : "YellowFever"
          },
          {
            "code" : "DiphtheriaTetanusPertussisacellularHepatitisBHaemophilusinfluenzaetypebPolioInactivated"
          },
          {
            "code" : "DiphtheriaTetanusPertussiswholecellHepatitisBHaemophilusinfluenzaetypebPolioInactivated"
          },
          {
            "code" : "PolioVaccineInactivatedIPV"
          },
          {
            "code" : "PolioVaccineInactivatedSabinsIPV"
          },
          {
            "code" : "PolioVaccineNovelOralnOPVType2"
          },
          {
            "code" : "PolioVaccineOralOPVBivalentTypes1and3"
          },
          {
            "code" : "PolioVaccineOralOPVMonovalentType1"
          },
          {
            "code" : "PolioVaccineOralOPVMonovalentType2"
          },
          {
            "code" : "PolioVaccineOralOPVMonovalentType3"
          },
          {
            "code" : "PolioVaccineOralOPVTrivalent"
          }
        ]
      }
    ]
  }
}

```
