/**
 * Library: HIV.IND.45 Logic
 * Ref No: TBH.2
 * Short Name: TPT completion
 *
 * Definition: Number and % of people living with HIV on ART who completed a course of TB preventive treatment among those who initiated TPT
 *
 * Numerator: Number of ART patients who completed a course of TPT during the reporting period
 * Numerator Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True AND "TB preventive treatment (TPT) start date" in the previous period AND "TB preventive treatment (TPT) status"='Completed'
 * Numerator Exclusions: 
 *
 * Denominator: Number of ART patients who initiated any course of TPT during the previous reporting period
 * Denominator Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True AND "TB preventive treatment (TPT) start date" in the prior reporting period
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Gender (female, male, other*) 
 *  • Age (0–4, 5–9, 10–14, 15–19, 20–24, 25–29, 30–34, 35–39, 40–44, 45–49, 50+ years)** 
 *  • Type of TPT regimen 
 *  • ART initiation (<12 months on ART, 12+ months on ART) 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Gender | Age | TPT regimen type | ART start date (<12 months on ART, ≥12 months on ART)
 *
 * Numerator and Denominator Elements:
 * HIV status 
 *  On ART 
 *  TB preventive treatment (TPT) start date 
 *  TB preventive treatment (TPT) status
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
 * HIV.B.DE72: ART start date | The date on which the client started or restarted antiretroviral therapy (ART)
 * HIV.B.DE115: HIV status | HIV status reported after applying the national HIV testing algorithm. No single HIV test can provide an HIV-positive diagnosis.
 * HIV.B.DE116: HIV-positive | Client is HIV-positive
 * HIV.B.DE117: HIV-negative | Client is HIV-negative
 * HIV.B.DE118: Unknown | Client has unknown HIV status
 * HIV.D.DE38: On ART | Client is currently taking ART
 * HIV.D.DE39: ART start date | The date on which the client started or restarted ART
 * HIV.D.DE954: TB preventive treatment (TPT) start date | The date on which the client began taking TPT
 * HIV.D.DE1028: TPT regimen type | Type of TPT regimen the client is currently on
 * HIV.D.DE1029: 3HP | The client's current TPT regimen is 3HP
 * HIV.D.DE1030: 1HP | The client's current TPT regimen is 1HP
 * HIV.D.DE1031: 6H | The client's current TPT regimen is 6H
 * HIV.D.DE1032: Six months of levofloxacin daily | The client's current TPT regimen is six months of levofloxacin daily
 * HIV.D.DE1033: Other TB preventive treatment (TPT) regimen | The client's current TPT regimen is another regimen than those listed above
 * HIV.D.DE1034: TB preventive treatment (TPT) status | Indicates the current status of TB preventive treatment (TPT)
 * HIV.D.DE1035: Not started | The client did not start the TB preventive treatment (TPT)
 * HIV.D.DE1036: On TPT | The client started the TB preventive treatment (TPT) and is currently taking the medication, without treatment interruptions
 * HIV.D.DE1037: On TPT with interruptions | The client started the TB preventive treatment (TPT) and is currently taking the medication, with treatment interruptions
 * HIV.D.DE1038: On hold | The health care worker has temporarily stopped the TB preventive treatment (TPT), but TPT is expected to continue again later. May also be called "suspended".
 * HIV.D.DE1039: Completed | TB preventive treatment (TPT) was completed
 * HIV.H.DE47: On ART | Client is currently taking ART 
 * HIV.SRV.DE6: ART start date | The date on which the client started or restarted antiretroviral therapy (ART)
 *
 * Additional Context
 * - what it measures: This indicator measures the effectiveness of scaled-up TPT programmes by assessing the proportion of patients who completed the recommended course of TPT.
 * - rationale: • Many countries have made progress in initiating eligible people living with HIV on TPT. However, rates of TPT completion remain poor or unknown. | • Assessment of TPT completion is a critical element of the TB/HIV cascade of services.
 * - method: For the numerator and denominator: Programme records (for example, ART registers) |  | Defining "previous reporting period": For example, for annual reporting of January to December 2021, the previous reporting period is January to December 2020 (except for programmes with 1HP-exclusive national guidelines and implementation, in which case they may use January to December 2021). For quarterly or semi-annual reporting to the national level, the previous reporting period will depend on the TPT regimen and duration defined by national guidelines. |  | Note: For programmes using continuous isoniazid preventive therapy (IPT), TPT completion is defined as six months of treatment. | 
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

library HIVIND45Logic

// Included Libraries
using FHIR version '4.0.1'

include HIVCommon version '0.0.1' called HIC
include FHIRHelpers version '4.0.1'

include WHOCommon called WCom

include HIVElements called HE
include HIVIndicatorElements called HIE

parameter "Measurement Period" Interval<Date> default Interval[@2023-01-01, @2023-01-30]

context Patient

/**
 * Indicator Definition
 */ 

/* Populations */

/*
 *Initial Population
 */

define "Initial Population":
  true

/**
 * Numerator
 * 
 * Definition: Number of ART patients who completed a course of TPT during the reporting period
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True AND "TB preventive treatment (TPT) start date" in the previous period AND "TB preventive treatment (TPT) status"='Completed'
 */

define "Numerator":
 HIE."Has HIV-positive Status" and HIE."On ART" and exists(HIE."TB preventive treatment TPT completed in measurement period")

/**
 * Denominator
 *
 * Definition: Number of ART patients who initiated any course of TPT during the previous reporting period
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True AND "TB preventive treatment (TPT) start date" in the prior reporting period
 */

define "Denominator":
 HIE."Has HIV-positive Status" and HIE."On ART" and exists(HIE."TB preventive treatment TPT start date in previous measurement period")
    
/* end Populations */

/*
 * Disaggregation
 *
 *  • Gender (female, male, other*) 
 *  • Age (0–4, 5–9, 10–14, 15–19, 20–24, 25–29, 30–34, 35–39, 40–44, 45–49, 50+ years)** 
 *  • Type of TPT regimen 
 *  • ART initiation (<12 months on ART, 12+ months on ART) 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 */

define "Administrative Gender Stratifier":
	HIE."By Administrative Gender Stratifier"

define "Age Stratifier":
  HIE."By Age Stratifier"

define "TPT Regimen Type Stratifier":
  HIE."TPT regimen type"

define "ART Initiation Stratifier":
  HIE."By ART initiation"

define "Geographic Region Stratifier":
  HIE."By Geographic Region Stratifier"

/*
 * Combined stratifiers
 */
define "Stratification":
  HIE."By Administrative Gender Stratifier".code 
    + ':' + HIE."By Age Stratifier"
    + ':' + Combine(HIE."TPT regimen type".coding.code)
    + ':' + HIE."By ART initiation"
	  + ':' + HIE."By Geographic Region Stratifier"
