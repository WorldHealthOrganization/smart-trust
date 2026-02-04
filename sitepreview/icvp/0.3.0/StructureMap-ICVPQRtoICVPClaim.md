# ICVPQRtoICVPClaim - SMART ICVP v0.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **ICVPQRtoICVPClaim**

## StructureMap: ICVPQRtoICVPClaim 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/icvp/StructureMap/ICVPQRtoICVPClaim | *Version*:0.3.0 |
| Draft as of 2025-10-17 | *Computable Name*:ICVPQRtoICVPClaim |

```

map "http://smart.who.int/icvp/StructureMap/ICVPQRtoICVPClaim" = "ICVPQRtoICVPClaim"

uses "http://hl7.org/fhir/StructureDefinition/QuestionnaireResponse" alias QuestionnaireResponse as source
uses "http://smart.who.int/icvp/StructureDefinition/ICVPMin" alias ICVPPayload as target
uses "http://smart.who.int/icvp/StructureDefinition/ICVP" alias ICVPModel as target
uses "http://smart.who.int/icvp/StructureDefinition/ICVPVaccineDetails" alias ICVPVaccineDetails as target

imports "http://smart.who.int/icvp/StructureMap/ICVPQRtoICVPLM"
imports "http://smart.who.int/icvp/StructureMap/ICVPLMtoICVPClaim"

group ICVPQRtoICVPClaim(source qr : QuestionnaireResponse, target ICVPClaim : ICVPPayload) {
  qr -> create('http://smart.who.int/icvp/StructureDefinition/ICVP') as model then {
    qr -> ICVPClaim then ICVPQRtoICVPLM(qr, model) "rule1aa";
    qr -> ICVPClaim then ICVPLMtoICVPClaim(model, ICVPClaim) "rule2";
  } "rule3";
}


```



## Resource Content

```json
{
  "resourceType" : "StructureMap",
  "id" : "ICVPQRtoICVPClaim",
  "url" : "http://smart.who.int/icvp/StructureMap/ICVPQRtoICVPClaim",
  "version" : "0.3.0",
  "name" : "ICVPQRtoICVPClaim",
  "status" : "draft",
  "date" : "2025-10-17T14:23:37+00:00",
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
      "url" : "http://hl7.org/fhir/StructureDefinition/QuestionnaireResponse",
      "mode" : "source",
      "alias" : "QuestionnaireResponse"
    },
    {
      "url" : "http://smart.who.int/icvp/StructureDefinition/ICVPMin",
      "mode" : "target",
      "alias" : "ICVPPayload"
    },
    {
      "url" : "http://smart.who.int/icvp/StructureDefinition/ICVP",
      "mode" : "target",
      "alias" : "ICVPModel"
    },
    {
      "url" : "http://smart.who.int/icvp/StructureDefinition/ICVPVaccineDetails",
      "mode" : "target",
      "alias" : "ICVPVaccineDetails"
    }
  ],
  "import" : [
    "http://smart.who.int/icvp/StructureMap/ICVPQRtoICVPLM",
    "http://smart.who.int/icvp/StructureMap/ICVPLMtoICVPClaim"
  ],
  "group" : [
    {
      "name" : "ICVPQRtoICVPClaim",
      "typeMode" : "none",
      "input" : [
        {
          "name" : "qr",
          "type" : "QuestionnaireResponse",
          "mode" : "source"
        },
        {
          "name" : "ICVPClaim",
          "type" : "ICVPPayload",
          "mode" : "target"
        }
      ],
      "rule" : [
        {
          "name" : "rule3",
          "source" : [
            {
              "context" : "qr"
            }
          ],
          "target" : [
            {
              "contextType" : "variable",
              "variable" : "model",
              "transform" : "create",
              "parameter" : [
                {
                  "valueString" : "http://smart.who.int/icvp/StructureDefinition/ICVP"
                }
              ]
            }
          ],
          "rule" : [
            {
              "name" : "rule1aa",
              "source" : [
                {
                  "context" : "qr"
                }
              ],
              "target" : [
                {
                  "context" : "ICVPClaim",
                  "contextType" : "variable"
                }
              ],
              "dependent" : [
                {
                  "name" : "ICVPQRtoICVPLM",
                  "variable" : ["qr", "model"]
                }
              ]
            },
            {
              "name" : "rule2",
              "source" : [
                {
                  "context" : "qr"
                }
              ],
              "target" : [
                {
                  "context" : "ICVPClaim",
                  "contextType" : "variable"
                }
              ],
              "dependent" : [
                {
                  "name" : "ICVPLMtoICVPClaim",
                  "variable" : ["model", "ICVPClaim"]
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
