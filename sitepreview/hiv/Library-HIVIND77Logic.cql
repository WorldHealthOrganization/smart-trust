/**
 * Library: HIV.IND.77 Logic
 * Ref No: STI.7B
 * Short Name: Presence of STI syndrome, HIV-positive clients
 *
 * Definition: % of people living with HIV diagnosed with a particular STI syndrome during the reporting period
 *
 * Numerator: Number of people living with HIV diagnosed with one or more of the STI syndromes during the reporting period
 * Numerator Calculation: COUNT of clients with "HIV status"='HIV-positive' AND with "Any STI syndrome diagnosed"=True on a "Visit date" in reporting period
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
 *  • STI syndrome (urethral discharge syndrome, vaginal discharge syndrome, lower abdominal pain, genital ulcer disease syndrome, and anorectal discharge) 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Gender | Age | Key population member type | Syndrome/STI diagnosed
 *
 * Numerator and Denominator Elements:
 * Any STI syndrome diagnosed 
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
 * HIV.B.DE226: Syndrome/STI diagnosed | Syndrome or STI for which client is diagnosed
 * HIV.B.DE227: Urethral discharge syndrome | Client diagnosed with urethral discharge syndrome
 * HIV.B.DE228: Vaginal discharge syndrome | Client diagnosed with vaginal discharge syndrome
 * HIV.B.DE229: Lower Abdominal pain  | Client diagnosed with lower abdominal pain
 * HIV.B.DE230: Genital ulcer disease syndrome | Client diagnosed with genital ulcer disease syndrome
 * HIV.B.DE231: Anorectal discharge | Client diagnosed with anorectal discharge
 * HIV.B.DE232: Sent for testing | Specimen sent for testing
 * HIV.B.DE233: Other | Other syndrome/STI diagnosed
 * HIV.B.DE235: Any STI syndrome diagnosed | Was the client diagnosed with any of the five STI syndromes during this visit?
 * HIV.D.DE778: Syndrome/STI diagnosed | Syndrome or STI for which client is diagnosed
 * HIV.D.DE779: Urethral discharge syndrome | Client diagnosed with urethral discharge syndrome
 * HIV.D.DE780: Vaginal discharge syndrome | Client diagnosed with vaginal discharge syndrome
 * HIV.D.DE781: Lower Abdominal pain  | Client diagnosed with lower abdominal pain
 * HIV.D.DE782: Genital ulcer disease syndrome | Client diagnosed with genital ulcer disease syndrome
 * HIV.D.DE783: Anorectal discharge | Client diagnosed with anorectal discharge
 * HIV.D.DE784: Sent for testing | Specimen sent for testing
 * HIV.D.DE785: Other | Other syndrome/STI diagnosed
 * HIV.D.DE787: Any STI syndrome diagnosed | Was the client diagnosed with any of the five STI syndromes during this visit?
 * HIV.E.DE114: Key population member type* | The type of key population that the infant's mother is included in
 * HIV.E.DE115: Sex worker | Infant's mother is a sex worker
 * HIV.E.DE116: People who inject drugs | Infant's mother is a person who injects drugs
 * HIV.E.DE117: Trans and gender-diverse people | Infant's mother identifies as trans and gender-diverse
 * HIV.E.DE118: People living in prisons and other closed setting | Infant's mother is in a prison or closed setting
 * HIV.SRV.DE15: Visit date | The date and time of the client's visit
 *
 * Additional Context
 * - what it measures: A: % of people attending HIV prevention services who were diagnosed with one of five STI syndromes during the reporting period | B: % of people living with HIV who were diagnosed with one of five STI syndromes during the reporting period
 * - rationale: • Diagnosis and treatment of syndromic STIs improves health, reduces transmission of STIs and contributes to a reduction in the transmission of HIV. | • In most resource-limited settings, the WHO syndromic treatment guidelines are still the standard of care when laboratory diagnosis is not available or where the results will take several days. | • The WHO 2021 guidelines for the management of symptomatic infections covers five syndromes: urethral discharge syndrome, vaginal discharge syndrome, lower abdominal pain, genital ulcer disease syndrome, and anorectal discharge. | • In countries that are looking to start collecting STI syndromic data, the STI syndromes to focus on initially are: urethral discharge syndrome, genital ulcer disease syndrome and vaginal discharge syndrome.
 * - method: Individual-level data obtained from programme records.   |  | If individual-level data are not available, the indicator can be reported using aggregate programme data. If aggregate data are used and it is not possible to exclude individuals who are tested more than once during the reporting period, the testing coverage estimates will be inflated.
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

library HIVIND77Logic

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
 * Definition: Number of people living with HIV diagnosed with one or more of the STI syndromes during the reporting period
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' AND with "Any STI syndrome diagnosed"=True on a "Visit date" in reporting period
 */

define "Numerator":
  HIE."Has HIV-positive Status"
  and exists(HIE."Syndrome/STI diagnosed B.DE226 Condition" C
    where exists (HE."Visit date SRV.DE15" t where start of t.toInterval() = start of C.prevalenceInterval())
  )


/**
 * Denominator
 *
 * Definition: Number of people living with HIV attending HIV care and treatment services during the reporting period
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' with a "Visit date" in reporting period
 */

define "Denominator":
  HIE."Has HIV-positive Status"
  and HIE."Visit date SRV.DE15"
    

/* end Populations */

/*
*
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

define "HIV prevention intervention":
	HIE."HIV prevention intervention"

  define "STI syndrome":
	HIE."STI syndrome"




define "Stratification":
 HIE."By Administrative Gender Stratifier".code 
  + ':' + HIE."By Age Stratifier 9"
+ ':' + HIE."By Geographic Region Stratifier"
+ Combine(HIE.patientGroups, ':')
+ Combine(HIE."HIV prevention intervention", ':')
+ Combine(HIE."STI syndrome", ':')