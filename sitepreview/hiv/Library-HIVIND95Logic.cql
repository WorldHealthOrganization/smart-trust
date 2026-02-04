/**
 * Library: HIV.IND.95 Logic
 * Ref No: CCA.3
 * Short Name: Invasive cervical cancer treatment
 *
 * Definition: % of women living with HIV diagnosed with invasive cancer who were treated
 *
 * Numerator: Number of women living with HIV who received treatment after being diagnosed with invasive cervical cancer
 * Numerator Calculation: COUNT of women with "HIV status"='HIV-positive' AND "Cervical cancer diagnosis"='Invasive cervical cancer' for a "Date of diagnosis of cervical precancer lesions or invasive cervical cancer" within the reporting period AND "Invasive cervical cancer treatment method" is NOT NULL
 * Numerator Exclusions: 
 *
 * Denominator: Number of women living with HIV who were diagnosed with invasive cervical cancer
 * Denominator Calculation: COUNT of women with "HIV status"='HIV-positive' AND "Cervical cancer diagnosis"='Invasive cervical cancer' for a "Date of diagnosis of cervical precancer lesions or invasive cervical cancer" within the reporting period
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Age (15–19, 20–24, 25–29, 30–49, 50+ years) 
 *  • Invasive cervical cancer treatment episode (1st in lifetime, 2nd, 3rd, 4th, etc.) 
 *  • Treatment type (medical, surgical) 
 *  • Cities and other administrative areas of epidemiologic importance
 *
 * Disaggregation Elements: Age | Invasive cervical cancer treatment episode | Invasive cervical cancer treatment method
 *
 * Numerator and Denominator Elements:
 * Cervical cancer diagnosis 
 *  Date of diagnosis of cervical precancer lesions or invasive cervical cancer 
 *  HIV status 
 *  Invasive cervical cancer treatment method
 *
 * Reference: Consolidated guidelines on person-centred HIV strategic information: strengthening routine data for impact. Geneva: World Health Organization; 2022
 * 
 * Data Concepts:
 * HIV.A.DE17: Age | Calculated age (number of years) of the client based on date of birth
 * HIV.B.DE115: HIV status | HIV status reported after applying the national HIV testing algorithm. No single HIV test can provide an HIV-positive diagnosis.
 * HIV.B.DE116: HIV-positive | Client is HIV-positive
 * HIV.B.DE117: HIV-negative | Client is HIV-negative
 * HIV.B.DE118: Unknown | Client has unknown HIV status
 * HIV.D.DE705: Date of diagnosis of cervical precancer lesions or invasive cervical cancer | Date of diagnosis of cervical precancer lesions or invasive cervical cancer
 * HIV.D.DE709: Cervical cancer diagnosis | Type of cervical cancer diagnosis
 * HIV.D.DE710: Cervical precancer lesions | Client is diagnosed with cervical precancer lesions
 * HIV.D.DE711: Invasive cervical cancer | Client is diagnosed with invasive cervical cancer disease
 * HIV.D.DE730: Invasive cervical cancer treatment episode | Client's lifetime number of treatments for invasive cervical cancer
 * HIV.D.DE731: Invasive cervical cancer treatment method | Invasive cervical cancer treatment method
 * HIV.D.DE732: Conization | Invasive cervical cancer treatment method is a conization
 * HIV.D.DE733: Trachelectomy | Invasive cervical cancer treatment method is a trachelectomy
 * HIV.D.DE734: Hysterectomy | Invasive cervical cancer treatment method is a hysterectomy
 * HIV.D.DE735: Management of invasive cervical cancer | Invasive cervical cancer treatment method is management of invasive cervical cancer
 * HIV.D.DE736: Radiotherapy | Invasive cervical cancer treatment method is a radiotherapy
 * HIV.D.DE737: Chemotherapy | Invasive cervical cancer treatment method is a chemotherapy
 * HIV.D.DE738: Chemoradiation | Invasive cervical cancer treatment method is a chemoradiation
 * HIV.D.DE739: Other | Invasive cervical cancer treatment method is a not in list
 *
 * Additional Context
 * - what it measures: Progress towards increasing access to treatment for invasive cervical cancer for women living with HIV
 * - rationale: The purpose of this indicator is to assess trends in availability and access to treatment services for invasive cervical cancer for women living with HIV. In the longer run, it is expected that the number of women living with HIV who received treatment for invasive cervical cancer will plateau and slowly decrease, as screening programmes expand detection and treatment of precancerous lesions, and coverage of human papillomavirus (HPV) vaccination increases in line with the WHO Global Strategy 90–70–90 elimination targets.
 * - method: The number is generated from programmatic data from HIV or cervical cancer programmes, or from a national cancer registry, if HIV status is recorded there.
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

/* 
 * Profiles:
 * - HIVStatusCondition
 * - HIVStatusObservation
 * - Patient
 * - InvasiveCervicalCancerDiagnosis
 * - InvasiveCervicalCancerTreatment
*/

library HIVIND95Logic

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
 * Definition: Number of women living with HIV who received treatment after being diagnosed with invasive cervical cancer
 * Calculation: COUNT of women with "HIV status"='HIV-positive' AND "Cervical cancer diagnosis"='Invasive cervical cancer' for a "Date of diagnosis of cervical precancer lesions or invasive cervical cancer" within the reporting period AND "Invasive cervical cancer treatment method" is NOT NULL
 //can't just be not null because if had treatment in past then is true
 */

define "Numerator":
  HIE."Has HIV-positive Status" and 
  exists(HE."Invasive cervical cancer" C 
  where exists (HE."Invasive cervical cancer treatment method" P
  where P.performed.toInterval() after start of C.prevalenceInterval()))

/**
 * Denominator
 *
 * Definition: Number of women living with HIV who were diagnosed with invasive cervical cancer
 * Calculation: COUNT of women with "HIV status"='HIV-positive' AND "Cervical cancer diagnosis"='Invasive cervical cancer' for a "Date of diagnosis of cervical precancer lesions or invasive cervical cancer" within the reporting period
 //language should specify only invasive cancer
 */

define "Denominator":
  HIE."Has HIV-positive Status" and 
  exists HIE."Invasive cervical cancer"
    

/* end Populations */

/*
 * Disaggregators
 */

define "Age Stratifier":
	HIE."By Age Stratifier 9"

define "Geographic Region Stratifier":
	HIE."By Geographic Region Stratifier"

define "Invasive cervical cancer treatment episode Statifier":
  HIE."Invasive cervical cancer treatment episode Value"

// define "Invasive cervical cancer treatment method stratifier":
//   HIE."Invasive cervical cancer treatment method stratifier"


define "Stratification":
HIE."By Age Stratifier 9"
+ ':' + HIE."By Geographic Region Stratifier"
+ ':' + (HIE."Invasive cervical cancer treatment episode Value")
//+ ':' + HIE."Invasive cervical cancer treatment method stratifier".code 

//treatment type not specified