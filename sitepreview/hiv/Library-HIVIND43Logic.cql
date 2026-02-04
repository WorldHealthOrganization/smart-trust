/**
 * Library: HIV.IND.43 Logic
 * Ref No: VER.7
 * Short Name: HIV prevalence among women attending ANC
 *
 * Definition: % of pregnant women who are HIV-positive at the time of their first test during the current pregnancy
 *
 * Numerator: Number of ANC attendees who tested HIV-positive at their first test during the current pregnancy plus number of ANC attendees known to be HIV-positive before their first ANC visit
 * Numerator Calculation: COUNT of "Currently pregnant" clients with "HIV test result"='HIV-positive' AND "HIV test date" on "ANC contact date" is EARLIEST within current pregnancy | PLUS | COUNT of clients with "HIV status"='HIV-positive' on first "ANC contact date"
 * Numerator Exclusions: 
 *
 * Denominator: Number of ANC attendees receiving their first HIV test during pregnancy plus number of ANC attendees known to be HIV-positive before first ANC visit
 * Denominator Calculation: COUNT of "Currently pregnant" clients with "HIV test date" on a "ANC contact date" during current pregnancy | PLUS | COUNT of clients with "HIV status"='HIV-positive' on first "ANC contact date"
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Age (<15, 15–19, 20–24, 25–29, 30–34, 35–39, 40–49, 50+ years) 
 *  • HIV status at first test during current pregnancy (known positive, tested HIV-negative, tested HIV-positive, not tested) 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Age | HIV status at first HIV test during current pregnancy
 *
 * Numerator and Denominator Elements:
 * ANC contact date 
 *  Currently pregnant 
 *  HIV status 
 *  HIV test date 
 *  HIV test result
 *
 * Reference: Consolidated guidelines on person-centred HIV strategic information: strengthening routine data for impact. Geneva: World Health Organization; 2022
 * 
 * Data Concepts:
 * HIV.A.DE17: Age | Calculated age (number of years) of the client based on date of birth
 * HIV.B.DE29: Currently pregnant | Client is currently pregnant
 * HIV.B.DE110: HIV test date | Date of the HIV test
 * HIV.B.DE111: HIV test result | The result from HIV testing after applying the testing algorithm
 * HIV.B.DE112: HIV-positive | Test result is HIV-positive
 * HIV.B.DE113: HIV-negative | Test result is HIV-negative
 * HIV.B.DE114: HIV-inconclusive | Test result is HIV-inconclusive
 * HIV.B.DE115: HIV status | HIV status reported after applying the national HIV testing algorithm. No single HIV test can provide an HIV-positive diagnosis.
 * HIV.B.DE116: HIV-positive | Client is HIV-positive
 * HIV.B.DE117: HIV-negative | Client is HIV-negative
 * HIV.B.DE118: Unknown | Client has unknown HIV status
 * HIV.D.DE31: Currently pregnant | Client is currently pregnant
 * HIV.E.DE85: ANC contact date | The date and time of the client's ANC contact (in the ANC DAK this is called 'Contact date')
 * HIV.E.DE224: HIV test date | Date of the HIV test
 * HIV.SRV.DE1: HIV test date | Date of the HIV test
 * HIV.SRV.DE2: HIV test result | The result from HIV testing after applying the testing algorithm
 * HIV.SRV.DE7: Currently pregnant | Client is currently pregnant
 * HIV.SRV.DE18: ANC contact date | The date and time of the client's ANC contact (in the ANC DAK this is called 'Contact date')
 *
 * Additional Context
 * - what it measures: HIV prevalence among pregnant women attending ANC, including those who were diagnosed with HIV before their first ANC visit and those testing positive during their current pregnancy.
 * - rationale: HIV prevalence among ANC attendees is used for surveillance to measure HIV prevalence and incidence and to monitor trends in HIV infection when the following conditions are met to ensure that HIV prevalence among ANC clients is consistently representative of HIV prevalence among all pregnant women: | • ANC attendance is high and all women are recorded (for example, not missing large private-sector ANC services). | • HIV testing is offered to all pregnant women and not restricted to only higher-risk women or interrupted due to stock-outs of test kits. | • Only the first HIV test result is used to calculate HIV prevalence during a single pregnancy. | • Women who are already known to be HIV-positive and/or are already on ART prior to their first ANC visit during a pregnancy and, therefore, are not tested for HIV, are recorded | and included in routine reporting. All HIV-positive women must be included in both the numerator and denominator when calculating HIV prevalence among pregnant women. |  | See section 5.2 4 on WHO's 2022 HIV SI Guidelines on routine antenatal HIV testing for more detail. | This indicator is also useful for estimating the number of women in need of PMTCT services for programme planning purposes.
 * - method: ANC registers, patient monitoring tools, EMRs (for example, patient records). |  | The recommended reporting period is 12 months.
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

library HIVIND43Logic

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
 * Definition: Number of ANC attendees who tested HIV-positive at their first test during the current pregnancy plus number of ANC attendees known to be HIV-positive before their first ANC visit
 * Calculation: COUNT of "Currently pregnant" clients with "HIV test result"='HIV-positive' AND "HIV test date" on "ANC contact date" is EARLIEST within current pregnancy | PLUS | COUNT of clients with "HIV status"='HIV-positive' on first "ANC contact date"
 */

define "Numerator":
  HIE."Currently pregnant SRV.DE7"
  and exists(HE."HIV-positive test result" O
  where start of O.effective.toInterval() = start of HIE."first anc date"
  ) and HE."Date HIV Status Positive" before start of HIE."first anc date"

  

/**
 * Denominator
 *
 * Definition: Number of ANC attendees receiving their first HIV test during pregnancy plus number of ANC attendees known to be HIV-positive before first ANC visit
 * Calculation: COUNT of "Currently pregnant" clients with "HIV test date" on a "ANC contact date" during current pregnancy | PLUS | COUNT of clients with "HIV status"='HIV-positive' on first "ANC contact date"
 */

define "Denominator":
  HIE."Currently pregnant SRV.DE7"
  and exists(HE."HIV test" O
  where start of O.effective.toInterval() = start of HIE."first anc date"
  ) and HE."Date HIV Status Positive" before start of HIE."first anc date"
    

/* end Populations */

/* 
 * Disaggregators
 */

define "Age Stratifier":
	HIE."By Age Stratifier 11"
  
define "Geographic Region Stratifier":
	HIE."By Geographic Region Stratifier"

define "HIV Status pregnancy Stratifier":
  HIE."HIV Status pregnancy Stratifier"

define "Stratification":
HIE."By Age Stratifier 11"
+ ':' + HIE."By Geographic Region Stratifier"
+ ':' + "HIV Status pregnancy Stratifier"


