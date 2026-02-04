# ICVPLMtoICVPClaim - SMART ICVP v0.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **ICVPLMtoICVPClaim**

## StructureMap: ICVPLMtoICVPClaim 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/icvp/StructureMap/ICVPLMtoICVPClaim | *Version*:0.3.0 |
| Draft as of 2025-10-17 | *Computable Name*:ICVPLMtoICVPClaim |

```

map "http://smart.who.int/icvp/StructureMap/ICVPLMtoICVPClaim" = "ICVPLMtoICVPClaim"

uses "http://smart.who.int/icvp/StructureDefinition/ICVP" alias ICVPLogicalModel as source
uses "http://smart.who.int/icvp/StructureDefinition/ICVPVaccineDetails" alias ICVPVaccineDetails as source
uses "http://smart.who.int/icvp/StructureDefinition/ICVPMin" alias ICVPClaim as target

group ICVPLMtoICVPClaim(source lm : ICVPLogicalModel, target claim : ICVPClaim) {
  lm.name as name -> claim.n = name "rule1";
  lm.dob as dob -> claim.dob = dob "rule2";
  lm.sex as sex then {
    sex.code as code -> claim.s = code "rule3";
  } "rule3a";
  lm.nationality as nationality then {
    nationality.code as code -> claim.ntl = code "rule4";
  } "rule4a";
  lm.nid as nid -> claim.nid = nid "rule5";
  lm.guardian as guardian -> claim.gn = guardian "rule6";
  lm.vaccineDetails as vaccineDetails -> claim.v as tVax then mapVaccineDetails(vaccineDetails, tVax) "rule7";
}

group mapVaccineDetails(source v : ICVPVaccineDetails, target tVax : BackboneElement) {
  v.disease as coding then {
    coding.code as disease -> tVax.tg = disease "rule9";
  } "rule9a";
  v.productID as vc then {
    vc.Coding as coding then {
      coding.code as vaccine -> tVax.vp = vaccine "rule10";
    } "rule10a";
  } "rule10b";
  v.vaccineTradeItem as identifier then {
    identifier.value as id -> tVax.mp = id "rule11";
  } "rule11a";
  v.manufacturer as manufacturer -> tVax.ma = manufacturer "rule12";
  v.manufacturerId as identifier then {
    identifier.value as mid -> tVax.mid = mid "rule13";
  } "rule13a";
  v.date as date -> tVax.dt = date "rule14";
  v.batchNo as batch -> tVax.bo = batch "rule15";
  v.validityPeriod as period then {
    period.start as start -> tVax.vls = start "rule16";
    period.end as end -> tVax.vle = end "rule17";
  } "rule16a";
  v.clinicianName as clinicianName -> tVax.cn = clinicianName "rule18";
  v.issuer as reference then {
    reference.id as issuer -> tVax.is = issuer "rule19";
  } "rule19a";
}


```



## Resource Content

