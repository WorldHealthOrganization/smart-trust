# ICVPQRtoICVPLM - SMART ICVP v0.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **ICVPQRtoICVPLM**

## StructureMap: ICVPQRtoICVPLM 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/icvp/StructureMap/ICVPQRtoICVPLM | *Version*:0.3.0 |
| Draft as of 2025-10-17 | *Computable Name*:ICVPQRtoICVPLM |

```

map "http://smart.who.int/icvp/StructureMap/ICVPQRtoICVPLM" = "ICVPQRtoICVPLM"

uses "http://hl7.org/fhir/StructureDefinition/QuestionnaireResponse" alias QuestionnaireResponse as source
uses "http://smart.who.int/icvp/StructureDefinition/ICVP" alias ICVPLogicalModel as target
uses "http://smart.who.int/icvp/StructureDefinition/ICVPVaccineDetails" alias ICVPVaccineDetails as target
uses "http://smart.who.int/icvp/StructureDefinition/ICVPMin" alias ICVPClaim as target

group ICVPQRtoICVPLM(source qr : QuestionnaireResponse, target lm : ICVPLogicalModel) {
  qr.item as item where linkId.value in ('name') then {
    item.answer as answer then {
      answer.value as name -> lm.name = name "rule1";
    } "rule1a";
  } "rule1b";
  qr.item as item where linkId.value in ('dob') then {
    item.answer as answer then {
      answer.value as dob -> lm.dob = dob "rule2";
    } "rule2a";
  } "rule2b";
  qr.item as item where linkId.value in ('sex') then {
    item.answer as answer then {
      answer.value as sex -> lm.sex = sex "rule3";
    } "rule3a";
  } "rule3b";
  qr.item as item where linkId.value in ('nationality') then {
    item.answer as answer then {
      answer.value as nationality -> lm.nationality = nationality "rule4";
    } "rule4a";
  } "rule4b";
  qr.item as item where linkId.value in ('nid') then {
    item.answer as answer then {
      answer.value as nid -> lm.nid = nid "rule5";
    } "rule5a";
  } "rule5b";
  qr.item as item where linkId.value in ('guardian') then {
    item.answer as answer then {
      answer.value as guardian -> lm.guardian = guardian "rule6";
    } "rule6a";
  } "rule6b";
  qr.item as item where linkId.value in ('vaccineDetails') -> lm.vaccineDetails as v then mapVaccineDetails(item, v) "rule7";
}

group mapVaccineDetails(source s : BackboneElement, target v : ICVPVaccineDetails) {
  s.item as item where linkId.value in ('productID') then {
    item.answer as answer then {
      answer.value as productID -> v.productID = productID "rule7";
    } "rule7a";
  } "rule7b";
  s.item as item where linkId.value in ('date') then {
    item.answer as answer then {
      answer.value as date -> v.date = date "rule8";
    } "rule8a";
  } "rule8b";
  s.item as item where linkId.value in ('clinicianName') then {
    item.answer as answer then {
      answer.value as clinicianName -> v.clinicianName = clinicianName "rule9";
    } "rule9a";
  } "rule9b";
  s.item as item where linkId.value in ('issuer') then {
    item.answer as answer then {
      answer.value as issuer -> v.issuer = issuer "rule10";
    } "rule10a";
  } "rule10b";
  s.item as item where linkId.value in ('batchNo.text') then {
    item.answer as answer then {
      answer.value as batchNo -> v.batchNo = batchNo "rule11";
    } "rule11a";
  } "rule11b";
  s.item as item where linkId.value in ('validityPeriod') then {
    item -> v.validityPeriod as period then {
      item.item as item where linkId.value in ('startDate') then {
        item.answer as answer then {
          answer.validityPeriod as start -> period.start = start "rule12";
        } "rule12a";
      } "rule12b";
      item.item as item where linkId.value in ('endDate') then {
        item.answer as answer then {
          answer.validityPeriod as end -> period.end = end "rule13";
        } "rule13a";
      } "rule13b";
    } "rule14";
  } "rule15";
}


```



