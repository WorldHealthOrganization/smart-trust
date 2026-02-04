/**
 * Library: HIV.IND.51 Logic
 * Ref No: DFT.4
 * Short Name: TB diagnosis among those tested for TB
 *
 * Definition: % of people living with HIV newly initiated on ART and tested for TB who are diagnosed with active TB disease
 *
 * Numerator: Number of people living with HIV newly initiated on ART who were diagnosed as having active TB disease
 * Numerator Calculation: COUNT of clients with "HIV status"='HIV-positive' AND with "ART start type"='First-time user of ART' AND with "ART start date" in the reporting period AND "TB screening date" in the reporting period AND "TB screening result"='Screen positive for TB' AND a "TB diagnostic test category" is NOT NULL AND with a "TB diagnostic test date" in the reporting period AND "Date of TB diagnosis" in the reporting period
 * Numerator Exclusions: 
 *
 * Denominator: Number of people living with HIV who newly initiated ART and screened positive for TB symptoms who had appropriate diagnostic testing during the reporting period*
 * Denominator Calculation: COUNT of clients with "HIV status"='HIV-positive' AND with "ART start type"='First-time user of ART' AND with "ART start date" in the reporting period AND "TB screening date" in the reporting period AND "TB screening result"='Screen positive for TB' AND a "TB diagnostic test category" is NOT NULL AND with a "TB diagnostic test date" in the reporting period
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Gender (female, male, other**) 
 *  • Age (0–4, 5–9, 10–14, 15–19, 20–24, 25–49, 50+ years)*** 
 *  • Cities and other administrative regions of epidemiologic importance 
 *   
 *  Note: This indicator is related to but distinct from indicator TB.4 Percentage of people living with HIV newly initiated on ART who have active TB disease.
 *
 * Disaggregation Elements: Gender | Age
 *
 * Numerator and Denominator Elements:
 * ART start date 
 *  ART start type 
 *  Date of TB diagnosis 
 *  HIV status 
 *  TB diagnostic test category 
 *  TB diagnostic test date 
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
 * HIV.D.DE952: Date of TB diagnosis | The date when the diagnosis was established
 * HIV.D.DE986: TB screening result | Record the result of the tuberculosis (TB) screening
 * HIV.D.DE987: Screen positive for TB | Screening result was positive for tuberculosis (TB)
 * HIV.D.DE988: Screen negative for TB | Screening result was negative for tuberculosis (TB)
 * HIV.D.DE989: Inconclusive | Screening result was inconclusive for tuberculosis (TB)
 * HIV.D.DE990: TB screening date | Date the TB screening was conducted
 * HIV.D.DE992: TB diagnostic test category | The type of diagnostic test performed to detect tuberculosis (TB) disease
 * HIV.D.DE993: LF-LAM | Client tested for tuberculosis with a lateral flow urine lipoarabinomannan assay
 * HIV.D.DE994: mWRD test for TB | Client tested with a WHO-recommended molecular diagnostic test to detect Mycobacterium tuberculosis (MTB)
 * HIV.D.DE995: Microscopy - Sputum acid-fast bacilli (AFB) | Client tested for tuberculosis with a sputum acid-fast bacilli (AFB)
 * HIV.D.DE996: TB Culture | Client tested for tuberculosis (TB) with a culture
 * HIV.D.DE997: TB diagnostic test date | The date when TB diagnostic test was performed
 * HIV.SRV.DE6: ART start date | The date on which the client started or restarted antiretroviral therapy (ART)
 *
 * Additional Context
 * - what it measures: This indicator measures the percentage of people living with HIV newly initiated on ART and, having screened positive for active TB disease, were evaluated and/or had appropriate TB diagnostic testing and were confirmed to have active TB disease.
 * - rationale: • Appropriate TB diagnostic testing based on national clinical/WHO guidelines is essential for people living with HIV who screen positive for TB. | • It is important to understand the cascade from ART enrolment to treatment of active TB disease; this indicator will highlight any obstacles between diagnostic testing and TB diagnosis. | • This is the fourth of five "screening cascade" indicators considered priority for high burden TB/HIV settings.
 * - method: "Newly initiated" is defined as the number of people living with HIV who start ART in accordance with national treatment guidelines during the reporting period. | For the numerator: Programme records (for example, ART registers, EMRs)  | For the denominator: Programme records (for example, ART registers, EMRs)
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

library HIVIND51Logic

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
 * Definition: Number of people living with HIV newly initiated on ART who were diagnosed as having active TB disease
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' AND with "ART start type"='First-time user of ART' AND with "ART start date" in the reporting period AND "TB screening date" in the reporting period AND "TB screening result"='Screen positive for TB' AND a "TB diagnostic test category" is NOT NULL AND with a "TB diagnostic test date" in the reporting period AND "Date of TB diagnosis" in the reporting period
 */

define "Numerator":
  HIE."Has HIV-positive Status"
  and (start of First(HE."First-time user of ART").effective.toInterval() during "Measurement Period")
  //related the two since we want a positive observation from a specific diagnostic test.
  and exists(
    HE."TB diagnostic test category" P
    with HE."Screen positive for TB" O
      such that P.partOf.references(O)
    where P.performed.toInterval() during "Measurement Period"
  )
  and HIE."Date of TB diagnosis"


/**
 * Denominator
 *
 * Definition: Number of people living with HIV who newly initiated ART and screened positive for TB symptoms who had appropriate diagnostic testing during the reporting period*
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' AND with "ART start type"='First-time user of ART' AND with "ART start date" in the reporting period AND "TB screening date" in the reporting period AND "TB screening result"='Screen positive for TB' AND a "TB diagnostic test category" is NOT NULL AND with a "TB diagnostic test date" in the reporting period
 */

define "Denominator":
  HIE."Has HIV-positive Status"
  and (start of First(HE."First-time user of ART").effective.toInterval() during "Measurement Period")
  //related the two since we want a positive observation from a specific diagnostic test.
  and exists(
    HE."TB diagnostic test category" P
    with HE."Screen positive for TB" O
      such that P.partOf.references(O)
    where P.performed.toInterval() during "Measurement Period"
  )
    

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