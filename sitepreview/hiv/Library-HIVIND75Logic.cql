/**
 * Library: HIV.IND.75 Logic
 * Ref No: STI.6B
 * Short Name: Gonorrhoea treatment coverage, HIV-positive clients
 *
 * Definition: % of people living with HIV tested positive for gonorrhoea who were treated based on national guidelines during the reporting period
 *
 * Numerator: Number of people living with HIV who tested positive for gonorrhoea and were treated based on national guidelines during the reporting period
 * Numerator Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "Gonorrhoea test date" in the reporting period AND "Gonorrhoea test result"='Positive' AND "Gonorrhoea treatment start date" in the reporting period
 * Numerator Exclusions: 
 *
 * Denominator: Number of people living with HIV who tested positive for gonorrhoea during the reporting period
 * Denominator Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "Gonorrhoea test date" in the reporting period AND "Gonorrhoea test result"='Positive'
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Gender (male, female, other*) 
 *  • Age (15–19, 20–24, 25–29, 30–49, 50+ years) 
 *  • Key populations (men who have sex with men, people living in prisons and other closed settings, people who inject drugs, sex workers, trans and gender diverse people)** 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Gender | Age | Key population member type
 *
 * Numerator and Denominator Elements:
 * Gonorrhoea test date 
 *  Gonorrhoea test result 
 *  Gonorrhoea treatment start date 
 *  HIV status
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
 * HIV.B.DE115: HIV status | HIV status reported after applying the national HIV testing algorithm. No single HIV test can provide an HIV-positive diagnosis.
 * HIV.B.DE116: HIV-positive | Client is HIV-positive
 * HIV.B.DE117: HIV-negative | Client is HIV-negative
 * HIV.B.DE118: Unknown | Client has unknown HIV status
 * HIV.B.DE255: Gonorrhoea test date | Date of Gonorrhoea test
 * HIV.B.DE256: Gonorrhoea test result | Result from Gonorrhoea test
 * HIV.B.DE257: Positive | Test result is positive for Neisseria gonorrhoeae
 * HIV.B.DE258: Negative | Test result is negative for Neisseria gonorrhoeae
 * HIV.B.DE259: Inconclusive | Test result is inconclusive
 * HIV.B.DE260: Gonorrhoea treatment start date | Date of initiation of Gonorrhoea treatment
 * HIV.D.DE807: Gonorrhoea test date | Date of Gonorrhoea test
 * HIV.D.DE808: Gonorrhoea test result | Result from Gonorrhoea test
 * HIV.D.DE809: Positive | Test result is positive for Neisseria gonorrhoeae
 * HIV.D.DE810: Negative | Test result is negative for Neisseria gonorrhoeae
 * HIV.D.DE811: Inconclusive | Test result is inconclusive
 * HIV.D.DE812: Gonorrhoea treatment start date | Date of initiation of Gonorrhoea treatment
 * HIV.E.DE114: Key population member type* | The type of key population that the infant's mother is included in
 * HIV.E.DE115: Sex worker | Infant's mother is a sex worker
 * HIV.E.DE116: People who inject drugs | Infant's mother is a person who injects drugs
 * HIV.E.DE117: Trans and gender-diverse people | Infant's mother identifies as trans and gender-diverse
 * HIV.E.DE118: People living in prisons and other closed setting | Infant's mother is in a prison or closed setting
 *
 * Additional Context
 * - what it measures: A: % of people attending HIV prevention services who tested positive for gonorrhoea | during the reporting period who were treated based on national guidelines | B: % of people living with HIV who tested positive for gonorrhoea in the reporting period who were treated based on national guidelines
 * - rationale: Prompt treatment of individuals positive for gonorrhoea is important for improving their health and reducing sexual and vertical transmission. Untreated gonorrhoea can result in pelvic inflammatory disease, ectopic pregnancy, infertility, blindness and disseminated disease.
 * - method: Individual-level data obtained from programme records.   |  | If individual-level data are not available, the indicator can be reported using aggregate programme data.
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */


  /*
  * Profiles:
  * - HivGonorrhoeaTest
  * - HivStatusObservation
  * - HivStatusCondition
  * - GonorrhoeaTreatment
  */ 

library HIVIND75Logic

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
 * Definition: Number of people living with HIV who tested positive for gonorrhoea and were treated based on national guidelines during the reporting period
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "Gonorrhoea test date" in the reporting period AND "Gonorrhoea test result"='Positive' AND "Gonorrhoea treatment start date" in the reporting period
 */

define "Numerator":
HIE."Has HIV-positive Status" and
  HIE."Positive B.DE257"
  and HIE."Gonorrhoea treatment start date B.DE260"



/**
 * Denominator
 *
 * Definition: Number of people living with HIV who tested positive for gonorrhoea during the reporting period
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "Gonorrhoea test date" in the reporting period AND "Gonorrhoea test result"='Positive'
 */

define "Denominator":
HIE."Has HIV-positive Status" and
  HIE."Positive B.DE257"

    

/* end Populations */

/*
 * Disaggregators
 */

define "Administrative Gender Stratifier":
	HIE."By Administrative Gender Stratifier"

define "Age Stratifier":
	HIE."By Age Stratifier 9"

define "Geographic Region Stratifier":
	HIE."By Geographic Region Stratifier"

define "patientGroups Stratifier":
	HIE."patientGroups"

define "Stratification":
 HIE."By Administrative Gender Stratifier".code 
  + ':' + HIE."By Age Stratifier 9"
+ ':' + HIE."By Geographic Region Stratifier"
+ Combine(HIE.patientGroups, ':')