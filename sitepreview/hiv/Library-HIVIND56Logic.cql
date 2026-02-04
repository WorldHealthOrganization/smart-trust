/**
 * Library: HIV.IND.56 Logic
 * Ref No: DSD.4
 * Short Name: Retention in DSD ART models
 *
 * Definition: % of people retained in DSD ART models during the reporting period
 *
 * Numerator: Number of people on ART known to be on treatment 12 months after enrolling in a DSD ART model* (also at 24, 36, 48, 60 months, etc. after enrolment in the model)
 * Numerator Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True AND "DSD ART start date">X months before reporting period end date AND "Currently enrolled in DSD ART model"=True |  | Reported where 'X' is 12, 24, 36, 48, or 60 months
 * Numerator Exclusions: Clients with an "HIV treatment outcome"='Transferred out'
 *
 * Denominator: Number of people on ART enrolled in a DSD ART model 12 months ago, excluding individuals who transferred out (also 24, 36, 48, 60 months ago, etc.)
 * Denominator Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True AND "DSD ART start date">X months before reporting period end date |  | Reported where 'X' is 12, 24, 36, 48, or 60 months
 * Denominator Exclusions: Clients with an "HIV treatment outcome"='Transferred out'
 *
 * Disaggregations:
 * • Gender (female, male, other**) 
 *  • Age (0–4, 5–14, 15–24, 25+ years) 
 *  • Key populations (men who have sex with men, people living in prisons and other closed settings, people who inject drugs, sex workers, trans and gender diverse people)*** 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Gender | Age | Key population member type
 *
 * Numerator and Denominator Elements:
 * Currently enrolled in DSD ART model 
 *  DSD ART start date 
 *  HIV status 
 *  On ART
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
 * HIV.B.DE115: HIV status | HIV status reported after applying the national HIV testing algorithm. No single HIV test can provide an HIV-positive diagnosis.
 * HIV.B.DE116: HIV-positive | Client is HIV-positive
 * HIV.B.DE117: HIV-negative | Client is HIV-negative
 * HIV.B.DE118: Unknown | Client has unknown HIV status
 * HIV.D.DE38: On ART | Client is currently taking ART
 * HIV.D.DE762: Currently enrolled in DSD ART model | Client currently enrolled in differentiated service delivery (DSD) ART model
 * HIV.D.DE763: DSD ART start date | Date client started on differentiated service delivery (DSD) for ART
 * HIV.E.DE114: Key population member type* | The type of key population that the infant's mother is included in
 * HIV.E.DE115: Sex worker | Infant's mother is a sex worker
 * HIV.E.DE116: People who inject drugs | Infant's mother is a person who injects drugs
 * HIV.E.DE117: Trans and gender-diverse people | Infant's mother identifies as trans and gender-diverse
 * HIV.E.DE118: People living in prisons and other closed setting | Infant's mother is in a prison or closed setting
 * HIV.H.DE47: On ART | Client is currently taking ART 
 *
 * Additional Context
 * - what it measures: Retention in DSD ART models among people living with HIV every 12 months after enrolment |  | This indicator is limited to facilities with electronic health information systems, as reporting would be onerous for facilities with paper-based reporting systems.
 * - rationale: As DSD ART is scaled up, it is important to monitor retention on treatment to ensure clinical outcomes at least equivalent with conventional care.
 * - method: EMR/electronic information systems |  | Measurement frequency: quarterly where feasible, maximum annually
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

library HIVIND56Logic

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
 * Definition: Number of people on ART known to be on treatment 12 months after enrolling in a DSD ART model* (also at 24, 36, 48, 60 months, etc. after enrolment in the model)
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True AND "DSD ART start date">X months before reporting period end date AND "Currently enrolled in DSD ART model"=True |  | Reported where 'X' is 12, 24, 36, 48, or 60 months
 */
  

define "Numerator":
  HIE."Has HIV-positive Status"
   and HIE."On ART H.DE47"
   and exists(HE."DSD ART start date" t where months between start of t and end of "Measurement Period" >= Config."DSD Retention Interval")
   and HIE."Currently enrolled in DSD ART model"


/**
 * Numerator Exclusions
 *
 * Calculation: Clients with an "HIV treatment outcome"='Transferred out'
 */
    
define "Numerator Exclusions":
  HIE."Has transferred out"

/**
 * Denominator
 *
 * Definition: Number of people on ART enrolled in a DSD ART model 12 months ago, excluding individuals who transferred out (also 24, 36, 48, 60 months ago, etc.)
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True AND "DSD ART start date">X months before reporting period end date |  | Reported where 'X' is 12, 24, 36, 48, or 60 months
 */

define "Denominator":
  HIE."Has HIV-positive Status"
   and HIE."On ART H.DE47"
   and exists(HE."DSD ART start date" t where months between start of t and end of "Measurement Period" >= Config."DSD Retention Interval")
    
/**
* Denominator Exclusions
*
* Calculation: Clients with an "HIV treatment outcome"='Transferred out'
*/

define "Denominator Exclusions":
  HIE."Has transferred out"

/* end Populations */

/*
 * Disaggregators
 */

define "Administrative Gender Stratifier":
	HIE."By Administrative Gender Stratifier"

define "Age Stratifier":
	HIE."By Age Stratifier 8"

define "Geographic Region Stratifier":
	HIE."By Geographic Region Stratifier"

define "patientGroups Stratifier":
	HIE."patientGroups"

define "Stratification":
 HIE."By Administrative Gender Stratifier".code 
  + ':' + HIE."By Age Stratifier 8"
+ ':' + HIE."By Geographic Region Stratifier"
+ Combine(HIE.patientGroups, ':')
