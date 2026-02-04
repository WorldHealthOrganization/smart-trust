/**
 * Library: HIV.IND.5 Logic
 * Ref No: PRV.5
 * Short Name: Number of PEP recipients
 *
 * Definition: Number of people prescribed PEP during the reporting period
 *
 * Numerator: Number of people prescribed PEP during the reporting period
 * Numerator Calculation: COUNT of clients with "Medications prescribed"='PEP for HIV prevention' AND "Date medications prescribed" within the reporting period
 * Numerator Exclusions: 
 *
 * Denominator: 1
 * Denominator Calculation: 1
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Gender (female, male, other*) 
 *  • Age (15-19, 20-24, 25-49, 50+ years) 
 *  • Key populations (men who have sex with men, people living in prisons and other closed settings, people who inject drugs, sex workers, trans and gender diverse people)2 
 *  • Exposure type (occupational, non-occupational violent, non-occupational consensual sex) 
 *  • Provider type (key population-led or community-led organization, public sector provider, other entities such as private for-profit and not-for-profit organizations, including faith-based, international, nongovernmental) 
 *  • Setting: facility-based service (including hospitals, health clinics, general practice offices, etc.) or community-based service (including drop-in centres, community service delivery points, mobile clinics or vans, outreach teams, community support groups, etc.) 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Gender | Age | Key population member type | HIV exposure type
 *
 * Numerator and Denominator Elements:
 * Date medications prescribed 
 *  Medications prescribed
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
 * HIV.B.DE61: HIV exposure type* | Ways in which the client was exposed to HIV
 * HIV.B.DE62: Occupational | Occupational exposure to HIV
 * HIV.B.DE63: Non-occupational violent | Non-occupational violent exposure to HIV
 * HIV.B.DE64: Non-occupational consensual sex | Exposure to HIV through non-occupational consensual sex
 * HIV.C.DE74: Date medications prescribed | Date the client was prescribed medications
 * HIV.C.DE75: Medications prescribed | Medications the client was prescribed
 * HIV.C.DE76: PrEP for HIV prevention | Client was prescribed pre-exposure prophylaxis (PrEP) for HIV prevention
 * HIV.C.DE77: PEP for HIV prevention | Client was prescribed post-exposure prophylaxis (PEP) for HIV prevention
 * HIV.C.DE78: Other | Client was prescribed other medications
 * HIV.D.DE457: Medications prescribed | Name or regimen code of all other medications prescribed during the visit
 * HIV.D.DE458: Date medications prescribed | Date the medications were prescribed
 * HIV.E.DE114: Key population member type* | The type of key population that the infant's mother is included in
 * HIV.E.DE115: Sex worker | Infant's mother is a sex worker
 * HIV.E.DE116: People who inject drugs | Infant's mother is a person who injects drugs
 * HIV.E.DE117: Trans and gender-diverse people | Infant's mother identifies as trans and gender-diverse
 * HIV.E.DE118: People living in prisons and other closed setting | Infant's mother is in a prison or closed setting
 * HIV.PRV.DE27: Date medications prescribed | Date the client was prescribed medications
 *
 * Additional Context
 * - what it measures: Measure of total number of individuals receiving PEP in a defined period.
 * - rationale: PEP should be offered and initiated as early as possible for all individuals with an exposure that has the potential for HIV transmission, preferably within 72 hours.
 * - method: Individual-level data obtained from programme records
 * 
 * Suggested Scoring Method: continuous-variable | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/cv-measure-cqfm
 */

library HIVIND5Logic

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
define "Measure Population":
  HIE."PEP for HIV prevention"

/*
 * As defined by Member States
 */
define "Initial Population":
  true

/*
 * NOTE: Modeled as a Continuous Variable measure because this is an estimated denominator proportion measure
 */

define function "Measure Observation"(Patient "Patient"):
  1

/*
 * Disaggregators
 */

define "Administrative Gender Stratifier":
	HIE."By Administrative Gender Stratifier"

define "Age Stratifier":
	HIE."By Age Stratifier 3"

define "Geographic Region Stratifier":
	HIE."By Geographic Region Stratifier"

define "patientGroups Stratifier":
	HIE."patientGroups"

define "prep product":
    HIE."prep_product"

define "Setting":
    HIE."setting"

define "hiv_exposure_type":
    HIE."hiv_exposure_type"

//provider type not provided?

define "Stratification":
 HIE."By Administrative Gender Stratifier".code 
  + ':' + HIE."By Age Stratifier 3"
+ ':' + HIE."By Geographic Region Stratifier"
+ Combine(HIE.patientGroups, ':')
 + ':' + HIE."setting".code
+ Combine(HIE.prep_product, ':')
+ Combine(HIE."hiv_exposure_type", ':')
