/**
 * Library: HIV.IND.40 Logic
 * Ref No: VER.4
 * Short Name: ART coverage in pregnant women
 *
 * Definition: % of HIV-positive pregnant women who received ART during pregnancy and/or at labour and delivery
 *
 * Numerator: Number of HIV-positive pregnant women who delivered during the reporting period and received ART during pregnancy and/or at labour and delivery
 * Numerator Calculation: COUNT of women with "HIV status"='HIV-positive' AND "Delivery date" in the reporting period AND (("On ART"=True at labour and delivery) OR ("On ART"=True during pregnancy, for this pregnancy))
 * Numerator Exclusions: 
 *
 * Denominator: a) Programme-based/service delivery denominator | Number of HIV-positive pregnant women who delivered during the reporting period and attended ANC or had a facility-based delivery | b) Population-based denominator | Number of HIV-positive pregnant women who delivered during the reporting period
 * Denominator Calculation: Programme-based/service delivery denominator: | COUNT of women with "HIV status"='HIV-positive' AND "Delivery date" in the reporting period AND (had an "ANC contact date" during reporting period OR "Place of delivery" was a 'Health facility') |  | Population-based denominator: | *Number of HIV-positive pregnant women who delivered during the reporting period
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * Numerator: 
 *  • Timing of ART initiation (1. already on ART at first ANC visit, 2. newly on ART during pregnancy, 3. newly on ART during labour and delivery, 4. on non-recommended ART regimen) 
 *   
 *  The primary indicator calculation should include ART status categories 1, 2 and 3. Removing the women in category 1 "already on ART at first ANC visit" from the numerator and denominator gives a measure of ART coverage among HIV-positive pregnant women newly diagnosed during ANC. Dividing category 2 by the sum of categories 2 and 3 gives the proportion of new ART initiations occurring during pregnancy rather than at delivery. Calculating the indicator with those in category 4 (non-recommended ARV regimen) included in the numerator gives a broader measure, that is, coverage of HIV-positive pregnant women receiving any ARV drug.
 *
 * Disaggregation Elements: Timing of ART initiation
 *
 * Numerator and Denominator Elements:
 * ANC contact date 
 *  Delivery date 
 *  HIV status 
 *  On ART 
 *  Place of delivery
 *
 * Reference: Consolidated guidelines on person-centred HIV strategic information: strengthening routine data for impact. Geneva: World Health Organization; 2022
 * 
 * Data Concepts:
 * HIV.B.DE115: HIV status | HIV status reported after applying the national HIV testing algorithm. No single HIV test can provide an HIV-positive diagnosis.
 * HIV.B.DE116: HIV-positive | Client is HIV-positive
 * HIV.B.DE117: HIV-negative | Client is HIV-negative
 * HIV.B.DE118: Unknown | Client has unknown HIV status
 * HIV.D.DE38: On ART | Client is currently taking ART
 * HIV.E.DE41: Timing of ART initiation | When the pregnant woman or mother initiated ART, for women living with HIV.
 * HIV.E.DE42: Already on ART at first antenatal care visit | The pregnant woman was already on antiretroviral therapy (ART) at first antenatal care visit
 * HIV.E.DE43: Newly on ART during pregnancy | The pregnant woman started ART during her pregnancy
 * HIV.E.DE44: Newly on ART during labour and delivery | The woman started ART during labour and delivery
 * HIV.E.DE46: Delivery date | Date on which the woman delivered
 * HIV.E.DE67: Place of delivery | The type of place where the woman delivered
 * HIV.E.DE68: Health facility | The woman delivered at a health facility
 * HIV.E.DE69: Home | The woman delivered at home
 * HIV.E.DE70: Other | The woman delivered at another location that is not at home or at a health facility
 * HIV.E.DE85: ANC contact date | The date and time of the client's ANC contact (in the ANC DAK this is called 'Contact date')
 * HIV.H.DE47: On ART | Client is currently taking ART 
 * HIV.SRV.DE18: ANC contact date | The date and time of the client's ANC contact (in the ANC DAK this is called 'Contact date')
 *
 * Additional Context
 * - what it measures: This indicator measures whether a recommended course of ART has been provided to HIV-positive pregnant women.
 * - rationale: • Providing ART for HIV-positive pregnant women is a critical strategy for preventing vertical transmission of HIV. | • In an era of "Treat All", all HIV-positive pregnant women should be given a recommended regimen of ART as soon as possible after diagnosis, including during labour and delivery.
 * - method: a) For the numerator and programme-based/service delivery denominator: Programme records (for example, PMTCT registers, ARV registers, labour and delivery registers) |  | b) For the population-based denominator: Modelling-based estimates (for example, Spectrum AIM) |  | The recommended reporting period is 12 months.
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

library HIVIND40Logic

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
 * Definition: Number of HIV-positive pregnant women who delivered during the reporting period and received ART during pregnancy and/or at labour and delivery
 * Calculation: COUNT of women with "HIV status"='HIV-positive' AND "Delivery date" in the reporting period AND (("On ART"=True at labour and delivery) OR ("On ART"=True during pregnancy, for this pregnancy))
 */


define "Numerator":
  HIE."Has HIV-positive Status" and
  exists(HIE."Live Birth Delivery" BirthDelivery
    where BirthDelivery.effective.toInterval() during "Measurement Period"
  ) and 
  exists ( 
    HE."On ART D.DE38" A 
    where A.effective.toInterval() during First(HIE."Live Birth Delivery" BirthDelivery
    where BirthDelivery.effective.toInterval() during "Measurement Period").effective.toInterval()
    or 
    A.effective.toInterval() during First(HE."Currently pregnant B.DE29" C 
    where C.prevalenceInterval() during "Measurement Period").prevalenceInterval()
  
  )



/**
 * Denominator
 *
 * Definition: a) Programme-based/service delivery denominator | Number of HIV-positive pregnant women who delivered during the reporting period and attended ANC or had a facility-based delivery | b) Population-based denominator | Number of HIV-positive pregnant women who delivered during the reporting period
 * Calculation: Programme-based/service delivery denominator: | COUNT of women with "HIV status"='HIV-positive' AND "Delivery date" in the reporting period AND (had an "ANC contact date" during reporting period OR "Place of delivery" was a 'Health facility') |  | Population-based denominator: | *Number of HIV-positive pregnant women who delivered during the reporting period
 */

define "Denominator":
  HIE."Has HIV-positive Status" and
  exists(HIE."Live Birth Delivery" BirthDelivery
    where BirthDelivery.effective.toInterval() during "Measurement Period"
  )and 
  (First(HIE."ANC within pregnancy").period.toInterval() during "Measurement Period"
  or
    HIE."Has Delivery in Health Facility")
    

/* end Populations */

/*
 * Disaggregators
 */


define "Timing of ART initiation":
  HIE."Timing of ART initiation"

define "Stratification":
  HIE."Timing of ART initiation".code 