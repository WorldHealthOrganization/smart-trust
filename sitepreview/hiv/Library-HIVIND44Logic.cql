/**
 * Library: HIV.IND.44 Logic
 * Ref No: TBH.1
 * Short Name: TPT initiation
 *
 * Definition: Number and % of eligible people living with HIV on ART who initiated TB preventive treatment
 *
 * Numerator: Number of ART patients who initiated TPT during the reporting period
 * Numerator Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True AND "TB preventive treatment (TPT) start date" in the reporting period
 * Numerator Exclusions: 
 *
 * Denominator: Number of ART patients who are eligible for TPT during the reporting period
 * Denominator Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True at end of last reporting period AND "Eligible for TB preventive treatment"=True
 * Denominator Exclusions: 
 *
 * Disaggregations:
 *  • Gender (female, male, other*) 
 *  • Age (0–4, 5–9, 10–14, 15–19, 20–24, 25–29, 30–34, 35–39, 40–44, 45–49, 50+ years)** 
 *  • Type of TPT regimen 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Gender | Age | TPT regimen type
 *
 * Numerator and Denominator Elements:
 * Eligible for TB preventive treatment 
 *  HIV status 
 *  On ART 
 *  TB preventive treatment (TPT) start date
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
 * HIV.B.DE115: HIV status | HIV status reported after applying the national HIV testing algorithm. No single HIV test can provide an HIV-positive diagnosis.
 * HIV.B.DE116: HIV-positive | Client is HIV-positive
 * HIV.B.DE117: HIV-negative | Client is HIV-negative
 * HIV.B.DE118: Unknown | Client has unknown HIV status
 * HIV.D.DE38: On ART | Client is currently taking ART
 * HIV.D.DE954: TB preventive treatment (TPT) start date | The date on which the client began taking TPT
 * HIV.D.DE1017: Eligible for TB preventive treatment | Client is eligible for tuberculosis preventive treatment (TPT)
 * HIV.D.DE1028: TPT regimen type | Type of TPT regimen the client is currently on
 * HIV.D.DE1029: 3HP | The client's current TPT regimen is 3HP
 * HIV.D.DE1030: 1HP | The client's current TPT regimen is 1HP
 * HIV.D.DE1031: 6H | The client's current TPT regimen is 6H
 * HIV.D.DE1032: Six months of levofloxacin daily | The client's current TPT regimen is six months of levofloxacin daily
 * HIV.D.DE1033: Other TB preventive treatment (TPT) regimen | The client's current TPT regimen is another regimen than those listed above
 * HIV.H.DE47: On ART | Client is currently taking ART 
 *
 * Additional Context
 * - what it measures: This indicator measures the extent to which people on ART initiated treatment for latent TB infection.
 * - rationale: • TB preventive treatment (TPT) is a critical component of preventing TB-related morbidity and mortality among people living with HIV. | • In the wake of recent high-level global commitments and targets, this is a critical period to track the progress that countries have made in scaling up TPT coverage.
 * - method: For the numerator: Programme records (for example, ART registers) | For the denominator: Formula for determining the number of ART patients who are eligible for TPT during the reporting period | Number of people living with HIV on ART at end of last reporting period | minus | Number of notified HIV-positive TB patients in last reporting period | also minus, where possible | Number of people living with HIV who previously received TPT – actual, if available, or based on country estimate | also minus, where possible number/estimate of people living with HIV not eligible for TPT due to co-morbidities, including active hepatitis, chronic alcoholism and/or neuropathy
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

library HIVIND44Logic

// Included Libraries
using FHIR version '4.0.1'

include HIVCommon called HIC
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
 * Definition: Number of ART patients who initiated TPT during the reporting period
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True AND "TB preventive treatment (TPT) start date" in the reporting period
 */

define "Numerator":
 HIE."Has HIV-positive Status" and HIE."On ART" and exists(HIE."TB preventive treatment TPT start date in measurement period")

/**
 * Denominator
 *
 * Definition: Number of ART patients who are eligible for TPT during the reporting period
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True at end of last reporting period AND "Eligible for TB preventive treatment"=True
 */

define "Denominator":
 HIE."Has HIV-positive Status" and HIE."On ART" and HIE."Eligible for TB preventive treatment"
    

/* end Populations */

/*
 * Disaggregations:
 *  • Gender (female, male, other*) 
 *  • Age (0–4, 5–9, 10–14, 15–19, 20–24, 25–29, 30–34, 35–39, 40–44, 45–49, 50+ years)** 
 *  • Type of TPT regimen 
 *  • Cities and other administrative regions of epidemiologic importance
 */

define "Administrative Gender Stratifier":
	HIE."By Administrative Gender Stratifier"

define "Age Stratifier":
  HIE."By Age Stratifier"

define "TPT Regimen Type Stratifier":
  HIE."TPT regimen type"

define "Geographic Region Stratifier":
  HIE."By Geographic Region Stratifier"

/*
 * Combined stratifiers
 */
define "Stratification":
  HIE."By Administrative Gender Stratifier".code 
    + ':' + HIE."By Age Stratifier"
    + ':' + Combine(HIE."TPT regimen type".coding.code)
	  + ':' + HIE."By Geographic Region Stratifier"
