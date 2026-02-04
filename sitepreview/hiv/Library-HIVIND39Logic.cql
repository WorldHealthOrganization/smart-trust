/**
 * Library: HIV.IND.39 Logic
 * Ref No: VER.3
 * Short Name: Infant ARV prophylaxis coverage
 *
 * Definition: % of HIV-exposed infants who initiated ARV prophylaxis
 *
 * Numerator: Number of HIV-exposed infants born within the past 12 months who were started on ARV prophylaxis at birth
 * Numerator Calculation: COUNT of infants who are an "HIV-exposed infant or child" AND "Infant date of birth" within reporting period AND "Infant ART start date" is on"Infant date of birth"
 * Numerator Exclusions: 
 *
 * Denominator: a) Programme-based/service delivery denominator: Number of HIV-positive women who delivered in a facility within the past 12 months. |  | B) Population-based denominator: Number of HIV-positive women who delivered within the past 12 months.
 * Denominator Calculation: Programme-based/service delivery denominator: | COUNT of women with "HIV status"='HIV-positive' AND "Place of delivery" is a 'Health facility' AND "Delivery date" within reporting period |  | Population-based denominator: | *Estimated number of HIV-positive women who delivered during the past 12 months
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • ARV drug regimen 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Current ART regimen
 *
 * Numerator and Denominator Elements:
 * Delivery date 
 *  HIV status 
 *  HIV-exposed infant or child 
 *  Infant ART start date 
 *  Infant date of birth 
 *  Place of delivery
 *
 * Reference: Consolidated guidelines on person-centred HIV strategic information: strengthening routine data for impact. Geneva: World Health Organization; 2022
 * 
 * Data Concepts:
 * HIV.B.DE115: HIV status | HIV status reported after applying the national HIV testing algorithm. No single HIV test can provide an HIV-positive diagnosis.
 * HIV.B.DE116: HIV-positive | Client is HIV-positive
 * HIV.B.DE117: HIV-negative | Client is HIV-negative
 * HIV.B.DE118: Unknown | Client has unknown HIV status
 * HIV.D.DE75: Current ART regimen | The current ART regimen the client is taking
 * HIV.E.DE46: Delivery date | Date on which the woman delivered
 * HIV.E.DE67: Place of delivery | The type of place where the woman delivered
 * HIV.E.DE68: Health facility | The woman delivered at a health facility
 * HIV.E.DE69: Home | The woman delivered at home
 * HIV.E.DE70: Other | The woman delivered at another location that is not at home or at a health facility
 * HIV.E.DE87: Infant date of birth | The infant's date of birth (DOB) if known
 * HIV.E.DE112: HIV-exposed infant or child | Whether the infant or child was determined to have had HIV exposure
 * HIV.E.DE229: Infant ART start date | The date on which the infant was started or restarted on antiretroviral therapy (ART)
 * HIV.SRV.DE20: HIV-exposed infant or child | Whether the infant or child was determined to have had HIV exposure
 *
 * Additional Context
 * - what it measures: This indicator measures the delivery of prevention services to HIV-exposed infants immediately after birth.
 * - rationale: • ARV prophylaxis for HIV-exposed infants is critical for reducing the risk of mother-to-child transmission in the immediate postpartum period – part of Prong 3 of the PMTCT strategy. | • In particular, coverage of HIV-exposed infants who are born in facilities should be very high. | • When using the programme-based/service delivery denominator, the indicator measures coverage among only HIV-exposed infants who are born in facilities, which is a direct measure of a programme's ability to meet standards of care.
 * - method: For the numerator: Programme records (for example, PMTCT registers) | a) For the programme-based/service delivery denominator: Programme records, labour and delivery registers | b) For the population-based denominator: Modelling-based estimates (for example, Spectrum AIM). |  | Note: The population-based denominator is a proxy measure for the number of infants born to HIV-infected women. |  | The recommended reporting period is 12 months.
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 * 
 * Profiles:
 * - HivInfant
 * - HivMother
 * - HivChildDelivery
 * - HivAntiRetroviralTreatment
 * - HivStatus
 * - HivOnArt
 * 
 */

library HIVIND39Logic

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
 * Definition: Number of HIV-exposed infants born within the past 12 months who were started on ARV prophylaxis at birth
 * Calculation: COUNT of infants who are an "HIV-exposed infant or child" AND "Infant date of birth" within reporting period AND "Infant ART start date" is on"Infant date of birth"
 */

define "Numerator":
  HIE."is HIV-exposed infant or child E.DE112" and 
    exists(HE."ART start date" d where date from d same day as Patient.birthDate)

/**
 * Denominator
 *
 * Definition: a) Programme-based/service delivery denominator: Number of HIV-positive women who delivered in a facility within the past 12 months. |  | B) Population-based denominator: Number of HIV-positive women who delivered within the past 12 months.
 * Calculation: Programme-based/service delivery denominator: | COUNT of women with "HIV status"='HIV-positive' AND "Place of delivery" is a 'Health facility' AND "Delivery date" within reporting period |  | Population-based denominator: | *Estimated number of HIV-positive women who delivered during the past 12 months
 */

define "Denominator":
  HIE."Has HIV-positive Status" and
    HIE."Has Delivery in Health Facility"
/* end Populations */

/*
 * Disaggregators
 */

define "Geographic Region Stratifier":
	HIE."By Geographic Region Stratifier"

define "Current ART regimen":
  HIE."Current ART regimen"

define "Stratification":
HIE."By Geographic Region Stratifier"
+ HIE."Current ART regimen".code 
