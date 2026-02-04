/**
 * Library: HIV.IND.47 Logic
 * Ref No: TBH.4
 * Short Name: People living with HIV with active TB disease
 *
 * Definition: % of people living with HIV newly initiated on ART who have active TB disease
 *
 * Numerator: Number of people living with HIV newly initiated on ART during the reporting period who have active TB disease. | "Newly initiated on ART" is defined as the number of people living with HIV who start ART in accordance with national treatment guidelines during the reporting period.
 * Numerator Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "ART start date" in the reporting period AND "Date of TB diagnosis" in the reporting period
 * Numerator Exclusions: 
 *
 * Denominator: Number of people living with HIV new on ART during the reporting period
 * Denominator Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "ART start date" in reporting period
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Gender (female, male, other*) 
 *  • Age (0–4, 5–9, 10–14, 15–19, 20–24, 25–29, 30–34, 35–39, 40–44, 45–49, 50+ years)** 
 *  • Key populations (men who have sex with men, people living in prisons and other closed settings, people who inject drugs, sex workers, trans and gender diverse people)*** 
 *  • Pregnant women or breastfeeding women 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Gender | Age | Key population member type | Currently pregnant | Breastfeeding
 *
 * Numerator and Denominator Elements:
 * ART start date 
 *  Date of TB diagnosis 
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
 * HIV.B.DE29: Currently pregnant | Client is currently pregnant
 * HIV.B.DE32: Breastfeeding | Infant is being breastfed by mother
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
 * HIV.D.DE31: Currently pregnant | Client is currently pregnant
 * HIV.D.DE32: Breastfeeding | Client is giving infant breast milk
 * HIV.D.DE39: ART start date | The date on which the client started or restarted ART
 * HIV.D.DE952: Date of TB diagnosis | The date when the diagnosis was established
 * HIV.E.DE114: Key population member type* | The type of key population that the infant's mother is included in
 * HIV.E.DE115: Sex worker | Infant's mother is a sex worker
 * HIV.E.DE116: People who inject drugs | Infant's mother is a person who injects drugs
 * HIV.E.DE117: Trans and gender-diverse people | Infant's mother identifies as trans and gender-diverse
 * HIV.E.DE118: People living in prisons and other closed setting | Infant's mother is in a prison or closed setting
 * HIV.SRV.DE6: ART start date | The date on which the client started or restarted antiretroviral therapy (ART)
 * HIV.SRV.DE7: Currently pregnant | Client is currently pregnant
 *
 * Additional Context
 * - what it measures: This indicator measures the burden of active TB disease among people living with HIV who are newly initiated on ART.
 * - rationale: • Early detection of TB among people living with HIV enables prompt TB treatment and early ART. | • This indicator also measures indirectly the extent of efforts to detect HIV-associated TB.
 * - method: For the numerator and denominator: Programme records (for example, pre-ART and ART registers, TB register at the TB management unit) |  | The recommended national reporting period is 12 months, with monthly or quarterly reporting at subnational levels. |  | Note: Data are drawn from TB- and HIV-sided services and data sources. This indicator is related to indicator DFT.4. TB diagnosis among those tested for TB. However, the latter covers only TB diagnosed as a result of symptom screening of people living with HIV newly initiated on ART (that is, it does not cover TB cases initiated on ART that were referred from TB clinics).
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

library HIVIND47Logic

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
 * Definition: Number of people living with HIV newly initiated on ART during the reporting period who have active TB disease. | "Newly initiated on ART" is defined as the number of people living with HIV who start ART in accordance with national treatment guidelines during the reporting period.
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "ART start date" in the reporting period AND "Date of TB diagnosis" in the reporting period
 */

define "Numerator":
  HIE."Has HIV-positive Status"
  and (start of HE."First On ART".effective.toInterval() during "Measurement Period")
  and HIE."Date of TB diagnosis"


/**
 * Denominator
 *
 * Definition: Number of people living with HIV new on ART during the reporting period
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "ART start date" in reporting period
 */

define "Denominator":
  HIE."Has HIV-positive Status"
  and (start of HE."First On ART".effective.toInterval() during "Measurement Period")
    

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
