/**
 * Library: HIV.IND.53 Logic
 * Ref No: DSD.1
 * Short Name: Multi-month ARV dispensing
 *
 * Definition: % of people living with HIV and On ART who are receiving multi-month dispensing of ARV medicine during the reporting period
 *
 * Numerator: Number of people living with HIV and On ART who received 3-5 or >6 months of ARV medicine at their most recent ARV medicine pick-up. |  | (The number receiving <3 months of ARV supply is also collected, for validation purposes.) |  | If countries cannot report on the number of months of ARV medicine dispensed by the disaggregations described above, they could, as an alternative, report the total number of people currently on ARV therapy and receiving ≥3 months of ARV medicine at their last medicine pick-up.
 * Numerator Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True AND (("Number of days medications prescribed">=3months) for last ART prescription
 * Numerator Exclusions: 
 *
 * Denominator: Number of people living with HIV and On ART
 * Denominator Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True within the reporting period
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Gender (female, male, other*) 
 *  • Age (0–4, 5–14, 15–24, 25+ years) 
 *  • Key populations (men who have sex with men, people living in prisons and other closed settings, people who inject drugs, sex workers, trans and gender diverse people)** 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Gender | Age | Key population member type | Number of days medications prescribed (3-5 months, >6 months)
 *
 * Numerator and Denominator Elements:
 * HIV status 
 *  Number of days medications prescribed 
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
 * HIV.B.DE115: HIV status | HIV status reported after applying the national HIV testing algorithm. No single HIV test can provide an HIV-positive diagnosis.
 * HIV.B.DE116: HIV-positive | Client is HIV-positive
 * HIV.B.DE117: HIV-negative | Client is HIV-negative
 * HIV.B.DE118: Unknown | Client has unknown HIV status
 * HIV.D.DE38: On ART | Client is currently taking ART
 * HIV.D.DE460: Number of days medications prescribed | Number of days supply of each medication or regimen prescribed during the visit
 * HIV.E.DE114: Key population member type* | The type of key population that the infant's mother is included in
 * HIV.E.DE115: Sex worker | Infant's mother is a sex worker
 * HIV.E.DE116: People who inject drugs | Infant's mother is a person who injects drugs
 * HIV.E.DE117: Trans and gender-diverse people | Infant's mother identifies as trans and gender-diverse
 * HIV.E.DE118: People living in prisons and other closed setting | Infant's mother is in a prison or closed setting
 * HIV.H.DE47: On ART | Client is currently taking ART 
 *
 * Additional Context
 * - what it measures: Percentage of all people living with HIV and On ART who received a multi-month supply of ARV medicine (as specified below) at their most recent ARV medicine pick-up.
 * - rationale: • The recommendation for people living with HIV who are established on ART (see "Definitions," below) to receive multiple months of ARV medicines is a key component | of care that responds to the needs and preferences of people living with HIV. For people living with HIV who are established on ART, multi-month dispensing has the potential to improve health outcomes and support long-term treatment adherence, while also reducing unnecessary clinic attendance, thus contributing to system efficiency. Broadly, multi-month dispensing can contribute to efforts to achieve the 95–95–95 targets. | • Adoption and rollout of multi-month dispensing as part of national government strategies and plans is increasing. Since 2016 DSD - including the option of multi-month dispensing - is recommended in WHO HIV treatment and public health guidelines. The extent to which these models of care have been scaled up in many countries is uncertain. Reporting on this indicator will support efforts to expand the offer of multi-month dispensing.
 * - method: The data for this indicator are collected at the end of the reporting period from facility ARV therapy registers (including ART dispensed outside the facility, for example, at the community level), programme monitoring tools or other databases such as EMR systems. (If data are available from the private sector, these should be included.) Pharmacy ARV dispensing data can also be used for this indicator if EMR systems cover only a fraction of the total number of people living with HIV on ART. |  | All people currently on ARV therapy should be identified. People who have not received ARV medicine within 28 days of their scheduled medicine pick-up are considered lost to follow-up and should not be counted in the denominator or the numerator. For example, if ARV medicine was provided for three months (12 weeks), the time since the last medicine pick-up should be no longer than 16 weeks (12 weeks plus 28 days). |  | For the numerator: Registers/EMRs should capture the duration of ARV medicine dispensed for each patient currently on ARV therapy at their most recent medicine pick-up visit. |  | If possible, this should be categorized as <3 months, 3–5 or >6 months and summarized for each age/sex group. |  | The denominator should match the total number of people currently on ARV therapy at the end of the reporting period. |  | Note: Multi-month ARV dispensing should not be confused with multi-month prescriptions. Someone who receives a six-month ARV medicine prescription but needs to attend clinic every one or two months for refills would not be counted as receiving multi-month dispensing. |  | Measurement frequency: Annual for national reporting. Quarterly reporting can be considered to monitor progress of implementation, particularly in the early stages of DSD scale-up and implementation, if feasible in country context and existing data systems.
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

library HIVIND53Logic

// Included Libraries
using FHIR version '4.0.1'

include HIVCommon version '0.0.1' called HIC
include FHIRHelpers version '4.0.1'

include WHOCommon called WCom
include HIVConceptsCustom version '0.0.1' called HCC
include HIVCommon version '0.0.1' called Common
include HIVElements called HE
include HIVIndicatorElements called HIE

// Indicator Definition
parameter "Measurement Period" Interval<Date> default Interval[@2023-01-01, @2023-01-30]

context Patient
/* Populations */

//use the last ART presciption authored before end of measurement period
define "Last ART prescribed before end of measurement period":
  Last([MedicationRequest: HCC."ART medication"] MR
  where (MR.authoredOn.toInterval() before end of "Measurement Period")
  and MR.MedicationRequestPeriod() overlaps "Measurement Period"
  sort by start of authoredOn.toInterval())


/*
 *Initial Population
 */

define "Initial Population":
  true

/**
 * Numerator
 * 
 * Definition: Number of people living with HIV and On ART who received 3-5 or >6 months of ARV medicine at their most recent ARV medicine pick-up. |  | (The number receiving <3 months of ARV supply is also collected, for validation purposes.) |  | If countries cannot report on the number of months of ARV medicine dispensed by the disaggregations described above, they could, as an alternative, report the total number of people currently on ARV therapy and receiving ≥3 months of ARV medicine at their last medicine pick-up.
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True AND (("Number of days medications prescribed">=3months) for last ART prescription
 */

define "Numerator":
  HIE."Has HIV-positive Status"
   and HIE."On ART H.DE47"
   and (duration in months of "Last ART prescribed before end of measurement period".MedicationRequestPeriod() >= 3 months)


/**
 * Denominator
 *
 * Definition: Number of people living with HIV and On ART
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True within the reporting period
 */

define "Denominator":
  HIE."Has HIV-positive Status"
   and HIE."On ART H.DE47"
    

/* end Populations */

/*
 * Disaggregators
 */

define "Administrative Gender Stratifier":
	HIE."By Administrative Gender Stratifier"

define "Age Stratifier":
	HIE."By Age Stratifier 8"

define "Geographic Region Stratifier":
	HIE."By Geographic Region Stratifier"

define "patientGroups Stratifier":
	HIE."patientGroups"

define "Stratification":
 HIE."By Administrative Gender Stratifier".code 
  + ':' + HIE."By Age Stratifier 8"
+ ':' + HIE."By Geographic Region Stratifier"
+ Combine(HIE.patientGroups, ':')