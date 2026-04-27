# GDHCN Participants to WHO Regional Offices - WHO SMART Trust v1.5.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCN Participants to WHO Regional Offices**

## ConceptMap: GDHCN Participants to WHO Regional Offices (Experimental) 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/trust/ConceptMap/ParticipantsToWHORegionalOffices | *Version*:1.5.0 |
| Active as of 2026-04-27 | *Computable Name*:ParticipantsToWHORegionalOffices |

 
ConceptMap from GDHCN Trust Network Production Participants to WHO Regional Offices. Participants that are not WHO Member States or State Parties (e.g. international organizations or non-member territories) have no mapping and are grouped under Other Participants. 



## Resource Content

```json
{
  "resourceType" : "ConceptMap",
  "id" : "ParticipantsToWHORegionalOffices",
  "url" : "http://smart.who.int/trust/ConceptMap/ParticipantsToWHORegionalOffices",
  "version" : "1.5.0",
  "name" : "ParticipantsToWHORegionalOffices",
  "title" : "GDHCN Participants to WHO Regional Offices",
  "status" : "active",
  "experimental" : true,
  "date" : "2026-04-27T07:32:49+00:00",
  "publisher" : "WHO",
  "contact" : [{
    "name" : "WHO",
    "telecom" : [{
      "system" : "url",
      "value" : "http://who.int"
    }]
  }],
  "description" : "ConceptMap from GDHCN Trust Network Production Participants to WHO Regional Offices.\nParticipants that are not WHO Member States or State Parties (e.g. international organizations\nor non-member territories) have no mapping and are grouped under Other Participants.",
  "jurisdiction" : [{
    "coding" : [{
      "system" : "http://unstats.un.org/unsd/methods/m49/m49.htm",
      "code" : "001"
    }]
  }],
  "sourceScopeCanonical" : "http://smart.who.int/trust/ValueSet/Participants",
  "targetScopeCanonical" : "http://smart.who.int/trust/ValueSet/WHORegionalOffices",
  "group" : [{
    "source" : "http://smart.who.int/refmart/CodeSystems/REF_COUNTRY",
    "target" : "http://smart.who.int/trust/CodeSystem/WHORegionalOffices",
    "element" : [{
      "code" : "BEN",
      "display" : "Benin",
      "target" : [{
        "code" : "AFRO",
        "relationship" : "related-to"
      }]
    },
    {
      "code" : "TGO",
      "display" : "Togo",
      "target" : [{
        "code" : "AFRO",
        "relationship" : "related-to"
      }]
    }]
  },
  {
    "source" : "http://smart.who.int/refmart/CodeSystems/REF_COUNTRY",
    "target" : "http://smart.who.int/trust/CodeSystem/WHORegionalOffices",
    "element" : [{
      "code" : "BRA",
      "display" : "Brazil",
      "target" : [{
        "code" : "AMRO",
        "relationship" : "related-to"
      }]
    }]
  },
  {
    "source" : "http://smart.who.int/refmart/CodeSystems/REF_COUNTRY",
    "target" : "http://smart.who.int/trust/CodeSystem/WHORegionalOffices",
    "element" : [{
      "code" : "OMN",
      "display" : "Oman",
      "target" : [{
        "code" : "EMRO",
        "relationship" : "related-to"
      }]
    }]
  },
  {
    "source" : "http://smart.who.int/refmart/CodeSystems/REF_COUNTRY",
    "target" : "http://smart.who.int/trust/CodeSystem/WHORegionalOffices",
    "element" : [{
      "code" : "ALB",
      "display" : "Albania",
      "target" : [{
        "code" : "EURO",
        "relationship" : "related-to"
      }]
    },
    {
      "code" : "AND",
      "display" : "Andorra",
      "target" : [{
        "code" : "EURO",
        "relationship" : "related-to"
      }]
    },
    {
      "code" : "ARM",
      "display" : "Armenia",
      "target" : [{
        "code" : "EURO",
        "relationship" : "related-to"
      }]
    },
    {
      "code" : "BEL",
      "display" : "Belgium",
      "target" : [{
        "code" : "EURO",
        "relationship" : "related-to"
      }]
    },
    {
      "code" : "CYP",
      "display" : "Cyprus",
      "target" : [{
        "code" : "EURO",
        "relationship" : "related-to"
      }]
    },
    {
      "code" : "CZE",
      "display" : "Czechia",
      "target" : [{
        "code" : "EURO",
        "relationship" : "related-to"
      }]
    },
    {
      "code" : "EST",
      "display" : "Estonia",
      "target" : [{
        "code" : "EURO",
        "relationship" : "related-to"
      }]
    },
    {
      "code" : "FIN",
      "display" : "Finland",
      "target" : [{
        "code" : "EURO",
        "relationship" : "related-to"
      }]
    },
    {
      "code" : "FRA",
      "display" : "France",
      "target" : [{
        "code" : "EURO",
        "relationship" : "related-to"
      }]
    },
    {
      "code" : "ISL",
      "display" : "Iceland",
      "target" : [{
        "code" : "EURO",
        "relationship" : "related-to"
      }]
    },
    {
      "code" : "IRL",
      "display" : "Ireland",
      "target" : [{
        "code" : "EURO",
        "relationship" : "related-to"
      }]
    },
    {
      "code" : "LVA",
      "display" : "Latvia",
      "target" : [{
        "code" : "EURO",
        "relationship" : "related-to"
      }]
    },
    {
      "code" : "LTU",
      "display" : "Lithuania",
      "target" : [{
        "code" : "EURO",
        "relationship" : "related-to"
      }]
    },
    {
      "code" : "MLT",
      "display" : "Malta",
      "target" : [{
        "code" : "EURO",
        "relationship" : "related-to"
      }]
    },
    {
      "code" : "MCO",
      "display" : "Monaco",
      "target" : [{
        "code" : "EURO",
        "relationship" : "related-to"
      }]
    },
    {
      "code" : "NLD",
      "display" : "Netherlands (Kingdom of the)",
      "target" : [{
        "code" : "EURO",
        "relationship" : "related-to"
      }]
    },
    {
      "code" : "POL",
      "display" : "Poland",
      "target" : [{
        "code" : "EURO",
        "relationship" : "related-to"
      }]
    },
    {
      "code" : "PRT",
      "display" : "Portugal",
      "target" : [{
        "code" : "EURO",
        "relationship" : "related-to"
      }]
    },
    {
      "code" : "SMR",
      "display" : "San Marino",
      "target" : [{
        "code" : "EURO",
        "relationship" : "related-to"
      }]
    },
    {
      "code" : "SVK",
      "display" : "Slovakia",
      "target" : [{
        "code" : "EURO",
        "relationship" : "related-to"
      }]
    },
    {
      "code" : "SVN",
      "display" : "Slovenia",
      "target" : [{
        "code" : "EURO",
        "relationship" : "related-to"
      }]
    },
    {
      "code" : "ESP",
      "display" : "Spain",
      "target" : [{
        "code" : "EURO",
        "relationship" : "related-to"
      }]
    },
    {
      "code" : "SWE",
      "display" : "Sweden",
      "target" : [{
        "code" : "EURO",
        "relationship" : "related-to"
      }]
    },
    {
      "code" : "TUR",
      "display" : "Türkiye",
      "target" : [{
        "code" : "EURO",
        "relationship" : "related-to"
      }]
    }]
  },
  {
    "source" : "http://smart.who.int/refmart/CodeSystems/REF_COUNTRY",
    "target" : "http://smart.who.int/trust/CodeSystem/WHORegionalOffices",
    "element" : [{
      "code" : "IDN",
      "display" : "Indonesia",
      "target" : [{
        "code" : "SEARO",
        "relationship" : "related-to"
      }]
    },
    {
      "code" : "THA",
      "display" : "Thailand",
      "target" : [{
        "code" : "SEARO",
        "relationship" : "related-to"
      }]
    }]
  },
  {
    "source" : "http://smart.who.int/refmart/CodeSystems/REF_COUNTRY",
    "target" : "http://smart.who.int/trust/CodeSystem/WHORegionalOffices",
    "element" : [{
      "code" : "MYS",
      "display" : "Malaysia",
      "target" : [{
        "code" : "WPRO",
        "relationship" : "related-to"
      }]
    },
    {
      "code" : "NZL",
      "display" : "New Zealand",
      "target" : [{
        "code" : "WPRO",
        "relationship" : "related-to"
      }]
    },
    {
      "code" : "SGP",
      "display" : "Singapore",
      "target" : [{
        "code" : "WPRO",
        "relationship" : "related-to"
      }]
    }]
  }]
}

```
