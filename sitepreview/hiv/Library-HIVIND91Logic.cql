/**
 * Library: HIV.IND.91 Logic
 * Ref No: HEP.6
 * Short Name: HCV treatment among people living with HIV
 *
 * Definition: % of people living with HIV and diagnosed with HCV infection who initiated HCV treatment (direct acting antivirals) during the reporting period
 *
 * Numerator: Number of people living with HIV newly started on HCV treatment during the reporting period
 * Numerator Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "HCV test date" in the reporting period AND "HCV test result"='HCV positive' AND "HCV treatment start date" in the reporting period
 * Numerator Exclusions: 
 *
 * Denominator: Number of people living with HIV diagnosed with HCV during the reporting period
 * Denominator Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "HCV test date" in the reporting period AND "HCV test result"='HCV positive'
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Gender (female, male, other*) 
 *  • Age (15–19, 20–24, 25–29, 30–49, 50+ years) 
 *  • Key populations (men who have sex with men, people living in prisons and other closed settings, people who inject drugs, sex workers, trans and gender diverse people)** 
 *  • Cities and other administrative regions of epidemiologic importance 
 *  • Medicine type (interferon or direct acting antivirals)
 *
 * Disaggregation Elements: Gender | Age | Key population member type | HCV medicine type
 *
 * Numerator and Denominator Elements:
 * HCV test date 
 *  HCV test result 
 *  HCV treatment start date 
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
 * HIV.D.DE169: HCV test date | Date client was tested for hepatitis C virus (HCV antibody, HCV RNA or HCV core antigen)
 * HIV.D.DE170: HCV test result | Hepatitis C virus test result (HCV antibody, HCV RNA or HCV core antigen)
 * HIV.D.DE171: Positive | HCV test result was positive
 * HIV.D.DE172: Negative | HCV test result was negative
 * HIV.D.DE173: Indeterminate | HCV test result was indeterminate
 * HIV.D.DE175: HCV treatment start date | Date when client started treatment for hepatitis C virus (HCV)
 * HIV.D.DE182: HCV medicine type | Type of medicine client is prescribed
 * HIV.D.DE183: Interferon | Client is prescribed interferon
 * HIV.D.DE184: Direct acting antivirals | Client is prescribed direct acting antivirals
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
 *
 * Additional Context
 * - what it measures: Measures the number of people living with HIV and diagnosed with HCV infection who were evaluated for hepatitis disease progression, were found to be eligible for treatment and were placed on treatment.
 * - rationale: The prevalence of HCV is high, especially among people living with HIV who inject drugs. Treating people living with HIV for HCV improves quality of life and life expectancy and reduces mortality. Trends over time reflect progress in treating patients. |  | Disaggregation can indicate degree of equity in enrolment of specific priority populations.
 * - method: Patient monitoring tools (electronic or paper), EMR/electronic information systems
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

/*
 * Profiles:
 * - HivStatus
 * - HcvTreatment
 * - HcvViralLoadResult
 */

library HIVIND91Logic

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
 * THIS REFERS TO ANY MEDICATION BUT ABOVE DESCRIPTION ONLY SAYS DIRECT ACTING ANTIRETROVIRALS
 * Definition: Number of people living with HIV newly started on HCV treatment during the reporting period
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "HCV test date" in the reporting period AND "HCV test result"='HCV positive' AND "HCV treatment start date" in the reporting period
 */

define "Numerator":
  HIE."Has HIV-positive Status" and
  exists(HIE."Positive D.DE171" O where O.effective.toInterval() during "Measurement Period") and
  HIE."HCV treatment start date"



/**
 * Denominator
 *
 * Definition: Number of people living with HIV diagnosed with HCV during the reporting period
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "HCV test date" in the reporting period AND "HCV test result"='HCV positive'
 */

define "Denominator":
  HIE."Has HIV-positive Status" and
  exists(HIE."Positive D.DE171" O where O.effective.toInterval() during "Measurement Period")
    

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