# WHO GDHCN Trust Network Participants CodeSystem - WHO SMART Trust v1.1.6

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **WHO GDHCN Trust Network Participants CodeSystem**

## CodeSystem: WHO GDHCN Trust Network Participants CodeSystem (Experimental) 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/trust/CodeSystem/Participants | *Version*:1.1.6 |
| Active as of 2026-02-18 | *Computable Name*:Participants |

 
CodeSystem for GDHCN Trust Network Participants which are not already included in the ISO-3166 three letter code system for Production environment 

 This Code system is referenced in the content logical definition of the following value sets: 

* [Participants](ValueSet-Participants.md)



## Resource Content

```json
{
  "resourceType" : "CodeSystem",
  "id" : "Participants",
  "url" : "http://smart.who.int/trust/CodeSystem/Participants",
  "version" : "1.1.6",
  "name" : "Participants",
  "title" : "WHO GDHCN Trust Network Participants CodeSystem",
  "status" : "active",
  "experimental" : true,
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
  "description" : "CodeSystem for GDHCN Trust Network Participants which are not already included in the ISO-3166 three letter code system for Production environment",
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
      "code" : "WHO",
      "display" : "WHO",
      "definition" : "World Health Organization"
    }
  ]
}

```
