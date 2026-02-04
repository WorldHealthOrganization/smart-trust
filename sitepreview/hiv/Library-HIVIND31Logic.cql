/**
 * Library: HIV.IND.31 Logic
 * Ref No: ART.5
 * Short Name: Late ART initiation
 *
 * Definition: % of people living with HIV who initiate ART with a CD4 count of <200 cells/mm3
 *
 * Numerator: Number of people living with HIV initiating ART during the reporting period with a baseline CD4 count of <200 cells/mm3
 * Numerator Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "ART start date" within the reporting period AND "Date of baseline CD4 count test" within the reporting period AND "Baseline CD4 count" LESS THAN 200 cells/mm^3
 * Numerator Exclusions: 
 *
 * Denominator: Number of people living with HIV initiating ART during the reporting period who have a baseline CD4 cell count
 * Denominator Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "ART start date" within the reporting period AND "Date of baseline CD4 count test" within the reporting period
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Gender (female, male, other*) 
 *  • Age (0–4, 5–9, 10–14, 15–19, 20–24, 25–49, 50+ years)** 
 *  • Key populations (men who have sex with men, people living in prisons and other closed settings, people who inject drugs, sex workers, trans and gender diverse people)*** 
 *  • Other priority populations 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Gender | Age | Key population member type | Other priority populations | Baseline CD4 count
 *
 * Numerator and Denominator Elements:
 * ART start date 
 *  Baseline CD4 count 
 *  Date of baseline CD4 count test 
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
 * HIV.B.DE72: ART start date | The date on which the client started or restarted antiretroviral therapy (ART)
 * HIV.B.DE115: HIV status | HIV status reported after applying the national HIV testing algorithm. No single HIV test can provide an HIV-positive diagnosis.
 * HIV.B.DE116: HIV-positive | Client is HIV-positive
 * HIV.B.DE117: HIV-negative | Client is HIV-negative
 * HIV.B.DE118: Unknown | Client has unknown HIV status
 * HIV.D.DE39: ART start date | The date on which the client started or restarted ART
 * HIV.D.DE367: Baseline CD4 count | CD4 count performed at HIV diagnosis
 * HIV.D.DE368: Date of baseline CD4 count test | Date and time when baseline CD4 count test was conducted
 * HIV.E.DE114: Key population member type* | The type of key population that the infant's mother is included in
 * HIV.E.DE115: Sex worker | Infant's mother is a sex worker
 * HIV.E.DE116: People who inject drugs | Infant's mother is a person who injects drugs
 * HIV.E.DE117: Trans and gender-diverse people | Infant's mother identifies as trans and gender-diverse
 * HIV.E.DE118: People living in prisons and other closed setting | Infant's mother is in a prison or closed setting
 * HIV.G.DE3: Baseline CD4 count | CD4 count performed at HIV diagnosis
 * HIV.SRV.DE3: Baseline CD4 count | CD4 count performed at HIV diagnosis
 * HIV.SRV.DE4: Date of baseline CD4 count test | Date and time when baseline CD4 count test was conducted
 * HIV.SRV.DE6: ART start date | The date on which the client started or restarted antiretroviral therapy (ART)
 * HIV.Config.DE19: Other priority populations | Other populations of priority of HIV prevention and care in local context (provided during adaptation)
 *
 * Additional Context
 * - what it measures: Measures the proportion of people living with HIV who have AIDS at the time that they initiate ART. Often CD4 count monitoring is performed at HIV diagnosis. WHO recommends CD4 count measurement at diagnosis and same day/rapid initiation of ART for all people diagnosed with HIV.
 * - rationale: Late initiation of ART is a risk factor for treatment failure and, therefore, is important to monitor.
 * - method: For the numerator and denominator: HIV patient monitoring tools (for example, patient records/EMRs, ART registers, laboratory records) |  | The recommended reporting period is 12 months.
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

library HIVIND31Logic

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
 * Definition: Number of people living with HIV initiating ART during the reporting period with a baseline CD4 count of <200 cells/mm3
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "ART start date" within the reporting period AND "Date of baseline CD4 count test" within the reporting period AND "Baseline CD4 count" LESS THAN 200 cells/mm^3
 */

define "Numerator":
    HIE."Has HIV-positive Status" 
   and (date from start of HE."First On ART".effective.toInterval() during "Measurement Period")
   and exists(HE."Baseline CD4 count SRV.DE3" O
   where O.effective.toInterval() during "Measurement Period"
   and O.value < 200)


/**
 * Denominator
 *
 * Definition: Number of people living with HIV initiating ART during the reporting period who have a baseline CD4 cell count
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "ART start date" within the reporting period AND "Date of baseline CD4 count test" within the reporting period
 */

define "Denominator":
 HIE."Has HIV-positive Status" 
   and (date from start of HE."First On ART".effective.toInterval() during "Measurement Period")
   and exists(HE."Baseline CD4 count SRV.DE3" O
   where O.effective.toInterval() during "Measurement Period")
    

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