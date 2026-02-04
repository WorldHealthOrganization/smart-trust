# ICVPClaimtoICVPLM - SMART ICVP v0.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **ICVPClaimtoICVPLM**

## StructureMap: ICVPClaimtoICVPLM 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/icvp/StructureMap/ICVPClaimtoICVPLM | *Version*:0.3.0 |
| Draft as of 2025-10-17 | *Computable Name*:ICVPClaimtoICVPLM |

```

map "http://smart.who.int/icvp/StructureMap/ICVPClaimtoICVPLM" = "ICVPClaimtoICVPLM"

uses "http://smart.who.int/icvp/StructureDefinition/ICVPMin" alias ICVPPayload as source
uses "http://smart.who.int/icvp/StructureDefinition/ICVP" alias ICVPModel as target
uses "http://smart.who.int/icvp/StructureDefinition/ICVPMinVaccineDetails" alias ICVPVaccineDetails as target

group ICVPClaimtoICVPLM(source src : ICVPPayload, target tgt : ICVPModel) {
  src.n as name -> tgt.name = name "rule1";
  src.dob as dob -> tgt.dob = dob "rule2";
  src.s as sex -> tgt.sex = sex "rule3";
  src.ndt as ndt -> tgt.ndt = ndt "rule3a";
  src.ntl as nationality -> tgt.nationality = nationality "rule4";
  src.nid as id -> tgt.nid = id "rule5";
  src.gn as gName -> tgt.guardian = gName "rule6";
  src.v as v -> tgt.vaccineDetails as tv then mapVaccineDetails(v, tv) "rule7";
}

group mapVaccineDetails(source src : BackboneElement, target tgt : ICVPVaccineDetails) {
  src.vp as vp ->  create('Coding') as coding,  coding.code = vp,  coding.system = 'http://smart.who.int/pcmt-vaxprequal/CodeSystem/PreQualProductIds',  tgt.productID = coding "rule9";
  src.dt as dt -> tgt.date = dt "rule13";
  src.bo as bo ->  create('CodeableConcept') as code,  code.text = bo,  tgt.batchNo = code "rule14";
  src -> create('Period') as period then {
    src.vls as start -> period.start = start "rule15";
    src.vle as end -> period.end = end "rule16";
    src -> tgt.validityPeriod = period "rule17";
  } "rule18";
  src.cn as cn -> tgt.clinicianName = cn "rule19";
  src.is as is ->  tgt.issuer as issuer,  issuer.reference = append('Organization/', is) "rule21";
}

// helper function
group generateNarrativeText(source src : Section, target text : string) {
  src -> text.status = 'empty' "setstatus";
  src -> text.div = '<div>narrative not available</div>' "setdiv";
}

group humanNameToHumanName(source sourceName, target targetName : HumanName) {
  sourceName.use as use -> targetName.use = use "CopyUse";
  sourceName.text as text -> targetName.text = text "CopyText";
  sourceName.family as family -> targetName.family = family "CopyFamily";
  sourceName.given as given -> targetName.given = given "CopyGiven";
  sourceName.prefix as prefix -> targetName.prefix = prefix "CopyPrefix";
  sourceName.suffix as suffix -> targetName.suffix = suffix "CopySuffix";
  // Copy the period using the previously defined group function
  sourceName.period as sourcePeriod -> targetName.period as targetPeriod then {
    sourcePeriod -> sourcePeriod then periodToPeriod(sourcePeriod, targetPeriod) "CopyPeriod";
  } "copyPeriod";
}

group periodToPeriod(source sourcePeriod, target targetPeriod : Period) {
  sourcePeriod.start as start -> targetPeriod.start = start "setPeriodStart";
  sourcePeriod.end as end -> targetPeriod.end = end "setPeriodEnd";
}


```



## Resource Content

