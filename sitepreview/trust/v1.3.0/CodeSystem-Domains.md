# WHO GDHCN Trust Domains - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **WHO GDHCN Trust Domains**

## CodeSystem: WHO GDHCN Trust Domains 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/trust/CodeSystem/Domains | *Version*:1.3.0 |
| Active as of 2025-10-27 | *Computable Name*:Domains |

 
CodeSystem for define WHO GDHCN Trust Domains for Production environment. 

 This Code system is referenced in the content logical definition of the following value sets: 

* [Domains](ValueSet-Domains.md)



## Resource Content

```json
{
  "resourceType" : "CodeSystem",
  "id" : "Domains",
  "url" : "http://smart.who.int/trust/CodeSystem/Domains",
  "version" : "1.3.0",
  "name" : "Domains",
  "title" : "WHO GDHCN Trust Domains",
  "status" : "active",
  "experimental" : false,
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
  "description" : "CodeSystem for define WHO GDHCN Trust Domains for Production environment.",
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
      "definition" : "The Pan-American Highway for Digital Health (PH4H) is defined by SMART Implementation Guide at https://worldhealthorganization.github.io/smart-ph4h/"
    },
    {
      "code" : "ICVP",
      "display" : "International Certificate of Vaccination of Prophylaxsis (ICVP)",
      "definition" : "The International Certificate of Vaccination of Prophylaxsis (ICVP) is defined by SMART Implementation Guide at https://worldhealthorganization.github.io/smart-icvp/"
    }
  ]
}

```
