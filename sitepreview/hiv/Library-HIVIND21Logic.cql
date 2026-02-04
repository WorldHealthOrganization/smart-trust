/**
 * Library: HIV.IND.21 Logic
 * Ref No: HTS.4
 * Short Name: Linkage to ART
 *
 * Definition: % of people newly diagnosed with HIV initiated on ART
 *
 * Numerator: Number of people newly diagnosed with HIV and started on ART during the reporting period
 * Numerator Calculation: COUNT of clients with "Date informed of HIV-positive diagnosis" in the reporting period AND "ART start date" in the reporting period
 * Numerator Exclusions: 
 *
 * Denominator: Number of people newly diagnosed with HIV during the reporting period
 * Denominator Calculation: COUNT of clients with "Date informed of HIV-positive diagnosis" in the reporting period
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Gender (female, male, other*) 
 *  • Age (0–4, 5–9, 10–14, 15–19, 20–24, 25–29, 30–34, 35–39, 40–44, 45–49, 50+ years)** 
 *  • Key populations (men who have sex with men, people living in prisons and other closed settings, people who inject drugs, sex workers, trans and gender diverse people)*** 
 *  • TB status (presumptive TB, diagnosed TB, none) 
 *  • Time to start ART (within 7, 30 or 90 days of diagnosis, as per country guidelines) 
 *  • Disaggregation by time since diagnosis (for example, 28 or 90 days) provides an indication of the quality of care with respect to national guidelines on when treatment should be started 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Gender | Age | Key population member type | TB diagnosis result | Presumptive TB | Time to start ART | Time since HIV diagnosis (28, 90 days)
 *
 * Numerator and Denominator Elements:
 * ART start date 
 *  Date informed of HIV-positive diagnosis
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
 * HIV.B.DE71: HIV diagnosis date | Date diagnosis was returned to client
 * HIV.B.DE72: ART start date | The date on which the client started or restarted antiretroviral therapy (ART)
 * HIV.D.DE39: ART start date | The date on which the client started or restarted ART
 * HIV.D.DE282: Presumptive TB | Client's comorbidities or coinfections or symptoms of these include presumptive TB
 * HIV.D.DE383: Time to start ART | Time from HIV diagnosis to when client started ART
 * HIV.D.DE384: Within 7 days of HIV diagnosis | Client started ART within 7 days
 * HIV.D.DE385: Within 30 days of HIV diagnosis | Client started ART within 30 days of ART initiation (but over 7 days)
 * HIV.D.DE386: Within 90 days of HIV diagnosis | Client started ART within 90 days of ART initiation (but over 30 days)
 * HIV.D.DE939: TB diagnosis result | Final result of the TB investigation (bacteriological and/or clinical)
 * HIV.D.DE940: Diagnosed TB | Client is diagnosed with TB disease
 * HIV.D.DE941: TB excluded | Client is not diagnosed with TB
 * HIV.D.DE945: Presumptive TB | Client has signs or symptoms of tuberculosis (TB) without laboratory confirmation
 * HIV.E.DE114: Key population member type* | The type of key population that the infant's mother is included in
 * HIV.E.DE115: Sex worker | Infant's mother is a sex worker
 * HIV.E.DE116: People who inject drugs | Infant's mother is a person who injects drugs
 * HIV.E.DE117: Trans and gender-diverse people | Infant's mother identifies as trans and gender-diverse
 * HIV.E.DE118: People living in prisons and other closed setting | Infant's mother is in a prison or closed setting
 * HIV.SRV.DE6: ART start date | The date on which the client started or restarted antiretroviral therapy (ART)
 *
 * Additional Context
 * - what it measures: This measures the extent of linkage to care and initiation of treatment following an HIV-positive diagnoses.
 * - rationale: • In the era of "Treat All", all people diagnosed as living with HIV should be rapidly initiated on treatment to optimize treatment outcomes and prevent new infections. | • Disaggregated reporting by time since diagnosis (for example, 28 days) provides an indication of the quality of care with respect to national guidelines on when treatment should be started.
 * - method: For the numerator and denominator: Patient monitoring records/tools (for example, | HTS register, ART register) or EMR. Data systems that collect individual-level data and use | a unique identifier can easily calculate the numerator for this indicator. In the absence of a cohort system of tracking, this indicator would be considered a proxy unless client records | are linked. Countries with aggregate reporting need data collection forms that categorize those who initiate ART by the timing of their HIV diagnosis. This can result in some mismatch between numerator and denominator, as some who are diagnosed with HIV toward the end of the reporting period (and so counted in the denominator) may initiate ART after the reporting period (and so not counted in the numerator). This should be considered in the interpretation of the indicator.
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

library HIVIND21Logic

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
   exists(HIE."HIV Status Positive Condition" C where C.onset.toInterval() during "Measurement Period")
	
   or 

	exists(HIE."HIV Status Positive Observation" O
  where O.issued.toInterval() during "Measurement Period"
  or O.effective.toInterval() during "Measurement Period") 

   and HIE."On ART H.DE47"

define "denominator":
   exists(HIE."HIV Status Positive Condition" C where C.onset.toInterval() during "Measurement Period")
	
   or 

	exists(HIE."HIV Status Positive Observation" O
  where O.issued.toInterval() during "Measurement Period"
  or O.effective.toInterval() during "Measurement Period") 

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

 define "TB Stratifier":
     HIE."tb"

define "Time to start ART":
	HE."Time to start ART"

define "Stratification":
 HIE."By Administrative Gender Stratifier".code 
 + ':' + HE."Time to start ART".code
  + ':' + HIE."By Age Stratifier"
+ ':' + HIE."By Geographic Region Stratifier"
+ Combine(HIE.patientGroups, ':')
+ ':' + HIE."tb".code