```json
{
  "resourceType" : "StructureMap",
  "id" : "ICVPClaimtoICVPLM",
  "url" : "http://smart.who.int/icvp/StructureMap/ICVPClaimtoICVPLM",
  "version" : "0.3.0",
  "name" : "ICVPClaimtoICVPLM",
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
      "url" : "http://smart.who.int/icvp/StructureDefinition/ICVPMin",
      "mode" : "source",
      "alias" : "ICVPPayload"
    },
    {
      "url" : "http://smart.who.int/icvp/StructureDefinition/ICVP",
      "mode" : "target",
      "alias" : "ICVPModel"
    },
    {
      "url" : "http://smart.who.int/icvp/StructureDefinition/ICVPMinVaccineDetails",
      "mode" : "target",
      "alias" : "ICVPVaccineDetails"
    }
  ],
  "group" : [
    {
      "name" : "ICVPClaimtoICVPLM",
      "typeMode" : "none",
      "input" : [
        {
          "name" : "src",
          "type" : "ICVPPayload",
          "mode" : "source"
        },
        {
          "name" : "tgt",
          "type" : "ICVPModel",
          "mode" : "target"
        }
      ],
      "rule" : [
        {
          "name" : "rule1",
          "source" : [
            {
              "context" : "src",
              "element" : "n",
              "variable" : "name"
            }
          ],
          "target" : [
            {
              "context" : "tgt",
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
          "name" : "rule2",
          "source" : [
            {
              "context" : "src",
              "element" : "dob",
              "variable" : "dob"
            }
          ],
          "target" : [
            {
              "context" : "tgt",
              "contextType" : "variable",
              "element" : "dob",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "dob"
                }
              ]
            }
          ]
        },
        {
          "name" : "rule3",
          "source" : [
            {
              "context" : "src",
              "element" : "s",
              "variable" : "sex"
            }
          ],
          "target" : [
            {
              "context" : "tgt",
              "contextType" : "variable",
              "element" : "sex",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "sex"
                }
              ]
            }
          ]
        },
        {
          "name" : "rule3a",
          "source" : [
            {
              "context" : "src",
              "element" : "ndt",
              "variable" : "ndt"
            }
          ],
          "target" : [
            {
              "context" : "tgt",
              "contextType" : "variable",
              "element" : "ndt",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "ndt"
                }
              ]
            }
          ]
        },
        {
          "name" : "rule4",
          "source" : [
            {
              "context" : "src",
              "element" : "ntl",
              "variable" : "nationality"
            }
          ],
          "target" : [
            {
              "context" : "tgt",
              "contextType" : "variable",
              "element" : "nationality",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "nationality"
                }
              ]
            }
          ]
        },
        {
          "name" : "rule5",
          "source" : [
            {
              "context" : "src",
              "element" : "nid",
              "variable" : "id"
            }
          ],
          "target" : [
            {
              "context" : "tgt",
              "contextType" : "variable",
              "element" : "nid",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "id"
                }
              ]
            }
          ]
        },
        {
          "name" : "rule6",
          "source" : [
            {
              "context" : "src",
              "element" : "gn",
              "variable" : "gName"
            }
          ],
          "target" : [
            {
              "context" : "tgt",
              "contextType" : "variable",
              "element" : "guardian",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "gName"
                }
              ]
            }
          ]
        },
        {
          "name" : "rule7",
          "source" : [
            {
              "context" : "src",
              "element" : "v",
              "variable" : "v"
            }
          ],
          "target" : [
            {
              "context" : "tgt",
              "contextType" : "variable",
              "element" : "vaccineDetails",
              "variable" : "tv"
            }
          ],
          "dependent" : [
            {
              "name" : "mapVaccineDetails",
              "variable" : ["v", "tv"]
            }
          ]
        }
      ]
    },
    {
      "name" : "mapVaccineDetails",
      "typeMode" : "none",
      "input" : [
        {
          "name" : "src",
          "type" : "BackboneElement",
          "mode" : "source"
        },
        {
          "name" : "tgt",
          "type" : "ICVPVaccineDetails",
          "mode" : "target"
        }
      ],
      "rule" : [
        {
          "name" : "rule9",
          "source" : [
            {
              "context" : "src",
              "element" : "vp",
              "variable" : "vp"
            }
          ],
          "target" : [
            {
              "contextType" : "variable",
              "variable" : "coding",
              "transform" : "create",
              "parameter" : [
                {
                  "valueString" : "Coding"
                }
              ]
            },
            {
              "context" : "coding",
              "contextType" : "variable",
              "element" : "code",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "vp"
                }
              ]
            },
            {
              "context" : "coding",
              "contextType" : "variable",
              "element" : "system",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueString" : "http://smart.who.int/pcmt-vaxprequal/CodeSystem/PreQualProductIds"
                }
              ]
            },
            {
              "context" : "tgt",
              "contextType" : "variable",
              "element" : "productID",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "coding"
                }
              ]
            }
          ]
        },
        {
          "name" : "rule13",
          "source" : [
            {
              "context" : "src",
              "element" : "dt",
              "variable" : "dt"
            }
          ],
          "target" : [
            {
              "context" : "tgt",
              "contextType" : "variable",
              "element" : "date",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "dt"
                }
              ]
            }
          ]
        },
        {
          "name" : "rule14",
          "source" : [
            {
              "context" : "src",
              "element" : "bo",
              "variable" : "bo"
            }
          ],
          "target" : [
            {
              "contextType" : "variable",
              "variable" : "code",
              "transform" : "create",
              "parameter" : [
                {
                  "valueString" : "CodeableConcept"
                }
              ]
            },
            {
              "context" : "code",
              "contextType" : "variable",
              "element" : "text",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "bo"
                }
              ]
            },
            {
              "context" : "tgt",
              "contextType" : "variable",
              "element" : "batchNo",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "code"
                }
              ]
            }
          ]
        },
        {
          "name" : "rule18",
          "source" : [
            {
              "context" : "src"
            }
          ],
          "target" : [
            {
              "contextType" : "variable",
              "variable" : "period",
              "transform" : "create",
              "parameter" : [
                {
                  "valueString" : "Period"
                }
              ]
            }
          ],
          "rule" : [
            {
              "name" : "rule15",
              "source" : [
                {
                  "context" : "src",
                  "element" : "vls",
                  "variable" : "start"
                }
              ],
              "target" : [
                {
                  "context" : "period",
                  "contextType" : "variable",
                  "element" : "start",
                  "transform" : "copy",
                  "parameter" : [
                    {
                      "valueId" : "start"
                    }
                  ]
                }
              ]
            },
            {
              "name" : "rule16",
              "source" : [
                {
                  "context" : "src",
                  "element" : "vle",
                  "variable" : "end"
                }
              ],
              "target" : [
                {
                  "context" : "period",
                  "contextType" : "variable",
                  "element" : "end",
                  "transform" : "copy",
                  "parameter" : [
                    {
                      "valueId" : "end"
                    }
                  ]
                }
              ]
            },
            {
              "name" : "rule17",
              "source" : [
                {
                  "context" : "src"
                }
              ],
              "target" : [
                {
                  "context" : "tgt",
                  "contextType" : "variable",
                  "element" : "validityPeriod",
                  "transform" : "copy",
                  "parameter" : [
                    {
                      "valueId" : "period"
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          "name" : "rule19",
          "source" : [
            {
              "context" : "src",
              "element" : "cn",
              "variable" : "cn"
            }
          ],
          "target" : [
            {
              "context" : "tgt",
              "contextType" : "variable",
              "element" : "clinicianName",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "cn"
                }
              ]
            }
          ]
        },
        {
          "name" : "rule21",
          "source" : [
            {
              "context" : "src",
              "element" : "is",
              "variable" : "is"
            }
          ],
          "target" : [
            {
              "context" : "tgt",
              "contextType" : "variable",
              "element" : "issuer",
              "variable" : "issuer"
            },
            {
              "context" : "issuer",
              "contextType" : "variable",
              "element" : "reference",
              "transform" : "append",
              "parameter" : [
                {
                  "valueString" : "Organization/"
                },
                {
                  "valueId" : "is"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "name" : "generateNarrativeText",
      "typeMode" : "none",
      "documentation" : "helper function",
      "input" : [
        {
          "name" : "src",
          "type" : "Section",
          "mode" : "source"
        },
        {
          "name" : "text",
          "type" : "string",
          "mode" : "target"
        }
      ],
      "rule" : [
        {
          "name" : "setstatus",
          "source" : [
            {
              "context" : "src"
            }
          ],
          "target" : [
            {
              "context" : "text",
              "contextType" : "variable",
              "element" : "status",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueString" : "empty"
                }
              ]
            }
          ]
        },
        {
          "name" : "setdiv",
          "source" : [
            {
              "context" : "src"
            }
          ],
          "target" : [
            {
              "context" : "text",
              "contextType" : "variable",
              "element" : "div",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueString" : "<div>narrative not available</div>"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "name" : "humanNameToHumanName",
      "typeMode" : "none",
      "input" : [
        {
          "name" : "sourceName",
          "mode" : "source"
        },
        {
          "name" : "targetName",
          "type" : "HumanName",
          "mode" : "target"
        }
      ],
      "rule" : [
        {
          "name" : "CopyUse",
          "source" : [
            {
              "context" : "sourceName",
              "element" : "use",
              "variable" : "use"
            }
          ],
          "target" : [
            {
              "context" : "targetName",
              "contextType" : "variable",
              "element" : "use",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "use"
                }
              ]
            }
          ]
        },
        {
          "name" : "CopyText",
          "source" : [
            {
              "context" : "sourceName",
              "element" : "text",
              "variable" : "text"
            }
          ],
          "target" : [
            {
              "context" : "targetName",
              "contextType" : "variable",
              "element" : "text",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "text"
                }
              ]
            }
          ]
        },
        {
          "name" : "CopyFamily",
          "source" : [
            {
              "context" : "sourceName",
              "element" : "family",
              "variable" : "family"
            }
          ],
          "target" : [
            {
              "context" : "targetName",
              "contextType" : "variable",
              "element" : "family",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "family"
                }
              ]
            }
          ]
        },
        {
          "name" : "CopyGiven",
          "source" : [
            {
              "context" : "sourceName",
              "element" : "given",
              "variable" : "given"
            }
          ],
          "target" : [
            {
              "context" : "targetName",
              "contextType" : "variable",
              "element" : "given",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "given"
                }
              ]
            }
          ]
        },
        {
          "name" : "CopyPrefix",
          "source" : [
            {
              "context" : "sourceName",
              "element" : "prefix",
              "variable" : "prefix"
            }
          ],
          "target" : [
            {
              "context" : "targetName",
              "contextType" : "variable",
              "element" : "prefix",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "prefix"
                }
              ]
            }
          ]
        },
        {
          "name" : "CopySuffix",
          "source" : [
            {
              "context" : "sourceName",
              "element" : "suffix",
              "variable" : "suffix"
            }
          ],
          "target" : [
            {
              "context" : "targetName",
              "contextType" : "variable",
              "element" : "suffix",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "suffix"
                }
              ]
            }
          ]
        },
        {
          "name" : "copyPeriod",
          "source" : [
            {
              "context" : "sourceName",
              "element" : "period",
              "variable" : "sourcePeriod"
            }
          ],
          "target" : [
            {
              "context" : "targetName",
              "contextType" : "variable",
              "element" : "period",
              "variable" : "targetPeriod"
            }
          ],
          "rule" : [
            {
              "name" : "CopyPeriod",
              "source" : [
                {
                  "context" : "sourcePeriod"
                }
              ],
              "target" : [
                {
                  "context" : "sourcePeriod",
                  "contextType" : "variable"
                }
              ],
              "dependent" : [
                {
                  "name" : "periodToPeriod",
                  "variable" : ["sourcePeriod", "targetPeriod"]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "name" : "periodToPeriod",
      "typeMode" : "none",
      "input" : [
        {
          "name" : "sourcePeriod",
          "mode" : "source"
        },
        {
          "name" : "targetPeriod",
          "type" : "Period",
          "mode" : "target"
        }
      ],
      "rule" : [
        {
          "name" : "setPeriodStart",
          "source" : [
            {
              "context" : "sourcePeriod",
              "element" : "start",
              "variable" : "start"
            }
          ],
          "target" : [
            {
              "context" : "targetPeriod",
              "contextType" : "variable",
              "element" : "start",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "start"
                }
              ]
            }
          ]
        },
        {
          "name" : "setPeriodEnd",
          "source" : [
            {
              "context" : "sourcePeriod",
              "element" : "end",
              "variable" : "end"
            }
          ],
          "target" : [
            {
              "context" : "targetPeriod",
              "contextType" : "variable",
              "element" : "end",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "end"
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
