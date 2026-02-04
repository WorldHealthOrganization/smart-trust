/**
Library: HIV.B7.DT Logic

@DecisionID: HIV.B7.DT
@BusinessRule: WHO standard testing strategy for HIV-1 diagnosis (among people ≥18 months of age)
@Trigger: HIV.B7 Test for HIV using testing algorithm, HIV.C4 Test for HIV using testing algorithm, HIV.D.11 Retest using HIV strategy
@Description: WHO standard testing strategy for HIV-1 diagnosis (among people ≥18 months of age)

Data Concepts:

*/

library HIVB7DTLogic

using FHIR version '4.0.1'

include HIVCommon version '0.0.1' called HIC
include HIVConcepts called Concepts
include HIVEncounterElements called Elements
include FHIRHelpers version '4.0.1'

include WHOCommon called WCom
  
context Patient

/*
 @output: "Report as HIV-negative"
 */
define "Report as HIV-negative":
  case 
  when "Assay 1" and "Non-reactive result"
    then true
  else null
  end

/*
 Supporting Logic
 */
define "Assay 1":
  exists("Assay 1 result") and not(exists("Assay 2 result"))

define "Assay 2":
  exists("Assay 2 result") and not(exists("Assay 3 result"))

define "Assay 3":
  exists("Assay 3 result")

define "Assay 1 result":
  Elements."Test result of HIV assay 1 B.DE94"

define "Assay 2 result":
  Elements."Test result of HIV assay 2 B.DE98"

define "Assay 3 result":
  Elements."Test result of HIV assay 3 B.DE102"

define "Non-reactive result":
  false
