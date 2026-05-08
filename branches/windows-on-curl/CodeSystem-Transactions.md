# WHO GDHCN Transactions CodeSystem - WHO SMART Trust v1.1.6

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **WHO GDHCN Transactions CodeSystem**

## CodeSystem: WHO GDHCN Transactions CodeSystem (Experimental) 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/trust/CodeSystem/Transactions | *Version*:1.1.6 |
| Active as of 2025-12-03 | *Computable Name*:Transactions |

 
CodeSystem for GDHCN transactions that has usage codes for verification keys published to the Trust Network as defined by the[certificate governance](concepts_certificate_governance.md) 

 This Code system is referenced in the content logical definition of the following value sets: 

* [Transactions](ValueSet-Transactions.md)



## Resource Content

```json
{
  "resourceType" : "CodeSystem",
  "id" : "Transactions",
  "url" : "http://smart.who.int/trust/CodeSystem/Transactions",
  "version" : "1.1.6",
  "name" : "Transactions",
  "title" : "WHO GDHCN Transactions CodeSystem",
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
  "description" : "CodeSystem for GDHCN transactions that has usage codes for verification keys published to the Trust Network as defined by the [certificate governance](concepts_certificate_governance.html)",
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
  "count" : 3,
  "concept" : [
    {
      "code" : "keys-get-api"
    },
    {
      "code" : "keys-get-did"
    },
    {
      "code" : "keys-put-api"
    }
  ]
}

```
