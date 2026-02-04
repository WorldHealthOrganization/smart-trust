/**
 * Library: HIV.IND.29 Logic
 * Ref No: ART.3
 * Short Name: People living with HIV on ART who have suppressed viral load
 *
 * Definition: % of people living with HIV on ART (for at least six months) who have virological suppression
 *
 * Numerator: Number of people living with HIV on ART for at least six months and with at least one routine VL test result who have virological suppression (<1000 copies/mL*) during the reporting period.
 * Numerator Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True and "ART start date" GREATER THAN 6 months before reporting period end date AND "Date of viral load sample collection" within reporting period AND "Reason for HIV viral load test"='Routine viral load test' AND "Viral load test result" LESS THAN 1000 copies/mL
 * Numerator Exclusions: 
 *
 * Denominator: Number of people living with HIV on ART at least six months with at least one routine VL result in a medical or laboratory record during the reporting period, to monitor progress towards the third 95 target |  | In addition, this can also be presented as the number with suppressed VL among all people living with HIV to calculate population-level viral suppression.
 * Denominator Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True and "ART start date" GREATER THAN 6 months before reporting period end date AND "Date of viral load sample collection" within reporting period AND "Reason for HIV viral load test"='Routine viral load test'
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Gender (female, male, other**) 
 *  • Age (0–4, 5–9, 10–14, 15–19, 20–24, 25–29, 30–34, 35–39, 40–44, 45–49, 50+ years)*** 
 *  • Key populations (men who have sex with men, people living in prisons and other closed settings, people who inject drugs, sex workers, trans and gender diverse people)**** 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Gender | Age | Key population member type
 *
 * Numerator and Denominator Elements:
 * ART start date 
 *  Date of viral load sample collection 
 *  HIV status 
 *  On ART 
 *  Reason for HIV viral load test 
 *  Viral load test result
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
 * HIV.D.DE194: Date of viral load sample collection | Date and time when the sample was collected to test the client's HIV viral load
 * HIV.D.DE387: Viral load test result | Result from the viral load test in number of copies/mL
 * HIV.D.DE391: Reason for HIV viral load test | Whether the viral load is being tested for routine monitoring on a set schedule or for targeted monitoring for suspected treatment failure
 * HIV.D.DE392: Routine viral load test | Routine refers to viral load tests obtained at standard intervals following ART initiation to monitor viral load response to ART
 * HIV.D.DE393: Targeted viral load monitoring | Targeted refers to viral load tests obtained based on a specific clinical indication (such as concern about disease progression or failure to respond to ART)
 * HIV.D.DE394: Initial viral load test | The first viral load test of the client
 * HIV.D.DE395: Follow-up viral load test after receiving enhanced adherence counselling | A follow-up viral load test within 3-6 months after enhanced adherence counselling after client received a high viral load test result
 * HIV.E.DE114: Key population member type* | The type of key population that the infant's mother is included in
 * HIV.E.DE115: Sex worker | Infant's mother is a sex worker
 * HIV.E.DE116: People who inject drugs | Infant's mother is a person who injects drugs
 * HIV.E.DE117: Trans and gender-diverse people | Infant's mother identifies as trans and gender-diverse
 * HIV.E.DE118: People living in prisons and other closed setting | Infant's mother is in a prison or closed setting
 * HIV.G.DE8: Date of viral load sample collection | Date and time when the sample was collected to test the client's HIV viral load
 * HIV.G.DE12: Viral load test result | Result from the viral load test in number of copies/mL
 * HIV.H.DE47: On ART | Client is currently taking ART 
 * HIV.SRV.DE6: ART start date | The date on which the client started or restarted antiretroviral therapy (ART)
 * HIV.SRV.DE12: Date of viral load sample collection | Date and time when the sample was collected to test the client's HIV viral load
 * HIV.SRV.DE13: Viral load test result | Result from the viral load test in number of copies/mL
 *
 * Additional Context
 * - what it measures: Measures clinical outcomes, specifically viral suppression of patients on ART regardless of ART initiation date.
 * - rationale: • Viral load suppression (VLS) represents the expected outcome of ART programme services that is, the third 95 target. | • VLS is also the best available measure of adherence to ART
 * - method: For the numerator and denominator: Patient monitoring tools (for example, ART register, patient records, EMRs, laboratory records) or acquired HIVDR surveillance, population-based surveys (such as, the Population-Based HIV Impact Assessment) that collects data on ART coverage and viral suppression |  | This indicator must be interpreted along with VL testing coverage to assess the potential for bias, that is, whether VL testing occurs in only a particular subset of people receiving ART. |  | Note: First routine VL testing is recommended at six months after ART initiation. As per ART.7, the time window for early VL monitoring can include a margin of +/– one month, that is, for reporting purposes a routine VL test can take place any time from five to seven months after initiation of ART.
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

library HIVIND29Logic

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
 * Definition: Number of people living with HIV on ART for at least six months and with at least one routine VL test result who have virological suppression (<1000 copies/mL*) during the reporting period.
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True and "ART start date" GREATER THAN 6 months before reporting period end date AND "Date of viral load sample collection" within reporting period AND "Reason for HIV viral load test"='Routine viral load test' AND "Viral load test result" LESS THAN 1000 copies/mL
 */

define "Numerator":
 HIE."Has HIV-positive Status"
  and HIE."On ART H.DE47"
  and 
   (months between (end of "Measurement Period") and (date from start of HE."First On ART".effective.toInterval()) > 6 months)
   and 
   exists(
    HIE."Viral load test result D.DE387" VL
    with HE."routine viral load sample collection" P 
    such that VL.partOf.references(P) and P.performed.toInterval() during "Measurement Period"
    where VL.value < 1000
    )

/**
 * Denominator
 *
 * Definition: Number of people living with HIV on ART at least six months with at least one routine VL result in a medical or laboratory record during the reporting period, to monitor progress towards the third 95 target |  | In addition, this can also be presented as the number with suppressed VL among all people living with HIV to calculate population-level viral suppression.
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True and "ART start date" GREATER THAN 6 months before reporting period end date AND "Date of viral load sample collection" within reporting period AND "Reason for HIV viral load test"='Routine viral load test'
 */

define "Denominator":
 HIE."Has HIV-positive Status"
  and HIE."On ART H.DE47"
  and 
   (months between (end of "Measurement Period") and (date from start of HE."First On ART".effective.toInterval()) > 6 months)
   and 
   exists(
    HIE."Viral load test result D.DE387" VL
    with HE."routine viral load sample collection" P 
    such that VL.partOf.references(P) and P.performed.toInterval() during "Measurement Period"
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


define "Stratification":
 HIE."By Administrative Gender Stratifier".code 
  + ':' + HIE."By Age Stratifier"
+ ':' + HIE."By Geographic Region Stratifier"
+ Combine(HIE.patientGroups, ':')