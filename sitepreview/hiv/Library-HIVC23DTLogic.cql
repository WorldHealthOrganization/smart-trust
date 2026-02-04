/**
Library: HIV.C23.DT Logic

@DecisionID: HIV.C23.DT
@BusinessRule: Determine PEP or PrEP regimen
@Trigger: HIV.C23 Prescribe or administer PrEP or PEP
@HitPolicy: Rule Order
@Description: Determine PEP or PrEP regimen

Data Concepts:
  

Consolidated guidelines on HIV prevention, testing, treatment, service delivery and monitoring: recommendations for a public health approach (2021) Chapter 5: Advanced HIV Disease. Figure 5.1: Algorithm for providing a package of care for people with advanced HIV disease.
*/

library HIVC23DTLogic

using FHIR version '4.0.1'

include HIVCommon version '0.0.1' called HIC
include HIVConcepts called Concepts
include HIVEncounterElements called Elements
include FHIRHelpers version '4.0.1'

include WHOCommon called WCom

parameter Today Date default Today()

context Patient

 /*
  @input: Age
  @pseudocode: "Age" >= 10 years
  */
define "Age 10 or older":
  Elements."Current Patient Age In Years" >= 10

 /*
  @input: Age
  @pseudocode: 2 years < "Age" < 10 years
  */
define "Age between 2 and 10":
  2 < Elements."Current Patient Age In Years" and Elements."Current Patient Age In Years" < 10

/*
 @input: Date/time of suscepted exposure to HIV
 @pseudocode: "Date/time of suspected exposure to HIV" < 72 hours from Current DateTime
 */
define "Suspected exposure to HIV within 72 hours":
  exists(
    Elements."Date/time of suspected exposure to HIV B.DE14" O
      where FHIRHelpers.ToInteger(O.value) < 72
        or O.value < Today + 72 hours
        or O.value.end < Today + 72 hours
  )

/*
 @input: Suitable for PrEP
 @pseudocode: "Suitable for PrEP"=True
 */
define "Client is suitable for PrEP":
  exists(
    Elements."Suitable for PrEP" O
      where O.value = true
  )

/*
 @output: What to use in HIV post-exposure prophylaxis (PEP) for adults and adolescents
 */
define "What to use in HIV post-exposure prophylaxis (PEP) for adults and adolescents":
  "Suspected exposure to HIV within 72 hours" and ("Age between 2 and 10" or "Age 10 or older")

/*
 @output: What to use in HIV pre-exposure prophylaxis (PrEP) for adults and adolescents
 */
define "What to use in HIV pre-exposure prophylaxis (PrEP) for adults and adolescents":
  "Client is suitable for PrEP" and "Age 10 or older"

/*
 @dynamicValue: Preferred PEP backbone regimen
 */
define "Preferred PEP backbone regimen":
  case
  when "Suspected exposure to HIV within 72 hours" and "Age 10 or older"
    then { Concepts."TDF + 3TC - HIV.C.DE20", Concepts."TDF + FTC - HIV.C.DE18" }
  when "Suspected exposure to HIV within 72 hours" and "Age between 2 and 10"
    then { Concepts."AZT + 3TC" }
  else null
  end

/*
 @dynamicValue: Alternative PEP backbone regimen
 */
define "Alternative PEP backbone regimen":
  case
  when "Suspected exposure to HIV within 72 hours" and "Age between 2 and 10"
    then { Concepts."ABC + 3TC", Concepts."TDF + 3TC - HIV.C.DE20", Concepts."TDF + FTC - HIV.C.DE18" }
  else null
  end

/*
 @dynamicValue: Preferred third PEP drug
 */
define "Preferred third PEP drug":
  case
  when "Suspected exposure to HIV within 72 hours" and "Age 10 or older"
    then { Concepts."DTG - HIV.C.DE100" }
  when "Suspected exposure to HIV within 72 hours" and "Age between 2 and 10"
    then { Concepts."DTG - HIV.C.DE100" }
  else null
  end

/*
 @dynamicValue: Alternative third PEP drug
 */
define "Alternative third PEP drug":
  case
  when "Suspected exposure to HIV within 72 hours" and ("Age 10 or older" or "Age between 2 and 10")
    then { 
      Concepts."ATV/r - HIV.C.DE102",
      Concepts."DRV/r - HIV.C.DE103",
      Concepts."LPV/r - HIV.C.DE104",
      Concepts."RAL - HIV.C.DE105" 
    }
  else null
  end

/*
 @dynamicValue: Recommended PrEP regimen
 */
define "Recommended PrEP regimen":
  case
  when "Age 10 or older" and "Client is suitable for PrEP"
    then {
      Concepts."TDF + FTC - HIV.C.DE18",
      Concepts."TDF - HIV.C.DE19",
      Concepts."TDF + 3TC - HIV.C.DE20",
      Concepts."Other TDF-based regimen",
      Concepts."Dapivirine vaginal ring DVR - HIV.C.DE22",
      Concepts."CAB-LA - HIV.C.DE23"
    }
  else null
  end

/*
 @dynamicValue: Guidance
 */
define "Guidance":
  Combine({
    if "Age 10 or older" and "Suspected exposure to HIV within 72 hours"
      then 'An HIV post-exposure prophylaxis (PEP) regimen with two ARV drugs is effective, but three drugs are preferred.

  TDF + 3TC (or FTC) is recommended as the preferred backbone regimen for HIV post-exposure prophylaxis for adults and adolescents. 

  DTG is recommended as the preferred third drug for HIV PEP.

  When available, ATV/r, DRV/r, LPV/r and RAL may be considered as alternative third drug options for PEP.

  NVP should not be used for PEP for adults, adolescents and older children because of the risk of life-threatening serious adverse events associated with HIV-negative adults using this drug.'
      else '',
    if "Age between 2 and 10" and "Suspected exposure to HIV within 72 hours"
      then 'An HIV PEP regimen with two ARV drugs is effective, but three drugs are preferred.

  AZT + 3TC is recommended as the preferred backbone regimen for HIV PEP for children 10 years and younger. 

  ABC + 3TC or TDF + 3TC (or FTC) can be considered as alternative regimens.

  DTG is recommended as the preferred third drug for HIV PEP with approved DTG dosing.

  When available, ATV/r, DRV/r, LPV/r and RAL may be considered as alternative third drug options for PEP.

  The choice of ARV drugs for children will depend on the availability of approved dosing and age-appropriate formulations.
  for children. 

  DTG was approved in June 2020 for all children older than 4 weeks weighing more than 3kg and available with dispersible tablets that can be easily administered for all children weighting less than 20 kg. For children weighting more than 20 kg, 50 mg adult film-coated tablets can be use.'
      else '',
    if "Age 10 or older" and "Client is suitable for PrEP"
      then 'If PrEP is suitable for client, prescribe one of the PrEP regimens: \'TDF + FTC\', \'TDF\',
  \'TDF + 3TC\', \'Other TDF-based regimen\', \'Dapivirine vaginal ring (DVR)\', \'CAB-LA\'.

  The dapivirine vaginal ring may be offered as an additional prevention choice for women* at substantial risk of HIV infection as part of combination prevention approaches.

  *For the recommendation on dapirivirine vaginal ring, the term women applies to cisgender women, meaning women assigned female at birth.  There is no research at this time to support the dapivirine vaginal ring for other populations.'
      else ''
  })
