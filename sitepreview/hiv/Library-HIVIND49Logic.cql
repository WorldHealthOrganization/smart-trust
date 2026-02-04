/**
 * Library: HIV.IND.49 Logic
 * Ref No: DFT.2
 * Short Name: TB symptom-screened positive among new ART patients
 *
 * Definition: % of people living with HIV newly initiated on ART who were screened for TB symptoms and who screened positive
 *
 * Numerator: Number of people living with HIV newly initiated on ART who screened positive for TB symptoms
 * Numerator Calculation: COUNT of clients with "HIV status"='HIV-positive' AND with "ART start type"='First-time user of ART' AND with "ART start date" in the reporting period AND "TB screening date" in the reporting period AND "TB screening result"='Screen positive for TB'
 * Numerator Exclusions: 
 *
 * Denominator: Number of people living with HIV newly initiated on ART during the reporting period who were screened for TB symptoms
 * Denominator Calculation: COUNT of clients with "HIV status"='HIV-positive' AND with "ART start type"='First-time user of ART' AND with "ART start date" in the reporting period AND "TB screening date" in the reporting period
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Gender (female, male, other*) 
 *  • Age 0–4, 5–9, 10–14, 15–19, 20–24, 25–49, 50+ years)** 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Gender | Age
 *
 * Numerator and Denominator Elements:
 * ART start date 
 *  ART start type 
 *  HIV status 
 *  TB screening date 
 *  TB screening result
 *
 * Reference: Consolidated guidelines on person-centred HIV strategic information: strengthening routine data for impact. Geneva: World Health Organization; 2022
 * 
 * Data Concepts:
 * HIV.A.DE17: Age | Calculated age (number of years) of the client based on date of birth
 * HIV.A.DE18: Gender* | Gender of the client*
 * HIV.A.DE19: Female | Client identifies as female
 * HIV.A.DE20: Male | Client identifies as male
 * HIV.A.DE21: Transgender male | Client identifies as transgender male
 * HIV.A.DE22: Transgender female | Client identifies as transgender female
 * HIV.A.DE23: Other | Additional category
 * HIV.B.DE72: ART start date | The date on which the client started or restarted antiretroviral therapy (ART)
 * HIV.B.DE115: HIV status | HIV status reported after applying the national HIV testing algorithm. No single HIV test can provide an HIV-positive diagnosis.
 * HIV.B.DE116: HIV-positive | Client is HIV-positive
 * HIV.B.DE117: HIV-negative | Client is HIV-negative
 * HIV.B.DE118: Unknown | Client has unknown HIV status
 * HIV.D.DE39: ART start date | The date on which the client started or restarted ART
 * HIV.D.DE43: ART start type | Whether the client is ART naive or is restarting ART
 * HIV.D.DE44: First-time user of ART | Client is ART naive, having never taken ART to treat HIV before
 * HIV.D.DE45: Restarting ART | Client is restarting ART after stopping treatment for any reason
 * HIV.D.DE986: TB screening result | Record the result of the tuberculosis (TB) screening
 * HIV.D.DE987: Screen positive for TB | Screening result was positive for tuberculosis (TB)
 * HIV.D.DE988: Screen negative for TB | Screening result was negative for tuberculosis (TB)
 * HIV.D.DE989: Inconclusive | Screening result was inconclusive for tuberculosis (TB)
 * HIV.D.DE990: TB screening date | Date the TB screening was conducted
 * HIV.SRV.DE6: ART start date | The date on which the client started or restarted antiretroviral therapy (ART)
 *
 * Additional Context
 * - what it measures: This indicator measures the percentage of people living with HIV newly initiated on ART and screened for symptoms of active TB disease who screen positive.
 * - rationale: • Routine TB screening among people living with HIV newly initiated on ART and those who are already on ART is essential to identifying presumptive TB cases in need of confirmatory diagnostic testing and to determine eligibility for TPT if active TB disease is ruled out. | • Screening positivity rates vary based on background TB prevalence and other epidemiological and environmental factors. However, low screening positivity rates can signal inadequate or poor-quality TB screening, particularly in high burden settings. | • It is important to understand the cascade from ART enrolment to treatment of active | TB disease; this indicator will highlight obstacles between ART enrolment and screening for TB symptoms. | • This is the second of five "screening cascade" indicators considered priority for high burden TB/HIV settings.
 * - method: "Newly initiated" is defined as the number of people living with HIV who start ART in accordance with national treatment guidelines during the reporting period. |  | For the numerator and denominator: Programme records (for example, ART registers, EMR)
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

library HIVIND49Logic

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
 * Definition: Number of people living with HIV newly initiated on ART who screened positive for TB symptoms
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' AND with "ART start type"='First-time user of ART' AND with "ART start date" in the reporting period AND "TB screening date" in the reporting period AND "TB screening result"='Screen positive for TB'
 */

define "Numerator":
  HIE."Has HIV-positive Status"
  and (start of First(HE."First-time user of ART").effective.toInterval() during "Measurement Period")
  and HIE."Screen positive for TB"


/**
 * Denominator
 *
 * Definition: Number of people living with HIV newly initiated on ART during the reporting period who were screened for TB symptoms
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' AND with "ART start type"='First-time user of ART' AND with "ART start date" in the reporting period AND "TB screening date" in the reporting period
 */

define "Denominator":
  HIE."Has HIV-positive Status"
  and (start of First(HE."First-time user of ART").effective.toInterval() during "Measurement Period")
  and HIE."TB screening date"
    

/* end Populations */

/*
 * Disaggregators
 */

define "Administrative Gender Stratifier":
	HIE."By Administrative Gender Stratifier"

define "Age Stratifier":
	HIE."By Age Stratifier 2"

define "Geographic Region Stratifier":
	HIE."By Geographic Region Stratifier"

define "Stratification":
 HIE."By Administrative Gender Stratifier".code 
  + ':' + HIE."By Age Stratifier 2"
+ ':' + HIE."By Geographic Region Stratifier"