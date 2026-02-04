library HIVCommon version '0.0.1' 

using FHIR version '4.0.1'

include FHIRHelpers version '4.0.1'
include WHOCommon called WCom

include HIVConcepts called Concepts
include HIVConceptsCustom called CustomConcepts

context Patient

//VERIFIED


//DRAFT

//need to add Time to start ART (within 7, 30 or 90 days of diagnosis, as per country guidelines)
//need to add Disaggregation by time since diagnosis
  


/* 
* DAK has codes for HAART misspecified 
* ICD-10 Z92.2	Other prophylactic chemotherapy		
* LOINC "54825-5	"	On scheduled pain medication regimen in last 7 days
*
* Should discuss 
*/







/*
* Kenya EMR defined as HIV positive condition
* Will need to discuss if produce flags through conditions for concepts to use in indicator calculation such as HIV positive and On ART
* However, we have moved forward with a more prescriptive approach 
* Inevitably our approach requires that certain data elements be available
*/

/*
 * HIV Treatment during the measurement period
 * uses dosage and dispensation amount to estimate last day of medication
 * medication should be dispensed before end of measurement period
 * medication should last until after 28 days after the end of the measurement period
 * This takes into account lost to follow up
 */

/*
*define "HIV Treatment during the measurement period":
*   [MedicationDispense] MD
*    where MD.status in { 'final', 'amended', 'corrected' }
*    and MD.medication ~ 'Antiretroviral'
*    and MD.whenHandedOver before end of "Measurement Period"
*    and (MD.whenHandedOver + MD.dosageInstruction[0].timing.repeat.duration.value * MedicationDispense.quantity.value) after (measurementPeriod.end - 28 days)
*/ 

/*
* Immunization defines HAART as
*  exists([MedicationAdministration] A where ExtractMedicationCode(A.medication) in IMMZc."ARV Drugs" and A.status = 'in-progress')
* I believe this is the incorrect resource unless they mean to say that medication is given during a medical encounter
* would like to discuss 
*/ 

/** 
 * Patient Deceased During Measurement Period
 * Immunization defines this as true when is a boolean. This may have the effect of deleting a person from indicators in all calculations
 * Should intend to use when patient.deceased FHIR boolean was updated to TRUE if no other date is available
 * Kenya EMR example does not account for when deceased is just a boolean
 */


/*
define "PREP Prescription Days":
  Sum(
    (
      collapse (
        [MedicationRequest] MR
          where MR.status = 'completed'
          and MR.intent = 'order'
          and MR.medication ~ Concepts."PrEP for HIV prevention"
        return WComV2."Prescription Relevant Period"( MR ) intersect "Measurement Period"
      )
    ) PREPUseInterval
      return days between start of PREPUseInterval and end of PREPUseInterval
  )
*/


define function GetDurationInDays(value FHIR.Duration): // returns Decimal:
    case value.code.value
      when 'a' then value.value * 365.0
      when 'mo' then value.value.value * 30.0
      when 'wk' then value.value.value * 7.0
      when 'd' then value.value.value
      when 'h' then value.value.value / 24.0
      when 'min' then value.value.value / 60.0 / 24.0
      when 's' then value.value.value / 60.0 / 60.0 / 24.0
      when 'ms' then value.value.value / 60.0 / 60.0 / 24.0 / 1000.0
      else Message(1000, true, 'Undefined', 'Error', 'Unsupported duration unit ' + value.code.value)
    end

define function "Prescription Relevant Period"(prescription FHIR.MedicationRequest):
  if (
    prescription.authoredOn is not null and prescription.dispenseRequest is not null
      and prescription.dispenseRequest.expectedSupplyDuration is not null
  )
  then Interval[
    date from prescription.authoredOn,
    date from prescription.authoredOn + System.Quantity{ value: GetDurationInDays(prescription.dispenseRequest.expectedSupplyDuration), unit: 'days' }
  ]
  else null

