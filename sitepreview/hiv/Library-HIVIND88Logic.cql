/**
 * Library: HIV.IND.88 Logic
 * Ref No: HEP.4A
 * Short Name: HCV positivity, HIV prevention services
 *
 * Definition: % of people attending HIV prevention services with a positive HCV test result (HCV antibody, HCV RNA (PCR) or HCV core antigen) during the reporting period
 *
 * Numerator: Number of people attending HIV prevention services newly identified with a positive HCV test during the reporting period
 * Numerator Calculation: COUNT of clients with "HCV test date" on a "Date accessed HIV prevention intervention" in the reporting period AND "HCV test result"='HCV positive'
 * Numerator Exclusions: 
 *
 * Denominator: Number of people attending HIV prevention services who were tested for HCV during the reporting period
 * Denominator Calculation: COUNT of clients with "HCV test date" on a "Date accessed HIV prevention intervention" in the reporting period
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Gender (female, male, other**) 
 *  • Age (15–19, 20–24, 25–29, 30–49, 50+ years) 
 *  • HIV status (HIV-positive, HIV-negative, unknown status) 
 *  • Key populations (men who have sex with men, people living in prisons and other closed settings, people who inject drugs, sex workers, trans and gender diverse people)*** 
 *  • Provider type (key population-led or community-led organization, public-sector provider, other entities such as private for-profit and not-for-profit organizations, including faith- based, international, nongovernmental) 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Gender | Age | HIV status | Key population member type
 *
 * Numerator and Denominator Elements:
 * Date accessed HIV prevention intervention 
 *  HCV test date 
 *  HCV test result
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
 * HIV.D.DE169: HCV test date | Date client was tested for hepatitis C virus (HCV antibody, HCV RNA or HCV core antigen)
 * HIV.D.DE170: HCV test result | Hepatitis C virus test result (HCV antibody, HCV RNA or HCV core antigen)
 * HIV.D.DE171: Positive | HCV test result was positive
 * HIV.D.DE172: Negative | HCV test result was negative
 * HIV.D.DE173: Indeterminate | HCV test result was indeterminate
 * HIV.E.DE114: Key population member type* | The type of key population that the infant's mother is included in
 * HIV.E.DE115: Sex worker | Infant's mother is a sex worker
 * HIV.E.DE116: People who inject drugs | Infant's mother is a person who injects drugs
 * HIV.E.DE117: Trans and gender-diverse people | Infant's mother identifies as trans and gender-diverse
 * HIV.E.DE118: People living in prisons and other closed setting | Infant's mother is in a prison or closed setting
 * HIV.G.DE42: HCV test date | Date client was tested for hepatitis C virus (HCV antibody, HCV RNA or HCV core antigen)
 * HIV.G.DE43: HCV test result | Hepatitis C virus test result (HCV antibody, HCV RNA or HCV core antigen)
 * HIV.G.DE44: Positive | HCV test result was positive
 * HIV.G.DE45: Negative | HCV test result was negative
 * HIV.G.DE46: Indeterminate | HCV test result was indeterminate
 * HIV.PRV.DE10: Date accessed HIV prevention intervention | Date the client accessed HIV prevention intervention
 *
 * Additional Context
 * - what it measures: A: % of people attending HIV prevention services who were tested for HCV during the | reporting period (laboratory-based test or rapid test) | B: % of people living with HIV who were tested for HCV during the reporting period (laboratory-based test or rapid test)
 * - rationale: Many people living with HIV and receiving ART die from liver disease resulting from untreated HCV. Testing people living with HIV for HCV identifies HIV and HCV co-infection and allows for adaptation of treatment. Highly effective hepatitis C treatment is newly available; it has a high rate of virus clearance regardless of hepatitis C virus subtype.
 * - method: Patient monitoring tools (electronic or paper), for example, hepatitis testing and HIV service records, lab registers, logbooks and reporting forms at facility and community levels, EMR/ electronic information systems
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

 /* 
  * Profiles:
  * - HivStatus
  * - HivHcvTest
  * - HivPreventionIntervention
  */

library HIVIND88Logic

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
 * Definition: Number of people attending HIV prevention services newly identified with a positive HCV test during the reporting period
 * Calculation: COUNT of clients with "HCV test date" on a "Date accessed HIV prevention intervention" in the reporting period AND "HCV test result"='HCV positive'
 */

define "Numerator":
  exists(HIE."Positive D.DE171" O
  where exists HIE."Date accessed HIV prevention intervention" t where t = start of O.effective.toInterval())


/**
 * Denominator
 *
 * Definition: Number of people attending HIV prevention services who were tested for HCV during the reporting period
 * Calculation: COUNT of clients with "HCV test date" on a "Date accessed HIV prevention intervention" in the reporting period
 */

define "Denominator":
  exists(
    HIE."HCV test result D.DE170" O
    where exists(HIE."Date accessed HIV prevention intervention" t where t = start of O.effective.toInterval()))

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

//add Provider type 