```json
{
  "resourceType" : "StructureMap",
  "id" : "ICVPLMtoICVPClaim",
  "url" : "http://smart.who.int/icvp/StructureMap/ICVPLMtoICVPClaim",
  "version" : "0.3.0",
  "name" : "ICVPLMtoICVPClaim",
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
      "url" : "http://smart.who.int/icvp/StructureDefinition/ICVP",
      "mode" : "source",
      "alias" : "ICVPLogicalModel"
    },
    {
      "url" : "http://smart.who.int/icvp/StructureDefinition/ICVPVaccineDetails",
      "mode" : "source",
      "alias" : "ICVPVaccineDetails"
    },
    {
      "url" : "http://smart.who.int/icvp/StructureDefinition/ICVPMin",
      "mode" : "target",
      "alias" : "ICVPClaim"
    }
  ],
  "group" : [
    {
      "name" : "ICVPLMtoICVPClaim",
      "typeMode" : "none",
      "input" : [
        {
          "name" : "lm",
          "type" : "ICVPLogicalModel",
          "mode" : "source"
        },
        {
          "name" : "claim",
          "type" : "ICVPClaim",
          "mode" : "target"
        }
      ],
      "rule" : [
        {
          "name" : "rule1",
          "source" : [
            {
              "context" : "lm",
              "element" : "name",
              "variable" : "name"
            }
          ],
          "target" : [
            {
              "context" : "claim",
              "contextType" : "variable",
              "element" : "n",
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
              "context" : "lm",
              "element" : "dob",
              "variable" : "dob"
            }
          ],
          "target" : [
            {
              "context" : "claim",
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
          "name" : "rule3a",
          "source" : [
            {
              "context" : "lm",
              "element" : "sex",
              "variable" : "sex"
            }
          ],
          "rule" : [
            {
              "name" : "rule3",
              "source" : [
                {
                  "context" : "sex",
                  "element" : "code",
                  "variable" : "code"
                }
              ],
              "target" : [
                {
                  "context" : "claim",
                  "contextType" : "variable",
                  "element" : "s",
                  "transform" : "copy",
                  "parameter" : [
                    {
                      "valueId" : "code"
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          "name" : "rule4a",
          "source" : [
            {
              "context" : "lm",
              "element" : "nationality",
              "variable" : "nationality"
            }
          ],
          "rule" : [
            {
              "name" : "rule4",
              "source" : [
                {
                  "context" : "nationality",
                  "element" : "code",
                  "variable" : "code"
                }
              ],
              "target" : [
                {
                  "context" : "claim",
                  "contextType" : "variable",
                  "element" : "ntl",
                  "transform" : "copy",
                  "parameter" : [
                    {
                      "valueId" : "code"
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          "name" : "rule5",
          "source" : [
            {
              "context" : "lm",
              "element" : "nid",
              "variable" : "nid"
            }
          ],
          "target" : [
            {
              "context" : "claim",
              "contextType" : "variable",
              "element" : "nid",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "nid"
                }
              ]
            }
          ]
        },
        {
          "name" : "rule6",
          "source" : [
            {
              "context" : "lm",
              "element" : "guardian",
              "variable" : "guardian"
            }
          ],
          "target" : [
            {
              "context" : "claim",
              "contextType" : "variable",
              "element" : "gn",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "guardian"
                }
              ]
            }
          ]
        },
        {
          "name" : "rule7",
          "source" : [
            {
              "context" : "lm",
              "element" : "vaccineDetails",
              "variable" : "vaccineDetails"
            }
          ],
          "target" : [
            {
              "context" : "claim",
              "contextType" : "variable",
              "element" : "v",
              "variable" : "tVax"
            }
          ],
          "dependent" : [
            {
              "name" : "mapVaccineDetails",
              "variable" : ["vaccineDetails", "tVax"]
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
          "name" : "v",
          "type" : "ICVPVaccineDetails",
          "mode" : "source"
        },
        {
          "name" : "tVax",
          "type" : "BackboneElement",
          "mode" : "target"
        }
      ],
      "rule" : [
        {
          "name" : "rule9a",
          "source" : [
            {
              "context" : "v",
              "element" : "disease",
              "variable" : "coding"
            }
          ],
          "rule" : [
            {
              "name" : "rule9",
              "source" : [
                {
                  "context" : "coding",
                  "element" : "code",
                  "variable" : "disease"
                }
              ],
              "target" : [
                {
                  "context" : "tVax",
                  "contextType" : "variable",
                  "element" : "tg",
                  "transform" : "copy",
                  "parameter" : [
                    {
                      "valueId" : "disease"
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          "name" : "rule10b",
          "source" : [
            {
              "context" : "v",
              "element" : "productID",
              "variable" : "vc"
            }
          ],
          "rule" : [
            {
              "name" : "rule10a",
              "source" : [
                {
                  "context" : "vc",
                  "element" : "Coding",
                  "variable" : "coding"
                }
              ],
              "rule" : [
                {
                  "name" : "rule10",
                  "source" : [
                    {
                      "context" : "coding",
                      "element" : "code",
                      "variable" : "vaccine"
                    }
                  ],
                  "target" : [
                    {
                      "context" : "tVax",
                      "contextType" : "variable",
                      "element" : "vp",
                      "transform" : "copy",
                      "parameter" : [
                        {
                          "valueId" : "vaccine"
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          "name" : "rule11a",
          "source" : [
            {
              "context" : "v",
              "element" : "vaccineTradeItem",
              "variable" : "identifier"
            }
          ],
          "rule" : [
            {
              "name" : "rule11",
              "source" : [
                {
                  "context" : "identifier",
                  "element" : "value",
                  "variable" : "id"
                }
              ],
              "target" : [
                {
                  "context" : "tVax",
                  "contextType" : "variable",
                  "element" : "mp",
                  "transform" : "copy",
                  "parameter" : [
                    {
                      "valueId" : "id"
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          "name" : "rule12",
          "source" : [
            {
              "context" : "v",
              "element" : "manufacturer",
              "variable" : "manufacturer"
            }
          ],
          "target" : [
            {
              "context" : "tVax",
              "contextType" : "variable",
              "element" : "ma",
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
          "name" : "rule13a",
          "source" : [
            {
              "context" : "v",
              "element" : "manufacturerId",
              "variable" : "identifier"
            }
          ],
          "rule" : [
            {
              "name" : "rule13",
              "source" : [
                {
                  "context" : "identifier",
                  "element" : "value",
                  "variable" : "mid"
                }
              ],
              "target" : [
                {
                  "context" : "tVax",
                  "contextType" : "variable",
                  "element" : "mid",
                  "transform" : "copy",
                  "parameter" : [
                    {
                      "valueId" : "mid"
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          "name" : "rule14",
          "source" : [
            {
              "context" : "v",
              "element" : "date",
              "variable" : "date"
            }
          ],
          "target" : [
            {
              "context" : "tVax",
              "contextType" : "variable",
              "element" : "dt",
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
          "name" : "rule15",
          "source" : [
            {
              "context" : "v",
              "element" : "batchNo",
              "variable" : "batch"
            }
          ],
          "target" : [
            {
              "context" : "tVax",
              "contextType" : "variable",
              "element" : "bo",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "batch"
                }
              ]
            }
          ]
        },
        {
          "name" : "rule16a",
          "source" : [
            {
              "context" : "v",
              "element" : "validityPeriod",
              "variable" : "period"
            }
          ],
          "rule" : [
            {
              "name" : "rule16",
              "source" : [
                {
                  "context" : "period",
                  "element" : "start",
                  "variable" : "start"
                }
              ],
              "target" : [
                {
                  "context" : "tVax",
                  "contextType" : "variable",
                  "element" : "vls",
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
              "name" : "rule17",
              "source" : [
                {
                  "context" : "period",
                  "element" : "end",
                  "variable" : "end"
                }
              ],
              "target" : [
                {
                  "context" : "tVax",
                  "contextType" : "variable",
                  "element" : "vle",
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
        },
        {
          "name" : "rule18",
          "source" : [
            {
              "context" : "v",
              "element" : "clinicianName",
              "variable" : "clinicianName"
            }
          ],
          "target" : [
            {
              "context" : "tVax",
              "contextType" : "variable",
              "element" : "cn",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "clinicianName"
                }
              ]
            }
          ]
        },
        {
          "name" : "rule19a",
          "source" : [
            {
              "context" : "v",
              "element" : "issuer",
              "variable" : "reference"
            }
          ],
          "rule" : [
            {
              "name" : "rule19",
              "source" : [
                {
                  "context" : "reference",
                  "element" : "id",
                  "variable" : "issuer"
                }
              ],
              "target" : [
                {
                  "context" : "tVax",
                  "contextType" : "variable",
                  "element" : "is",
                  "transform" : "copy",
                  "parameter" : [
                    {
                      "valueId" : "issuer"
                    }
                  ]
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
