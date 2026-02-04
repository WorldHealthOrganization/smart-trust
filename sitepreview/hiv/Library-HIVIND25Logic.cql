/**
 * Library: HIV.IND.25 Logic
 * Ref No: HTS.8
 * Short Name: HIV retesting coverage
 *
 * Definition: % of people testing HIV-negative who tested again within a defined period of time after their previous test
 *
 * Numerator: Number of individuals who tested HIV-negative assessed to be at elevated risk for HIV acquisition who had another HIV test within a defined period after previous test.
 * Numerator Calculation: COUNT of clients with "At elevated risk for HIV acquisition"=True AND with a second "HIV test date" within fixed period after "HIV test date" in the reporting period with "HIV test result"='HIV-negative'
 * Numerator Exclusions: 
 *
 * Denominator: Number of people assessed as being at elevated risk for HIV acquisition (includes people requesting/receiving any HIV prevention intervention, people from key populations, people with known risk factors or those assessed as being at risk of HIV acquisition) who received an HIV-negative test result in the reporting period.
 * Denominator Calculation: COUNT of clients with "At elevated risk for HIV acquisition"=True AND with an "HIV test date" in the reporting period with "HIV test result"='HIV-negative'
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Gender (female, male, other*) 
 *  • Age (<15, 15–19, 20–24, 25–49, 50+ years)** 
 *  • Key populations (men who have sex with men, people living in prisons and other closed settings, people who inject drugs, sex workers, trans and gender diverse people)*** 
 *  • Provider type (key population-led or community-led organization, public sector provider, other entities such as private for-profit and not-for-profit organizations, including faith-based, international, nongovernmental) 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Gender | Age | Key population member type
 *
 * Numerator and Denominator Elements:
 * At elevated risk for HIV acquisition 
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
 * HIV.B.DE110: HIV test date | Date of the HIV test
 * HIV.B.DE111: HIV test result | The result from HIV testing after applying the testing algorithm
 * HIV.B.DE112: HIV-positive | Test result is HIV-positive
 * HIV.B.DE113: HIV-negative | Test result is HIV-negative
 * HIV.B.DE114: HIV-inconclusive | Test result is HIV-inconclusive
 * HIV.B.DE225: At elevated risk for HIV acquisition | Client is at elevated risk for HIV acquisition
 * HIV.E.DE114: Key population member type* | The type of key population that the infant's mother is included in
 * HIV.E.DE115: Sex worker | Infant's mother is a sex worker
 * HIV.E.DE116: People who inject drugs | Infant's mother is a person who injects drugs
 * HIV.E.DE117: Trans and gender-diverse people | Infant's mother identifies as trans and gender-diverse
 * HIV.E.DE118: People living in prisons and other closed setting | Infant's mother is in a prison or closed setting
 * HIV.E.DE224: HIV test date | Date of the HIV test
 * HIV.PRV.DE1: At elevated risk for HIV acquisition | Client is at elevated risk for HIV acquisition, defined according to country/programme context
 * HIV.SRV.DE1: HIV test date | Date of the HIV test
 * HIV.SRV.DE2: HIV test result | The result from HIV testing after applying the testing algorithm
 *
 * Additional Context
 * - what it measures: This indicator measures the rate of retesting for HIV among those at ongoing risk of HIV acquisition.
 * - rationale: For those individuals who test negative for HIV but are at ongoing risk of HIV acquisition, retesting is encouraged. The recommended frequency of re-testing will differ for different groups in different settings. The level of retesting examined by this indicator should aligned with national recommendations.
 * - method: Individual-level data obtained from programme records
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

library HIVIND25Logic

// Included Libraries
using FHIR version '4.0.1'

include HIVCommon version '0.0.1' called HIC
include FHIRHelpers version '4.0.1'
include WHOCommon called WCom
include HIVConfig called Config
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
 * Definition: Number of individuals who tested HIV-negative assessed to be at elevated risk for HIV acquisition who had another HIV test within a defined period after previous test.
 * Calculation: COUNT of clients with "At elevated risk for HIV acquisition"=True AND with a second "HIV test date" within fixed period after "HIV test date" in the reporting period with "HIV test result"='HIV-negative'
 */

define "Numerator":
  exists(HIE."Negative Tests after First Negative Test")


/**
 * Denominator
 *
 * Definition: Number of people assessed as being at elevated risk for HIV acquisition (includes people requesting/receiving any HIV prevention intervention, people from key populations, people with known risk factors or those assessed as being at risk of HIV acquisition) who received an HIV-negative test result in the reporting period.
 * Calculation: COUNT of clients with "At elevated risk for HIV acquisition"=True AND with an "HIV test date" in the reporting period with "HIV test result"='HIV-negative'
 */

define "Denominator":
  exists(HIE."Negative Tests within Measurement Period")
    

/* end Populations */


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

define "Stratification":
 HIE."By Administrative Gender Stratifier".code 
 + ':' + HIE."HIV status of partner or contact".code
  + ':' + HIE."By Age Stratifier 2"
+ ':' + HIE."By Geographic Region Stratifier"
+ Combine(HIE.patientGroups, ':')