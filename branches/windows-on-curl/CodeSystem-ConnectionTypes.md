# WHO GDHCN Connection Types - WHO SMART Trust v1.1.6

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **WHO GDHCN Connection Types**

## CodeSystem: WHO GDHCN Connection Types (Experimental) 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/trust/CodeSystem/ConnectionTypes | *Version*:1.1.6 |
| Active as of 2025-12-03 | *Computable Name*:ConnectionTypes |

 
CodeSystem for GDHCN connection types 

 This Code system is referenced in the content logical definition of the following value sets: 

* [ConnectionTypes](ValueSet-ConnectionTypes.md)



## Resource Content

```json
{
  "resourceType" : "CodeSystem",
  "id" : "ConnectionTypes",
  "url" : "http://smart.who.int/trust/CodeSystem/ConnectionTypes",
  "version" : "1.1.6",
  "name" : "ConnectionTypes",
  "title" : "WHO GDHCN Connection Types",
  "status" : "active",
  "experimental" : true,
  "date" : "2025-12-03T10:40:16+00:00",
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
  "description" : "CodeSystem for GDHCN connection types",
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
  "count" : 2,
  "concept" : [
    {
      "code" : "http-get",
      "display" : "http-get",
      "definition" : "http(s) GET request"
    },
    {
      "code" : "mtls",
      "display" : "mTLS",
      "definition" : "mutual TLS (mTLS)"
    }
  ]
}

```
