# WHO GDHCN Trust Domains - DEV - WHO SMART Trust v1.4.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **WHO GDHCN Trust Domains - DEV**

## CodeSystem: WHO GDHCN Trust Domains - DEV 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/trust/CodeSystem/Domains-DEV | *Version*:1.4.0 |
| Active as of 2026-02-11 | *Computable Name*:Domains-DEV |

 
CodeSystem for define WHO GDHCN Trust Domains for Development environment. 

 This Code system is referenced in the content logical definition of the following value sets: 

* [Domains-DEV](ValueSet-Domains-DEV.md)



## Resource Content

```json
{
  "resourceType" : "CodeSystem",
  "id" : "Domains-DEV",
  "url" : "http://smart.who.int/trust/CodeSystem/Domains-DEV",
  "version" : "1.4.0",
  "name" : "Domains-DEV",
  "title" : "WHO GDHCN Trust Domains - DEV",
  "status" : "active",
  "experimental" : false,
  "date" : "2026-02-11T14:17:30+00:00",
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
  "description" : "CodeSystem for define WHO GDHCN Trust Domains for Development environment.",
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
  "caseSensitive" : true,
  "content" : "complete",
  "count" : 4,
  "concept" : [
    {
      "code" : "DDCC",
      "display" : "DDCC",
      "definition" : "The Digital Documentation for COVID-19 Certificates (DDCC) is defined by the SMART Implementation Guide at http://smart.who.int/ddcc"
    },
    {
      "code" : "IPS-PILGRIMAGE",
      "display" : "IPS for Pilgrimage",
      "definition" : "The IPS for Pilgrimage is defined by the SMART Implementation Guide at http://smart.who.int/ips-pilgrimage"
    },
    {
      "code" : "PH4H",
      "display" : "Pan-American Highway for Digital Health (PH4H)",
      "definition" : "The Pan-American Highway for Digital Health (PH4H) is defined by SMART Implementation Guide at https://worldhealthorganization.github.io/smart-ph4h/"
    },
    {
      "code" : "ICVP",
      "display" : "International Certificate of Vaccination of Prophylaxsis (ICVP)",
      "definition" : "The International Certificate of Vaccination of Prophylaxsis (ICVP) is defined by SMART Implementation Guide at https://worldhealthorganization.github.io/smart-icvp/"
    }
  ]
}

```
