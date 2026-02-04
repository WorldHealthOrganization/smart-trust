/**
 * Library: HIV.IND.32 Logic
 * Ref No: ART.6
 * Short Name: Viral load testing coverage
 *
 * Definition: % of people living with HIV on ART (for at least six months) with viral load test results
 *
 * Numerator: Number of people living with HIV on ART with at least one routine VL test result during the reporting period
 * Numerator Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True AND "ART start date" GREATER THAN 6 months before reporting period end date AND "Date viral load test results received by client" within reporting period AND "Reason for HIV viral load test"='Routine viral load test'
 * Numerator Exclusions: Exclude clients with an "HIV treatment outcome" IN 'Lost to follow up', 'Transferred out', 'Death (documented)'
 *
 * Denominator: Number of people living with HIV on ART for at least six months
 * Denominator Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True AND "ART start date" GREATER THAN 6 months before reporting period end date
 * Denominator Exclusions: Exclude clients with an "HIV treatment outcome" IN 'Lost to follow up', 'Transferred out', 'Death (documented)'
 *
 * Disaggregations:
 * • Gender (female, male, other*) 
 *  • Age (0–4, 5–9, 10–14, 15–19, 20–24, 25–49, 50+ years)** 
 *  • Key populations (men who have sex with men, people living in prisons and other closed settings, people who inject drugs, sex workers, trans and gender diverse people)*** 
 *  • Other priority populations 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Gender | Age | Key population member type | Other priority populations
 *
 * Numerator and Denominator Elements:
 * ART start date 
 *  Date viral load test results received by client 
 *  HIV status 
 *  On ART 
 *  Reason for HIV viral load test
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
 * HIV.B.DE72: ART start date | The date on which the client started or restarted antiretroviral therapy (ART)
 * HIV.B.DE115: HIV status | HIV status reported after applying the national HIV testing algorithm. No single HIV test can provide an HIV-positive diagnosis.
 * HIV.B.DE116: HIV-positive | Client is HIV-positive
 * HIV.B.DE117: HIV-negative | Client is HIV-negative
 * HIV.B.DE118: Unknown | Client has unknown HIV status
 * HIV.D.DE38: On ART | Client is currently taking ART
 * HIV.D.DE39: ART start date | The date on which the client started or restarted ART
 * HIV.D.DE193: Date viral load test results received by client | The date on which the client received results from viral load test
 * HIV.D.DE391: Reason for HIV viral load test | Whether the viral load is being tested for routine monitoring on a set schedule or for targeted monitoring for suspected treatment failure
 * HIV.D.DE392: Routine viral load test | Routine refers to viral load tests obtained at standard intervals following ART initiation to monitor viral load response to ART
 * HIV.D.DE393: Targeted viral load monitoring | Targeted refers to viral load tests obtained based on a specific clinical indication (such as concern about disease progression or failure to respond to ART)
 * HIV.D.DE394: Initial viral load test | The first viral load test of the client
 * HIV.D.DE395: Follow-up viral load test after receiving enhanced adherence counselling | A follow-up viral load test within 3-6 months after enhanced adherence counselling after client received a high viral load test result
 * HIV.D.DE417: Date viral load test results received by client | The date on which the client received results from a viral load test
 * HIV.E.DE114: Key population member type* | The type of key population that the infant's mother is included in
 * HIV.E.DE115: Sex worker | Infant's mother is a sex worker
 * HIV.E.DE116: People who inject drugs | Infant's mother is a person who injects drugs
 * HIV.E.DE117: Trans and gender-diverse people | Infant's mother identifies as trans and gender-diverse
 * HIV.E.DE118: People living in prisons and other closed setting | Infant's mother is in a prison or closed setting
 * HIV.H.DE47: On ART | Client is currently taking ART 
 * HIV.SRV.DE6: ART start date | The date on which the client started or restarted antiretroviral therapy (ART)
 * HIV.Config.DE19: Other priority populations | Other populations of priority of HIV prevention and care in local context (provided during adaptation)
 *
 * Additional Context
 * - what it measures: Assesses the extent to which VL testing is available in the country and enables appropriate interpretation of VL suppression data. This indicator is essential for monitoring access to viral load testing as well as the interpretation of the indicator ART.3 PLHIV on ART who have suppressed viral load and its representativeness.
 * - rationale: • WHO recommends routine VL testing at six months and 12 months after ART initiation and every 12 months thereafter. | • Many countries are still in the process of scaling up VL testing capacity. | • This indicator is critical to decide whether VL suppression as measured through routine data is likely to be representative of all patients on ART.
 * - method: For the numerator and denominator: Patient monitoring tools (for example, patient records/EMRs, ART register, cohort reporting forms, laboratory information system) |  | It is critical to de-duplicate records and avoid double-counting when identifying the appropriate numerator. The denominator excludes patients who have died, transferred to another facility or been classified as lost to follow-up.
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

library HIVIND32Logic

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
 * Definition: Number of people living with HIV on ART with at least one routine VL test result during the reporting period
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True AND "ART start date" GREATER THAN 6 months before reporting period end date AND "Date viral load test results received by client" within reporting period AND "Reason for HIV viral load test"='Routine viral load test'
 */

define "Numerator":
  HIE."Has HIV-positive Status"
  and HIE."On ART H.DE47"
  and 
   (months between (end of "Measurement Period") and (date from start of HE."First On ART".effective.toInterval()) > 6 months)
   and 
   exists(
    HE."Date viral load test results received by client D.DE193" VL
    with HE."routine viral load sample collection" P 
    such that VL.partOf.references(P)
    where VL.issued.toInterval() during "Measurement Period"
    )

/**
 * Numerator Exclusions
 *
 * Calculation: Exclude clients with an "HIV treatment outcome" IN 'Lost to follow up', 'Transferred out', 'Death (documented)'
 */
    
define "Numerator Exclusions":
  HIE."Has death documented"
   or HIE."Has transferred out"
   or HIE."Is lost to follow-up"

/**
 * Denominator
 *
 * Definition: Number of people living with HIV on ART for at least six months
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True AND "ART start date" GREATER THAN 6 months before reporting period end date
 */

define "Denominator":
 HIE."Has HIV-positive Status"
  and HIE."On ART H.DE47"
  and 
   (months between (end of "Measurement Period") and (date from start of HE."First On ART".effective.toInterval()) > 6 months)
    
/**
* Denominator Exclusions
*
* Calculation: Exclude clients with an "HIV treatment outcome" IN 'Lost to follow up', 'Transferred out', 'Death (documented)'
*/

define "Denominator Exclusions":
  HIE."Has death documented"
   and HIE."Has transferred out"
   and HIE."Is lost to follow-up"

/* end Populations */

/*
 * Disaggregators
 */

define "Administrative Gender Stratifier":
	HIE."By Administrative Gender Stratifier"

define "Age Stratifier 2":
	HIE."By Age Stratifier 2"

define "Geographic Region Stratifier":
	HIE."By Geographic Region Stratifier"

define "patientGroups Stratifier":
	HIE."patientGroups"

define "Stratification":
 HIE."By Administrative Gender Stratifier".code 
  + ':' + HIE."By Age Stratifier 2"
+ ':' + HIE."By Geographic Region Stratifier"
+ Combine(HIE.patientGroups, ':')
