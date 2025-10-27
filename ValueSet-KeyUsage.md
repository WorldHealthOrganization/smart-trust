# WHO GDHCN Key Usage ValueSet - WHO SMART Trust v1.1.6

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **WHO GDHCN Key Usage ValueSet**

## ValueSet: WHO GDHCN Key Usage ValueSet (Experimental) 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/trust/ValueSet/KeyUsage | *Version*:1.1.6 |
| Active as of 2025-10-26 | *Computable Name*:KeyUsage |

 
ValueSet of codes for key usage codes for Production environment 

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



## Resource Content

```json
{
  "resourceType" : "ValueSet",
  "id" : "KeyUsage",
  "url" : "http://smart.who.int/trust/ValueSet/KeyUsage",
  "version" : "1.1.6",
  "name" : "KeyUsage",
  "title" : "WHO GDHCN  Key Usage ValueSet",
  "status" : "active",
  "experimental" : true,
  "date" : "2025-10-26T07:45:42+00:00",
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
  "description" : "ValueSet of codes for key usage codes for Production environment",
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
        "system" : "http://smart.who.int/trust/CodeSystem/KeyUsage",
        "concept" : [
          {
            "code" : "SCA",
            "display" : "Signing Certificate Authority"
          },
          {
            "code" : "DSC",
            "display" : "Document Signing Certificate"
          },
          {
            "code" : "UP",
            "display" : "Upload"
          },
          {
            "code" : "TLS",
            "display" : "TLS"
          }
        ]
      }
    ]
  }
}

```
