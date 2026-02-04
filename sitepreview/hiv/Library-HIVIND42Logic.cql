/**
 * Library: HIV.IND.42 Logic
 * Ref No: VER.6
 * Short Name: Final outcome of PMTCT
 *
 * Definition: % of HIV-exposed infants whose final HIV outcome status is known
 *
 * Numerator: HIV-exposed infants born within the past 12 months (or 24 months in breastfeeding settings) who have known final HIV outcome status
 * Numerator Calculation: COUNT of infants who are an "HIV-exposed infant or child" AND [(with an "Infant date of birth" in past 12 months) OR (with an "Infant date of birth" in past 24 months IF mothers are "Breastfeeding")] AND "Registered in birth cohort"=True AND with a "Final diagnosis of HIV-exposed infant" of NOT NULL
 * Numerator Exclusions: 
 *
 * Denominator: a) Programme-based/service delivery denominator | Number of HIV-exposed infants who were born within the 12 months (or 24 months in breastfeeding settings) prior to the reporting period and registered in the birth cohort | For example, for the reporting period January to December 2021 the denominator would be the number of HIV-exposed infants born between January to December 2020 in non-breast feeding settings and January to December 2019 in breastfeeding settings. |  | b) Population-based denominator | Estimated number of HIV-positive women who delivered within the past 12 months | (or 24 months in breastfeeding settings)
 * Denominator Calculation: COUNT of infants who are an "HIV-exposed infant or child" AND [(with an "Infant date of birth" within past 12 months) OR (with an "Infant date of birth" within past 24 months IF mothers are "Breastfeeding")] AND "Registered in birth cohort"=True
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Outcome status (HIV-positive, HIV-negative, no longer breastfeeding) 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Infant HIV status
 *
 * Numerator and Denominator Elements:
 * Breastfeeding 
 *  Final diagnosis of HIV-exposed infant 
 *  HIV-exposed infant or child 
 *  Infant date of birth 
 *  Registered in birth cohort
 *
 * Reference: Consolidated guidelines on person-centred HIV strategic information: strengthening routine data for impact. Geneva: World Health Organization; 2022
 * 
 * Data Concepts:
 * HIV.B.DE32: Breastfeeding | Infant is being breastfed by mother
 * HIV.D.DE32: Breastfeeding | Client is giving infant breast milk
 * HIV.E.DE87: Infant date of birth | The infant's date of birth (DOB) if known
 * HIV.E.DE112: HIV-exposed infant or child | Whether the infant or child was determined to have had HIV exposure
 * HIV.E.DE179: Registered in birth cohort | Whether the infant has been registered in a birth cohort
 * HIV.E.DE225: Infant HIV status | HIV status reported after applying the HIV testing algorithm. No single HIV test can provide an HIV-positive diagnosis.
 * HIV.E.DE226: HIV-positive | Infant is HIV-positive
 * HIV.E.DE227: HIV-negative | Infant is HIV-negative
 * HIV.E.DE228: Unknown | Infant has unknown HIV status
 * HIV.E.DE230: Final diagnosis of HIV-exposed infant | HIV-exposed infant final status at 18 months or 3 months after cessation of breastfeeding (whichever is later).
 * HIV.E.DE231: HIV-positive | The infant is HIV-positive
 * HIV.E.DE232: HIV-negative and no longer breastfeeding | The infant is HIV-negative and the mother has quit breastfeeding
 * HIV.E.DE233: HIV status unknown | The final HIV status of the child is unknown because the infant died, was lost to follow-up or transferred out without ever having an HIV-positive diagnosis or is active in care but was not tested at 18 months
 * HIV.SRV.DE20: HIV-exposed infant or child | Whether the infant or child was determined to have had HIV exposure
 * HIV.SRV.DE22: Final diagnosis of HIV-exposed infant | HIV-exposed infant final status at 18 months or 3 months after cessation of breastfeeding (whichever is later).
 *
 * Additional Context
 * - what it measures: This indicator measures quality of programme follow-up to track exposed infants and ascertain final HIV status.
 * - rationale: • Effective PMTCT programmes must follow HIV-exposed infants until the end of the breastfeeding period to ensure that the full cascade of services and support is provided to HIV-positive mothers and their infants. | • The ability to ascertain final outcome status through routine programme data across multiple points of care is a key challenge.
 * - method: This indicator measures quality of programme follow-up to track exposed infants and ascertain final HIV status.
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

library HIVIND42Logic

// Included Libraries
using FHIR version '4.0.1'

include HIVCommon version '0.0.1' called HIC
include FHIRHelpers version '4.0.1'

include WHOCommon called WCom

include HIVElements called HE
include HIVIndicatorElements called HIE


// Indicator Definition
parameter "Measurement Period" Interval<Date> default Interval[@2023-01-01, @2023-01-30]

context Patient
/* Populations */

/*
 *Initial Population
 */

define "Initial Population":
  true

/**
 * Numerator
 * 
 * Definition: HIV-exposed infants born within the past 12 months (or 24 months in breastfeeding settings) who have known final HIV outcome status
 * Calculation: COUNT of infants who are an "HIV-exposed infant or child" AND [(with an "Infant date of birth" in past 12 months) OR (with an "Infant date of birth" in past 24 months IF mothers are "Breastfeeding")] AND "Registered in birth cohort"=True AND with a "Final diagnosis of HIV-exposed infant" of NOT NULL
 */

define "Numerator":
  HIE."is HIV-exposed infant or child E.DE112"
  and
  (exists(HIE."Live Birth Delivery" B where months between end of B.effective.toInterval() and end of  "Measurement Period" < 12 months)
  or 
  (
  exists(HIE."Breastfeeding B.DE32" B) and
  exists(HIE."Live Birth Delivery" B where months between end of B.effective.toInterval() and end of  "Measurement Period" < 24 months)
  )
  )
  and HIE."Registered in birth cohort"
  and HE."Final diagnosis of HIV-exposed infant E.DE230" is not null


/**
 * Denominator
 *
 * Definition: a) Programme-based/service delivery denominator | Number of HIV-exposed infants who were born within the 12 months (or 24 months in breastfeeding settings) prior to the reporting period and registered in the birth cohort | For example, for the reporting period January to December 2021 the denominator would be the number of HIV-exposed infants born between January to December 2020 in non-breast feeding settings and January to December 2019 in breastfeeding settings. |  | b) Population-based denominator | Estimated number of HIV-positive women who delivered within the past 12 months | (or 24 months in breastfeeding settings)
 * Calculation: COUNT of infants who are an "HIV-exposed infant or child" AND [(with an "Infant date of birth" within past 12 months) OR (with an "Infant date of birth" within past 24 months IF mothers are "Breastfeeding")] AND "Registered in birth cohort"=True
 */

define "Denominator":
  HIE."is HIV-exposed infant or child E.DE112"
  and
  (exists(HIE."Live Birth Delivery" B where months between end of B.effective.toInterval() and end of  "Measurement Period" < 12 months)
  or 
  (
  exists(HIE."Breastfeeding B.DE32" B) and
  exists(HIE."Live Birth Delivery" B where months between end of B.effective.toInterval() and end of  "Measurement Period" < 24 months)
  )
  )
  and HIE."Registered in birth cohort"
    

/* end Populations */

/* 
 * Disaggregators
 */
  
define "Geographic Region Stratifier":
	HIE."By Geographic Region Stratifier"

define "HIV Status Stratifier infant":
  HIE."HIV Status Stratifier infant"

define "Stratification":
HIE."HIV Status Stratifier infant".code
+ ':' + HIE."By Geographic Region Stratifier"




