/**
 * Library: HIV.IND.37 Logic
 * Ref No: VER.1
 * Short Name: Viral suppression at labour and delivery
 *
 * Definition: % of HIV-positive pregnant women who are virally suppressed at labour and delivery
 *
 * Numerator: Number of HIV-positive pregnant women on ART during pregnancy and delivering at a facility during the reporting period who were virally suppressed (<1000 copies/mL) at delivery
 * Numerator Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "Place of delivery" is a 'Health facility' AND "Delivery date" is in the reporting period AND "Date of viral load sample collection" is on "Delivery date" AND "Viral load test result" LESS THAN 1000 copies/mL
 * Numerator Exclusions: 
 *
 * Denominator: Number of HIV-positive pregnant women on ART during pregnancy who deliver at a facility during the reporting period and had a viral load test during delivery, or the estimated total number of pregnant women living with HIV
 * Denominator Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "Place of delivery" is a 'Health facility' AND "Delivery date" is in the reporting period AND "Date of viral load sample collection" is on "Delivery date" |  | Alternatively: *Estimated total number of pregnant women living with HIV
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Age (<15, 15–19, 20–25, 25+ years) 
 *  • Timing of ART initiation (during pregnancy, on ART at first ANC visit) 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Age | Timing of ART initiation
 *
 * Numerator and Denominator Elements:
 * Date of viral load sample collection 
 *  Delivery date 
 *  HIV status 
 *  Place of delivery 
 *  Viral load test result
 *
 * Reference: Consolidated guidelines on person-centred HIV strategic information: strengthening routine data for impact. Geneva: World Health Organization; 2022
 * 
 * Data Concepts:
 * HIV.A.DE17: Age | Calculated age (number of years) of the client based on date of birth
 * HIV.B.DE115: HIV status | HIV status reported after applying the national HIV testing algorithm. No single HIV test can provide an HIV-positive diagnosis.
 * HIV.B.DE116: HIV-positive | Client is HIV-positive
 * HIV.B.DE117: HIV-negative | Client is HIV-negative
 * HIV.B.DE118: Unknown | Client has unknown HIV status
 * HIV.D.DE194: Date of viral load sample collection | Date and time when the sample was collected to test the client's HIV viral load
 * HIV.D.DE387: Viral load test result | Result from the viral load test in number of copies/mL
 * HIV.E.DE41: Timing of ART initiation | When the pregnant woman or mother initiated ART, for women living with HIV.
 * HIV.E.DE42: Already on ART at first antenatal care visit | The pregnant woman was already on antiretroviral therapy (ART) at first antenatal care visit
 * HIV.E.DE43: Newly on ART during pregnancy | The pregnant woman started ART during her pregnancy
 * HIV.E.DE44: Newly on ART during labour and delivery | The woman started ART during labour and delivery
 * HIV.E.DE46: Delivery date | Date on which the woman delivered
 * HIV.E.DE67: Place of delivery | The type of place where the woman delivered
 * HIV.E.DE68: Health facility | The woman delivered at a health facility
 * HIV.E.DE69: Home | The woman delivered at home
 * HIV.E.DE70: Other | The woman delivered at another location that is not at home or at a health facility
 * HIV.G.DE8: Date of viral load sample collection | Date and time when the sample was collected to test the client's HIV viral load
 * HIV.G.DE12: Viral load test result | Result from the viral load test in number of copies/mL
 * HIV.SRV.DE12: Date of viral load sample collection | Date and time when the sample was collected to test the client's HIV viral load
 * HIV.SRV.DE13: Viral load test result | Result from the viral load test in number of copies/mL
 *
 * Additional Context
 * - what it measures: This indicator measures viral suppression at the time of delivery among HIV-positive pregnant women.
 * - rationale: • Viral suppression at the time of delivery is a service quality measure at a critical point in the vertical transmission risk period. | • Two different denominators give indicators similar to general measures of viral suppression among people living with HIV: The programme-based/service delivery denominator, that is, those on ART, delivering in a facility and having a viral load test, measures the third "95" target. The population-based denominator, that is, viral load among all estimated pregnant women living with HIV, regardless of ART status or ANC/facility attendance, measures population viral load suppression (of pregnant women living with HIV).
 * - method: For the numerator:  | Patient monitoring tools/EMRs (for example, PMTCT registers, patient records) |  | For the denominator: | • Population-based denominator: modelling-based estimates (for example, Spectrum AIM) | • Programme-based/service delivery denominator: programme records, labour and delivery registers/EMRs | Note: This indicator should be interpreted with consideration of the VL testing coverage of pregnant women living with HIV at delivery. |  | The recommended reporting period is 12 months.
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

library HIVIND37Logic

// Included Libraries
using FHIR version '4.0.1'

include HIVCommon version '0.0.1' called HIC
include FHIRHelpers version '4.0.1'

include WHOCommon called WCom

include HIVIndicatorElements called HIE
include HIVElements called HE

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
 * Definition: Number of HIV-positive pregnant women on ART during pregnancy and delivering at a facility during the reporting period who were virally suppressed (<1000 copies/mL) at delivery
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "Place of delivery" is a 'Health facility' AND "Delivery date" is in the reporting period AND "Date of viral load sample collection" is on "Delivery date" AND "Viral load test result" LESS THAN 1000 copies/mL
 */

//health facility birth
define "First Health facility":
  (First(HE."Health facility"))

define "Numerator":
  HIE."Has HIV-positive Status"
  and HIE."On ART D.DE38"
  and HIE."Health facility"
  and exists(
    HIE."Viral load test result D.DE387" VL
    with HE."viral load sample collection" P 
    such that VL.partOf.references(P) and start of P.performed.toInterval() = start of "First Health facility".effective.toInterval()
    where VL.value < 1000
    )


/**
 * Denominator
 *
 * Definition: Number of HIV-positive pregnant women on ART during pregnancy who deliver at a facility during the reporting period and had a viral load test during delivery, or the estimated total number of pregnant women living with HIV
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "Place of delivery" is a 'Health facility' AND "Delivery date" is in the reporting period AND "Date of viral load sample collection" is on "Delivery date" |  | Alternatively: *Estimated total number of pregnant women living with HIV
 */

define "Denominator":
  HIE."Has HIV-positive Status"
  and HIE."On ART D.DE38"
  and HIE."Health facility"
  and exists(
    HIE."Viral load test result D.DE387" VL
    with HE."viral load sample collection" P 
    such that VL.partOf.references(P) and start of P.performed.toInterval() = start of "First Health facility".effective.toInterval()
    )

/* end Populations */

/*
 * Disaggregators
 */


define "Age Stratifier":
	HIE."By Age Stratifier 3"

define "Geographic Region Stratifier":
	HIE."By Geographic Region Stratifier"

define "Timing of ART initiation":
  HIE."Timing of ART initiation"

define "Stratification":
 HIE."By Age Stratifier 3"
+ ':' + HIE."By Geographic Region Stratifier"
+ HIE."Timing of ART initiation".code 
