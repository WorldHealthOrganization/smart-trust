/**
 * Library: HIV.IND.85 Logic
 * Ref No: HEP.3A
 * Short Name: HBsAg positivity, HIV prevention services
 *
 * Definition: Percentage of people attending HIV prevention services who were tested for HBsAg and had a positive HBsAg test during the reporting period
 *
 * Numerator: Number of people attending HIV prevention services who tested positive for HBsAg during the reporting period
 * Numerator Calculation: COUNT of clients with "HBsAg test date" on a "Date accessed HIV prevention intervention" in the reporting period AND "HBsAg test result"='HBsAg positive'
 * Numerator Exclusions: 
 *
 * Denominator: Number of people attending HIV prevention services who were tested for HBsAg during the reporting period
 * Denominator Calculation: COUNT of clients with "HBsAg test date" on a "Date accessed HIV prevention intervention" in the reporting period
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Gender (female, male, other*) 
 *  • Age (15–19, 20–24, 25–29, 30–49, 50+ years) 
 *  • HIV status (HIV-positive, HIV-negative, unknown status) 
 *  • Key populations (men who have sex with men, people living in prisons and other closed settings, people who inject drugs, sex workers, trans and gender diverse people)** 
 *  • Provider type (key population-led or community-led organization, public-sector provider, other entities such as private for-profit and not-for-profit organizations, including faith-based, international, nongovernmental) 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Gender | Age | HIV status | Key population member type
 *
 * Numerator and Denominator Elements:
 * Date accessed HIV prevention intervention 
 *  HBsAg test date 
 *  HBsAg test result
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
 * HIV.D.DE161: HBsAg test date | Date client was tested for hepatitis B virus (HBV)
 * HIV.D.DE162: HBsAg test result | Hepatitis B virus test result (HBsAg)
 * HIV.D.DE163: Positive | HBsAg test result was positive
 * HIV.D.DE164: Negative | HBsAg test result was negative
 * HIV.D.DE165: Indeterminate | HBsAg test result was indeterminate
 * HIV.E.DE114: Key population member type* | The type of key population that the infant's mother is included in
 * HIV.E.DE115: Sex worker | Infant's mother is a sex worker
 * HIV.E.DE116: People who inject drugs | Infant's mother is a person who injects drugs
 * HIV.E.DE117: Trans and gender-diverse people | Infant's mother identifies as trans and gender-diverse
 * HIV.E.DE118: People living in prisons and other closed setting | Infant's mother is in a prison or closed setting
 * HIV.G.DE17: HBsAg test date | Date client was tested for hepatitis B virus (HBV)
 * HIV.G.DE18: HBsAg test result | Hepatitis B virus test result (HBsAg)
 * HIV.G.DE19: Positive | HBsAg test result was positive
 * HIV.G.DE20: Negative | HBsAg test result was negative
 * HIV.G.DE21: Indeterminate | HBsAg test result was indeterminate
 * HIV.PRV.DE10: Date accessed HIV prevention intervention | Date the client accessed HIV prevention intervention
 *
 * Additional Context
 * - what it measures: A: % of people attending HIV prevention services who were tested for HBsAg and had a positive HBsAg test result during the reporting period (laboratory-based test or rapid test) | B: % of people living with HIV who were tested for HBsAg and had a positive HBsAg test result during the reporting period (laboratory-based test or rapid test) | C: % of pregnant women who were tested for HBsAg and had a positive HBsAg test result during the reporting period (laboratory-based test or rapid test)
 * - rationale: • Testing for HBV identifies HIV and HBV co-infection so that HIV treatment regimens can be adjusted to treat chronic hepatitis B infection as well. | • The HBsAg positivity rate in ANC attendees can be used to monitor the prevalence of HBV in the population and give an indication of the HBV burden.
 * - method: Patient monitoring tools (electronic or paper), for example, hepatitis and HIV testing service records, lab registers, logbooks and reporting forms at facility and community levels, EMR/electronic information systems
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 * 
 * Profiles:
 * - HivStatus
 * - HivHbsAgTest
 */

library HIVIND85Logic

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
 * Definition: Number of people attending HIV prevention services who tested positive for HBsAg during the reporting period
 * Calculation: COUNT of clients with "HBsAg test date" on a "Date accessed HIV prevention intervention" in the reporting period AND "HBsAg test result"='HBsAg positive'
 */

define "Numerator":
  exists(HE."Positive D.DE163" G
  with HE."HBsAg test date D.DE161" P
  such that G.partOf.references(P) and P.performed.toInterval() during "Measurement Period"
  and exists (HE."Date accessed HIV prevention intervention" t where t = start of P.performed.toInterval()))


/**
 * Denominator
 *
 * Definition: Number of people attending HIV prevention services who were tested for HBsAg during the reporting period
 * Calculation: COUNT of clients with "HBsAg test date" on a "Date accessed HIV prevention intervention" in the reporting period
 */

define "Denominator":
  exists(HE."HBsAg test date D.DE161" P
    where P.performed.toInterval() during "Measurement Period" 
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

//add Provider type 