# WHO GDHCN Connection Types - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **WHO GDHCN Connection Types**

## ValueSet: WHO GDHCN Connection Types (Experimental) 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/trust/ValueSet/ConnectionTypes | *Version*:1.3.0 |
| Active as of 2025-10-27 | *Computable Name*:ConnectionTypes |

 
ValueSet of GDHCN Trust Network Connection Types 

 **References** 

This value set is not used here; it may be used elsewhere (e.g. specifications and/or implementations that use this content)

### Logical Definition (CLD)

* Include all codes defined in [`http://smart.who.int/trust/CodeSystem/ConnectionTypes`](CodeSystem-ConnectionTypes.md)version 📦1.3.0

 

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
  "id" : "ConnectionTypes",
  "url" : "http://smart.who.int/trust/ValueSet/ConnectionTypes",
  "version" : "1.3.0",
  "name" : "ConnectionTypes",
  "title" : "WHO GDHCN Connection Types",
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
  "description" : "ValueSet of GDHCN Trust Network Connection Types",
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
        "system" : "http://smart.who.int/trust/CodeSystem/ConnectionTypes"
      }
    ]
  }
}

```
