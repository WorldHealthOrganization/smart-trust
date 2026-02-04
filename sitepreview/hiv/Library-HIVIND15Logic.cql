/**
 * Library: HIV.IND.15 Logic
 * Ref No: PRV.15
 * Short Name: VMMC scale-up
 *
 * Definition: Total number of voluntary medical male circumcisions (VMMCs) performed according to national standard during the reporting period
 *
 * Numerator: Total number of people undergoing VMMC performed according to national standard during the reporting period
 * Numerator Calculation: COUNT of clients with a "VMMC procedure date" in the reporting period
 * Numerator Exclusions: 
 *
 * Denominator: 1
 * Denominator Calculation: 1
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Age (0–4, 5–9, 10–14, 15–19, 20–24, 25–49, 50+ years) 
 *  • HIV status (positive, negative) 
 *  • Provider type (key population-led or community-led organization, public sector provider, other entities such as private for-profit and not-for-profit organizations, including faith- based, international, nongovernmental) 
 *  • Setting: facility-based service (including hospitals, health clinics, general practice offices, etc.) or community-based service (including drop-in centres, community service delivery points, mobile clinics or vans, outreach teams, community support groups, etc.) 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Age | HIV status
 *
 * Numerator and Denominator Elements:
 * VMMC procedure date
 *
 * Reference: Consolidated guidelines on person-centred HIV strategic information: strengthening routine data for impact. Geneva: World Health Organization; 2022
 * 
 * Data Concepts:
 * HIV.A.DE17: Age | Calculated age (number of years) of the client based on date of birth
 * HIV.B.DE115: HIV status | HIV status reported after applying the national HIV testing algorithm. No single HIV test can provide an HIV-positive diagnosis.
 * HIV.B.DE116: HIV-positive | Client is HIV-positive
 * HIV.B.DE117: HIV-negative | Client is HIV-negative
 * HIV.B.DE118: Unknown | Client has unknown HIV status
 * HIV.B.DE198: VMMC procedure date | Date on which a voluntary medical male circumcision procedure was performed
 *
 * Additional Context
 * - what it measures: This indicator measures progress in scaling up male circumcision services.
 * - rationale: WHO and UNAIDS recommend VMMC as an efficacious intervention for HIV prevention in priority* countries and regions with high HIV prevalence and low male circumcision prevalence. |  | Randomized controlled trials have shown that VMMC provided by trained health professionals with proper equipment can reduce the risk of men heterosexually acquiring HIV infection.
 * - method: Individual-level data obtained from programme records (for example, VMMC registers).   |  | The recommended reporting period is 12 months.
 * 
 * Suggested Scoring Method: continuous-variable | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/cv-measure-cqfm
 */

library HIVIND15Logic

// Included Libraries
using FHIR version '4.0.1'

include HIVCommon version '0.0.1' called HIC
include FHIRHelpers version '4.0.1'
include WHOCommon called WCom

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
 * Measure Population
 *
 * Definition: Total number of people undergoing VMMC performed according to national standard during the reporting period
 * Calculation: Total number of people undergoing VMMC performed according to national standard during the reporting period
 */
                                                       
define "Measure Population":
  HIE."VMMC"

/**
 * Measure Observation
 * Definition: Total number of people undergoing VMMC performed according to national standard during the reporting period
 * Calculation: Total number of people undergoing VMMC performed according to national standard during the reporting period                                                      
 */     

define function "Measure Observation"(Patient "Patient"):
  1
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

define "Setting":
    HIE."setting"

define "HIV Status":
    HIE."HIV Status Stratifier"

//provider type not provided?

define "Stratification":
 HIE."By Administrative Gender Stratifier".code 
  + ':' + HIE."By Age Stratifier 2"
+ ':' + HIE."By Geographic Region Stratifier"
 + ':' + HIE."setting".code
+ ':' + HIE."HIV Status Stratifier".code 