# preQualVaccines - SMART ICVP v0.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **preQualVaccines**

## ValueSet: preQualVaccines 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/icvp/ValueSet/preQualVaccines | *Version*:0.3.0 |
| Active as of 2025-10-17 | *Computable Name*:preQualVaccines |

 
preQualVaccines value set 

 **References** 

This value set is not used here; it may be used elsewhere (e.g. specifications and/or implementations that use this content)

### Logical Definition (CLD)

* Include all codes defined in `http://smart.who.int/icvp/CodeSystem/preQualVaccines`version Not Stated (use latest from terminology server)

 

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
  "id" : "preQualVaccines",
  "url" : "http://smart.who.int/icvp/ValueSet/preQualVaccines",
  "version" : "0.3.0",
  "name" : "preQualVaccines",
  "title" : "preQualVaccines",
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
  "description" : "preQualVaccines value set",
  "compose" : {
    "include" : [
      {
        "system" : "http://smart.who.int/icvp/CodeSystem/preQualVaccines"
      }
    ]
  }
}

```
