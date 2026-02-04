/**
 * Library: HIV.IND.34 Logic
 * Ref No: ART.8
 * Short Name: Appropriate second viral load test after adherence counselling
 *
 * Definition: % of people living with HIV receiving ART with VL ≥1000 copies/mL who received a follow-up viral load test within three months
 *
 * Numerator: Number of people living with HIV on ART who received a follow-up VL test three months after a VL test result of ≥1000 copies/mL during the reporting period*
 * Numerator Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True AND "Date of viral load sample collection" within reporting period AND "Viral load test result" GREATER THAN 1000 copies/mL AND follow-up "Date of viral load sample collection" LESS THAN 3 months AFTER elevated viral load result
 * Numerator Exclusions: 
 *
 * Denominator: Number of people living with HIV on ART with VL ≥1000 copies/mL during the reporting period
 * Denominator Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True AND "Date of viral load sample collection" within reporting period AND "Viral load test result" GREATER THAN 1000 copies/mL
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Gender (female, male, other**) 
 *  • Age (0–4, 5–9, 10–14, 15–19, 20–24, 25–49, 50+ years)*** 
 *  • Key populations (men who have sex with men, people living in prisons and other closed settings, people who inject drugs, sex workers, trans and gender diverse people)**** 
 *  • ART regimen 
 *  • Receipt of enhanced adherence counselling (yes/no/unknown) 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Gender | Age | Key population member type | Current ART regimen | Enhanced adherence counselling provided
 *
 * Numerator and Denominator Elements:
 * Date of viral load sample collection 
 *  HIV status 
 *  On ART 
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
 * HIV.B.DE115: HIV status | HIV status reported after applying the national HIV testing algorithm. No single HIV test can provide an HIV-positive diagnosis.
 * HIV.B.DE116: HIV-positive | Client is HIV-positive
 * HIV.B.DE117: HIV-negative | Client is HIV-negative
 * HIV.B.DE118: Unknown | Client has unknown HIV status
 * HIV.D.DE38: On ART | Client is currently taking ART
 * HIV.D.DE75: Current ART regimen | The current ART regimen the client is taking
 * HIV.D.DE194: Date of viral load sample collection | Date and time when the sample was collected to test the client's HIV viral load
 * HIV.D.DE387: Viral load test result | Result from the viral load test in number of copies/mL
 * HIV.D.DE496: Enhanced adherence counselling provided | Enhanced adherence counselling was provided to the client during the visit
 * HIV.E.DE114: Key population member type* | The type of key population that the infant's mother is included in
 * HIV.E.DE115: Sex worker | Infant's mother is a sex worker
 * HIV.E.DE116: People who inject drugs | Infant's mother is a person who injects drugs
 * HIV.E.DE117: Trans and gender-diverse people | Infant's mother identifies as trans and gender-diverse
 * HIV.E.DE118: People living in prisons and other closed setting | Infant's mother is in a prison or closed setting
 * HIV.G.DE8: Date of viral load sample collection | Date and time when the sample was collected to test the client's HIV viral load
 * HIV.G.DE12: Viral load test result | Result from the viral load test in number of copies/mL
 * HIV.H.DE47: On ART | Client is currently taking ART 
 * HIV.SRV.DE12: Date of viral load sample collection | Date and time when the sample was collected to test the client's HIV viral load
 * HIV.SRV.DE13: Viral load test result | Result from the viral load test in number of copies/mL
 *
 * Additional Context
 * - what it measures: Measures the extent to which people living with HIV with non-suppressed VL receive appropriate follow-up VL testing to check virologic suppression.
 * - rationale: • Virologic suppression is essential to the 95–95–95-related impact goals. | • This indicator complements the VL testing coverage (ART.6) and VL suppression (ART.3) indicators.
 * - method: For the numerator and denominator: HIV patient monitoring tools (for example, ART registers, EMRs, laboratory information system) |  | The recommended maximum reporting period is 12 months. Shorter reporting intervals, for example, three months, are recommended where feasible.
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

library HIVIND34Logic

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
 * Definition: Number of people living with HIV on ART who received a follow-up VL test three months after a VL test result of ≥1000 copies/mL during the reporting period*
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True AND "Date of viral load sample collection" within reporting period AND "Viral load test result" GREATER THAN 1000 copies/mL AND follow-up "Date of viral load sample collection" LESS THAN 3 months AFTER elevated viral load result
 */

define "Numerator":
  HIE."Has HIV-positive Status"
  and HIE."On ART H.DE47"
  and 
    exists(HIE."Elevated Viral load test during Measurement Period")
  and 
    exists(
      HE."viral load sample collection" VL
      where (months between (start of First(HIE."Elevated Viral load test during Measurement Period").issued.toInterval()) and (date from start of VL.performed.toInterval() ) < 3 months)
      
      
    )



/**
 * Denominator
 *
 * Definition: Number of people living with HIV on ART with VL ≥1000 copies/mL during the reporting period
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True AND "Date of viral load sample collection" within reporting period AND "Viral load test result" GREATER THAN 1000 copies/mL
 */

define "Denominator":
  HIE."Has HIV-positive Status"
  and HIE."On ART H.DE47"
  and 
    exists(HIE."Elevated Viral load test during Measurement Period")
    

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

define "Current ART regimen":
  HIE."Current ART regimen"

define "Enhanced adherence counselling provided Disaggregation":
  HIE."Enhanced adherence counselling provided Disaggregation"

define "Stratification":
 HIE."By Administrative Gender Stratifier".code 
  + ':' + HIE."By Age Stratifier 2"
+ ':' + HIE."By Geographic Region Stratifier"
+ Combine(HIE.patientGroups, ':')
+ HIE."Current ART regimen".code 
+ HIE."Enhanced adherence counselling provided Disaggregation".code
