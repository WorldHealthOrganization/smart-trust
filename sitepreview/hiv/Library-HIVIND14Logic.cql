/**
 * Library: HIV.IND.14 Logic
 * Ref No: PRV.14
 * Short Name: OAMT minimum dose
 *
 * Definition: % of OAMT recipients receiving a maintenance dose greater than or equal to the recommended minimum dose
 *
 * Numerator: Number of people, at a specified date, maintained on methadone or buprenorphine receiving recommended minimum maintenance dose (WHO guidance recommends doses of ≥60 mg of methadone or ≥8 mg of buprenorphine*)
 * Numerator Calculation: COUNT of clients with ("Medications prescribed"='Methadone' AND "Dose of medications prescribed" GREATER THAN OR EQUAL TO 60mg) OR ("Medications prescribed"='Buprenorphine' AND "Dose of medications prescribed" GREATER THAN OR EQUAL TO 8mg) for a specified "Reporting date"
 * Numerator Exclusions: "Client being inducted on OAMT" OR "Client on reducing doses of OAMT"
 *
 * Denominator: Number of people receiving maintenance dose of methadone or buprenorphine at a specified date, excluding: a) individuals currently being inducted on OAMT and yet to reach the maintenance dose and b) individuals on reducing doses of OAMT.
 * Denominator Calculation: COUNT of clients with "Medications prescribed" IN 'Methadone', 'Buprenorphine' for a specified "Reporting date"
 * Denominator Exclusions: "Client being inducted on OAMT" OR "Client on reducing doses of OAMT"
 *
 * Disaggregations:
 * • Gender (female, male, other**) 
 *  • Age (15–19, 20–24, 25–49, 50+ years) 
 *  • Provider type (key population-led or community-led organization, public sector provider, other entities such as private for-profit and not-for-profit organizations, including faith-based, international, nongovernmental) 
 *  • Setting: facility-based service (including hospitals, health clinics, general practice offices, etc.) or community-based service (including drop-in centres, community service delivery points, mobile clinics or vans, outreach teams, community support groups, etc.) 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Gender | Age
 *
 * Numerator and Denominator Elements:
 * Dose of medications prescribed 
 *  Medications prescribed 
 *  Reporting date
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
 * HIV.C.DE75: Medications prescribed | Medications the client was prescribed
 * HIV.C.DE76: PrEP for HIV prevention | Client was prescribed pre-exposure prophylaxis (PrEP) for HIV prevention
 * HIV.C.DE77: PEP for HIV prevention | Client was prescribed post-exposure prophylaxis (PEP) for HIV prevention
 * HIV.C.DE78: Other | Client was prescribed other medications
 * HIV.D.DE457: Medications prescribed | Name or regimen code of all other medications prescribed during the visit
 * HIV.D.DE459: Dose of medications prescribed | Number of doses (quantity taken at a single point in time) of drugs prescribed/dispensed
 * HIV.Config.DE22: Reporting date | Reporting date, for surveys performed on a specific date
 *
 * Additional Context
 * - what it measures: Measures the proportion of OAMT recipients receiving the recommended minimum maintenance dose.
 * - rationale: Evidence demonstrates that maximum benefit from OAMT is gained when individuals receive at least the recommended minimum maintenance dose.
 * - method: Individual-level data obtained from programme records
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 
 * Profiles: HivTreatmentMedicationRequest, HivOamtEpisodeOfCare
 */

library HIVIND14Logic

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
 * Definition: Number of people, at a specified date, maintained on methadone or buprenorphine receiving recommended minimum maintenance dose (WHO guidance recommends doses of ≥60 mg of methadone or ≥8 mg of buprenorphine*)
 * Calculation: COUNT of clients with ("Medications prescribed"='Methadone' AND "Dose of medications prescribed" GREATER THAN OR EQUAL TO 60mg) OR ("Medications prescribed"='Buprenorphine' AND "Dose of medications prescribed" GREATER THAN OR EQUAL TO 8mg) for a specified "Reporting date"
 */

define "Numerator":
  First(HIE."Methadone D.DE555").dailyDose() >= System.Quantity{ value: 60, unit: 'mg' }
  or First(HIE."Buprenorphine D.DE552").dailyDose() >= System.Quantity{ value: 8, unit: 'mg' }

/**
 * Numerator Exclusions
 *
 * Calculation: "Client being inducted on OAMT" OR "Client on reducing doses of OAMT"
 */
    
define "Numerator Exclusions":
  HIE."Client being inducted on OAMT" or HIE."Client on reducing doses of OAMT"

/**
 * Denominator
 *
 * Definition: Number of people receiving maintenance dose of methadone or buprenorphine at a specified date, excluding: a) individuals currently being inducted on OAMT and yet to reach the maintenance dose and b) individuals on reducing doses of OAMT.
 * Calculation: COUNT of clients with "Medications prescribed" IN 'Methadone', 'Buprenorphine' for a specified "Reporting date"
 */

define "Denominator":
  Exists(HIE."Methadone D.DE555") or Exists(HIE."Buprenorphine D.DE552")
    
/**
* Denominator Exclusions
*
* Calculation: "Client being inducted on OAMT" OR "Client on reducing doses of OAMT"
*/

define "Denominator Exclusions":
  HIE."Client being inducted on OAMT" or HIE."Client on reducing doses of OAMT"

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