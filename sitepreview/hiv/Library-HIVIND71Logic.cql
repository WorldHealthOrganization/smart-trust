/**
 * Library: HIV.IND.71 Logic
 * Ref No: STI.4B
 * Short Name: Gonorrhoea testing coverage, HIV-positive clients
 *
 * Definition: % of people living with HIV tested for gonorrhoea during the reporting period
 *
 * Numerator: Number of people living with HIV tested for gonorrhoea (using a molecular test, culture or POC test) while attending HIV care and treatment services
 * Numerator Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "Gonorrhoea test date" in the reporting period
 * Numerator Exclusions: 
 *
 * Denominator: Number of people living with HIV attending HIV care and treatment services during the reporting period
 * Denominator Calculation: COUNT of clients with "HIV status"='HIV-positive' with a "Visit date" in reporting period
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Gender (female, male, other*) 
 *  • Age (15–19, 20–24, 25–29, 30–49, 50+ years) 
 *  • Key populations (men who have sex with men, people living in prisons and other closed settings, people who inject drugs, sex workers, trans and gender diverse people)** 
 *  • Diagnostic test used and anatomic site sampled 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Gender | Age | Key population member type | Type of specimen | Neisseria gonorrhoeae test type
 *
 * Numerator and Denominator Elements:
 * Gonorrhoea test date 
 *  HIV status 
 *  Visit date
 *
 * Reference: Consolidated guidelines on person-centred HIV strategic information: strengthening routine data for impact. Geneva: World Health Organization; 2022
 * 
 * Data Concepts:
 * HIV.A.DE3: Visit date | The date and time of the client's visit
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
 * HIV.B.DE261: Type of specimen | Type of specimen to be collected
 * HIV.B.DE262: Blood | Blood specimen to be collected
 * HIV.B.DE263: Urine | Urine specimen to be collected
 * HIV.B.DE264: Cervical or vaginal swab | Cervical or vaginal swab to be collected
 * HIV.B.DE265: Urethral or penile swab | Urethral or penile swab to be collected
 * HIV.B.DE266: Rectal swab | Rectal swab to be collected
 * HIV.B.DE267: Other | Other specimen type to be collected
 * HIV.B.DE276: Neisseria gonorrhoeae test type | Type of diagnostic test used for Neisseria gonorrhoeae
 * HIV.B.DE277: NAAT | Nucleic Acid Amplification Test (NAAT) used
 * HIV.B.DE278: POC Test | Point-of-care (POC) test used
 * HIV.B.DE279: Culture | Culture test used
 * HIV.B.DE280: Microscopy | Microscopy test used
 * HIV.B.DE281: Other | Other type of test used
 * HIV.D.DE807: Gonorrhoea test date | Date of Gonorrhoea test
 * HIV.D.DE813: Type of specimen | Type of specimen to be collected
 * HIV.D.DE814: Blood | Blood specimen to be collected
 * HIV.D.DE815: Urine | Urine specimen to be collected
 * HIV.D.DE816: Cervical or vaginal swab | Cervical or vaginal swab to be collected
 * HIV.D.DE817: Urethral or penile swab | Urethral or penile swab to be collected
 * HIV.D.DE818: Rectal swab | Rectal swab to be collected
 * HIV.D.DE819: Other | Other specimen type to be collected
 * HIV.D.DE828: Neisseria gonorrhoeae test type | Type of diagnostic test used for Neisseria gonorrhoeae
 * HIV.D.DE829: NAAT | Nucleic Acid Amplification Test (NAAT) used
 * HIV.D.DE830: POC Test | Point-of-care (POC) test used
 * HIV.D.DE831: Culture | Culture test used
 * HIV.D.DE832: Microscopy | Microscopy test used
 * HIV.D.DE833: Other | Other type of test used
 * HIV.E.DE114: Key population member type* | The type of key population that the infant's mother is included in
 * HIV.E.DE115: Sex worker | Infant's mother is a sex worker
 * HIV.E.DE116: People who inject drugs | Infant's mother is a person who injects drugs
 * HIV.E.DE117: Trans and gender-diverse people | Infant's mother identifies as trans and gender-diverse
 * HIV.E.DE118: People living in prisons and other closed setting | Infant's mother is in a prison or closed setting
 * HIV.SRV.DE15: Visit date | The date and time of the client's visit
 *
 * Additional Context
 * - what it measures: A: % of people attending HIV prevention services who were tested for gonorrhoea | (molecular test, culture or POC test) during the reporting period | B: % of people living with HIV who were tested for gonorrhoea (using a molecular test, culture or POC test) during the reporting period
 * - rationale: • Infection with an acute bacterial sexually transmitted infection such as gonorrhoea is a marker of unprotected sexual intercourse and facilitates HIV transmission and acquisition. | • Measuring the burden of gonorrhoea among people living with HIV and among populations at risk of HIV can help national planners determine the resources needed to address both diseases. | • Testing for gonorrhoea identifies individuals who would benefit from treatment. | • Testing coverage measures progress towards scaling up screening/testing and can be used to assess whether national screening guidelines are being followed.
 * - method: Individual-level data obtained from programme records.   |  | If individual-level data are not available, the indicator can be reported using aggregate programme data. If aggregate data are used and it is not possible to exclude individuals who are tested more than once during the reporting period, the testing coverage estimates will be inflated.
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

 /*
  * Profiles:
  * - HivGonorhoeaTest
  * - HivStatusObservation
  * - HivStatusCondition
  */ 

library HIVIND71Logic

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
 * Definition: Number of people living with HIV tested for gonorrhoea (using a molecular test, culture or POC test) while attending HIV care and treatment services
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "Gonorrhoea test date" in the reporting period
 */

define "Numerator":
  HIE."Has HIV-positive Status" and
  exists(HIE."Gonorrhoea test result B.DE256")


/**
 * Denominator
 *
 * Definition: Number of people living with HIV attending HIV care and treatment services during the reporting period
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' with a "Visit date" in reporting period
 */

define "Denominator":
  HIE."Has HIV-positive Status" and 
  exists(HIE."Visit date")
    

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

define "Neisseria gonorrhoeae test type B.DE276":
  HIE."Neisseria gonorrhoeae test type B.DE276"

define "Type of specimen B.DE261":
  HIE."Type of specimen B.DE261"

define "Stratification":
 HIE."By Administrative Gender Stratifier".code 
  + ':' + HIE."By Age Stratifier 9"
+ ':' + HIE."By Geographic Region Stratifier"
+ Combine(HIE.patientGroups, ':')
+ ':' + HIE."Neisseria gonorrhoeae test type B.DE276".code 
+ ':' + HIE."Type of specimen B.DE261".code 
