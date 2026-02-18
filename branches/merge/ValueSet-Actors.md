# WHO GDHCN Actor ValueSet of actor codes - WHO SMART Trust v1.1.6

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **WHO GDHCN Actor ValueSet of actor codes**

## ValueSet: WHO GDHCN Actor ValueSet of actor codes (Experimental) 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/trust/ValueSet/Actors | *Version*:1.1.6 |
| Active as of 2026-02-17 | *Computable Name*:Actors |

 
ValueSet of codes for actor codes 

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
| Display | The display (used in the*display*element of a[Coding](http://hl7.org/fhir/R5/datatypes.html#Coding)). If there is no display, implementers should not simply display the code, but map the concept into their application |
| Definition | An explanation of the meaning of the concept |
| Comments | Additional notes about how to use the code |

## API Information

##### WHO GDHCN Actor ValueSet of actor codes Schema API

JSON Schema for WHO GDHCN Actor ValueSet of actor codes ValueSet codes. Generated from FHIR expansions using IRI format.

**Version:** 1.0.0

## Endpoints

### GET /ValueSet-Actors.schema.json

#### JSON Schema definition for the enumeration ValueSet-Actors

This endpoint serves the JSON Schema definition for the enumeration ValueSet-Actors.

## Schema Definition

### ValueSet-Actors

**Description:** JSON Schema for WHO GDHCN Actor ValueSet of actor codes ValueSet codes. Generated from FHIR expansions using IRI format.

**Type:** string

**This documentation is automatically generated from the OpenAPI specification.**



## Resource Content

```json
{
  "resourceType" : "ValueSet",
  "id" : "Actors",
  "url" : "http://smart.who.int/trust/ValueSet/Actors",
  "version" : "1.1.6",
  "name" : "Actors",
  "title" : "WHO GDHCN Actor ValueSet of actor codes",
  "status" : "active",
  "experimental" : true,
  "date" : "2026-02-17T12:30:39+00:00",
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
  "description" : "ValueSet of codes for actor codes",
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
        "system" : "http://smart.who.int/trust/CodeSystem/Actors"
      }
    ]
  }
}

```
