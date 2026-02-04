/**
 * Library: HIV.IND.66 Logic
 * Ref No: STI.3A
 * Short Name: Syphilis treatment coverage, HIV prevention services
 *
 * Definition: % of people attending HIV prevention services tested positive for syphilis who were treated based on national guidelines during the reporting period
 *
 * Numerator: Number of people attending HIV prevention services who tested positive for syphilis and were treated based on national guidelines during the reporting period
 * Numerator Calculation: COUNT of clients with "Syphilis test date" in the reporting period AND "Syphilis test result"='Positive' AND "Syphilis treatment start date" in the reporting period
 * Numerator Exclusions: 
 *
 * Denominator: Number of people attending HIV prevention services who tested positive for syphilis during the reporting period
 * Denominator Calculation: COUNT of clients with "Syphilis test date" on "Date accessed HIV prevention intervention" in the reporting period AND "Syphilis test result"='Positive'
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Gender (female, male, other*) 
 *  • Age (15–19, 20–24, 25–29, 30–49, 50+ years) 
 *  • Key populations (men who have sex with men, people living in prisons and other closed settings, people who inject drugs, sex workers, trans and gender diverse people)** 
 *  • HIV status (HIV-positive, HIV-negative, unknown status) 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Gender | Age | Key population member type | HIV status | HIV prevention intervention
 *
 * Numerator and Denominator Elements:
 * Date accessed HIV prevention intervention 
 *  Syphilis test date 
 *  Syphilis test result 
 *  Syphilis treatment start date
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
 * HIV.B.DE249: Syphilis test date | Date of syphilis test
 * HIV.B.DE250: Syphilis test result | Result from syphilis test
 * HIV.B.DE251: Positive | Test result is positive for syphilis
 * HIV.B.DE252: Negative | Test result is negative for syphilis
 * HIV.B.DE253: Inconclusive | Test result is inconclusive
 * HIV.B.DE254: Syphilis treatment start date | Date of initiation of syphilis treatment
 * HIV.D.DE801: Syphilis test date | Date of syphilis test
 * HIV.D.DE802: Syphilis test result | Result from syphilis test
 * HIV.D.DE803: Positive | Test result is positive for syphilis
 * HIV.D.DE804: Negative | Test result is negative for syphilis
 * HIV.D.DE805: Inconclusive | Test result is inconclusive
 * HIV.D.DE806: Syphilis treatment start date | Date of initiation of syphilis treatment
 * HIV.E.DE114: Key population member type* | The type of key population that the infant's mother is included in
 * HIV.E.DE115: Sex worker | Infant's mother is a sex worker
 * HIV.E.DE116: People who inject drugs | Infant's mother is a person who injects drugs
 * HIV.E.DE117: Trans and gender-diverse people | Infant's mother identifies as trans and gender-diverse
 * HIV.E.DE118: People living in prisons and other closed setting | Infant's mother is in a prison or closed setting
 * HIV.G.DE69: Syphilis test date | Date of syphilis test
 * HIV.G.DE70: Syphilis test result | Result from syphilis test
 * HIV.G.DE71: Positive | Test result is positive for syphilis
 * HIV.G.DE72: Negative | Test result is negative for syphilis
 * HIV.G.DE73: Inconclusive | Test result is inconclusive
 * HIV.PRV.DE2: HIV prevention intervention | HIV prevention intervention that client accessed
 * HIV.PRV.DE3: PrEP service | Client accessed PrEP services
 * HIV.PRV.DE4: OAMT | Client accessed opioid agonist maintenance treatment (OAMT) services
 * HIV.PRV.DE5: NSP | Client accessed needle-syringe programme (NSP) services
 * HIV.PRV.DE6: STI services | Client accessed sexually transmitted infection (STI) services
 * HIV.PRV.DE7: VMMC | Client accessed voluntary medical male circumcision (VMMC) services
 * HIV.PRV.DE8: Other | Client accessed other HIV prevention services
 * HIV.PRV.DE10: Date accessed HIV prevention intervention | Date the client accessed HIV prevention intervention
 *
 * Additional Context
 * - what it measures: A: % of people attending HIV prevention services who tested positive for syphilis and | were treated based on national guidelines during the reporting period | B: % of people living with HIV who tested positive for syphilis and were treated based on national guidelines during the reporting period | C: % of pregnant women who tested positive for syphilis and were treated based on national guidelines during the reporting period
 * - rationale: Prompt treatment of individuals positive for syphilis is important for improving their health and reducing sexual and vertical transmission of syphilis.
 * - method: Individual-level data obtained from programme records.   |  | If individual-level data are not available, the indicator can be reported using aggregate programme data.
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

library HIVIND66Logic

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
 * Definition: Number of people attending HIV prevention services who tested positive for syphilis and were treated based on national guidelines during the reporting period
 * Calculation: COUNT of clients with "Syphilis test date" in the reporting period AND "Syphilis test result"='Positive' AND "Syphilis treatment start date" in the reporting period
 */

define "Numerator":
  exists(HE."Positive B.DE251" S
  with HE."Syphilis test date B.DE249" P
  such that S.partOf.references(P) and P.performed.toInterval() during "Measurement Period")
  and HIE."Syphilis treatment start date B.DE254"


/**
 * Denominator
 *
 * Definition: Number of people attending HIV prevention services who tested positive for syphilis during the reporting period
 * Calculation: COUNT of clients with "Syphilis test date" on "Date accessed HIV prevention intervention" in the reporting period AND "Syphilis test result"='Positive'
 */

define "Denominator":
  exists(HE."Positive B.DE251" S
  with HE."Syphilis test date B.DE249" P
  such that S.partOf.references(P) and P.performed.toInterval() during "Measurement Period"
  and exists (HE."Date accessed HIV prevention intervention" t where t = start of P.performed.toInterval()))
    

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

define "HIV Status":
  HIE."HIV Status Stratifier"

define "Stratification":
 HIE."By Administrative Gender Stratifier".code 
  + ':' + HIE."By Age Stratifier 9"
+ ':' + HIE."By Geographic Region Stratifier"
+ Combine(HIE.patientGroups, ':')
+ ':' + HIE."HIV Status Stratifier".code 

