/**
 * Library: HIV.IND.94 Logic
 * Ref No: CCA.2
 * Short Name: Pre-invasive cervical disease treatment
 *
 * Definition: % of women living with HIV who screened positive for pre-invasive cervical disease and received treatment for it
 *
 * Numerator: Number of women living with HIV who received treatment after screening positive for pre-invasive cervical disease and were deemed eligible for treatment in line with the WHO recommendations
 * Numerator Calculation: COUNT of women with "HIV status"='HIV-positive' AND with a "Date of cervical cancer screening test" in the reporting period for "Cervical cancer screening outcome"='Positive for cervical precancer lesions' AND "Date of treatment for cervical precancer lesions" within 6 months of "Date of cervical cancer screening test"
 * Numerator Exclusions: 
 *
 * Denominator: Number of women living with HIV who screened positive for pre-invasive cervical disease.
 * Denominator Calculation: COUNT of women with "HIV status"='HIV-positive' AND with a "Date of cervical cancer screening test" in the reporting period for "Cervical cancer screening outcome"='Positive for cervical precancer lesions'
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Age (15–19, 20–24, 25–29, 30–49, 50+ years) 
 *  • Provider type (public-sector provider, private-sector provider) 
 *  • Cities and other administrative areas of epidemiologic importance
 *
 * Disaggregation Elements: Age
 *
 * Numerator and Denominator Elements:
 * Cervical cancer screening outcome 
 *  Date of cervical cancer screening test 
 *  Date of treatment for cervical precancer lesions 
 *  HIV status
 *
 * Reference: Consolidated guidelines on person-centred HIV strategic information: strengthening routine data for impact. Geneva: World Health Organization; 2022
 * 
 * Data Concepts:
 * HIV.A.DE17: Age | Calculated age (number of years) of the client based on date of birth
 * HIV.B.DE115: HIV status | HIV status reported after applying the national HIV testing algorithm. No single HIV test can provide an HIV-positive diagnosis.
 * HIV.B.DE116: HIV-positive | Client is HIV-positive
 * HIV.B.DE117: HIV-negative | Client is HIV-negative
 * HIV.B.DE118: Unknown | Client has unknown HIV status
 * HIV.D.DE656: Date of cervical cancer screening test | Date of cervical cancer screening test
 * HIV.D.DE706: Cervical cancer screening outcome | Client's screening outcome for cervical cancer
 * HIV.D.DE707: Positive for cervical precancer lesions | Screening outcome for cervical precancer lesions is positive
 * HIV.D.DE708: Negative for cervical precancer lesions | Screening outcome for cervical precancer lesions is negative
 * HIV.D.DE718: Date of treatment for cervical precancer lesions | Date of treatment for cervical precancer lesions
 *
 * Additional Context
 * - what it measures: Progress towards the treatment coverage target of 90% of women with a positive screening test receiving treatment as defined in the Global Strategy for cervical cancer elimination.
 * - rationale: • To assess availability, access and coverage of pre-invasive cervical disease treatment among women living with HIV who were diagnosed with precancerous lesions upon screening and were deemed eligible for precancer treatment in line with the WHO recommendations for screening and treatment to prevent cervical cancer. | • The WHO Global Strategy targets to eliminate cervical cancer are to vaccinate 90% of eligible girls against human papillomavirus (HPV), to screen 70% of eligible women at least twice in their lifetimes and to effectively treat 90% of those with a positive screening test or a cervical lesion, including palliative care when needed, all by 2030.
 * - method: Health facility patient registers, patient records |  | Treatment options include thermal ablation, cryotherapy and excision treatment including Large Loop Excision of the Transformation Zone therapy.
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

/* 
 * Profiles:
 * - HIVStatusCondition
 * - HIVStatusObservation
 * - CervicalCancerScreening
 * - CervicalCancerScreeningOutcome
 */

library HIVIND94Logic

// Included Libraries
using FHIR version '4.0.1'

include HIVCommon version '0.0.1' called HIC
include FHIRHelpers version '4.0.1'

include WHOCommon called WCom
include HIVElements called HE
include HIVIndicatorElements called HIE
include HIVConfig called Config


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
 * Definition: Number of women living with HIV who received treatment after screening positive for pre-invasive cervical disease and were deemed eligible for treatment in line with the WHO recommendations
 * Calculation: COUNT of women with "HIV status"='HIV-positive' AND with a "Date of cervical cancer screening test" in the reporting period for "Cervical cancer screening outcome"='Positive for cervical precancer lesions' AND "Date of treatment for cervical precancer lesions" within 6 months of "Date of cervical cancer screening test"
 */

define "Numerator":
  HIE."Has HIV-positive Status" and
  exists(HE."Positive for cervical precancer lesions" O
  where O.effective.toInterval() during "Measurement Period"
  and exists(HE."Date of treatment for cervical precancer lesions" T where months between start of T.performed.toInterval() and start of O.effective.toInterval() < 6 months))


/**
 * Denominator
 *
 * Definition: Number of women living with HIV who screened positive for pre-invasive cervical disease.
 * Calculation: COUNT of women with "HIV status"='HIV-positive' AND with a "Date of cervical cancer screening test" in the reporting period for "Cervical cancer screening outcome"='Positive for cervical precancer lesions'
 */

define "Denominator":
  HIE."Has HIV-positive Status" and
  exists(HE."Positive for cervical precancer lesions" O
  where O.effective.toInterval() during "Measurement Period")
    

/* end Populations */

/*
 * Disaggregators
 */

define "Age Stratifier":
	HIE."By Age Stratifier 9"

define "Geographic Region Stratifier":
	HIE."By Geographic Region Stratifier"




define "Stratification":
HIE."By Age Stratifier 9"
+ ':' + HIE."By Geographic Region Stratifier"

//need to add provider