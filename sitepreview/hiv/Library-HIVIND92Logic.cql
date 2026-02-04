/**
 * Library: HIV.IND.92 Logic
 * Ref No: HEP.7
 * Short Name: HCV cured among people living with HIV
 *
 * Definition: % of people living with HIV and co-infected with HCV who were confirmed to be cured of HCV during the reporting period
 *
 * Numerator: Number of people living with HIV diagnosed with HCV infection who have completed HCV treatment and had a sustained virological response (SVR). SVR is assessed by a viral load measurement 12–24 weeks after the end of treatment.
 * Numerator Calculation: COUNT of clients with "HIV status"='HIV-positive' with "HCV treatment completion date" in the reporting period AND with "HCV viral load test date" is BETWEEN '12, 24' weeks after "HCV treatment completion date" AND "HCV viral load test result"='Not detected'
 * Numerator Exclusions: 
 *
 * Denominator: Number of people living with HIV and co-infected with HCV who completed HCV treatment and were assessed for sustained virological response
 * Denominator Calculation: COUNT of clients with "HIV status"='HIV-positive' with "HCV treatment completion date" in the reporting period AND with "HCV viral load test date" is BETWEEN '12, 24' weeks after "HCV treatment completion date"
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Gender (female, male, other*) 
 *  • Age (15–19, 20–24, 25–29, 30–49, 50+ years) 
 *  • Key populations (men who have sex with men, people living in prisons and other closed settings, people who inject drugs, sex workers, trans and gender diverse people)** 
 *  • Cities and other administrative regions of epidemiologic importance 
 *  • Medicine type (interferon or direct acting antivirals)
 *
 * Disaggregation Elements: Gender | Age | Key population member type | HCV medicine type
 *
 * Numerator and Denominator Elements:
 * HCV treatment completion date 
 *  HCV viral load test date 
 *  HCV viral load test result 
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
 * HIV.B.DE115: HIV status | HIV status reported after applying the national HIV testing algorithm. No single HIV test can provide an HIV-positive diagnosis.
 * HIV.B.DE116: HIV-positive | Client is HIV-positive
 * HIV.B.DE117: HIV-negative | Client is HIV-negative
 * HIV.B.DE118: Unknown | Client has unknown HIV status
 * HIV.D.DE176: HCV treatment completion date | Date when client completed treatment for hepatitis C virus (HCV)
 * HIV.D.DE178: HCV viral load test date | Hepatitis C viral load test date
 * HIV.D.DE179: HCV viral load test result | Hepatitis C viral load test result (qualitative)
 * HIV.D.DE180: Detected | HCV was detected
 * HIV.D.DE181: Not detected | HCV was not detected
 * HIV.D.DE182: HCV medicine type | Type of medicine client is prescribed
 * HIV.D.DE183: Interferon | Client is prescribed interferon
 * HIV.D.DE184: Direct acting antivirals | Client is prescribed direct acting antivirals
 * HIV.E.DE114: Key population member type* | The type of key population that the infant's mother is included in
 * HIV.E.DE115: Sex worker | Infant's mother is a sex worker
 * HIV.E.DE116: People who inject drugs | Infant's mother is a person who injects drugs
 * HIV.E.DE117: Trans and gender-diverse people | Infant's mother identifies as trans and gender-diverse
 * HIV.E.DE118: People living in prisons and other closed setting | Infant's mother is in a prison or closed setting
 * HIV.G.DE47: HCV viral load test date | Hepatitis C viral load test date
 * HIV.G.DE48: HCV viral load test result | Hepatitis C viral load test result (qualitative)
 * HIV.G.DE49: Detected | HCV was detected
 * HIV.G.DE50: Not detected | HCV was not detected
 *
 * Additional Context
 * - what it measures: Measures how many are cured among all those who completed treatment.
 * - rationale: Short courses of HCV treatment with direct acting antivirals (DAAs) lead to cure in >90% of patients and reduce mortality. Information on sustained viral response (cure) for HCV will measure treatment effectiveness and provide an incentive system, for example, cure certificates.
 * - method: Programme records, cohort studies, patient monitoring tools (electronic or paper), EMR/ electronic information systems, combined with best estimates for the population with no viral load data
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

/*
 * Profiles:
 * - HivStatus
 * - HcvTreatment
 * - HcvViralLoadResult
 */
 
library HIVIND92Logic

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
 * Definition: Number of people living with HIV diagnosed with HCV infection who have completed HCV treatment and had a sustained virological response (SVR). SVR is assessed by a viral load measurement 12–24 weeks after the end of treatment.
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' with "HCV treatment completion date" in the reporting period AND with "HCV viral load test date" is BETWEEN '12, 24' weeks after "HCV treatment completion date" AND "HCV viral load test result"='Not detected'
 */

define "Numerator":
  HIE."Has HIV-positive Status" and
  HIE."HCV treatment completion date" and
  exists(
    HE."Not detected D.DE181" O 
    with HE."HCV viral load test date D.DE178" P
    such that O.partOf.references(P) and (weeks between end of P.performed.toInterval() and date from end of Last(HE."HCV treatment completion date").effective.toInterval()> 12 weeks) and 
    (weeks between end of P.performed.toInterval() and date from end of Last(HE."HCV treatment completion date").effective.toInterval()< 24 weeks)
  )


/**
 * Denominator
 *
 * Definition: Number of people living with HIV and co-infected with HCV who completed HCV treatment and were assessed for sustained virological response
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' with "HCV treatment completion date" in the reporting period AND with "HCV viral load test date" is BETWEEN '12, 24' weeks after "HCV treatment completion date"
 */

define "Denominator":
  HIE."Has HIV-positive Status" and
  HIE."HCV treatment completion date" and
  exists(HE."HCV viral load test date D.DE178" P
    where (weeks between end of P.performed.toInterval() and date from end of Last(HE."HCV treatment completion date").effective.toInterval()> 12 weeks) and 
    (weeks between end of P.performed.toInterval() and date from end of Last(HE."HCV treatment completion date").effective.toInterval()< 24 weeks)
  )
    

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

define "By HCV medicine type Stratifier":
	HIE."By HCV medicine type Stratifier"


define "Stratification":
 HIE."By Administrative Gender Stratifier".code 
  + ':' + HIE."By Age Stratifier 9"
+ ':' + HIE."By Geographic Region Stratifier"
+ Combine(HIE.patientGroups, ':')
+ HIE."By HCV medicine type Stratifier".code 