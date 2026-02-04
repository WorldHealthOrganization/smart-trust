# PreQualDBtoProductLM - SMART ICVP v0.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **PreQualDBtoProductLM**

## StructureMap: PreQualDBtoProductLM 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/icvp/StructureMap/PreQualDBtoProductLM | *Version*:0.3.0 |
| Draft as of 2025-10-17 | *Computable Name*:PreQualDBtoProductLM |

```

map "http://smart.who.int/icvp/StructureMap/PreQualDBtoProductLM" = "PreQualDBtoProductLM"

uses "http://smart.who.int/icvp/StructureDefinition/PreQualDBwithIDs" alias PreQualDB as source
uses "http://smart.who.int/icvp/StructureDefinition/Product" alias Product as target

group PreQualDBtoProductLM(source prequal : PreQualDB, target product : Product) {
  prequal.number as number -> product.number = number "setNumber";
  prequal.commercialName as name -> product.name = name "setName";
  prequal.manufacturer as manufacturer -> product.manufacturer = manufacturer "setManufacturer";
  prequal.dateOfPrequal as date -> product.dateOfPrequal = date "setDate";
  prequal.vaccineType as vaccineType -> product.vaccineType = vaccineType "setVaccineType";
  prequal.presentation as presentation -> product.presentation = presentation "setPresentation";
  prequal.numDoses as doses -> product.numDoses = doses "setDoses";
  prequal.responsibleNRA as nra -> product.responsibleNRA = nra "setResponsibleNRA";
}


```



## Resource Content

```json
{
  "resourceType" : "StructureMap",
  "id" : "PreQualDBtoProductLM",
  "url" : "http://smart.who.int/icvp/StructureMap/PreQualDBtoProductLM",
  "version" : "0.3.0",
  "name" : "PreQualDBtoProductLM",
  "status" : "draft",
  "date" : "2025-10-17T14:28:32+00:00",
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
  "structure" : [
    {
      "url" : "http://smart.who.int/icvp/StructureDefinition/PreQualDBwithIDs",
      "mode" : "source",
      "alias" : "PreQualDB"
    },
    {
      "url" : "http://smart.who.int/icvp/StructureDefinition/Product",
      "mode" : "target",
      "alias" : "Product"
    }
  ],
  "group" : [
    {
      "name" : "PreQualDBtoProductLM",
      "typeMode" : "none",
      "input" : [
        {
          "name" : "prequal",
          "type" : "PreQualDB",
          "mode" : "source"
        },
        {
          "name" : "product",
          "type" : "Product",
          "mode" : "target"
        }
      ],
      "rule" : [
        {
          "name" : "setNumber",
          "source" : [
            {
              "context" : "prequal",
              "element" : "number",
              "variable" : "number"
            }
          ],
          "target" : [
            {
              "context" : "product",
              "contextType" : "variable",
              "element" : "number",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "number"
                }
              ]
            }
          ]
        },
        {
          "name" : "setName",
          "source" : [
            {
              "context" : "prequal",
              "element" : "commercialName",
              "variable" : "name"
            }
          ],
          "target" : [
            {
              "context" : "product",
              "contextType" : "variable",
              "element" : "name",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "name"
                }
              ]
            }
          ]
        },
        {
          "name" : "setManufacturer",
          "source" : [
            {
              "context" : "prequal",
              "element" : "manufacturer",
              "variable" : "manufacturer"
            }
          ],
          "target" : [
            {
              "context" : "product",
              "contextType" : "variable",
              "element" : "manufacturer",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "manufacturer"
                }
              ]
            }
          ]
        },
        {
          "name" : "setDate",
          "source" : [
            {
              "context" : "prequal",
              "element" : "dateOfPrequal",
              "variable" : "date"
            }
          ],
          "target" : [
            {
              "context" : "product",
              "contextType" : "variable",
              "element" : "dateOfPrequal",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "date"
                }
              ]
            }
          ]
        },
        {
          "name" : "setVaccineType",
          "source" : [
            {
              "context" : "prequal",
              "element" : "vaccineType",
              "variable" : "vaccineType"
            }
          ],
          "target" : [
            {
              "context" : "product",
              "contextType" : "variable",
              "element" : "vaccineType",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "vaccineType"
                }
              ]
            }
          ]
        },
        {
          "name" : "setPresentation",
          "source" : [
            {
              "context" : "prequal",
              "element" : "presentation",
              "variable" : "presentation"
            }
          ],
          "target" : [
            {
              "context" : "product",
              "contextType" : "variable",
              "element" : "presentation",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "presentation"
                }
              ]
            }
          ]
        },
        {
          "name" : "setDoses",
          "source" : [
            {
              "context" : "prequal",
              "element" : "numDoses",
              "variable" : "doses"
            }
          ],
          "target" : [
            {
              "context" : "product",
              "contextType" : "variable",
              "element" : "numDoses",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "doses"
                }
              ]
            }
          ]
        },
        {
          "name" : "setResponsibleNRA",
          "source" : [
            {
              "context" : "prequal",
              "element" : "responsibleNRA",
              "variable" : "nra"
            }
          ],
          "target" : [
            {
              "context" : "product",
              "contextType" : "variable",
              "element" : "responsibleNRA",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "nra"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}

```
