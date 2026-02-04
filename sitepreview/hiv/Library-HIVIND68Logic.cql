/**
 * Library: HIV.IND.68 Logic
 * Ref No: STI.3C1
 * Short Name: Syphilis treatment coverage, pregnant women, first ANC visit
 *
 * Definition: % of pregnant women tested positive for syphilis on first ANC services visit who were treated based on national guidelines during the reporting period
 *
 * Numerator: Number of pregnant women who tested positive for syphilis on first ANC services visit and were treated based on national guidelines during the reporting period
 * Numerator Calculation: COUNT of pregnant women with first "ANC contact date" for this pregnancy in the reporting period AND "Syphilis test date" on first "ANC contact date" AND "Syphilis test result"='Positive' AND "Syphilis treatment start date" in the reporting period
 * Numerator Exclusions: 
 *
 * Denominator: Number of pregnant women who tested positive for syphilis on first ANC services visit during the reporting period
 * Denominator Calculation: COUNT of pregnant women with first "ANC contact date" for this pregnancy in the reporting period AND "Syphilis test date" on first "ANC contact date" AND "Syphilis test result"='Positive'
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
 *  Syphilis treatment start date
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
 * HIV.B.DE254: Syphilis treatment start date | Date of initiation of syphilis treatment
 * HIV.D.DE801: Syphilis test date | Date of syphilis test
 * HIV.D.DE802: Syphilis test result | Result from syphilis test
 * HIV.D.DE803: Positive | Test result is positive for syphilis
 * HIV.D.DE804: Negative | Test result is negative for syphilis
 * HIV.D.DE805: Inconclusive | Test result is inconclusive
 * HIV.D.DE806: Syphilis treatment start date | Date of initiation of syphilis treatment
 * HIV.E.DE85: ANC contact date | The date and time of the client's ANC contact (in the ANC DAK this is called 'Contact date')
 * HIV.G.DE69: Syphilis test date | Date of syphilis test
 * HIV.G.DE70: Syphilis test result | Result from syphilis test
 * HIV.G.DE71: Positive | Test result is positive for syphilis
 * HIV.G.DE72: Negative | Test result is negative for syphilis
 * HIV.G.DE73: Inconclusive | Test result is inconclusive
 * HIV.SRV.DE18: ANC contact date | The date and time of the client's ANC contact (in the ANC DAK this is called 'Contact date')
 *
 * Additional Context
 * - what it measures: A: % of people attending HIV prevention services who tested positive for syphilis and | were treated based on national guidelines during the reporting period | B: % of people living with HIV who tested positive for syphilis and were treated based on national guidelines during the reporting period | C: % of pregnant women who tested positive for syphilis and were treated based on national guidelines during the reporting period
 * - rationale: Prompt treatment of individuals positive for syphilis is important for improving their health and reducing sexual and vertical transmission of syphilis.
 * - method: Individual-level data obtained from programme records.   |  | If individual-level data are not available, the indicator can be reported using aggregate programme data.
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

library HIVIND68Logic

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
 * Definition: Number of pregnant women who tested positive for syphilis on first ANC services visit and were treated based on national guidelines during the reporting period
 * Calculation: COUNT of pregnant women with first "ANC contact date" for this pregnancy in the reporting period AND "Syphilis test date" on first "ANC contact date" AND "Syphilis test result"='Positive' AND "Syphilis treatment start date" in the reporting period
 */

define "Numerator":
  First(HIE."ANC within pregnancy").period.toInterval() during "Measurement Period"
  and exists(HE."Positive B.DE251" S
  with HE."Syphilis test date B.DE249" P
  such that S.partOf.references(P) and P.performed.toInterval() during "Measurement Period"
  and start of P.performed.toInterval() = start of HIE."first anc date"
  )
  and HIE."Syphilis treatment start date B.DE254"


/**
 * Denominator
 *
 * Definition: Number of pregnant women who tested positive for syphilis on first ANC services visit during the reporting period
 * Calculation: COUNT of pregnant women with first "ANC contact date" for this pregnancy in the reporting period AND "Syphilis test date" on first "ANC contact date" AND "Syphilis test result"='Positive'
 */

define "Denominator":
  First(HIE."ANC within pregnancy").period.toInterval() during "Measurement Period"
  and exists(HE."Positive B.DE251" S
  with HE."Syphilis test date B.DE249" P
  such that S.partOf.references(P) and P.performed.toInterval() during "Measurement Period"
  and start of P.performed.toInterval() = start of HIE."first anc date"
  )
    

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