//System.Integer
define function ToDaily(frequency System.Integer, period System.Quantity):
  case period.unit
    when 'h' then frequency * (24.0 / period.value)
    when 'min' then frequency * (24.0 / period.value) * 60
    when 's' then frequency * (24.0 / period.value) * 60 * 60
    when 'd' then frequency * (24.0 / period.value) / 24
    when 'wk' then frequency * (24.0 / period.value) / (24 * 7)
    when 'mo' then frequency * (24.0 / period.value) / (24 * 30) /* assuming 30 days in month */
    when 'a' then frequency * (24.0 / period.value) / (24 * 365) /* assuming 365 days in year */
    when 'hour' then frequency * (24.0 / period.value)
    when 'minute' then frequency * (24.0 / period.value) * 60
    when 'second' then frequency * (24.0 / period.value) * 60 * 60
    when 'day' then frequency * (24.0 / period.value) / 24
    when 'week' then frequency * (24.0 / period.value) / (24 * 7)
    when 'month' then frequency * (24.0 / period.value) / (24 * 30) /* assuming 30 days in month */
    when 'year' then frequency * (24.0 / period.value) / (24 * 365) /* assuming 365 days in year */
    when 'hours' then frequency * (24.0 / period.value)
    when 'minutes' then frequency * (24.0 / period.value) * 60
    when 'seconds' then frequency * (24.0 / period.value) * 60 * 60
    when 'days' then frequency * (24.0 / period.value) / 24
    when 'weeks' then frequency * (24.0 / period.value) / (24 * 7)
    when 'months' then frequency * (24.0 / period.value) / (24 * 30) /* assuming 30 days in month */
    when 'years' then frequency * (24.0 / period.value) / (24 * 365) /* assuming 365 days in year */
    else null
  end

  define function "HasEnd"(period Interval<DateTime> ):
  not (end of period is null
    or end of period = maximum DateTime
)

  define fluent function MedicationRequestPeriod(Request MedicationRequest):
  Request R
    let
      dosage: singleton from R.dosageInstruction,
      doseAndRate: singleton from dosage.doseAndRate,
      doseRange: doseAndRate.dose as Range,
      doseQuantity: doseAndRate.dose as SimpleQuantity,
      dose: Coalesce(end of doseRange, doseQuantity),
      timing: dosage.timing,
      frequency: Coalesce(timing.repeat.frequencyMax, timing.repeat.frequency),
      period: System.Quantity { value: timing.repeat.period, unit: timing.repeat.periodUnit.value },
      dosesPerDay: Coalesce(ToDaily(FHIRHelpers.ToInteger(frequency), period), Count(timing.repeat.timeOfDay), 1.0),
      boundsPeriod: timing.repeat.bounds as Period,
      daysSupply: R.dispenseRequest.expectedSupplyDuration,
      quantity: R.dispenseRequest.quantity,
      refills: Coalesce(R.dispenseRequest.numberOfRepeatsAllowed, 0),
      startDate:
        Coalesce(
          start of boundsPeriod,
          start of R.dispenseRequest.validityPeriod,
          R.authoredOn
        )
    return
      if HasEnd(boundsPeriod) then
        Interval[startDate, end of boundsPeriod]
      else
        (
          Coalesce(daysSupply, quantity / (dose * dosesPerDay))
            * (1 + refills)
        ) durationInDays
          return Interval[startDate, startDate + durationInDays]


