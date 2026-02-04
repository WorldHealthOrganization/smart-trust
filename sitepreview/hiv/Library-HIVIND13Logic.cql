/**
 * Library: HIV.IND.13 Logic
 * Ref No: PRV.13
 * Short Name: OAMT minimum duration
 *
 * Definition: % of OAMT recipients who received treatment for at least six months
 *
 * Numerator: Number of people in cohort retained in OAMT for at least six months
 * Numerator Calculation: COUNT of clients within cohort "Retained on OAMT"=True 6 months after "Date OAMT initiated"
 * Numerator Exclusions: 
 *
 * Denominator: Number of people starting OAMT during defined cohort recruitment period
 * Denominator Calculation: COUNT of clients within cohort with "Date OAMT initiated" in cohort recruitment period
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Gender (female, male, other*) 
 *  • Age (15–19, 20–24, 25–49, 50+ years) 
 *  • Provider type (key population-led or community-led organization, public sector provider, other entities such as private for-profit and not-for-profit organizations, including faith-based, international, nongovernmental) 
 *  • Setting: facility-based service (including hospitals, health clinics, general practice offices, etc.) or community-based service (including drop-in centres, community service delivery points, mobile clinics or vans, outreach teams, community support groups, etc.) 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Gender | Age
 *
 * Numerator and Denominator Elements:
 * Date OAMT initiated 
 *  Retained on OAMT
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
 * HIV.PRV.DE17: Date OAMT initiated | Date client initiated opioid agonist maintenance treatment (OAMT)
 * HIV.PRV.DE21: Retained on OAMT | Client is retained on opioid agonist maintenance treatment (OAMT) at reporting date, defined according to country/program to account for medication dispensed and LTFU criterion
 *
 * Additional Context
 * - what it measures: This indicator uses a cohort analysis to measure the proportion of OAMT recipients retained on treatment for at least six months and is a measure of how OAMT is prescribed and of retention in the OAMT programme.
 * - rationale: Evidence demonstrates that maximum benefit from OAMT is gained when treatment lasts at least six months.
 * - method: Individual-level data obtained from programme records
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 
 * Profiles: HivOamtTreatment
 
 */

library HIVIND13Logic

// Included Libraries
using FHIR version '4.0.1'

include HIVCommon version '0.0.1' called HIC
include FHIRHelpers version '4.0.1'
include WHOCommon called WCom

include HIVIndicatorElements called HIE
include HIVElements called HE

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
 * Definition: Number of people in cohort retained in OAMT for at least six months
 * Calculation: COUNT of clients within cohort "Retained on OAMT"=True 6 months after "Date OAMT initiated"
 */

define "Numerator":
  exists(HE."OAMT" t where t starts during "Measurement Period" and t ends after (end of "Measurement Period" + 6 months))


/**
 * Denominator
 *
 * Definition: Number of people starting OAMT during defined cohort recruitment period
 * Calculation: COUNT of clients within cohort with "Date OAMT initiated" in cohort recruitment period
 */

define "Denominator":
  HIE.OAMT
    

/* end Populations */

/*
 * Disaggregators
 */

define "Administrative Gender Stratifier":
	HIE."By Administrative Gender Stratifier"

define "Age Stratifier":
	HIE."By Age Stratifier 3"

define "Geographic Region Stratifier":
	HIE."By Geographic Region Stratifier"

define "Setting":
    HIE."setting"

//provider type not provided?

define "Stratification":
 HIE."By Administrative Gender Stratifier".code 
  + ':' + HIE."By Age Stratifier 3"
+ ':' + HIE."By Geographic Region Stratifier"
 + ':' + HIE."setting".code
