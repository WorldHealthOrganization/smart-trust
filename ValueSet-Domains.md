# WHO GDHCN Trust Domains - WHO SMART Trust v1.1.6

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **WHO GDHCN Trust Domains**

## ValueSet: WHO GDHCN Trust Domains 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/trust/ValueSet/Domains | *Version*:1.1.6 |
| Draft as of 2026-02-18 | *Computable Name*:Domains |

 
ValueSet of WHO GDHCN Trust Domains for Production environment 

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

##### WHO GDHCN Trust Domains Schema API

JSON Schema for WHO GDHCN Trust Domains ValueSet codes. Generated from FHIR expansions using IRI format.

**Version:** 1.0.0

## Endpoints

### GET /ValueSet-Domains.schema.json

#### JSON Schema definition for the enumeration ValueSet-Domains

This endpoint serves the JSON Schema definition for the enumeration ValueSet-Domains.

## Schema Definition

### ValueSet-Domains

**Description:** JSON Schema for WHO GDHCN Trust Domains ValueSet codes. Generated from FHIR expansions using IRI format.

**Type:** string

**This documentation is automatically generated from the OpenAPI specification.**



## Resource Content

```json
{
  "resourceType" : "ValueSet",
  "id" : "Domains",
  "url" : "http://smart.who.int/trust/ValueSet/Domains",
  "version" : "1.1.6",
  "name" : "Domains",
  "title" : "WHO GDHCN Trust Domains",
  "status" : "draft",
  "experimental" : false,
  "date" : "2026-02-18T13:36:49+00:00",
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
  "description" : "ValueSet of WHO GDHCN Trust Domains for Production environment",
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
        "system" : "http://smart.who.int/trust/CodeSystem/Domains"
      }
    ]
  }
}

```
