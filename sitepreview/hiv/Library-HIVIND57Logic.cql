/**
 * Library: HIV.IND.57 Logic
 * Ref No: DSD.5
 * Short Name: Viral suppression among people living with HIV engaged in DSD ART models
 *
 * Definition: % of people living with HIV engaged in DSD ART models who have virological suppression
 *
 * Numerator: Number of people enrolled in a DSD ART model with at least one routine viral load test during the reporting period who have virological suppression (<1000 copies/mL) at 6 months after ART initiation and yearly thereafter (that is, at 24, 36, 48 and 60 months, etc. after ART initiation).
 * Numerator Calculation: COUNT of clients with "Currently enrolled in DSD ART model"=True AND "Date of viral load sample collection" during the reporting period AND "Reason for HIV viral load test"='Routine viral load test' AND "Viral load test result" LESS THAN 1000 copies/mL
 * Numerator Exclusions: "Date of viral load sample collection" LESS THAN 6 months AFTER "ART start date"
 *
 * Denominator: Number of people enrolled in a DSD ART model with at least one routine viral load result in a medical or laboratory record during the reporting period
 * Denominator Calculation: COUNT of clients with "Currently enrolled in DSD ART model"=True AND "Date of viral load sample collection" during the reporting period AND "Reason for HIV viral load test"='Routine viral load test'
 * Denominator Exclusions: "Date of viral load sample collection" LESS THAN 6 months AFTER "ART start date"
 *
 * Disaggregations:
 * • Gender (female, male, other*) 
 *  • Age (0–4, 5–14, 15–24, 25+ years) 
 *  • Key populations (men who have sex with men, people living in prisons and other closed settings, people who inject drugs, sex workers, trans and gender diverse people)** 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Gender | Age | Key population member type
 *
 * Numerator and Denominator Elements:
 * Currently enrolled in DSD ART model 
 *  Date of viral load sample collection 
 *  Reason for HIV viral load test 
 *  Viral load test result
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
 * HIV.D.DE194: Date of viral load sample collection | Date and time when the sample was collected to test the client's HIV viral load
 * HIV.D.DE387: Viral load test result | Result from the viral load test in number of copies/mL
 * HIV.D.DE391: Reason for HIV viral load test | Whether the viral load is being tested for routine monitoring on a set schedule or for targeted monitoring for suspected treatment failure
 * HIV.D.DE392: Routine viral load test | Routine refers to viral load tests obtained at standard intervals following ART initiation to monitor viral load response to ART
 * HIV.D.DE393: Targeted viral load monitoring | Targeted refers to viral load tests obtained based on a specific clinical indication (such as concern about disease progression or failure to respond to ART)
 * HIV.D.DE394: Initial viral load test | The first viral load test of the client
 * HIV.D.DE395: Follow-up viral load test after receiving enhanced adherence counselling | A follow-up viral load test within 3-6 months after enhanced adherence counselling after client received a high viral load test result
 * HIV.D.DE762: Currently enrolled in DSD ART model | Client currently enrolled in differentiated service delivery (DSD) ART model
 * HIV.E.DE114: Key population member type* | The type of key population that the infant's mother is included in
 * HIV.E.DE115: Sex worker | Infant's mother is a sex worker
 * HIV.E.DE116: People who inject drugs | Infant's mother is a person who injects drugs
 * HIV.E.DE117: Trans and gender-diverse people | Infant's mother identifies as trans and gender-diverse
 * HIV.E.DE118: People living in prisons and other closed setting | Infant's mother is in a prison or closed setting
 * HIV.G.DE8: Date of viral load sample collection | Date and time when the sample was collected to test the client's HIV viral load
 * HIV.G.DE12: Viral load test result | Result from the viral load test in number of copies/mL
 * HIV.SRV.DE12: Date of viral load sample collection | Date and time when the sample was collected to test the client's HIV viral load
 * HIV.SRV.DE13: Viral load test result | Result from the viral load test in number of copies/mL
 *
 * Additional Context
 * - what it measures: Measures HIV viral suppression at six months and 12 months after ART initiation and yearly thereafter among people living with HIV enrolled in DSD ART models |  | This indicator is limited to facilities with electronic health information systems and would be monitored in addition to viral load suppression by ART cohort for all people living with HIV and on ART.
 * - rationale: • Enables monitoring of viral load suppression by cohort of people living with HIV enrolled in DSD models for ART and progress towards the third 95 target | • Viral load suppression is also the best available measure of patient adherence to ART.
 * - method: EMR/electronic information systems |  | Measurement frequency: quarterly where feasible, at least annually
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

library HIVIND57Logic

// Included Libraries
using FHIR version '4.0.1'

include HIVCommon version '0.0.1' called HIC
include FHIRHelpers version '4.0.1'

include WHOCommon called WCom
include HIVElements called HE
include HIVIndicatorElements called HIE
include HIVConfig called Config

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
 * Definition: Number of people enrolled in a DSD ART model with at least one routine viral load test during the reporting period who have virological suppression (<1000 copies/mL) at 6 months after ART initiation and yearly thereafter (that is, at 24, 36, 48 and 60 months, etc. after ART initiation).
 * Calculation: COUNT of clients with "Currently enrolled in DSD ART model"=True AND "Date of viral load sample collection" during the reporting period AND "Reason for HIV viral load test"='Routine viral load test' AND "Viral load test result" LESS THAN 1000 copies/mL
 */

