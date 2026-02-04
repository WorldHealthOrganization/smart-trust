/**
 * Library: HIV.IND.9 Logic
 * Ref No: PRV.9
 * Short Name: Regular NSP access
 *
 * Definition: % of people who inject drugs accessing a needle-syringe programme (NSP) at least once per month during the reporting period
 *
 * Numerator: Total number of people receiving needles-syringes at least once per month during the reporting period, either: | a) number of people accessing an NSP at least once in each 30-day period of the reporting period | b) number of people accessing an NSP at least once per month on average during the reporting period
 * Numerator Calculation: COUNT of clients with "Date injecting equipment provided" within each 30 day period of reporting period
 * Numerator Exclusions: 
 *
 * Denominator: a) Programme/service provider level: number of people who inject drugs accessing service | b) Population level: population-size estimate of people who inject drugs in relevant geographic area
 * Denominator Calculation: Programme/service level:  | COUNT of clients with "Key population member type"='People who inject drugs' |  | Population level: | *Estimated number of people who inject drugs
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Gender (female, male, other*) 
 *  • Age (<25, 25+ years) 
 *  • Provider type (key population-led or community-led organization, public sector provider, other entities such as private for-profit and not-for-profit organizations, including faith-based, international, nongovernmental) 
 *  • Setting: facility-based service (including hospitals, health clinics, general practice offices, etc.) or community-based service (including drop-in centres, community service delivery points, mobile clinics or vans, outreach teams, community support groups, etc.) 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Gender | Age (<25, 25+ years)
 *
 * Numerator and Denominator Elements:
 * Date injecting equipment provided 
 *  Key population member type
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
 * HIV.E.DE114: Key population member type* | The type of key population that the infant's mother is included in
 * HIV.E.DE115: Sex worker | Infant's mother is a sex worker
 * HIV.E.DE116: People who inject drugs | Infant's mother is a person who injects drugs
 * HIV.E.DE117: Trans and gender-diverse people | Infant's mother identifies as trans and gender-diverse
 * HIV.E.DE118: People living in prisons and other closed setting | Infant's mother is in a prison or closed setting
 * HIV.PRV.DE15: Date injecting equipment provided | Date client was provided with injecting equipment
 *
 * Additional Context
 * - what it measures: This indicator measures the frequency that people who inject drugs access a NSP.
 * - rationale: Frequent and regular access to an NSP by people who inject drugs is encouraged to ensure availability of sterile injecting equipment.
 * - method: Individual-level data obtained from programmatic records.
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

 /*
  * Profiles:
  * - 
 **/
library HIVIND9Logic

// Included Libraries
using FHIR version '4.0.1'

include HIVCommon version '0.0.1' called HIC
include FHIRHelpers version '4.0.1'

include WHOCommon called WCom

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
 * Definition: Total number of people receiving needles-syringes at least once per month during the reporting period, either: | a) number of people accessing an NSP at least once in each 30-day period of the reporting period | b) number of people accessing an NSP at least once per month on average during the reporting period
 * Calculation: COUNT of clients with "Date injecting equipment provided" within each 30 day period of reporting period
 */

define "Numerator":
  true

/**
 * Denominator
 *
 * Definition: a) Programme/service provider level: number of people who inject drugs accessing service | b) Population level: population-size estimate of people who inject drugs in relevant geographic area
 * Calculation: Programme/service level:  | COUNT of clients with "Key population member type"='People who inject drugs' |  | Population level: | *Estimated number of people who inject drugs
 */

define "Denominator":
  true
    

/* end Populations */

