/**
 * Library: HIV.IND.11 Logic
 * Ref No: PRV.11
 * Short Name: OAMT coverage
 *
 * Definition: % of opioid dependent people receiving opioid agonist maintenance treatment (OAMT) at a specified date
 *
 * Numerator: Number of people on OAMT at specified census date
 * Numerator Calculation: Number of clients with "Key population member type"='People who inject drugs' AND "Currently on OAMT"=True for a specific "Reporting date"
 * Numerator Exclusions: 
 *
 * Denominator: a) Programme/service provider level: number of opioid dependent people accessing service | b) Population level: population size estimate of opioid dependent people in relevant geographic area
 * Denominator Calculation: Programme/service provider level: | COUNT of opioid dependent people accessing service |  | Population level:  | *Estimated population size of opioid dependent people in relevant geographic area
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Gender (female, male, other*) 
 *  • Age (<25, 25+ years) 
 *  • Provider type (key population-led or community-led organization, public sector provider, other entities such as private for-profit and not-for-profit organizations, including faith-based, international, nongovernmental) 
 *  • Setting: facility-based service (including hospitals, health clinics, general practice offices, etc.) or community-based service (including drop-in centres, community service delivery points, mobile clinics or vans, outreach teams, community support groups, etc.) 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Gender | Age (<25, 25+ years)
 *
 * Numerator and Denominator Elements:
 * Currently on OAMT 
 *  Key population member type 
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
 * HIV.B.DE50: Key population member type* | The type of key population that the client is included in
 * HIV.B.DE51: Sex worker | Client is a sex worker
 * HIV.B.DE52: Men who have sex with men | Client is a man who has sex with men
 * HIV.B.DE53: Trans and gender-diverse people | Client identifies as trans and gender-diverse
 * HIV.B.DE54: People who inject drugs | Client is a person who injects drugs
 * HIV.B.DE55: People living in prisons and other closed settings | Client lives in a prison or another closed setting
 * HIV.E.DE114: Key population member type* | The type of key population that the infant's mother is included in
 * HIV.E.DE115: Sex worker | Infant's mother is a sex worker
 * HIV.E.DE116: People who inject drugs | Infant's mother is a person who injects drugs
 * HIV.E.DE117: Trans and gender-diverse people | Infant's mother identifies as trans and gender-diverse
 * HIV.E.DE118: People living in prisons and other closed setting | Infant's mother is in a prison or closed setting
 * HIV.PRV.DE20: Currently on OAMT | Client is currently on opioid agonist maintenance treatment (OAMT) at reporting date, defined according to country/program to account for medication dispensed and LTFU criterion
 * HIV.Config.DE22: Reporting date | Reporting date, for surveys performed on a specific date
 *
 * Additional Context
 * - what it measures: Measure of the coverage of OAMT among people who are opioid dependent. Measured at either the service provider or population level.
 * - rationale: By providing a direct method of reducing the number of injection risk acts per person who inject drugs, OAMT is a critical component of effective harm reduction services.
 * - method: Individual-level data obtained from programme records. |  | The total population of people who are opioid dependent includes both people who inject drugs as well as people who consume opioids by other routes of administration. Not all OAMT recipients will have a history of injecting and not all people who inject drugs will use or be dependent on opioids.
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 * 
 * Profiles:
 * - Key Population Member Type
 * - OAMT Treatment Status
 */

library HIVIND11Logic

// Included Libraries
using FHIR version '4.0.1'

include HIVCommon version '0.0.1' called HIC
include FHIRHelpers version '4.0.1'

include HIVElements called HE
include HIVIndicatorElements called HIE

include WHOCommon called WCom

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
 * Definition: Number of people on OAMT at specified census date
 * Calculation: Number of clients with "Key population member type"='People who inject drugs' AND "Currently on OAMT"=True for a specific "Reporting date"
 */

define "Numerator":
  HIE."People who inject drugs" and HIE."Currently on OAMT"

/**
 * Denominator
 *
 * Definition: a) Programme/service provider level: number of opioid dependent people accessing service | b) Population level: population size estimate of opioid dependent people in relevant geographic area
 * Calculation: Programme/service provider level: | COUNT of opioid dependent people accessing service |  | Population level:  | *Estimated population size of opioid dependent people in relevant geographic area
 */

define "Denominator":
  HE."HIV prevention intervention" and HIE."People who inject drugs"
    

/* end Populations */


/*
 * Disaggregators
 */

define "Administrative Gender Stratifier":
	HIE."By Administrative Gender Stratifier"

define "Age Stratifier":
	HIE."By Age Stratifier 4"

define "Geographic Region Stratifier":
	HIE."By Geographic Region Stratifier"

define "Setting":
    HIE."setting"

//provider type not provided?

define "Stratification":
 HIE."By Administrative Gender Stratifier".code 
  + ':' + HIE."By Age Stratifier 4"
+ ':' + HIE."By Geographic Region Stratifier"
 + ':' + HIE."setting".code