# WHO Regional Offices CodeSystem - WHO SMART Trust v1.6.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **WHO Regional Offices CodeSystem**

## CodeSystem: WHO Regional Offices CodeSystem (Experimental) 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/trust/CodeSystem/WHORegionalOffices | *Version*:1.6.0 |
| Active as of 2026-05-08 | *Computable Name*:WHORegionalOffices |

 
CodeSystem for WHO Regional Offices 

 This Code system is referenced in the content logical definition of the following value sets: 

* [WHORegionalOffices](ValueSet-WHORegionalOffices.md)



## Resource Content

```json
{
  "resourceType" : "CodeSystem",
  "id" : "WHORegionalOffices",
  "url" : "http://smart.who.int/trust/CodeSystem/WHORegionalOffices",
  "version" : "1.6.0",
  "name" : "WHORegionalOffices",
  "title" : "WHO Regional Offices CodeSystem",
  "status" : "active",
  "experimental" : true,
  "date" : "2026-05-08T12:31:42+00:00",
  "publisher" : "WHO",
  "contact" : [{
    "name" : "WHO",
    "telecom" : [{
      "system" : "url",
      "value" : "http://who.int"
    }]
  }],
  "description" : "CodeSystem for WHO Regional Offices",
  "jurisdiction" : [{
    "coding" : [{
      "system" : "http://unstats.un.org/unsd/methods/m49/m49.htm",
      "code" : "001"
    }]
  }],
  "caseSensitive" : false,
  "content" : "complete",
  "count" : 7,
  "concept" : [{
    "code" : "AFRO",
    "display" : "WHO Regional Office for Africa",
    "definition" : "WHO Regional Office for Africa (AFRO)"
  },
  {
    "code" : "AMRO",
    "display" : "WHO Regional Office for the Americas",
    "definition" : "WHO Regional Office for the Americas (AMRO/PAHO)"
  },
  {
    "code" : "EMRO",
    "display" : "WHO Regional Office for the Eastern Mediterranean",
    "definition" : "WHO Regional Office for the Eastern Mediterranean (EMRO)"
  },
  {
    "code" : "EURO",
    "display" : "WHO Regional Office for Europe",
    "definition" : "WHO Regional Office for Europe (EURO)"
  },
  {
    "code" : "SEARO",
    "display" : "WHO Regional Office for South-East Asia",
    "definition" : "WHO Regional Office for South-East Asia (SEARO)"
  },
  {
    "code" : "WPRO",
    "display" : "WHO Regional Office for the Western Pacific",
    "definition" : "WHO Regional Office for the Western Pacific (WPRO)"
  },
  {
    "code" : "OTHER",
    "display" : "Other Participants",
    "definition" : "Participants that are not WHO Member States or State Parties"
  }]
}

```
