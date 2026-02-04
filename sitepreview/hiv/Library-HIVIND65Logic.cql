/**
 * Library: HIV.IND.65 Logic
 * Ref No: STI.2C2
 * Short Name: Syphilis test positivity, pregnant women, any visit
 *
 * Definition: % of pregnant women who tested positive for syphilis during the reporting period
 *
 * Numerator: Number of pregnant women who tested positive for syphilis during the reporting period (tested positive on both nontreponemal and treponemal tests or tested positive on either nontreponemal or treponemal test)
 * Numerator Calculation: COUNT of pregnant women with "ANC contact date" in reporting period AND with "Syphilis test date" on ANY "ANC contact date" for this pregnancy AND "Syphilis test result"='Positive'
 * Numerator Exclusions: 
 *
 * Denominator: Number of pregnant women tested for syphilis while attending ANC services during the reporting period
 * Denominator Calculation: COUNT of pregnant women with "ANC contact date" in reporting period AND with "Syphilis test date" on ANY "ANC contact date" for this pregnancy
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Age (15–19, 20–24, 25–29, 30–49, 50+ years) 
 *  • HIV status (HIV-positive, HIV-negative, unknown status) 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Age | HIV status
 *
 * Numerator and Denominator Elements:
 * ANC contact date 
 *  Syphilis test date 
 *  Syphilis test result
 *
 * Reference: Consolidated guidelines on person-centred HIV strategic information: strengthening routine data for impact. Geneva: World Health Organization; 2022
 * 
 * Data Concepts:
 * HIV.A.DE17: Age | Calculated age (number of years) of the client based on date of birth
 * HIV.B.DE115: HIV status | HIV status reported after applying the national HIV testing algorithm. No single HIV test can provide an HIV-positive diagnosis.
 * HIV.B.DE116: HIV-positive | Client is HIV-positive
 * HIV.B.DE117: HIV-negative | Client is HIV-negative
 * HIV.B.DE118: Unknown | Client has unknown HIV status
 * HIV.B.DE249: Syphilis test date | Date of syphilis test
 * HIV.B.DE250: Syphilis test result | Result from syphilis test
 * HIV.B.DE251: Positive | Test result is positive for syphilis
 * HIV.B.DE252: Negative | Test result is negative for syphilis
 * HIV.B.DE253: Inconclusive | Test result is inconclusive
 * HIV.D.DE801: Syphilis test date | Date of syphilis test
 * HIV.D.DE802: Syphilis test result | Result from syphilis test
 * HIV.D.DE803: Positive | Test result is positive for syphilis
 * HIV.D.DE804: Negative | Test result is negative for syphilis
 * HIV.D.DE805: Inconclusive | Test result is inconclusive
 * HIV.E.DE85: ANC contact date | The date and time of the client's ANC contact (in the ANC DAK this is called 'Contact date')
 * HIV.G.DE69: Syphilis test date | Date of syphilis test
 * HIV.G.DE70: Syphilis test result | Result from syphilis test
 * HIV.G.DE71: Positive | Test result is positive for syphilis
 * HIV.G.DE72: Negative | Test result is negative for syphilis
 * HIV.G.DE73: Inconclusive | Test result is inconclusive
 * HIV.SRV.DE18: ANC contact date | The date and time of the client's ANC contact (in the ANC DAK this is called 'Contact date')
 *
 * Additional Context
 * - what it measures: A: % of people attending HIV prevention services who were tested for syphilis and had a | positive syphilis test result during the reporting period | B: % of people living with HIV who were tested for syphilis and had a positive syphilis test result during the reporting period | C: % of pregnant women who were tested for syphilis and had a positive test result during the reporting period
 * - rationale: • Syphilis test positivity can be used to identify areas within a country that require additional support and can provide early warning of potential changes in HIV and STI transmission in the general population. | • Syphilis test positivity data are an important source for generating national, regional and global incidence and prevalence estimates for syphilis and congenital syphilis.
 * - method: Individual-level data obtained from programme records |  | If individual-level data are not available, the indicator can be reported using aggregate programme data. |  | Syphilis positivity can be a positive treponemal test, a reactive nontreponemal test or a combination of both. It is important to report the testing (screening) algorithm generally used in the country. If both treponemal and nontreponemal test results on an individual person are available, then syphilis positivity should be defined as having positive results in both tests. Collecting information on the testing algorithm used to determine positivity is important so that prevalence estimates can be adjusted to look at trends.
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

library HIVIND65Logic

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
 * Definition: Number of pregnant women who tested positive for syphilis during the reporting period (tested positive on both nontreponemal and treponemal tests or tested positive on either nontreponemal or treponemal test)
 * Calculation: COUNT of pregnant women with "ANC contact date" in reporting period AND with "Syphilis test date" on ANY "ANC contact date" for this pregnancy AND "Syphilis test result"='Positive'
 */


define "Numerator":
  exists(HIE."ANC within pregnancy within measurement period")
  and exists(HE."Positive B.DE251" S
  with HE."Syphilis test date B.DE249" P
    such that S.partOf.references(P) and exists(HIE."all anc dates" t where duration in days of (t intersect P.performed.toInterval()) > 0))


/**
 * Denominator
 *
 * Definition: Number of pregnant women tested for syphilis while attending ANC services during the reporting period
 * Calculation: COUNT of pregnant women with "ANC contact date" in reporting period AND with "Syphilis test date" on ANY "ANC contact date" for this pregnancy
 */

define "Denominator":
  exists(HIE."ANC within pregnancy within measurement period")
  and exists(HE."Syphilis test date B.DE249" P
    where exists(HIE."all anc dates" t where duration in days of (t intersect P.performed.toInterval()) > 0))
    

/* end Populations */

/*
 * Disaggregators
 */


define "Age Stratifier":
	HIE."By Age Stratifier 9"

define "Geographic Region Stratifier":
	HIE."By Geographic Region Stratifier"

define "HIV Status":
  HIE."HIV Status Stratifier"

define "Stratification":
HIE."By Age Stratifier 9"
+ ':' + HIE."By Geographic Region Stratifier"
+ ':' + HIE."HIV Status Stratifier".code 