define function "DosesPerDay"(frequency Code):
	/*Calculates the cumulative dose per day for each prescription*/
	case
		when frequency ~ CustomConcepts."Once daily (qualifier value)" then 1.0
		when frequency ~ CustomConcepts."Twice a day (qualifier value)" then 2.0
		when frequency ~ CustomConcepts."Three times daily (qualifier value)" then 3.0
		when frequency ~ CustomConcepts."Four times daily (qualifier value)" then 4.0
		when frequency ~ CustomConcepts."Every twenty four hours (qualifier value)" then 1.0
		when frequency ~ CustomConcepts."Every twelve hours (qualifier value)" then 2.0
		when frequency ~ CustomConcepts."Every thirty six hours (qualifier value)" then 0.67
		when frequency ~ CustomConcepts."Every eight hours (qualifier value)" then 3.0
		when frequency ~ CustomConcepts."Every four hours (qualifier value)" then 6.0
		when frequency ~ CustomConcepts."Every six hours (qualifier value)" then 4.0
		when frequency ~ CustomConcepts."Every seventy two hours (qualifier value)" then 0.34
		when frequency ~ CustomConcepts."Every forty eight hours (qualifier value)" then 0.5
		when frequency ~ CustomConcepts."Every eight to twelve hours (qualifier value)" then 2.0
		when frequency ~ CustomConcepts."Every six to eight hours (qualifier value)" then 3.0
		when frequency ~ CustomConcepts."Every three to four hours (qualifier value)" then 6.0
		when frequency ~ CustomConcepts."Every three to six hours (qualifier value)" then 4.0
		when frequency ~ CustomConcepts."Every two to four hours (qualifier value)" then 6.0
		when frequency ~ CustomConcepts."One to four times a day (qualifier value)" then 4.0
		when frequency ~ CustomConcepts."One to three times a day (qualifier value)" then 3.0
		when frequency ~ CustomConcepts."One to two times a day (qualifier value)" then 2.0
		else null 
	end

  //define function "GetMedicationDailyDose"(dosage Quantity, dosesPerDay Decimal):
  //dosage * Quantity { value: dosesPerDay, unit: '/d' }


define fluent function dailyDose(Request "MedicationRequest"):
  Request R
    let
      dosage: singleton from R.dosageInstruction,
      doseAndRate: singleton from dosage.doseAndRate,
      timing: dosage.timing,
      frequency: Coalesce(timing.repeat.frequencyMax, timing.repeat.frequency),
      period: System.Quantity { value: timing.repeat.period, unit: timing.repeat.periodUnit.value },
      doseRange: doseAndRate.dose as Range,
      doseQuantity: doseAndRate.dose as SimpleQuantity,
      dose: Coalesce(doseRange.high, doseQuantity),
      dosesPerDay: Coalesce(ToDaily(frequency, period), Count(timing.repeat.timeOfDay), 1.0),
      quantity: R.dispenseRequest.quantity
    return
      quantity / (dose * dosesPerDay)

define fluent function dailyDose(Dispense "MedicationDispense"):
  Dispense D
    let
      dosage: singleton from D.dosageInstruction,
      doseAndRate: singleton from dosage.doseAndRate,
      timing: dosage.timing,
      frequency: Coalesce(timing.repeat.frequencyMax, timing.repeat.frequency),
      period: System.Quantity { value: timing.repeat.period, unit: timing.repeat.periodUnit.value },
      doseRange: doseAndRate.dose as Range,
      doseQuantity: doseAndRate.dose as SimpleQuantity,
      dose: Coalesce(doseRange.high, doseQuantity),
      dosesPerDay: Coalesce(ToDaily(frequency, period), Count(timing.repeat.timeOfDay), 1.0)
    return
      D.quantity / (dose * dosesPerDay)







  
  


//need to define
  define STI_testing:
    [Procedure] P
  where P.status = 'completed'
  and P.code ~ Concepts."STI testing and treatment services" 


/**
 * @description Takes a choice between a Medication and a CodeableConcept and returns just the code of the medication
 */
define function ExtractMedicationCode(choice Choice<FHIR.CodeableConcept, FHIR.Reference>):
  case
	  when choice is FHIR.CodeableConcept then
    	choice as FHIR.CodeableConcept
    when choice is FHIR.Reference then
      First([Medication] M 
        where M.id = Last(Split(choice.reference, '/'))
        return M.code as FHIR.CodeableConcept)
    else
      Message(null as FHIR.CodeableConcept, true, '1', 'Error', 'Cannot compute a medication code') // TODO: I'm sure that this is supported somehow?
  end

/**
 * @description Returns the code of an Observation CodeableConcept
 */
define fluent function getObservationCode(observation FHIR.Observation):
  case 
    when observation.code is FHIR.CodeableConcept then (observation.value as CodeableConcept).coding.code
    else null
  end
  
/**
 * @description Returns a list of codes of an a list of Observations
 */
define fluent function getObservationCodes(obslist List<FHIR.Observation>):
  obslist obs return obs.getObservationCode()


