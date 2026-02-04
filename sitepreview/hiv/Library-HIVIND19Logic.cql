/**
 * Library: HIV.IND.19 Logic
 * Ref No: HTS.2
 * Short Name: HTS test volume and positivity
 *
 * Definition: Number of HIV tests performed (volume) and the % of HIV-positive results returned to people (positivity)
 *
 * Numerator: Number of tests conducted in which a new HIV-positive result or diagnosis was returned to a person during the reporting period (positivity)
 * Numerator Calculation: COUNT of tests with "HIV test result"='HIV-positive' AND (("Date HIV test results returned" in the reporting period) OR ("HIV diagnosis date" in the reporting period))
 * Numerator Exclusions: Self-testing
 *
 * Denominator: Number of tests performed where results were returned to a person during the reporting period (testing volume)
 * Denominator Calculation: COUNT of tests with "HIV test date" AND "Date HIV test results returned" in the reporting period
 * Denominator Exclusions: Self-testing
 *
 * Disaggregations:
 * • Gender (female, male, other*) 
 *  • Age (0–4, 5–9, 10–14, 15–19, 20–24, 25–29, 30–34, 35–39, 40–44, 45–49, 50+ years)** 
 *  • Key populations (men who have sex with men, people living in prisons and other closed settings, people who inject drugs, sex workers, trans and gender diverse people)*** 
 *  • TB status (presumptive TB, diagnosed TB, none) 
 *  • Testing entry point: 
 *  - Facility-level testing: Provider-initiated testing and counselling in clinics or emergency facilities, ANC clinics (including labour and delivery), voluntary counselling and testing (within a health facility setting), family planning clinics (only in high HIV burden settings), TB clinics, other facility-level testing 
 *  - Community-level testing: Mobile testing (for example, through vans or temporary testing facilities), voluntary counselling and testing centres (not within a health facility setting), other community-based testing. 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Gender | Age | Key population member type | TB diagnosis result | Presumptive TB
 *
 * Numerator and Denominator Elements:
 * Date HIV test results returned 
 *  HIV diagnosis date 
 *  HIV test date 
 *  HIV test result
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
 * HIV.B.DE60: Date HIV test results returned | Date HIV test result returned to client
 * HIV.B.DE71: HIV diagnosis date | Date diagnosis was returned to client
 * HIV.B.DE110: HIV test date | Date of the HIV test
 * HIV.B.DE111: HIV test result | The result from HIV testing after applying the testing algorithm
 * HIV.B.DE112: HIV-positive | Test result is HIV-positive
 * HIV.B.DE113: HIV-negative | Test result is HIV-negative
 * HIV.B.DE114: HIV-inconclusive | Test result is HIV-inconclusive
 * HIV.D.DE282: Presumptive TB | Client's comorbidities or coinfections or symptoms of these include presumptive TB
 * HIV.D.DE939: TB diagnosis result | Final result of the TB investigation (bacteriological and/or clinical)
 * HIV.D.DE940: Diagnosed TB | Client is diagnosed with TB disease
 * HIV.D.DE941: TB excluded | Client is not diagnosed with TB
 * HIV.D.DE945: Presumptive TB | Client has signs or symptoms of tuberculosis (TB) without laboratory confirmation
 * HIV.E.DE114: Key population member type* | The type of key population that the infant's mother is included in
 * HIV.E.DE115: Sex worker | Infant's mother is a sex worker
 * HIV.E.DE116: People who inject drugs | Infant's mother is a person who injects drugs
 * HIV.E.DE117: Trans and gender-diverse people | Infant's mother identifies as trans and gender-diverse
 * HIV.E.DE118: People living in prisons and other closed setting | Infant's mother is in a prison or closed setting
 * HIV.E.DE224: HIV test date | Date of the HIV test
 * HIV.SRV.DE1: HIV test date | Date of the HIV test
 * HIV.SRV.DE2: HIV test result | The result from HIV testing after applying the testing algorithm
 *
 * Additional Context
 * - what it measures: This indicator measures HIV test volume and positivity across service delivery approaches and populations.
 * - rationale: • Knowledge of HIV status is the entry point for people living with HIV to treatment and the continuum of care, and for those who test HIV-negative and remain at risk to prevention interventions. | • Testing volume disaggregated by age, sex, testing approach and HIV status helps to assess the gaps among various settings, contexts and populations and better target service delivery.
 * - method: For the numerator and denominator: Patient monitoring tools, for example, HIV testing service records, HTS or lab registers, logbooks and reporting forms at facility and community levels or EMRs. Reported data should be a count of the number of tests conducted and their results were returned to a person and not the number of unique persons who tested during the reporting period. The method of measurement intends to prevent double counting when multiple assays are used to confirm an HIV-positive diagnosis according to the national testing algorithm. This indicator does not include self-testing.
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

library HIVIND19Logic

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
/*
 * As defined by Member State
 */
define "Initial Population":
  true
  
define "numerator":
	Count(HIE."Non-Self HIV test date and results returned within measurement period for HIV-positive result")

define "denominator":
	Count(HIE."Non-Self HIV test with date and results returned in measurement period")



/*
 * Disaggregators
 */
 
define "Administrative Gender Stratifier":
	HIE."By Administrative Gender Stratifier"

define "Age Stratifier":
	HIE."By Age Stratifier"

define "Geographic Region Stratifier":
	HIE."By Geographic Region Stratifier"

define "patientGroups Stratifier":
	HIE."patientGroups"

define "Setting":
    HIE."setting"

 define "TB Stratifier":
     HIE."tb"

define "Stratification":
 HIE."By Administrative Gender Stratifier".code 
  + ':' + HIE."By Age Stratifier"
+ ':' + HIE."By Geographic Region Stratifier"
+ Combine(HIE.patientGroups, ':')
 + ':' + HIE."setting".code
+ ':' + HIE."tb".code
