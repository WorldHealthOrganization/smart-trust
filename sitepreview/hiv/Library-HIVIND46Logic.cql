/**
 * Library: HIV.IND.46 Logic
 * Ref No: TBH.3
 * Short Name: TB diagnostic testing type
 *
 * Definition: % of people living with HIV with TB symptoms who receive a rapid molecular test, for example, Xpert MTB/RIF, as a first test for diagnosis of TB
 *
 * Numerator: Number of people living with HIV and having TB symptoms who were tested using a rapid molecular test (for example, Xpert MTB/RIF) as a first test during the reporting period
 * Numerator Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "TB screening date" in the reporting period AND "TB screening result"='Screen positive for TB' AND "TB diagnostic test category"='mWRD test for TB'
 * Numerator Exclusions: 
 *
 * Denominator: Number of people living with HIV who are screened for TB and found to have symptoms during the reporting period
 * Denominator Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "TB screening date" in the reporting period AND "TB screening result"='Screen positive for TB'
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Gender (female, male, other*) 
 *  • Age (0–4, 5–9, 10–14, 15–19, 20–24, 25–29, 30–34, 35–39, 40–44, 45–49, 50+ years)** 
 *  • Key populations (men who have sex with men, people living in prisons and other closed settings, people who inject drugs, sex workers, trans and gender diverse people)*** 
 *  • Pregnant or breastfeeding women 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Gender | Age | Key population member type | Currently pregnant | Breastfeeding
 *
 * Numerator and Denominator Elements:
 * HIV status 
 *  TB diagnostic test category 
 *  TB screening date 
 *  TB screening result
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
 * HIV.B.DE29: Currently pregnant | Client is currently pregnant
 * HIV.B.DE32: Breastfeeding | Infant is being breastfed by mother
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
 * HIV.D.DE31: Currently pregnant | Client is currently pregnant
 * HIV.D.DE32: Breastfeeding | Client is giving infant breast milk
 * HIV.D.DE986: TB screening result | Record the result of the tuberculosis (TB) screening
 * HIV.D.DE987: Screen positive for TB | Screening result was positive for tuberculosis (TB)
 * HIV.D.DE988: Screen negative for TB | Screening result was negative for tuberculosis (TB)
 * HIV.D.DE989: Inconclusive | Screening result was inconclusive for tuberculosis (TB)
 * HIV.D.DE990: TB screening date | Date the TB screening was conducted
 * HIV.D.DE992: TB diagnostic test category | The type of diagnostic test performed to detect tuberculosis (TB) disease
 * HIV.D.DE993: LF-LAM | Client tested for tuberculosis with a lateral flow urine lipoarabinomannan assay
 * HIV.D.DE994: mWRD test for TB | Client tested with a WHO-recommended molecular diagnostic test to detect Mycobacterium tuberculosis (MTB)
 * HIV.D.DE995: Microscopy - Sputum acid-fast bacilli (AFB) | Client tested for tuberculosis with a sputum acid-fast bacilli (AFB)
 * HIV.D.DE996: TB Culture | Client tested for tuberculosis (TB) with a culture
 * HIV.E.DE114: Key population member type* | The type of key population that the infant's mother is included in
 * HIV.E.DE115: Sex worker | Infant's mother is a sex worker
 * HIV.E.DE116: People who inject drugs | Infant's mother is a person who injects drugs
 * HIV.E.DE117: Trans and gender-diverse people | Infant's mother identifies as trans and gender-diverse
 * HIV.E.DE118: People living in prisons and other closed setting | Infant's mother is in a prison or closed setting
 * HIV.SRV.DE7: Currently pregnant | Client is currently pregnant
 *
 * Additional Context
 * - what it measures: This indicator measures the proportion of people living with HIV who screen positive for TB symptoms who receive a recommended test for diagnosis of TB.
 * - rationale: • People living with HIV should be screened for TB symptoms and, if found positive, be tested for TB. | • WHO recommends rapid-diagnostic molecular tests, for example, Xpert MTB/RIF, as the first test for diagnosis of TB among people living with HIV.
 * - method: For the numerator and denominator: Programme records (for example, laboratory register for smear microscopy and Xpert MTB/RIF, ART registers)
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

library HIVIND46Logic

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
/* Populations */

/*
 *Initial Population
 */

define "Initial Population":
  true

/**
 * Numerator
 * 
 * Definition: Number of people living with HIV and having TB symptoms who were tested using a rapid molecular test (for example, Xpert MTB/RIF) as a first test during the reporting period
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "TB screening date" in the reporting period AND "TB screening result"='Screen positive for TB' AND "TB diagnostic test category"='mWRD test for TB'
 */



define "Numerator":
  HIE."Has HIV-positive Status"
  and 
  //I related the two because otherwise a positive observation could come from another test type and be counted. 
  exists(
    HE."mWRD test for TB" P
    with HE."Screen positive for TB" O
      such that P.partOf.references(O)
    where P.performed.toInterval() during "Measurement Period"
  )

/**
 * Denominator
 *
 * Definition: Number of people living with HIV who are screened for TB and found to have symptoms during the reporting period
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "TB screening date" in the reporting period AND "TB screening result"='Screen positive for TB'
 */

define "Denominator":
  HIE."Has HIV-positive Status"
  and 
  exists(
    HE."TB diagnostic test category" P
    with HE."Screen positive for TB" O
      such that P.partOf.references(O)
    where P.performed.toInterval() during "Measurement Period"
  )
    

/* end Populations */

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

define "pregnancy stratifier":
  HIE."pregnancy stratifier"

define "Stratification":
 HIE."By Administrative Gender Stratifier".code 
  + ':' + HIE."By Age Stratifier"
+ ':' + HIE."By Geographic Region Stratifier"
+ Combine(HIE.patientGroups, ':')
+ HIE."pregnancy stratifier".code
