/**
 * Library: HIV.IND.2 Logic
 * Ref No: PRV.2
 * Short Name: Total PrEP recipients
 *
 * Definition: Number of people who received PrEP at least once during the reporting period
 *
 * Numerator: Number of people prescribed or dispensed any form of PrEP at least once during the reporting period. Individuals prescribed different PrEP products or regimens at different times during the reporting period should be counted only once.
 * Numerator Calculation: COUNT of clients with "Medications prescribed"='PrEP for HIV prevention' with "Date medications prescribed" in the reporting period
 * Numerator Exclusions: 
 *
 * Denominator: 1
 * Denominator Calculation: 1
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Age (15–19, 20–24, 25–49, 50+ years) 
 *  • Gender (female, male, other*) 
 *  • Key populations (men who have sex with men, people living in prisons and other closed settings, people who inject drugs, sex workers, trans and gender diverse people)** 
 *  • PrEP product and formulation (oral, long-acting device, long-acting injectable). Some people may start, continue, stop and restart, one or multiple times with different products or formulations in a given reporting period. Because of this, the percentages of recipients receiving different PrEP products may total more than 100%. 
 *  • Experience with PrEP (first time, continuing, or restarting following a period of not 
 *  taking PrEP) 
 *  • Provider type (key population-led or community-led organization, public sector provider, other entities such as private for-profit and not-for-profit organizations, including faith- based, international, nongovernmental) 
 *  • Setting: facility-based service (including hospitals, health clinics, general practice offices, etc.) or community-based service (including drop-in centres, community service delivery points, mobile clinics or vans, outreach teams, community support groups, etc.) 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Gender | Age | Key population member type | PrEP product prescribed | PrEP dosing type | Experience with PrEP
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
 * HIV.C.DE11: PrEP dosing type | Way in which pre-exposure prophylaxis (PrEP) is taken (daily or event-driven)
 * HIV.C.DE12: Daily oral PrEP | Pre-exposure prophylaxis (PrEP) is taken every day
 * HIV.C.DE13: Event-driven PrEP (2+1+1) | Event-driven pre-exposure prophylaxis (PrEP) is taken on an even-driven basis (2+1+1)
 * HIV.C.DE14: Other PrEP dosing type | Other PrEP dosing type
 * HIV.C.DE24: Experience with PrEP | The client's experience in taking PrEP
 * HIV.C.DE25: First-time user | The client has never used pre-exposure prophylaxis (PrEP) before (naive)
 * HIV.C.DE26: Continuing user | The client has used PrEP before and is continuing to use PrEP
 * HIV.C.DE27: Restarting following a period of not taking PrEP | The client is restarting PrEP following a period of not taking PrEP
 * HIV.C.DE74: Date medications prescribed | Date the client was prescribed medications
 * HIV.C.DE75: Medications prescribed | Medications the client was prescribed
 * HIV.C.DE76: PrEP for HIV prevention | Client was prescribed pre-exposure prophylaxis (PrEP) for HIV prevention
 * HIV.C.DE77: PEP for HIV prevention | Client was prescribed post-exposure prophylaxis (PEP) for HIV prevention
 * HIV.C.DE78: Other | Client was prescribed other medications
 * HIV.C.DE80: PrEP product prescribed | PrEP product that the client was prescribed
 * HIV.C.DE81: Oral PrEP | Client was prescribed oral PrEP
 * HIV.C.DE82: Dapivirine vaginal ring (DVR) | Client was prescribed dapivirine vaginal ring (DVR)
 * HIV.C.DE83: CAB-LA | Client was prescribed long-acting cabotegravir (CAB-LA)
 * HIV.C.DE84: Other | Client was prescribed other PrEP product
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
 * - what it measures: This indicator measures the number of people receiving any PrEP product during the reporting period, including people starting PrEP for the first time, restarting PrEP, continuing PrEP or switching from one PrEP product to another.
 * - rationale: • The use of ARV medicines by people who are HIV-negative before they are exposed to HIV can prevent HIV infection. | • Through disaggregation, this indicator can help managers compare the uptake and use of PrEP among different types of users (for example, by first-time users, and members of priority populations).
 * - method: Individual-level data obtained from programme records. |  | If individual-level data are not available, the indicator can be reported using aggregate programme data. Because de-duplication is not possible, individuals prescribed multiple | PrEP products or formulations at different times during the reporting period maybe counted multiple times, and the number reported may be greater than the number of unique individuals receiving PrEP during the reporting period.
 * 
 * Suggested Scoring Method: continuous-variable | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/cv-measure-cqfm
 */

/**
 * Profiles:
 * - HivPrepTreatment
 * - HivCurrentPrepRegimenPrescription
 * - 
 */

library HIVIND2Logic

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
   HIE."PrEP for HIV prevention"

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

define "Setting":
  HIE."setting"

define "prep product":
  HIE."prep_product"

define "prep_experience":
  HIE."prep_experience"

define "prep_dosing":
  HIE."prep_dosing"

// Provider type concepts are not found in DD

define "Stratification":
 HIE."By Administrative Gender Stratifier".code 
  + ':' + HIE."By Age Stratifier 3"
+ ':' + HIE."By Geographic Region Stratifier"
+ Combine(HIE.patientGroups, ':')
 + ':' + HIE."setting".code
+ Combine(HIE.prep_product, ':')
+ Combine(HIE.prep_experience, ':')
+ Combine(HIE.prep_dosing, ':')