/**
 * Library: HIV.IND.4 Logic
 * Ref No: PRV.4
 * Short Name: Volume of PrEP prescribed
 *
 * Definition: Total volume of PrEP product prescribed
 *
 * Numerator: The total sum of the volume of PrEP product prescribed for each PrEP recipient during the reporting period
 * Numerator Calculation: SUM of "Number of days prescribed" for all clients with "Medications prescribed"='PrEP for HIV prevention'
 * Numerator Exclusions: 
 *
 * Denominator: 1
 * Denominator Calculation: 1
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Gender (female, male, other*) 
 *  • Age (15–19, 20–24, 25–49, 50+ years) 
 *  • Key populations (men who have sex with men, people living in prisons and other closed settings, people who inject drugs, sex workers, trans and gender diverse people)** 
 *  • PrEP product and formulation (oral, long-acting device, long-acting injectable) 
 *  • Provider type (key population-led or community-led organization, public sector provider, other entities such as private for-profit and not-for-profit organizations, including faith- based, international, nongovernmental) 
 *  • Setting: facility-based service (including hospitals, health clinics, general practice offices, etc.) or community-based service (including drop-in centres, community service delivery points, mobile clinics or vans, outreach teams, community support groups, etc.) 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Gender | Age | Key population member type | PrEP product prescribed
 *
 * Numerator and Denominator Elements:
 * Medications prescribed 
 *  Number of days prescribed
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
 * HIV.C.DE75: Medications prescribed | Medications the client was prescribed
 * HIV.C.DE76: PrEP for HIV prevention | Client was prescribed pre-exposure prophylaxis (PrEP) for HIV prevention
 * HIV.C.DE77: PEP for HIV prevention | Client was prescribed post-exposure prophylaxis (PEP) for HIV prevention
 * HIV.C.DE78: Other | Client was prescribed other medications
 * HIV.C.DE80: PrEP product prescribed | PrEP product that the client was prescribed
 * HIV.C.DE81: Oral PrEP | Client was prescribed oral PrEP
 * HIV.C.DE82: Dapivirine vaginal ring (DVR) | Client was prescribed dapivirine vaginal ring (DVR)
 * HIV.C.DE83: CAB-LA | Client was prescribed long-acting cabotegravir (CAB-LA)
 * HIV.C.DE84: Other | Client was prescribed other PrEP product
 * HIV.C.DE121: Number of days prescribed | Days of medication client has been prescribed
 * HIV.D.DE457: Medications prescribed | Name or regimen code of all other medications prescribed during the visit
 * HIV.E.DE114: Key population member type* | The type of key population that the infant's mother is included in
 * HIV.E.DE115: Sex worker | Infant's mother is a sex worker
 * HIV.E.DE116: People who inject drugs | Infant's mother is a person who injects drugs
 * HIV.E.DE117: Trans and gender-diverse people | Infant's mother identifies as trans and gender-diverse
 * HIV.E.DE118: People living in prisons and other closed setting | Infant's mother is in a prison or closed setting
 * HIV.PRV.DE28: Number of days prescribed | Days of medication client has been prescribed
 *
 * Additional Context
 * - what it measures: The total volume of PrEP product prescribed can be used to forecast future commodity needs.
 * - rationale: The total volume of PrEP product prescribed or dispensed can be used to calculate the total number of days (or months/years) available for product use, which can be used derive indicators examining the level of PrEP provided relative to need.
 * - method: Individual-level data obtained from programme records. Either the volume of PrEP prescribed or the volume of product dispensed can be used if this is available, for example from pharmacy data. |  | The total volume of PrEP product prescribed (or dispensed) can then be used to derive the total number of days (or months/years) of product use based on the duration of HIV prevention provided by each unit of product. Such an indicator could be described, for example, as | the number of person-years of PrEP protection provided. This measure can then be used to examine the level of PrEP availability to monitor trends and for modelling the impact of PrEP at the population level. It can also be used to derive the following additional indicators useful for understanding the quantity of PrEP product available relative to need: |  | a) numerator:total number of days available for product use; denominator: total number of PrEP recipients | b) numerator:total number of days available for product use; denominator: estimates of the total number of people who would benefit from PrEP
 * 
 * Suggested Scoring Method: continuous-variable | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/cv-measure-cqfm
 * 
 * Profiles:
 * - HivPrepTreatment
 * - HivPepTreatment (4 types)
 */

library HIVIND4Logic

// Included Libraries
using FHIR version '4.0.1'

include HIVCommon version '0.0.1' called HIC
include FHIRHelpers version '4.0.1'
//
include WHOCommon called WCom

include HIVElements called HE
include HIVIndicatorElements called HIE

// Indicator Definition
parameter "Measurement Period" Interval<Date> default Interval[@2023-01-01, @2023-01-30]

context Patient
define "Measure Population":
   Sum(
    (
      collapse (HE."PREP Prescription" MR
      return HIC."Prescription Relevant Period"( MR ) intersect "Measurement Period"
      )
    ) PREPUseInterval
      return days between start of PREPUseInterval and end of PREPUseInterval
  )

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

//provider type not provided?

define "Stratification":
 HIE."By Administrative Gender Stratifier".code 
  + ':' + HIE."By Age Stratifier 3"
+ ':' + HIE."By Geographic Region Stratifier"
+ Combine(HIE.patientGroups, ':') 
 + ':' + HIE."setting".code
+ Combine(HIE.prep_product, ':')
