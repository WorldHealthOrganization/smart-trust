/**
 * Library: HIV.IND.28 Logic
 * Ref No: ART.2
 * Short Name: Total attrition from ART
 *
 * Definition: Number and % of people living with HIV on ART at the end of the last reporting period and those newly initiating ART during the current reporting period who were not on ART at the end of the current reporting period
 *
 * Numerator: *Number of people living with HIV reported on ART at the end of the last reporting period | plus | Number of people living with HIV newly initiated on ART during the current reporting period | minus | Total number of people living with HIV on ART at the end of the current reporting period
 * Numerator Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True at the end of previous reporting period | PLUS | COUNT of clients with "HIV status"='HIV-positive' AND "ART start date" within reporting period | MINUS | COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True on the reporting period end date
 * Numerator Exclusions: 
 *
 * Denominator: Number of people reported on ART at the end of the last reporting period | plus | those newly initiated on ART during the current reporting period
 * Denominator Calculation: COUNT of clients with "HIV status"='HIV-positive' and "On ART"=True on previous reporting period end date | PLUS | COUNT of clients with "HIV status"='HIV-positive' AND "ART start date" within the reporting period
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Gender (female, male, other**) 
 *  • Age (0–4, 5–9, 10–14, 15–19, 20–24, 25–29, 30–34, 35–39, 40–44, 45–49, 50+ years)*** 
 *  • Key populations (men who have sex with men, people living in prisons and other closed settings, people who inject drugs, sex workers, trans and gender diverse people)**** 
 *  • Treatment outcome category (died, stopped treatment, lost to follow-up) 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Gender | Age | Key population member type | HIV treatment outcome
 *
 * Numerator and Denominator Elements:
 * ART start date 
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
 * HIV.E.DE114: Key population member type* | The type of key population that the infant's mother is included in
 * HIV.E.DE115: Sex worker | Infant's mother is a sex worker
 * HIV.E.DE116: People who inject drugs | Infant's mother is a person who injects drugs
 * HIV.E.DE117: Trans and gender-diverse people | Infant's mother identifies as trans and gender-diverse
 * HIV.E.DE118: People living in prisons and other closed setting | Infant's mother is in a prison or closed setting
 * HIV.H.DE41: HIV treatment outcome | The outcome for the client which is used for reporting retention/attrition.
 * HIV.H.DE42: Lost to follow-up | Twenty-eight days or more since last missed appointment 
 * HIV.H.DE43: Transferred out | The client transferred to another facility
 * HIV.H.DE44: Death (documented) | People living with HIV previously on ART who are confirmed to have died from any cause
 * HIV.H.DE45: Refused (stopped) treatment | Client was contacted and confirmed to have stopped ART (reasons may include stigma and discrimination, faith healing, etc.)
 * HIV.H.DE47: On ART | Client is currently taking ART 
 * HIV.SRV.DE6: ART start date | The date on which the client started or restarted antiretroviral therapy (ART)
 *
 * Additional Context
 * - what it measures: Measures progress towards promoting retention on ART and mitigating loss, that is, attrition from ART. |  | This indicator is central to understanding total attrition (loss) from ART during a reporting period and to understanding net progress towards reaching the second 95 target.
 * - rationale: • WHO currently recommends treatment for all people living with HIV to achieve viral suppression. ART attrition analyses by treatment outcome category are essential to achieving this goal. | • This indicator is central to understanding total attrition (loss) from ART during a reporting period and to understanding net progress towards reaching the second 95 target. | • This indicator is closely related to ART.1 People living with HIV on ART and is measured by using the same methods and programmatic outcome classification categories.
 * - method: For the numerator: Determined from HIV patient monitoring tools (for example, ART registers, patient records, EMRs) |  | Calculation of numerator (attrition): | Attrition = [(total on ART at the end of the last reporting period) + (total newly initiated on ART during current reporting period)] – (total on ART at the end of the current reporting period) |  | This will calculate the total number of individuals who are classified as having died, stopped treatment and/or been lost to follow-up by the end of the current period. These treatment outcome classification categories should be reported separately to the national level and | used for calculation of indicator ART.1 People living with HIV on ART. Definitions of treatment outcomes should remain consistent with established standards, with the following exception: The recommended threshold for designation of people living with HIV on ART as lost to follow- up is 28 days after the last missed appointment. |  | For the denominator: The number of people living with HIV who are on ART at the end of the previous reporting period plus the number of people living with HIV newly initiated on ART during the current reporting period
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

library HIVIND28Logic

// Included Libraries
using FHIR version '4.0.1'

include HIVCommon version '0.0.1' called HIC
include FHIRHelpers version '4.0.1'
include WHOCommon called WCom
include HIVElements called HE
include HIVIndicatorElements called HIE
include HIVConcepts called Concepts
include HIVConfig called Config

// Indicator Definition
parameter "Measurement Period" Interval<Date> default Interval[@2023-01-01, @2023-01-30]

context Patient
/*
 * As defined by Member State
 */
define "Initial Population":
  true


define "numerator":
//HIV Positive
HIE."Has HIV-positive Status"
   and exists(HE."On ART H.DE47" A
    with [EpisodeOfCare] EOC
      such that A.context.references(EOC) and 
      //On ART during last measurement period or started ART during this measurement period
      ((A.effective.toInterval() starts before (end of "Measurement Period" - duration in days of "Measurement Period")
    and A.effective.toInterval() ends after (start of "Measurement Period" - duration in days of "Measurement Period"))
    or (date from start of HE."First On ART".effective.toInterval() during "Measurement Period"))
     and
      //and either Transferred out
      (exists(EOC.type T where T ~ Concepts."On ART - HIV.H.DE47")
      and EOC.status = 'finished' and EOC.period.toInterval() ends during "Measurement Period")
      or exists (
      EOC.statusHistory H
      where H.status = 'finished'
      and H.period.toInterval() ends during "Measurement Period")
      //or Lost to follow up
      or (A.effective.toInterval() ends before (end of "Measurement Period" - Config."LTFU Days")
   //or death   
   or HIE."Has death documented"))



 define "denominator":
   //HIV Positive
HIE."Has HIV-positive Status"
   and exists(HE."On ART H.DE47" A
    with [EpisodeOfCare] EOC
      such that A.context.references(EOC) and 
      //On ART during last measurement period or started ART during this measurement period
      ((A.effective.toInterval() starts before (end of "Measurement Period" - duration in days of "Measurement Period")
    and A.effective.toInterval() ends after (start of "Measurement Period" - duration in days of "Measurement Period"))
    or (date from start of HE."First On ART".effective.toInterval() during "Measurement Period")))



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

define "Treatment outcome category Stratifier":
	HIE."Treatment outcome category"

define "Stratification":
 HIE."By Administrative Gender Stratifier".code 
  + ':' + HIE."By Age Stratifier"
+ ':' + HIE."By Geographic Region Stratifier"
+ Combine(HIE.patientGroups, ':')
+ Combine(HIE."Treatment outcome category", ':')