## Resource Content

```json
{
  "resourceType" : "StructureMap",
  "id" : "ICVPQRtoICVPLM",
  "url" : "http://smart.who.int/icvp/StructureMap/ICVPQRtoICVPLM",
  "version" : "0.3.0",
  "name" : "ICVPQRtoICVPLM",
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
      "url" : "http://smart.who.int/icvp/StructureDefinition/ICVP",
      "mode" : "target",
      "alias" : "ICVPLogicalModel"
    },
    {
      "url" : "http://smart.who.int/icvp/StructureDefinition/ICVPVaccineDetails",
      "mode" : "target",
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
      "name" : "ICVPQRtoICVPLM",
      "typeMode" : "none",
      "input" : [
        {
          "name" : "qr",
          "type" : "QuestionnaireResponse",
          "mode" : "source"
        },
        {
          "name" : "lm",
          "type" : "ICVPLogicalModel",
          "mode" : "target"
        }
      ],
      "rule" : [
        {
          "name" : "rule1b",
          "source" : [
            {
              "context" : "qr",
              "element" : "item",
              "variable" : "item",
              "condition" : "linkId.value in ('name')"
            }
          ],
          "rule" : [
            {
              "name" : "rule1a",
              "source" : [
                {
                  "context" : "item",
                  "element" : "answer",
                  "variable" : "answer"
                }
              ],
              "rule" : [
                {
                  "name" : "rule1",
                  "source" : [
                    {
                      "context" : "answer",
                      "element" : "value",
                      "variable" : "name"
                    }
                  ],
                  "target" : [
                    {
                      "context" : "lm",
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
                }
              ]
            }
          ]
        },
        {
          "name" : "rule2b",
          "source" : [
            {
              "context" : "qr",
              "element" : "item",
              "variable" : "item",
              "condition" : "linkId.value in ('dob')"
            }
          ],
          "rule" : [
            {
              "name" : "rule2a",
              "source" : [
                {
                  "context" : "item",
                  "element" : "answer",
                  "variable" : "answer"
                }
              ],
              "rule" : [
                {
                  "name" : "rule2",
                  "source" : [
                    {
                      "context" : "answer",
                      "element" : "value",
                      "variable" : "dob"
                    }
                  ],
                  "target" : [
                    {
                      "context" : "lm",
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
                }
              ]
            }
          ]
        },
        {
          "name" : "rule3b",
          "source" : [
            {
              "context" : "qr",
              "element" : "item",
              "variable" : "item",
              "condition" : "linkId.value in ('sex')"
            }
          ],
          "rule" : [
            {
              "name" : "rule3a",
              "source" : [
                {
                  "context" : "item",
                  "element" : "answer",
                  "variable" : "answer"
                }
              ],
              "rule" : [
                {
                  "name" : "rule3",
                  "source" : [
                    {
                      "context" : "answer",
                      "element" : "value",
                      "variable" : "sex"
                    }
                  ],
                  "target" : [
                    {
                      "context" : "lm",
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
                }
              ]
            }
          ]
        },
        {
          "name" : "rule4b",
          "source" : [
            {
              "context" : "qr",
              "element" : "item",
              "variable" : "item",
              "condition" : "linkId.value in ('nationality')"
            }
          ],
          "rule" : [
            {
              "name" : "rule4a",
              "source" : [
                {
                  "context" : "item",
                  "element" : "answer",
                  "variable" : "answer"
                }
              ],
              "rule" : [
                {
                  "name" : "rule4",
                  "source" : [
                    {
                      "context" : "answer",
                      "element" : "value",
                      "variable" : "nationality"
                    }
                  ],
                  "target" : [
                    {
                      "context" : "lm",
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
                }
              ]
            }
          ]
        },
        {
          "name" : "rule5b",
          "source" : [
            {
              "context" : "qr",
              "element" : "item",
              "variable" : "item",
              "condition" : "linkId.value in ('nid')"
            }
          ],
          "rule" : [
            {
              "name" : "rule5a",
              "source" : [
                {
                  "context" : "item",
                  "element" : "answer",
                  "variable" : "answer"
                }
              ],
              "rule" : [
                {
                  "name" : "rule5",
                  "source" : [
                    {
                      "context" : "answer",
                      "element" : "value",
                      "variable" : "nid"
                    }
                  ],
                  "target" : [
                    {
                      "context" : "lm",
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
                }
              ]
            }
          ]
        },
        {
          "name" : "rule6b",
          "source" : [
            {
              "context" : "qr",
              "element" : "item",
              "variable" : "item",
              "condition" : "linkId.value in ('guardian')"
            }
          ],
          "rule" : [
            {
              "name" : "rule6a",
              "source" : [
                {
                  "context" : "item",
                  "element" : "answer",
                  "variable" : "answer"
                }
              ],
              "rule" : [
                {
                  "name" : "rule6",
                  "source" : [
                    {
                      "context" : "answer",
                      "element" : "value",
                      "variable" : "guardian"
                    }
                  ],
                  "target" : [
                    {
                      "context" : "lm",
                      "contextType" : "variable",
                      "element" : "guardian",
                      "transform" : "copy",
                      "parameter" : [
                        {
                          "valueId" : "guardian"
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
          "name" : "rule7",
          "source" : [
            {
              "context" : "qr",
              "element" : "item",
              "variable" : "item",
              "condition" : "linkId.value in ('vaccineDetails')"
            }
          ],
          "target" : [
            {
              "context" : "lm",
              "contextType" : "variable",
              "element" : "vaccineDetails",
              "variable" : "v"
            }
          ],
          "dependent" : [
            {
              "name" : "mapVaccineDetails",
              "variable" : ["item", "v"]
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
          "name" : "s",
          "type" : "BackboneElement",
          "mode" : "source"
        },
        {
          "name" : "v",
          "type" : "ICVPVaccineDetails",
          "mode" : "target"
        }
      ],
      "rule" : [
        {
          "name" : "rule7b",
          "source" : [
            {
              "context" : "s",
              "element" : "item",
              "variable" : "item",
              "condition" : "linkId.value in ('productID')"
            }
          ],
          "rule" : [
            {
              "name" : "rule7a",
              "source" : [
                {
                  "context" : "item",
                  "element" : "answer",
                  "variable" : "answer"
                }
              ],
              "rule" : [
                {
                  "name" : "rule7",
                  "source" : [
                    {
                      "context" : "answer",
                      "element" : "value",
                      "variable" : "productID"
                    }
                  ],
                  "target" : [
                    {
                      "context" : "v",
                      "contextType" : "variable",
                      "element" : "productID",
                      "transform" : "copy",
                      "parameter" : [
                        {
                          "valueId" : "productID"
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
          "name" : "rule8b",
          "source" : [
            {
              "context" : "s",
              "element" : "item",
              "variable" : "item",
              "condition" : "linkId.value in ('date')"
            }
          ],
          "rule" : [
            {
              "name" : "rule8a",
              "source" : [
                {
                  "context" : "item",
                  "element" : "answer",
                  "variable" : "answer"
                }
              ],
              "rule" : [
                {
                  "name" : "rule8",
                  "source" : [
                    {
                      "context" : "answer",
                      "element" : "value",
                      "variable" : "date"
                    }
                  ],
                  "target" : [
                    {
                      "context" : "v",
                      "contextType" : "variable",
                      "element" : "date",
                      "transform" : "copy",
                      "parameter" : [
                        {
                          "valueId" : "date"
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
          "name" : "rule9b",
          "source" : [
            {
              "context" : "s",
              "element" : "item",
              "variable" : "item",
              "condition" : "linkId.value in ('clinicianName')"
            }
          ],
          "rule" : [
            {
              "name" : "rule9a",
              "source" : [
                {
                  "context" : "item",
                  "element" : "answer",
                  "variable" : "answer"
                }
              ],
              "rule" : [
                {
                  "name" : "rule9",
                  "source" : [
                    {
                      "context" : "answer",
                      "element" : "value",
                      "variable" : "clinicianName"
                    }
                  ],
                  "target" : [
                    {
                      "context" : "v",
                      "contextType" : "variable",
                      "element" : "clinicianName",
                      "transform" : "copy",
                      "parameter" : [
                        {
                          "valueId" : "clinicianName"
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
          "name" : "rule10b",
          "source" : [
            {
              "context" : "s",
              "element" : "item",
              "variable" : "item",
              "condition" : "linkId.value in ('issuer')"
            }
          ],
          "rule" : [
            {
              "name" : "rule10a",
              "source" : [
                {
                  "context" : "item",
                  "element" : "answer",
                  "variable" : "answer"
                }
              ],
              "rule" : [
                {
                  "name" : "rule10",
                  "source" : [
                    {
                      "context" : "answer",
                      "element" : "value",
                      "variable" : "issuer"
                    }
                  ],
                  "target" : [
                    {
                      "context" : "v",
                      "contextType" : "variable",
                      "element" : "issuer",
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
        },
        {
          "name" : "rule11b",
          "source" : [
            {
              "context" : "s",
              "element" : "item",
              "variable" : "item",
              "condition" : "linkId.value in ('batchNo.text')"
            }
          ],
          "rule" : [
            {
              "name" : "rule11a",
              "source" : [
                {
                  "context" : "item",
                  "element" : "answer",
                  "variable" : "answer"
                }
              ],
              "rule" : [
                {
                  "name" : "rule11",
                  "source" : [
                    {
                      "context" : "answer",
                      "element" : "value",
                      "variable" : "batchNo"
                    }
                  ],
                  "target" : [
                    {
                      "context" : "v",
                      "contextType" : "variable",
                      "element" : "batchNo",
                      "transform" : "copy",
                      "parameter" : [
                        {
                          "valueId" : "batchNo"
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
          "name" : "rule15",
          "source" : [
            {
              "context" : "s",
              "element" : "item",
              "variable" : "item",
              "condition" : "linkId.value in ('validityPeriod')"
            }
          ],
          "rule" : [
            {
              "name" : "rule14",
              "source" : [
                {
                  "context" : "item"
                }
              ],
              "target" : [
                {
                  "context" : "v",
                  "contextType" : "variable",
                  "element" : "validityPeriod",
                  "variable" : "period"
                }
              ],
              "rule" : [
                {
                  "name" : "rule12b",
                  "source" : [
                    {
                      "context" : "item",
                      "element" : "item",
                      "variable" : "item",
                      "condition" : "linkId.value in ('startDate')"
                    }
                  ],
                  "rule" : [
                    {
                      "name" : "rule12a",
                      "source" : [
                        {
                          "context" : "item",
                          "element" : "answer",
                          "variable" : "answer"
                        }
                      ],
                      "rule" : [
                        {
                          "name" : "rule12",
                          "source" : [
                            {
                              "context" : "answer",
                              "element" : "validityPeriod",
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
                        }
                      ]
                    }
                  ]
                },
                {
                  "name" : "rule13b",
                  "source" : [
                    {
                      "context" : "item",
                      "element" : "item",
                      "variable" : "item",
                      "condition" : "linkId.value in ('endDate')"
                    }
                  ],
                  "rule" : [
                    {
                      "name" : "rule13a",
                      "source" : [
                        {
                          "context" : "item",
                          "element" : "answer",
                          "variable" : "answer"
                        }
                      ],
                      "rule" : [
                        {
                          "name" : "rule13",
                          "source" : [
                            {
                              "context" : "answer",
                              "element" : "validityPeriod",
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
  ]
}

```