define "Numerator":
  HIE."Currently enrolled in DSD ART model"
   and exists(
    HIE."Viral load test result D.DE387" VL
    with HE."routine viral load sample collection" P 
    such that VL.partOf.references(P) and  P.performed.toInterval() during "Measurement Period"
    where VL.value < 1000
    )

/**
 * Numerator Exclusions
 *
 * Calculation: "Date of viral load sample collection" LESS THAN 6 months AFTER "ART start date"
 */
    
define "Numerator Exclusions":
  HIE."Currently enrolled in DSD ART model"
   and exists(
    HIE."Viral load test result D.DE387" VL
    with HE."routine viral load sample collection" P 
    such that VL.partOf.references(P) and  P.performed.toInterval() during "Measurement Period"
    and months between (start of P.performed.toInterval()) and (date from start of HE."First On ART".effective.toInterval()) < 6 months
    where VL.value < 1000
    )


/**
 * Denominator
 *
 * Definition: Number of people enrolled in a DSD ART model with at least one routine viral load result in a medical or laboratory record during the reporting period
 * Calculation: COUNT of clients with "Currently enrolled in DSD ART model"=True AND "Date of viral load sample collection" during the reporting period AND "Reason for HIV viral load test"='Routine viral load test'
 */

define "Denominator":
  HIE."Currently enrolled in DSD ART model"
   and exists(
    HIE."Viral load test result D.DE387" VL
    with HE."routine viral load sample collection" P 
    such that VL.partOf.references(P) and  P.performed.toInterval() during "Measurement Period"
    )
    
/**
* Denominator Exclusions
*
* Calculation: "Date of viral load sample collection" LESS THAN 6 months AFTER "ART start date"
*/

define "Denominator Exclusions":
  HIE."Currently enrolled in DSD ART model"
   and exists(
    HIE."Viral load test result D.DE387" VL
    with HE."routine viral load sample collection" P 
    such that VL.partOf.references(P) and  P.performed.toInterval() during "Measurement Period"
    and months between (start of P.performed.toInterval()) and (date from start of HE."First On ART".effective.toInterval()) < 6 months
    )

/* end Populations */

/*
 * Disaggregators
 */

define "Administrative Gender Stratifier":
	HIE."By Administrative Gender Stratifier"

define "Age Stratifier":
	HIE."By Age Stratifier 8"

define "Geographic Region Stratifier":
	HIE."By Geographic Region Stratifier"

define "patientGroups Stratifier":
	HIE."patientGroups"

define "Stratification":
 HIE."By Administrative Gender Stratifier".code 
  + ':' + HIE."By Age Stratifier 8"
+ ':' + HIE."By Geographic Region Stratifier"
+ Combine(HIE.patientGroups, ':')
