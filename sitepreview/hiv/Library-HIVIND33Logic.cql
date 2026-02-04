/**
 * Library: HIV.IND.33 Logic
 * Ref No: ART.7
 * Short Name: Early viral load testing (at six months)
 *
 * Definition: Number and % of people living with HIV on ART who had a viral load result reviewed by six months after initiation of ART
 *
 * Numerator: Number of people living with HIV on ART who were eligible for VL monitoring at six months after initiation of ART during the reporting period and who had a VL test performed and result reviewed by six months after ART initiation
 * Numerator Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True AND "ART start date" is within reporting period AND "Date viral load test results received by client" within 6 months of "ART start date"
 * Numerator Exclusions: 
 *
 * Denominator: Number of people living with HIV on ART eligible for VL monitoring at six months after initiation of ART during the reporting period
 * Denominator Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True AND "ART start date" is within reporting period
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Gender (female, male, other**) 
 *  • Age (0–4, 5–9, 10–14, 15–19, 20–24, 25–49, 50+ years)*** 
 *  • Key populations (men who have sex with men, people living in prisons and other closed settings, people who inject drugs, sex workers, trans and gender diverse people)**** 
 *  • Other priority populations 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Gender | Age | Key population member type | Other priority populations
 *
 * Numerator and Denominator Elements:
 * ART start date 
 *  Date viral load test results received by client 
 *  HIV status 
 *  On ART
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
 * HIV.B.DE72: ART start date | The date on which the client started or restarted antiretroviral therapy (ART)
 * HIV.B.DE115: HIV status | HIV status reported after applying the national HIV testing algorithm. No single HIV test can provide an HIV-positive diagnosis.
 * HIV.B.DE116: HIV-positive | Client is HIV-positive
 * HIV.B.DE117: HIV-negative | Client is HIV-negative
 * HIV.B.DE118: Unknown | Client has unknown HIV status
 * HIV.D.DE38: On ART | Client is currently taking ART
 * HIV.D.DE39: ART start date | The date on which the client started or restarted ART
 * HIV.D.DE193: Date viral load test results received by client | The date on which the client received results from viral load test
 * HIV.D.DE417: Date viral load test results received by client | The date on which the client received results from a viral load test
 * HIV.E.DE114: Key population member type* | The type of key population that the infant's mother is included in
 * HIV.E.DE115: Sex worker | Infant's mother is a sex worker
 * HIV.E.DE116: People who inject drugs | Infant's mother is a person who injects drugs
 * HIV.E.DE117: Trans and gender-diverse people | Infant's mother identifies as trans and gender-diverse
 * HIV.E.DE118: People living in prisons and other closed setting | Infant's mother is in a prison or closed setting
 * HIV.H.DE47: On ART | Client is currently taking ART 
 * HIV.SRV.DE6: ART start date | The date on which the client started or restarted antiretroviral therapy (ART)
 * HIV.Config.DE19: Other priority populations | Other populations of priority of HIV prevention and care in local context (provided during adaptation)
 *
 * Additional Context
 * - what it measures: Measures the extent to which people newly initiating ART receive appropriate and rapid follow-up VL testing to check virologic suppression and to provide an early warning to prompt adherence support and avoid HIV drug resistance.*
 * - rationale: • WHO currently recommends VL testing for all people living with HIV at six months after ART initiation to assess VLS and, in the event of non-suppression, to identify persons in need of intensive adherence counselling and follow-up. | • Virologic suppression is essential to the 95–95–95-related impact goals. | • This indicator complements the VL testing coverage (ART.6) and VL suppression (ART.3) indicators.
 * - method: For the numerator and denominator: Patient monitoring tools (for example, ART registers, cohort reporting forms, patient records/EMRs, laboratory information system) |  | The time window for early VL monitoring can include a margin of +/– one month, that is, a routine VL test can take place any time from five to seven months after initiation of ART.
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

library HIVIND33Logic

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
 * Definition: Number of people living with HIV on ART who were eligible for VL monitoring at six months after initiation of ART during the reporting period and who had a VL test performed and result reviewed by six months after ART initiation
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True AND "ART start date" is within reporting period AND "Date viral load test results received by client" within 6 months of "ART start date"
 */

define "Numerator":
  HIE."Has HIV-positive Status"
  and HIE."On ART H.DE47"
   and (date from start of HE."First On ART".effective.toInterval() during "Measurement Period")
   and (months between (start of First(HE."Viral load tests received after ART intitiation").issued.toInterval()) and (date from start of HE."First On ART".effective.toInterval()) < 6 months)


/**
 * Denominator
 *
 * Definition: Number of people living with HIV on ART eligible for VL monitoring at six months after initiation of ART during the reporting period
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True AND "ART start date" is within reporting period
 */

define "Denominator":
  HIE."Has HIV-positive Status"
  and HIE."On ART H.DE47"
   and (date from start of HE."First On ART".effective.toInterval() during "Measurement Period")
    

/* end Populations */

/*
 * Disaggregators
 */

define "Administrative Gender Stratifier":
	HIE."By Administrative Gender Stratifier"

define "Age Stratifier 2":
	HIE."By Age Stratifier 2"

define "Geographic Region Stratifier":
	HIE."By Geographic Region Stratifier"

define "patientGroups Stratifier":
	HIE."patientGroups"

define "Stratification":
 HIE."By Administrative Gender Stratifier".code 
  + ':' + HIE."By Age Stratifier 2"
+ ':' + HIE."By Geographic Region Stratifier"
+ Combine(HIE.patientGroups, ':')