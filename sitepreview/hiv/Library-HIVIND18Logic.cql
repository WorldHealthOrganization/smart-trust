/**
 * Library: HIV.IND.18 Logic
 * Ref No: HTS.1
 * Short Name: People living with HIV who know their HIV status (first 95)
 *
 * Definition: Number and % of people living with HIV who know their HIV status
 *
 * Numerator: Number of people living with HIV who have received their diagnosis and are still alive
 * Numerator Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "Date informed of HIV-positive diagnosis" before reporting period end date
 * Numerator Exclusions: Exclude clients who are lost to follow up, transferred out, died, or refused (stopped) ART
 *
 * Denominator: Estimated number of people living with HIV
 * Denominator Calculation: *Estimated number of people living with HIV
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Gender (female, male, other**) 
 *  • Age (0–4, 5–9, 10–14, 15–19, 20–24, 25–49, 50+ years)*** 
 *  • Key populations (men who have sex with men, people living in prisons and other closed 
 *  settings, people who inject drugs, sex workers, trans and gender diverse people)**** 
 *  • ANC attendees 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Gender | Age | Key population member type | ANC contact date
 *
 * Numerator and Denominator Elements:
 * Date informed of HIV-positive diagnosis 
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
 * HIV.B.DE65: Date informed of HIV-positive diagnosis | The date on which the client was diagnosed with HIV
 * HIV.B.DE115: HIV status | HIV status reported after applying the national HIV testing algorithm. No single HIV test can provide an HIV-positive diagnosis.
 * HIV.B.DE116: HIV-positive | Client is HIV-positive
 * HIV.B.DE117: HIV-negative | Client is HIV-negative
 * HIV.B.DE118: Unknown | Client has unknown HIV status
 * HIV.E.DE85: ANC contact date | The date and time of the client's ANC contact (in the ANC DAK this is called 'Contact date')
 * HIV.E.DE114: Key population member type* | The type of key population that the infant's mother is included in
 * HIV.E.DE115: Sex worker | Infant's mother is a sex worker
 * HIV.E.DE116: People who inject drugs | Infant's mother is a person who injects drugs
 * HIV.E.DE117: Trans and gender-diverse people | Infant's mother identifies as trans and gender-diverse
 * HIV.E.DE118: People living in prisons and other closed setting | Infant's mother is in a prison or closed setting
 * HIV.SRV.DE18: ANC contact date | The date and time of the client's ANC contact (in the ANC DAK this is called 'Contact date')
 *
 * Additional Context
 * - what it measures: This measures the number and percentage of people living with HIV who have been tested and know their HIV status.
 * - rationale: • Knowledge of HIV status is the entry point for people living with HIV to treatment and the continuum of care, and for those who test HIV-negative and remain at elevated risk of HIV acquisition, to prevention interventions. | • Disaggregated estimates can reveal gaps in access to testing among important groups of people living with HIV
 * - method: For the numerator: Best estimate based on available data sources |  | 1. Direct estimates from HIV case surveillance systems of the number of people living with HIV diagnosed with HIV, reported by a surveillance system and who are still alive. HIV case surveillance data can be used if reporting from all facilities providing confirmatory HIV testing and treatment services has been in place since at least 2014 and if people who have died, been lost to follow-up, etc., are removed from the numerator. Only confirmed HIV diagnoses should be counted. Mechanisms should be in place to de-duplicate individuals reported multiple times or from multiple facilities. |  | 2. Modelled estimates, for which the modelling approach depends on the availability of country data. For countries with robust case surveillance and vital registration systems, the number of people who know their HIV status can be derived using the Case Surveillance and Vital Registration (CSAVR) fitting tool in the Spectrum AIDS Impact Module (AIM). For countries with household population survey data that either directly capture the number of HIV-positive respondents who report that they know their status or the number of HIV- positive people who report ever having been tested, UNAIDS recommends (as of 2018) that the first 90 be modelled using the Shiny First 90.*
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

library HIVIND18Logic

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
   HIE."Has HIV-positive Status"
	
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
	HIE."By Age Stratifier 2"

define "Geographic Region Stratifier":
	HIE."By Geographic Region Stratifier"

define "patientGroups Stratifier":
	HIE."patientGroups"

 define "ANC Stratifier":
    HIE."anc"


define "Stratification":
 HIE."By Administrative Gender Stratifier".code 
  + ':' + HIE."By Age Stratifier 2"
+ ':' + HIE."By Geographic Region Stratifier"
+ Combine(HIE.patientGroups, ':')
+ ':' + HIE."anc".code
