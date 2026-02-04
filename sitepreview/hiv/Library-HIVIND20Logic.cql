/**
 * Library: HIV.IND.20 Logic
 * Ref No: HTS.3
 * Short Name: Individuals testing positive for HIV
 *
 * Definition: % testing positive among people who received an HIV test in the reporting period
 *
 * Numerator: Number of people who test HIV-positive in the reporting period and have results returned to them*
 * Numerator Calculation: COUNT of clients with "HIV test result"='HIV-positive' AND "HIV test date" in the reporting period AND (("Date HIV test results returned" in the reporting period) OR ("HIV diagnosis date" in the reporting period))
 * Numerator Exclusions: 
 *
 * Denominator: Number of people receiving an HIV test in the reporting period
 * Denominator Calculation: COUNT of clients with "HIV test date" in the reporting period AND "Date HIV test results returned" in the reporting period
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Gender (female, male, other**) 
 *  • Age (0–4, 5–9, 10–14, 15–19, 20–24, 25–29, 30–34, 35–39, 40–44, 45–49, 50+ years)*** 
 *  • Key populations (men who have sex with men, people living in prisons and other closed settings, people who inject drugs, sex workers, trans and gender diverse people)**** 
 *  • TB status (presumptive TB, diagnosed TB, none) 
 *  • Testing entry point: 
 *  - Facility-level testing: Provider-initiated testing and counselling in clinics or emergency facilities, ANC clinics (including labour and delivery), voluntary counselling and testing (within a health facility setting), family planning clinics (only in high HIV burden settings), TB clinics, other facility-level testing 
 *  - Community-level testing: Mobile testing (for example, through vans or temporary testing facilities), voluntary counselling and testing (VCT) centres (not within a health facility setting), other community-based testing. 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Gender | Age | Key population member type | TB diagnosis result | Presumptive TB | Testing entry point
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
 * HIV.B.DE15: Testing entry point | Whether testing is happening in the community or at a facility
 * HIV.B.DE16: Community-level testing | Testing is happening in the community, which includes mobile testing
 * HIV.B.DE17: Facility-level testing | Testing is happening at a facility
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
 * - what it measures: Measures the proportion of people testing positive for HIV. Individuals receiving more than one HIV test in the reporting period are counted only once in the denominator.
 * - rationale: Knowing the HIV test positivity among individuals by testing approach is critical to understanding the reach of HIV testing services, and the number of people aware of their status and receiving person-centred services.
 * - method: For the numerator and denominator: Patient monitoring tools, for example, HIV testing service records, HTS or lab registers, logbooks and reporting forms at facility and community levels or EMRs
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

library HIVIND20Logic

// Included Libraries
using FHIR version '4.0.1'

include HIVCommon version '0.0.1' called HIC
include FHIRHelpers version '4.0.1'
include WHOCommon called WCom

include HIVIndicatorElements called HIE

// Indicator Definition
parameter "Measurement Period" Interval<Date> default Interval[@2023-01-01, @2023-01-30]

context Patient

// From BRYN
//you use a Measure resource, and your Measure would be based on either Patients or Observations.
//If you want to count number of Patients that have received the test, that's a Patient-based Measure using an "exists", 
//if you want to count the number of Tests, that could be a Patient-based continuous variable measure, where the Measure Observation is a Count of tests, or it could be an Observation-based proportion measure, where the basis is actually Observation.

/*
 * As defined by Member State
 */
define "Initial Population":
  true


//Does this also filter out self HIV tests 
//right now using HIVIND19 definition which does
define "numerator":
    exists(HIE."HIV Status Positive Condition" C where C.onset.toInterval() during "Measurement Period")
	or 
	exists(HIE."HIV Status Positive Observation" O
  where O.issued.toInterval() during "Measurement Period"
  or O.effective.toInterval() during "Measurement Period") 

define "denominator":
    exists(HIE."HIV test results returned in measurement period")

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