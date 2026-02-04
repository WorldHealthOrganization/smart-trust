# ICVPLMToIPS - SMART ICVP v0.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **ICVPLMToIPS**

## StructureMap: ICVPLMToIPS 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/icvp/StructureMap/ICVPLMToIPS | *Version*:0.3.0 |
| Draft as of 2025-10-17 | *Computable Name*:ICVPLMToIPS |

```

map "http://smart.who.int/icvp/StructureMap/ICVPLMToIPS" = "ICVPLMToIPS"

uses "http://smart.who.int/icvp/StructureDefinition/ICVP" alias ICVPLogicalModel as source
uses "http://hl7.org/fhir/StructureDefinition/Bundle" alias IPS as target

// uses "http://smart.who.int/icvp/ConceptMap/ICVPProductIdToVaccineType" alias ICVPProductIdToVaccineType as conceptmap
// create Bundle
group ICVPLMToIPS(source lm : ICVPLogicalModel, target ips : IPS) {
  lm -> ips.type = 'document' "setIPSType";
  lm ->  uuid() as bid,  ips.identifier as id,  id.value = bid,  id.system = 'urn:oid:2.16.724.4.8.10.200.10' "setId";
  lm ->  uuid() as cid,  uuid() as pid,  uuid() as mid,  uuid() as aid,  uuid() as proid,  uuid() as immid then {
    lm ->  ips.entry as entry,  entry.resource = create('Composition') as composition,  entry.fullUrl = append('urn:uuid:', cid) then {
      lm then LmToComposition(lm, ips, composition, cid, pid, mid, aid, proid, immid) "setLmToComposition";
      lm ->  ips.entry as entry,  entry.fullUrl = append('urn:uuid:', pid),  create('Patient') as patient then {
        lm then DemographicsToPatient(lm, patient, pid) "createPatient";
        lm -> entry.resource = patient "setPatientEntry";
      } "mapPatientResource";
      lm.issuer as issuer then {
        issuer.reference as id ->  ips.entry as entry,  entry.fullUrl = append('urn:uuid:', id),  create('Organization') as organization then {
          lm -> organization then createAuthor(issuer, organization) "createOrganization";
          lm -> entry.resource = organization "setOrganizationEntry";
        } "mapOrganizationResource";
      } "ss";
    } "mapCompositionResource";
  } "setEntries";
}

// create Composition
group LmToComposition(source lm : ICVPLogicalModel, target ips : Bundle, target composition : Composition, source cid, source pid, source mid, source aid, source proid, source immid) {
  cid -> composition.id = cid "setCid";
  lm -> composition.status = 'final' "setStatus";
  lm -> composition.title = 'International Patient Summary' "setTitle";
  lm ->  create('Coding') as coding,  coding.code = '60591-5',  coding.system = 'http://loinc.org',  create('CodeableConcept') as code,  code.coding = coding,  composition.type = code "setType";
  lm -> composition.subject as subject then {
    lm -> subject.reference = append('urn:uuid:', pid) "setSubject";
  } "setSubject";
  lm.issuer as issuer then {
    issuer.reference as id -> composition.author as author then {
      id -> author.reference = append('urn:uuid:', id) "setAuthor";
    } "setauthr";
  } "setid";
  lm -> composition.section as medication then createSectionMedications(lm, medication, mid) "createMedication";
  lm -> composition.section as allergies then createSectionAllergies(lm, allergies, aid) "createAllergies";
  lm -> composition.section as problems then createSectionProblems(lm, problems, proid) "createProblems";
  lm then createSectionImmunizations(lm, ips, composition, immid, pid) "createImmunizations";
}

// create Patient
group DemographicsToPatient(source lm : ICVPLogicalModel, target patient : Patient, source pid) {
  pid -> patient.id = pid "setPatientId";
  lm.name as sourceName -> patient.name as targetName then nameToHumanName(sourceName, targetName) "Setname";
  lm.dob as dob -> patient.birthDate = dob "setDateofBirth";
  lm.sex as sex then ExtractGender(sex, patient) "PatientGender";
  // lm.sex as sex -> patient.gender = sex "setSex";
  lm.nid as id ->  patient.identifier as identifier,  identifier.value = id "setNationalIdentifier";
  lm.guardian as guardian ->  patient.contact as parentContact,  parentContact.name as parentName then nameToHumanName(guardian, parentName) "setGuardianName";
}

// deals with short and case sensitive codes
group ExtractGender(source sex, target patient : Patient) {
  sex where (sex = 'M') -> patient.gender = 'male' "setMale";
  sex where (sex = 'F') -> patient.gender = 'female' "setFemale";
  sex where (sex = 'm') -> patient.gender = 'male' "setMale";
  sex where (sex = 'f') -> patient.gender = 'female' "setFemale";
  sex where (sex = 'Male') -> patient.gender = 'male' "setMale";
  sex where (sex = 'Female') -> patient.gender = 'female' "setFemale";
  sex where (sex = 'male') -> patient.gender = 'male' "setMale";
  sex where (sex = 'female') -> patient.gender = 'female' "setFemale";
}

// create author
group createAuthor(source issuer, target org : Organization) {
  issuer.reference as id -> org.id = id "setID";
}

// create sectionMedications
group createSectionMedications(source lm : ICVPLogicalModel, target med : BackboneElement, source mid) {
  mid -> med.id = mid "setmedicationid";
  lm -> med.title = 'Medication Summary Section' "setMedicationTitle";
  lm -> med.text as text then generateNarrativeText(med, text) "setText";
  lm ->  create('Coding') as coding,  coding.code = '10160-0',  coding.system = 'http://loinc.org',  create('CodeableConcept') as code,  code.coding = coding,  med.code = code "setCode";
  lm ->  create('Coding') as coding,  coding.code = 'unavailable',  coding.system = 'http://terminology.hl7.org/CodeSystem/list-empty-reason',  create('CodeableConcept') as code,  code.coding = coding,  med.emptyReason = code "setCode";
}

// create sectionAllergies
group createSectionAllergies(source lm : ICVPLogicalModel, target all : BackboneElement, source aid) {
  aid -> all.id = aid "setAllergyId";
  lm -> all.title = 'Allergies Section' "setAllergyTitle";
  lm -> all.text as text then generateNarrativeText(all, text) "setText";
  lm ->  create('Coding') as coding,  coding.code = '48765-2',  coding.system = 'http://loinc.org',  create('CodeableConcept') as code,  code.coding = coding,  all.code = code "setCode";
  lm ->  create('Coding') as coding,  coding.code = 'unavailable',  coding.system = 'http://terminology.hl7.org/CodeSystem/list-empty-reason',  create('CodeableConcept') as code,  code.coding = coding,  all.emptyReason = code "setCode";
}

// create sectionProblems
group createSectionProblems(source lm : ICVPLogicalModel, target prb : BackboneElement, source proid) {
  proid -> prb.id = proid "setProblemsId";
  lm -> prb.title = 'Problems Section' "setProblemTitle";
  lm -> prb.text as text then generateNarrativeText(prb, text) "setText";
  lm ->  create('Coding') as coding,  coding.code = '11450-4',  coding.system = 'http://loinc.org',  create('CodeableConcept') as code,  code.coding = coding,  prb.code = code "setCode";
  lm ->  create('Coding') as coding,  coding.code = 'unavailable',  coding.system = 'http://terminology.hl7.org/CodeSystem/list-empty-reason',  create('CodeableConcept') as code,  code.coding = coding,  prb.emptyReason = code "setCode";
}

// create sectionImmunizations
group createSectionImmunizations(source lm : ICVPLogicalModel, target bundle : Bundle, target composition : Composition, source immid, source pid) {
  lm -> composition.section as imm then {
    immid -> imm.id = immid "setImmunizationsId";
    lm -> imm.title = 'Immunizations Section' "setImmunizationTitle";
    lm -> imm.text as text then generateNarrativeText(imm, text) "setText";
    lm ->  create('Coding') as coding,  coding.code = '11369-6',  coding.system = 'http://loinc.org',  create('CodeableConcept') as code,  code.coding = coding,  imm.code = code "setCode";
    lm.vaccineDetails as vax ->  uuid() as id,  bundle.entry as entry,  entry.fullUrl = append('urn:uuid:', id),  imm.entry as sectionEntry,  sectionEntry.reference = append('urn:uuid:', id),  entry.resource = create('Immunization') as immunization,  immunization.id = id then createImmunizationResource(vax, immunization, pid) "setImmz";
  } "set";
}

group createImmunizationResource(source vax : vaccineDetails, target immunization : Immunization, source pid) {
  vax -> immunization.status = 'completed' "setStatus";
  vax.productID as vaccine then {
    // Keep the original productID as-is in the extension
    vaccine ->  immunization.extension as ext,  ext.url = 'http://smart.who.int/pcmt/StructureDefinition/ProductID',  ext.value = vaccine "keepProductIdExt";
    // Normalize system just for translate(): CM source = .../PreQualProductIds (camel 'Ids')
    vaccine.code as pcode ->  create('Coding') as src,  src.system = 'http://smart.who.int/pcmt-vaxprequal/CodeSystem/PreQualProductIds',  src.code = pcode,  create('Coding') as vcoding,  vcoding.system = 'http://smart.who.int/pcmt-vaxprequal/CodeSystem/PreQualVaccineType',  vcoding.code = translate(src, 'http://smart.who.int/icvp/ConceptMap/ICVPProductIdToVaccineType', 'code'),  create('CodeableConcept') as tgtVaccineCode,  tgtVaccineCode.coding = vcoding,  immunization.vaccineCode = tgtVaccineCode "mapVaxCode";
  } "setVaccine";
  vax.date as date -> immunization.occurrence = append(date, 'T00:00:00.000Z') "setDate";
  vax.batchNo as batchNo then {
    batchNo.text as text -> immunization.lotNumber = text "setBatchNoFromText";
  } "setBatchNo";
  vax -> immunization.protocolApplied as protocol then {
    vax.disease as disease ->  create('CodeableConcept') as code,  code.coding = disease,  protocol.targetDisease = code "setTargetDisease";
  } "setProtocolApplied";
  vax ->  immunization.patient as subject,  subject.reference = append('urn:uuid:', pid) "setSubject";
  vax.manufacturerId as maId ->  create('Reference') as maRef,  maRef.identifier = maId,  immunization.manufacturer = maRef "setManufacturer";
}

// helper function
group generateNarrativeText(source src : Section, target text : string) {
  src -> text.status = 'empty' "setstatus";
  src -> text.div = '<div xmlns=\"http://www.w3.org/1999/xhtml\">Narrative not available</div>' "setdiv";
}

group nameToHumanName(source sourceName, target targetName : HumanName) {
  sourceName as patientName -> targetName.text = patientName "PatientName";
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
    sourcePeriod then periodToPeriod(sourcePeriod, targetPeriod) "CopyPeriod";
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
  "id" : "ICVPLMToIPS",
  "url" : "http://smart.who.int/icvp/StructureMap/ICVPLMToIPS",
  "version" : "0.3.0",
  "name" : "ICVPLMToIPS",
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
      "url" : "http://smart.who.int/icvp/StructureDefinition/ICVP",
      "mode" : "source",
      "alias" : "ICVPLogicalModel"
    },
    {
      "url" : "http://hl7.org/fhir/StructureDefinition/Bundle",
      "mode" : "target",
      "alias" : "IPS"
    }
  ],
  "group" : [
    {
      "name" : "ICVPLMToIPS",
      "typeMode" : "none",
      "documentation" : "uses \"http://smart.who.int/icvp/ConceptMap/ICVPProductIdToVaccineType\" alias ICVPProductIdToVaccineType as conceptmap\r\ncreate Bundle",
      "input" : [
        {
          "name" : "lm",
          "type" : "ICVPLogicalModel",
          "mode" : "source"
        },
        {
          "name" : "ips",
          "type" : "IPS",
          "mode" : "target"
        }
      ],
      "rule" : [
        {
          "name" : "setIPSType",
          "source" : [
            {
              "context" : "lm"
            }
          ],
          "target" : [
            {
              "context" : "ips",
              "contextType" : "variable",
              "element" : "type",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueString" : "document"
                }
              ]
            }
          ]
        },
        {
          "name" : "setId",
          "source" : [
            {
              "context" : "lm"
            }
          ],
          "target" : [
            {
              "contextType" : "variable",
              "variable" : "bid",
              "transform" : "uuid"
            },
            {
              "context" : "ips",
              "contextType" : "variable",
              "element" : "identifier",
              "variable" : "id"
            },
            {
              "context" : "id",
              "contextType" : "variable",
              "element" : "value",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "bid"
                }
              ]
            },
            {
              "context" : "id",
              "contextType" : "variable",
              "element" : "system",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueString" : "urn:oid:2.16.724.4.8.10.200.10"
                }
              ]
            }
          ]
        },
        {
          "name" : "setEntries",
          "source" : [
            {
              "context" : "lm"
            }
          ],
          "target" : [
            {
              "contextType" : "variable",
              "variable" : "cid",
              "transform" : "uuid"
            },
            {
              "contextType" : "variable",
              "variable" : "pid",
              "transform" : "uuid"
            },
            {
              "contextType" : "variable",
              "variable" : "mid",
              "transform" : "uuid"
            },
            {
              "contextType" : "variable",
              "variable" : "aid",
              "transform" : "uuid"
            },
            {
              "contextType" : "variable",
              "variable" : "proid",
              "transform" : "uuid"
            },
            {
              "contextType" : "variable",
              "variable" : "immid",
              "transform" : "uuid"
            }
          ],
          "rule" : [
            {
              "name" : "mapCompositionResource",
              "source" : [
                {
                  "context" : "lm"
                }
              ],
              "target" : [
                {
                  "context" : "ips",
                  "contextType" : "variable",
                  "element" : "entry",
                  "variable" : "entry"
                },
                {
                  "context" : "entry",
                  "contextType" : "variable",
                  "element" : "resource",
                  "variable" : "composition",
                  "transform" : "create",
                  "parameter" : [
                    {
                      "valueString" : "Composition"
                    }
                  ]
                },
                {
                  "context" : "entry",
                  "contextType" : "variable",
                  "element" : "fullUrl",
                  "transform" : "append",
                  "parameter" : [
                    {
                      "valueString" : "urn:uuid:"
                    },
                    {
                      "valueId" : "cid"
                    }
                  ]
                }
              ],
              "rule" : [
                {
                  "name" : "setLmToComposition",
                  "source" : [
                    {
                      "context" : "lm"
                    }
                  ],
                  "dependent" : [
                    {
                      "name" : "LmToComposition",
                      "variable" : [
                        "lm",
                        "ips",
                        "composition",
                        "cid",
                        "pid",
                        "mid",
                        "aid",
                        "proid",
                        "immid"
                      ]
                    }
                  ]
                },
                {
                  "name" : "mapPatientResource",
                  "source" : [
                    {
                      "context" : "lm"
                    }
                  ],
                  "target" : [
                    {
                      "context" : "ips",
                      "contextType" : "variable",
                      "element" : "entry",
                      "variable" : "entry"
                    },
                    {
                      "context" : "entry",
                      "contextType" : "variable",
                      "element" : "fullUrl",
                      "transform" : "append",
                      "parameter" : [
                        {
                          "valueString" : "urn:uuid:"
                        },
                        {
                          "valueId" : "pid"
                        }
                      ]
                    },
                    {
                      "contextType" : "variable",
                      "variable" : "patient",
                      "transform" : "create",
                      "parameter" : [
                        {
                          "valueString" : "Patient"
                        }
                      ]
                    }
                  ],
                  "rule" : [
                    {
                      "name" : "createPatient",
                      "source" : [
                        {
                          "context" : "lm"
                        }
                      ],
                      "dependent" : [
                        {
                          "name" : "DemographicsToPatient",
                          "variable" : ["lm", "patient", "pid"]
                        }
                      ]
                    },
                    {
                      "name" : "setPatientEntry",
                      "source" : [
                        {
                          "context" : "lm"
                        }
                      ],
                      "target" : [
                        {
                          "context" : "entry",
                          "contextType" : "variable",
                          "element" : "resource",
                          "transform" : "copy",
                          "parameter" : [
                            {
                              "valueId" : "patient"
                            }
                          ]
                        }
                      ]
                    }
                  ]
                },
                {
                  "name" : "ss",
                  "source" : [
                    {
                      "context" : "lm",
                      "element" : "issuer",
                      "variable" : "issuer"
                    }
                  ],
                  "rule" : [
                    {
                      "name" : "mapOrganizationResource",
                      "source" : [
                        {
                          "context" : "issuer",
                          "element" : "reference",
                          "variable" : "id"
                        }
                      ],
                      "target" : [
                        {
                          "context" : "ips",
                          "contextType" : "variable",
                          "element" : "entry",
                          "variable" : "entry"
                        },
                        {
                          "context" : "entry",
                          "contextType" : "variable",
                          "element" : "fullUrl",
                          "transform" : "append",
                          "parameter" : [
                            {
                              "valueString" : "urn:uuid:"
                            },
                            {
                              "valueId" : "id"
                            }
                          ]
                        },
                        {
                          "contextType" : "variable",
                          "variable" : "organization",
                          "transform" : "create",
                          "parameter" : [
                            {
                              "valueString" : "Organization"
                            }
                          ]
                        }
                      ],
                      "rule" : [
                        {
                          "name" : "createOrganization",
                          "source" : [
                            {
                              "context" : "lm"
                            }
                          ],
                          "target" : [
                            {
                              "context" : "organization",
                              "contextType" : "variable"
                            }
                          ],
                          "dependent" : [
                            {
                              "name" : "createAuthor",
                              "variable" : ["issuer", "organization"]
                            }
                          ]
                        },
                        {
                          "name" : "setOrganizationEntry",
                          "source" : [
                            {
                              "context" : "lm"
                            }
                          ],
                          "target" : [
                            {
                              "context" : "entry",
                              "contextType" : "variable",
                              "element" : "resource",
                              "transform" : "copy",
                              "parameter" : [
                                {
                                  "valueId" : "organization"
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
    },
    {
      "name" : "LmToComposition",
      "typeMode" : "none",
      "documentation" : "create Composition",
      "input" : [
        {
          "name" : "lm",
          "type" : "ICVPLogicalModel",
          "mode" : "source"
        },
        {
          "name" : "ips",
          "type" : "Bundle",
          "mode" : "target"
        },
        {
          "name" : "composition",
          "type" : "Composition",
          "mode" : "target"
        },
        {
          "name" : "cid",
          "mode" : "source"
        },
        {
          "name" : "pid",
          "mode" : "source"
        },
        {
          "name" : "mid",
          "mode" : "source"
        },
        {
          "name" : "aid",
          "mode" : "source"
        },
        {
          "name" : "proid",
          "mode" : "source"
        },
        {
          "name" : "immid",
          "mode" : "source"
        }
      ],
      "rule" : [
        {
          "name" : "setCid",
          "source" : [
            {
              "context" : "cid"
            }
          ],
          "target" : [
            {
              "context" : "composition",
              "contextType" : "variable",
              "element" : "id",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "cid"
                }
              ]
            }
          ]
        },
        {
          "name" : "setStatus",
          "source" : [
            {
              "context" : "lm"
            }
          ],
          "target" : [
            {
              "context" : "composition",
              "contextType" : "variable",
              "element" : "status",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueString" : "final"
                }
              ]
            }
          ]
        },
        {
          "name" : "setTitle",
          "source" : [
            {
              "context" : "lm"
            }
          ],
          "target" : [
            {
              "context" : "composition",
              "contextType" : "variable",
              "element" : "title",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueString" : "International Patient Summary"
                }
              ]
            }
          ]
        },
        {
          "name" : "setType",
          "source" : [
            {
              "context" : "lm"
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
                  "valueString" : "60591-5"
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
                  "valueString" : "http://loinc.org"
                }
              ]
            },
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
              "element" : "coding",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "coding"
                }
              ]
            },
            {
              "context" : "composition",
              "contextType" : "variable",
              "element" : "type",
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
          "name" : "setSubject",
          "source" : [
            {
              "context" : "lm"
            }
          ],
          "target" : [
            {
              "context" : "composition",
              "contextType" : "variable",
              "element" : "subject",
              "variable" : "subject"
            }
          ],
          "rule" : [
            {
              "name" : "setSubject",
              "source" : [
                {
                  "context" : "lm"
                }
              ],
              "target" : [
                {
                  "context" : "subject",
                  "contextType" : "variable",
                  "element" : "reference",
                  "transform" : "append",
                  "parameter" : [
                    {
                      "valueString" : "urn:uuid:"
                    },
                    {
                      "valueId" : "pid"
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          "name" : "setid",
          "source" : [
            {
              "context" : "lm",
              "element" : "issuer",
              "variable" : "issuer"
            }
          ],
          "rule" : [
            {
              "name" : "setauthr",
              "source" : [
                {
                  "context" : "issuer",
                  "element" : "reference",
                  "variable" : "id"
                }
              ],
              "target" : [
                {
                  "context" : "composition",
                  "contextType" : "variable",
                  "element" : "author",
                  "variable" : "author"
                }
              ],
              "rule" : [
                {
                  "name" : "setAuthor",
                  "source" : [
                    {
                      "context" : "id"
                    }
                  ],
                  "target" : [
                    {
                      "context" : "author",
                      "contextType" : "variable",
                      "element" : "reference",
                      "transform" : "append",
                      "parameter" : [
                        {
                          "valueString" : "urn:uuid:"
                        },
                        {
                          "valueId" : "id"
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
          "name" : "createMedication",
          "source" : [
            {
              "context" : "lm"
            }
          ],
          "target" : [
            {
              "context" : "composition",
              "contextType" : "variable",
              "element" : "section",
              "variable" : "medication"
            }
          ],
          "dependent" : [
            {
              "name" : "createSectionMedications",
              "variable" : ["lm", "medication", "mid"]
            }
          ]
        },
        {
          "name" : "createAllergies",
          "source" : [
            {
              "context" : "lm"
            }
          ],
          "target" : [
            {
              "context" : "composition",
              "contextType" : "variable",
              "element" : "section",
              "variable" : "allergies"
            }
          ],
          "dependent" : [
            {
              "name" : "createSectionAllergies",
              "variable" : ["lm", "allergies", "aid"]
            }
          ]
        },
        {
          "name" : "createProblems",
          "source" : [
            {
              "context" : "lm"
            }
          ],
          "target" : [
            {
              "context" : "composition",
              "contextType" : "variable",
              "element" : "section",
              "variable" : "problems"
            }
          ],
          "dependent" : [
            {
              "name" : "createSectionProblems",
              "variable" : ["lm", "problems", "proid"]
            }
          ]
        },
        {
          "name" : "createImmunizations",
          "source" : [
            {
              "context" : "lm"
            }
          ],
          "dependent" : [
            {
              "name" : "createSectionImmunizations",
              "variable" : ["lm", "ips", "composition", "immid", "pid"]
            }
          ]
        }
      ]
    },
    {
      "name" : "DemographicsToPatient",
      "typeMode" : "none",
      "documentation" : "create Patient",
      "input" : [
        {
          "name" : "lm",
          "type" : "ICVPLogicalModel",
          "mode" : "source"
        },
        {
          "name" : "patient",
          "type" : "Patient",
          "mode" : "target"
        },
        {
          "name" : "pid",
          "mode" : "source"
        }
      ],
      "rule" : [
        {
          "name" : "setPatientId",
          "source" : [
            {
              "context" : "pid"
            }
          ],
          "target" : [
            {
              "context" : "patient",
              "contextType" : "variable",
              "element" : "id",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "pid"
                }
              ]
            }
          ]
        },
        {
          "name" : "Setname",
          "source" : [
            {
              "context" : "lm",
              "element" : "name",
              "variable" : "sourceName"
            }
          ],
          "target" : [
            {
              "context" : "patient",
              "contextType" : "variable",
              "element" : "name",
              "variable" : "targetName"
            }
          ],
          "dependent" : [
            {
              "name" : "nameToHumanName",
              "variable" : ["sourceName", "targetName"]
            }
          ]
        },
        {
          "name" : "setDateofBirth",
          "source" : [
            {
              "context" : "lm",
              "element" : "dob",
              "variable" : "dob"
            }
          ],
          "target" : [
            {
              "context" : "patient",
              "contextType" : "variable",
              "element" : "birthDate",
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
          "name" : "PatientGender",
          "source" : [
            {
              "context" : "lm",
              "element" : "sex",
              "variable" : "sex"
            }
          ],
          "dependent" : [
            {
              "name" : "ExtractGender",
              "variable" : ["sex", "patient"]
            }
          ]
        },
        {
          "name" : "setNationalIdentifier",
          "source" : [
            {
              "context" : "lm",
              "element" : "nid",
              "variable" : "id"
            }
          ],
          "target" : [
            {
              "context" : "patient",
              "contextType" : "variable",
              "element" : "identifier",
              "variable" : "identifier"
            },
            {
              "context" : "identifier",
              "contextType" : "variable",
              "element" : "value",
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
          "name" : "setGuardianName",
          "source" : [
            {
              "context" : "lm",
              "element" : "guardian",
              "variable" : "guardian"
            }
          ],
          "target" : [
            {
              "context" : "patient",
              "contextType" : "variable",
              "element" : "contact",
              "variable" : "parentContact"
            },
            {
              "context" : "parentContact",
              "contextType" : "variable",
              "element" : "name",
              "variable" : "parentName"
            }
          ],
          "dependent" : [
            {
              "name" : "nameToHumanName",
              "variable" : ["guardian", "parentName"]
            }
          ]
        }
      ]
    },
    {
      "name" : "ExtractGender",
      "typeMode" : "none",
      "documentation" : "deals with short and case sensitive codes",
      "input" : [
        {
          "name" : "sex",
          "mode" : "source"
        },
        {
          "name" : "patient",
          "type" : "Patient",
          "mode" : "target"
        }
      ],
      "rule" : [
        {
          "name" : "setMale",
          "source" : [
            {
              "context" : "sex",
              "condition" : "(sex = 'M')"
            }
          ],
          "target" : [
            {
              "context" : "patient",
              "contextType" : "variable",
              "element" : "gender",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueString" : "male"
                }
              ]
            }
          ]
        },
        {
          "name" : "setFemale",
          "source" : [
            {
              "context" : "sex",
              "condition" : "(sex = 'F')"
            }
          ],
          "target" : [
            {
              "context" : "patient",
              "contextType" : "variable",
              "element" : "gender",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueString" : "female"
                }
              ]
            }
          ]
        },
        {
          "name" : "setMale",
          "source" : [
            {
              "context" : "sex",
              "condition" : "(sex = 'm')"
            }
          ],
          "target" : [
            {
              "context" : "patient",
              "contextType" : "variable",
              "element" : "gender",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueString" : "male"
                }
              ]
            }
          ]
        },
        {
          "name" : "setFemale",
          "source" : [
            {
              "context" : "sex",
              "condition" : "(sex = 'f')"
            }
          ],
          "target" : [
            {
              "context" : "patient",
              "contextType" : "variable",
              "element" : "gender",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueString" : "female"
                }
              ]
            }
          ]
        },
        {
          "name" : "setMale",
          "source" : [
            {
              "context" : "sex",
              "condition" : "(sex = 'Male')"
            }
          ],
          "target" : [
            {
              "context" : "patient",
              "contextType" : "variable",
              "element" : "gender",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueString" : "male"
                }
              ]
            }
          ]
        },
        {
          "name" : "setFemale",
          "source" : [
            {
              "context" : "sex",
              "condition" : "(sex = 'Female')"
            }
          ],
          "target" : [
            {
              "context" : "patient",
              "contextType" : "variable",
              "element" : "gender",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueString" : "female"
                }
              ]
            }
          ]
        },
        {
          "name" : "setMale",
          "source" : [
            {
              "context" : "sex",
              "condition" : "(sex = 'male')"
            }
          ],
          "target" : [
            {
              "context" : "patient",
              "contextType" : "variable",
              "element" : "gender",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueString" : "male"
                }
              ]
            }
          ]
        },
        {
          "name" : "setFemale",
          "source" : [
            {
              "context" : "sex",
              "condition" : "(sex = 'female')"
            }
          ],
          "target" : [
            {
              "context" : "patient",
              "contextType" : "variable",
              "element" : "gender",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueString" : "female"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "name" : "createAuthor",
      "typeMode" : "none",
      "documentation" : "create author",
      "input" : [
        {
          "name" : "issuer",
          "mode" : "source"
        },
        {
          "name" : "org",
          "type" : "Organization",
          "mode" : "target"
        }
      ],
      "rule" : [
        {
          "name" : "setID",
          "source" : [
            {
              "context" : "issuer",
              "element" : "reference",
              "variable" : "id"
            }
          ],
          "target" : [
            {
              "context" : "org",
              "contextType" : "variable",
              "element" : "id",
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
      "name" : "createSectionMedications",
      "typeMode" : "none",
      "documentation" : "create sectionMedications",
      "input" : [
        {
          "name" : "lm",
          "type" : "ICVPLogicalModel",
          "mode" : "source"
        },
        {
          "name" : "med",
          "type" : "BackboneElement",
          "mode" : "target"
        },
        {
          "name" : "mid",
          "mode" : "source"
        }
      ],
      "rule" : [
        {
          "name" : "setmedicationid",
          "source" : [
            {
              "context" : "mid"
            }
          ],
          "target" : [
            {
              "context" : "med",
              "contextType" : "variable",
              "element" : "id",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "mid"
                }
              ]
            }
          ]
        },
        {
          "name" : "setMedicationTitle",
          "source" : [
            {
              "context" : "lm"
            }
          ],
          "target" : [
            {
              "context" : "med",
              "contextType" : "variable",
              "element" : "title",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueString" : "Medication Summary Section"
                }
              ]
            }
          ]
        },
        {
          "name" : "setText",
          "source" : [
            {
              "context" : "lm"
            }
          ],
          "target" : [
            {
              "context" : "med",
              "contextType" : "variable",
              "element" : "text",
              "variable" : "text"
            }
          ],
          "dependent" : [
            {
              "name" : "generateNarrativeText",
              "variable" : ["med", "text"]
            }
          ]
        },
        {
          "name" : "setCode",
          "source" : [
            {
              "context" : "lm"
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
                  "valueString" : "10160-0"
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
                  "valueString" : "http://loinc.org"
                }
              ]
            },
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
              "element" : "coding",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "coding"
                }
              ]
            },
            {
              "context" : "med",
              "contextType" : "variable",
              "element" : "code",
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
          "name" : "setCode",
          "source" : [
            {
              "context" : "lm"
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
                  "valueString" : "unavailable"
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
                  "valueString" : "http://terminology.hl7.org/CodeSystem/list-empty-reason"
                }
              ]
            },
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
              "element" : "coding",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "coding"
                }
              ]
            },
            {
              "context" : "med",
              "contextType" : "variable",
              "element" : "emptyReason",
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
      "name" : "createSectionAllergies",
      "typeMode" : "none",
      "documentation" : "create sectionAllergies",
      "input" : [
        {
          "name" : "lm",
          "type" : "ICVPLogicalModel",
          "mode" : "source"
        },
        {
          "name" : "all",
          "type" : "BackboneElement",
          "mode" : "target"
        },
        {
          "name" : "aid",
          "mode" : "source"
        }
      ],
      "rule" : [
        {
          "name" : "setAllergyId",
          "source" : [
            {
              "context" : "aid"
            }
          ],
          "target" : [
            {
              "context" : "all",
              "contextType" : "variable",
              "element" : "id",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "aid"
                }
              ]
            }
          ]
        },
        {
          "name" : "setAllergyTitle",
          "source" : [
            {
              "context" : "lm"
            }
          ],
          "target" : [
            {
              "context" : "all",
              "contextType" : "variable",
              "element" : "title",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueString" : "Allergies Section"
                }
              ]
            }
          ]
        },
        {
          "name" : "setText",
          "source" : [
            {
              "context" : "lm"
            }
          ],
          "target" : [
            {
              "context" : "all",
              "contextType" : "variable",
              "element" : "text",
              "variable" : "text"
            }
          ],
          "dependent" : [
            {
              "name" : "generateNarrativeText",
              "variable" : ["all", "text"]
            }
          ]
        },
        {
          "name" : "setCode",
          "source" : [
            {
              "context" : "lm"
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
                  "valueString" : "48765-2"
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
                  "valueString" : "http://loinc.org"
                }
              ]
            },
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
              "element" : "coding",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "coding"
                }
              ]
            },
            {
              "context" : "all",
              "contextType" : "variable",
              "element" : "code",
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
          "name" : "setCode",
          "source" : [
            {
              "context" : "lm"
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
                  "valueString" : "unavailable"
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
                  "valueString" : "http://terminology.hl7.org/CodeSystem/list-empty-reason"
                }
              ]
            },
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
              "element" : "coding",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "coding"
                }
              ]
            },
            {
              "context" : "all",
              "contextType" : "variable",
              "element" : "emptyReason",
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
      "name" : "createSectionProblems",
      "typeMode" : "none",
      "documentation" : "create sectionProblems",
      "input" : [
        {
          "name" : "lm",
          "type" : "ICVPLogicalModel",
          "mode" : "source"
        },
        {
          "name" : "prb",
          "type" : "BackboneElement",
          "mode" : "target"
        },
        {
          "name" : "proid",
          "mode" : "source"
        }
      ],
      "rule" : [
        {
          "name" : "setProblemsId",
          "source" : [
            {
              "context" : "proid"
            }
          ],
          "target" : [
            {
              "context" : "prb",
              "contextType" : "variable",
              "element" : "id",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "proid"
                }
              ]
            }
          ]
        },
        {
          "name" : "setProblemTitle",
          "source" : [
            {
              "context" : "lm"
            }
          ],
          "target" : [
            {
              "context" : "prb",
              "contextType" : "variable",
              "element" : "title",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueString" : "Problems Section"
                }
              ]
            }
          ]
        },
        {
          "name" : "setText",
          "source" : [
            {
              "context" : "lm"
            }
          ],
          "target" : [
            {
              "context" : "prb",
              "contextType" : "variable",
              "element" : "text",
              "variable" : "text"
            }
          ],
          "dependent" : [
            {
              "name" : "generateNarrativeText",
              "variable" : ["prb", "text"]
            }
          ]
        },
        {
          "name" : "setCode",
          "source" : [
            {
              "context" : "lm"
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
                  "valueString" : "11450-4"
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
                  "valueString" : "http://loinc.org"
                }
              ]
            },
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
              "element" : "coding",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "coding"
                }
              ]
            },
            {
              "context" : "prb",
              "contextType" : "variable",
              "element" : "code",
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
          "name" : "setCode",
          "source" : [
            {
              "context" : "lm"
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
                  "valueString" : "unavailable"
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
                  "valueString" : "http://terminology.hl7.org/CodeSystem/list-empty-reason"
                }
              ]
            },
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
              "element" : "coding",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "coding"
                }
              ]
            },
            {
              "context" : "prb",
              "contextType" : "variable",
              "element" : "emptyReason",
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
      "name" : "createSectionImmunizations",
      "typeMode" : "none",
      "documentation" : "create sectionImmunizations",
      "input" : [
        {
          "name" : "lm",
          "type" : "ICVPLogicalModel",
          "mode" : "source"
        },
        {
          "name" : "bundle",
          "type" : "Bundle",
          "mode" : "target"
        },
        {
          "name" : "composition",
          "type" : "Composition",
          "mode" : "target"
        },
        {
          "name" : "immid",
          "mode" : "source"
        },
        {
          "name" : "pid",
          "mode" : "source"
        }
      ],
      "rule" : [
        {
          "name" : "set",
          "source" : [
            {
              "context" : "lm"
            }
          ],
          "target" : [
            {
              "context" : "composition",
              "contextType" : "variable",
              "element" : "section",
              "variable" : "imm"
            }
          ],
          "rule" : [
            {
              "name" : "setImmunizationsId",
              "source" : [
                {
                  "context" : "immid"
                }
              ],
              "target" : [
                {
                  "context" : "imm",
                  "contextType" : "variable",
                  "element" : "id",
                  "transform" : "copy",
                  "parameter" : [
                    {
                      "valueId" : "immid"
                    }
                  ]
                }
              ]
            },
            {
              "name" : "setImmunizationTitle",
              "source" : [
                {
                  "context" : "lm"
                }
              ],
              "target" : [
                {
                  "context" : "imm",
                  "contextType" : "variable",
                  "element" : "title",
                  "transform" : "copy",
                  "parameter" : [
                    {
                      "valueString" : "Immunizations Section"
                    }
                  ]
                }
              ]
            },
            {
              "name" : "setText",
              "source" : [
                {
                  "context" : "lm"
                }
              ],
              "target" : [
                {
                  "context" : "imm",
                  "contextType" : "variable",
                  "element" : "text",
                  "variable" : "text"
                }
              ],
              "dependent" : [
                {
                  "name" : "generateNarrativeText",
                  "variable" : ["imm", "text"]
                }
              ]
            },
            {
              "name" : "setCode",
              "source" : [
                {
                  "context" : "lm"
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
                      "valueString" : "11369-6"
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
                      "valueString" : "http://loinc.org"
                    }
                  ]
                },
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
                  "element" : "coding",
                  "transform" : "copy",
                  "parameter" : [
                    {
                      "valueId" : "coding"
                    }
                  ]
                },
                {
                  "context" : "imm",
                  "contextType" : "variable",
                  "element" : "code",
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
              "name" : "setImmz",
              "source" : [
                {
                  "context" : "lm",
                  "element" : "vaccineDetails",
                  "variable" : "vax"
                }
              ],
              "target" : [
                {
                  "contextType" : "variable",
                  "variable" : "id",
                  "transform" : "uuid"
                },
                {
                  "context" : "bundle",
                  "contextType" : "variable",
                  "element" : "entry",
                  "variable" : "entry"
                },
                {
                  "context" : "entry",
                  "contextType" : "variable",
                  "element" : "fullUrl",
                  "transform" : "append",
                  "parameter" : [
                    {
                      "valueString" : "urn:uuid:"
                    },
                    {
                      "valueId" : "id"
                    }
                  ]
                },
                {
                  "context" : "imm",
                  "contextType" : "variable",
                  "element" : "entry",
                  "variable" : "sectionEntry"
                },
                {
                  "context" : "sectionEntry",
                  "contextType" : "variable",
                  "element" : "reference",
                  "transform" : "append",
                  "parameter" : [
                    {
                      "valueString" : "urn:uuid:"
                    },
                    {
                      "valueId" : "id"
                    }
                  ]
                },
                {
                  "context" : "entry",
                  "contextType" : "variable",
                  "element" : "resource",
                  "variable" : "immunization",
                  "transform" : "create",
                  "parameter" : [
                    {
                      "valueString" : "Immunization"
                    }
                  ]
                },
                {
                  "context" : "immunization",
                  "contextType" : "variable",
                  "element" : "id",
                  "transform" : "copy",
                  "parameter" : [
                    {
                      "valueId" : "id"
                    }
                  ]
                }
              ],
              "dependent" : [
                {
                  "name" : "createImmunizationResource",
                  "variable" : ["vax", "immunization", "pid"]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "name" : "createImmunizationResource",
      "typeMode" : "none",
      "input" : [
        {
          "name" : "vax",
          "type" : "vaccineDetails",
          "mode" : "source"
        },
        {
          "name" : "immunization",
          "type" : "Immunization",
          "mode" : "target"
        },
        {
          "name" : "pid",
          "mode" : "source"
        }
      ],
      "rule" : [
        {
          "name" : "setStatus",
          "source" : [
            {
              "context" : "vax"
            }
          ],
          "target" : [
            {
              "context" : "immunization",
              "contextType" : "variable",
              "element" : "status",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueString" : "completed"
                }
              ]
            }
          ]
        },
        {
          "name" : "setVaccine",
          "source" : [
            {
              "context" : "vax",
              "element" : "productID",
              "variable" : "vaccine"
            }
          ],
          "rule" : [
            {
              "name" : "keepProductIdExt",
              "source" : [
                {
                  "context" : "vaccine"
                }
              ],
              "target" : [
                {
                  "context" : "immunization",
                  "contextType" : "variable",
                  "element" : "extension",
                  "variable" : "ext"
                },
                {
                  "context" : "ext",
                  "contextType" : "variable",
                  "element" : "url",
                  "transform" : "copy",
                  "parameter" : [
                    {
                      "valueString" : "http://smart.who.int/pcmt/StructureDefinition/ProductID"
                    }
                  ]
                },
                {
                  "context" : "ext",
                  "contextType" : "variable",
                  "element" : "value",
                  "transform" : "copy",
                  "parameter" : [
                    {
                      "valueId" : "vaccine"
                    }
                  ]
                }
              ]
            },
            {
              "name" : "mapVaxCode",
              "source" : [
                {
                  "context" : "vaccine",
                  "element" : "code",
                  "variable" : "pcode"
                }
              ],
              "target" : [
                {
                  "contextType" : "variable",
                  "variable" : "src",
                  "transform" : "create",
                  "parameter" : [
                    {
                      "valueString" : "Coding"
                    }
                  ]
                },
                {
                  "context" : "src",
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
                  "context" : "src",
                  "contextType" : "variable",
                  "element" : "code",
                  "transform" : "copy",
                  "parameter" : [
                    {
                      "valueId" : "pcode"
                    }
                  ]
                },
                {
                  "contextType" : "variable",
                  "variable" : "vcoding",
                  "transform" : "create",
                  "parameter" : [
                    {
                      "valueString" : "Coding"
                    }
                  ]
                },
                {
                  "context" : "vcoding",
                  "contextType" : "variable",
                  "element" : "system",
                  "transform" : "copy",
                  "parameter" : [
                    {
                      "valueString" : "http://smart.who.int/pcmt-vaxprequal/CodeSystem/PreQualVaccineType"
                    }
                  ]
                },
                {
                  "context" : "vcoding",
                  "contextType" : "variable",
                  "element" : "code",
                  "transform" : "translate",
                  "parameter" : [
                    {
                      "valueId" : "src"
                    },
                    {
                      "valueString" : "http://smart.who.int/icvp/ConceptMap/ICVPProductIdToVaccineType"
                    },
                    {
                      "valueString" : "code"
                    }
                  ]
                },
                {
                  "contextType" : "variable",
                  "variable" : "tgtVaccineCode",
                  "transform" : "create",
                  "parameter" : [
                    {
                      "valueString" : "CodeableConcept"
                    }
                  ]
                },
                {
                  "context" : "tgtVaccineCode",
                  "contextType" : "variable",
                  "element" : "coding",
                  "transform" : "copy",
                  "parameter" : [
                    {
                      "valueId" : "vcoding"
                    }
                  ]
                },
                {
                  "context" : "immunization",
                  "contextType" : "variable",
                  "element" : "vaccineCode",
                  "transform" : "copy",
                  "parameter" : [
                    {
                      "valueId" : "tgtVaccineCode"
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          "name" : "setDate",
          "source" : [
            {
              "context" : "vax",
              "element" : "date",
              "variable" : "date"
            }
          ],
          "target" : [
            {
              "context" : "immunization",
              "contextType" : "variable",
              "element" : "occurrence",
              "transform" : "append",
              "parameter" : [
                {
                  "valueId" : "date"
                },
                {
                  "valueString" : "T00:00:00.000Z"
                }
              ]
            }
          ]
        },
        {
          "name" : "setBatchNo",
          "source" : [
            {
              "context" : "vax",
              "element" : "batchNo",
              "variable" : "batchNo"
            }
          ],
          "rule" : [
            {
              "name" : "setBatchNoFromText",
              "source" : [
                {
                  "context" : "batchNo",
                  "element" : "text",
                  "variable" : "text"
                }
              ],
              "target" : [
                {
                  "context" : "immunization",
                  "contextType" : "variable",
                  "element" : "lotNumber",
                  "transform" : "copy",
                  "parameter" : [
                    {
                      "valueId" : "text"
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          "name" : "setProtocolApplied",
          "source" : [
            {
              "context" : "vax"
            }
          ],
          "target" : [
            {
              "context" : "immunization",
              "contextType" : "variable",
              "element" : "protocolApplied",
              "variable" : "protocol"
            }
          ],
          "rule" : [
            {
              "name" : "setTargetDisease",
              "source" : [
                {
                  "context" : "vax",
                  "element" : "disease",
                  "variable" : "disease"
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
                  "element" : "coding",
                  "transform" : "copy",
                  "parameter" : [
                    {
                      "valueId" : "disease"
                    }
                  ]
                },
                {
                  "context" : "protocol",
                  "contextType" : "variable",
                  "element" : "targetDisease",
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
          "name" : "setSubject",
          "source" : [
            {
              "context" : "vax"
            }
          ],
          "target" : [
            {
              "context" : "immunization",
              "contextType" : "variable",
              "element" : "patient",
              "variable" : "subject"
            },
            {
              "context" : "subject",
              "contextType" : "variable",
              "element" : "reference",
              "transform" : "append",
              "parameter" : [
                {
                  "valueString" : "urn:uuid:"
                },
                {
                  "valueId" : "pid"
                }
              ]
            }
          ]
        },
        {
          "name" : "setManufacturer",
          "source" : [
            {
              "context" : "vax",
              "element" : "manufacturerId",
              "variable" : "maId"
            }
          ],
          "target" : [
            {
              "contextType" : "variable",
              "variable" : "maRef",
              "transform" : "create",
              "parameter" : [
                {
                  "valueString" : "Reference"
                }
              ]
            },
            {
              "context" : "maRef",
              "contextType" : "variable",
              "element" : "identifier",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "maId"
                }
              ]
            },
            {
              "context" : "immunization",
              "contextType" : "variable",
              "element" : "manufacturer",
              "transform" : "copy",
              "parameter" : [
                {
                  "valueId" : "maRef"
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
                  "valueString" : "<div xmlns=\"http://www.w3.org/1999/xhtml\">Narrative not available</div>"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "name" : "nameToHumanName",
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
          "name" : "PatientName",
          "source" : [
            {
              "context" : "sourceName",
              "variable" : "patientName"
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
                  "valueId" : "patientName"
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
