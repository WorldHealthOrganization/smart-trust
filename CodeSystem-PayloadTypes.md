# WHO GDHCN Payload Types - WHO SMART Trust v1.1.6

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **WHO GDHCN Payload Types**

## CodeSystem: WHO GDHCN Payload Types (Experimental) 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/trust/CodeSystem/PayloadTypes | *Version*:1.1.6 |
| Active as of 2025-10-26 | *Computable Name*:PayloadTypes |

 
CodeSystem for GDHCN Payload types 

 This Code system is referenced in the content logical definition of the following value sets: 

* [PayloadTypes](ValueSet-PayloadTypes.md)



## Resource Content

```json
{
  "resourceType" : "CodeSystem",
  "id" : "PayloadTypes",
  "url" : "http://smart.who.int/trust/CodeSystem/PayloadTypes",
  "version" : "1.1.6",
  "name" : "PayloadTypes",
  "title" : "WHO GDHCN Payload Types",
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
  "description" : "CodeSystem for GDHCN Payload types",
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
  "caseSensitive" : false,
  "content" : "complete",
  "count" : 1,
  "concept" : [
    {
      "code" : "urn:who:trust:trustlist:v2",
      "display" : "WHO GDHCN Trust List v2",
      "definition" : "WHO Global Digital Health Certification Network (GDHCN) Trust List. Major release v2"
    }
  ]
}

```
