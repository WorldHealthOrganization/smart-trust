/**
 * Library: HIV.IND.16 Logic
 * Ref No: PRV.16
 * Short Name: VMMC adverse events
 *
 * Definition: a) Number or (b) % of adverse events during the reporting period
 *
 * Numerator: Number of people experiencing at least one moderate or severe adverse event during or following circumcision surgery during the reporting period
 * Numerator Calculation: COUNT of clients with "VMMC procedure date" in the reporting period AND "Adverse event severity" IN 'Moderate', 'Severe' AND "Timing of adverse event" LESS THAN 30 days from "VMMC procedure date"
 * Numerator Exclusions: 
 *
 * Denominator: a) 1 | b) Total number of individuals under going VMMC performed according to national standard during the reporting period
 * Denominator Calculation: a) 1 | b) COUNT of clients with a "VMMC procedure date" in the reporting period
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Age (0–4, 5–9, 10–14, 15–19, 20–24, 25–49, 50+ years) 
 *  • Type and seriousness of adverse event 
 *  • Timing of adverse event (intraoperative, postoperative) 
 *  • Service site 
 *  • Provider type (key population-led or community-led organization, public sector provider, other entities such as private for-profit and not-for-profit organizations, including faith- based, international, nongovernmental) 
 *  • Setting: facility-based service (including hospitals, health clinics, general practice offices, etc.) or community-based service (including drop-in centres, community service delivery points, mobile clinics or vans, outreach teams, community support groups, etc.) 
 *  • Cities and other administrative regions of epidemiologic importance 
 *  
 *
 * Disaggregation Elements: Age | Adverse event severity | Timing of adverse event | Type of adverse VMMC event
 *
 * Numerator and Denominator Elements:
 * Adverse event severity 
 *  Timing of adverse event 
 *  VMMC procedure date
 *
 * Reference: Consolidated guidelines on person-centred HIV strategic information: strengthening routine data for impact. Geneva: World Health Organization; 2022
 * 
 * Data Concepts:
 * HIV.A.DE17: Age | Calculated age (number of years) of the client based on date of birth
 * HIV.B.DE198: VMMC procedure date | Date on which a voluntary medical male circumcision procedure was performed
 * HIV.B.DE201: Adverse event severity | Severity of the adverse event associated with voluntary medical male circumcision (VMMC) procedure
 * HIV.B.DE202: Moderate | Severity of the adverse event associated with VMMC procedure was moderate
 * HIV.B.DE203: Severe | Severity of the adverse event associated with VMMC procedure was severe
 * HIV.B.DE204: Timing of adverse event | When the adverse event associated with VMMC procedure occurred
 * HIV.B.DE205: Intraoperative | The adverse event associated with VMMC procedure occurred during the procedure
 * HIV.B.DE206: Postoperative | The adverse event associated with VMMC procedure occurred within the first 30 days after the procedure
 * HIV.B.DE207: Type of adverse VMMC event | Type of adverse event associated with voluntary medical male circumcision (VMMC) procedure
 * HIV.B.DE208: Abnormal pain | Client experienced abnormal pain
 * HIV.B.DE209: Anaesthesia-related effects | Client had anaesthesia-related effects
 * HIV.B.DE210: Bleeding | Client had bleeding
 * HIV.B.DE211: Damage to the penis | Client had damage to the penis
 * HIV.B.DE212: Difficulty urinating | Client had difficulty urinating
 * HIV.B.DE213: Excessive bleeding | Client experienced excessive bleeding
 * HIV.B.DE214: Excessive skin removal | Client experienced excessive skin removal
 * HIV.B.DE215: Excessive swelling | Client experienced excessive swelling
 * HIV.B.DE216: Haematoma | Client experienced haematoma
 * HIV.B.DE217: Infection | Client experienced infection
 * HIV.B.DE218: Injury to glans | Client experienced injury to glans
 * HIV.B.DE219: Scar or disfigurement | Client experienced scar or disfigurement
 * HIV.B.DE220: Sharps injury to personnel | During VMMC procedure there was sharps injury to personnel
 * HIV.B.DE221: Wound disruption | Client experienced wound disruption
 * HIV.B.DE222: Other | Client experienced other adverse VMMC event
 *
 * Additional Context
 * - what it measures: • This indicator measures whether VMMC services meet national standards of safety and effectiveness.
 * - rationale: • Staff conducting medical circumcisions must have appropriate training and access to proper equipment. | • Trends in adverse events may indicate where service providers need additional support. | • Intraoperative adverse events may include pain, excessive bleeding, anaesthesia-related effects, excessive skin removal, damage to the penis, sharps injury to personnel. Postoperative adverse events may include abnormal pain, excessive swelling, infection, haematoma, bleeding, difficulty urinating, wound disruption, scar or disfigurement, injury to glans, excessive skin removal. | • Moderate or severe adverse events include complications resulting in death or hospitalization within 30 days or permanent disability.
 * - method: Individual-level data obtained from programme records |  | This indicator can be reported as simply the absolute number of men experiencing adverse events occurring in the reporting period or can be reported as a proportion of the number of procedures conducted.
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

library HIVIND16Logic

// Included Libraries
using FHIR version '4.0.1'

include HIVCommon version '0.0.1' called HIC
include FHIRHelpers version '4.0.1'
include WHOCommon called WCom
include HIVConceptsCustom called HCC

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
 * Definition: Number of people experiencing at least one moderate or severe adverse event during or following circumcision surgery during the reporting period
 * Calculation: COUNT of clients with "VMMC procedure date" in the reporting period AND "Adverse event severity" IN 'Moderate', 'Severe' AND "Timing of adverse event" LESS THAN 30 days from "VMMC procedure date"
 */

define "Numerator":
  exists(HIE."VMMC_adverse_event" VMAC
    where (VMAC.severity = HCC."severe"
    or VMAC.severity = HCC."moderate")
  )


/**
 * Denominator
 *
 * Definition: a) 1 | b) Total number of individuals under going VMMC performed according to national standard during the reporting period
 * Calculation: a) 1 | b) COUNT of clients with a "VMMC procedure date" in the reporting period
 */

define "Denominator":
  HIE."VMMC"
    

/* end Populations */



/*
 * Disaggregators
 */

define "Administrative Gender Stratifier":
	HIE."By Administrative Gender Stratifier"

define "Age Stratifier":
	HIE."By Age Stratifier 2"

define "Geographic Region Stratifier":
	HIE."By Geographic Region Stratifier"

define "Setting":
    HIE."setting"

define "VMMC_adverse_event_type":
    HIE."VMMC_adverse_event_type"

define "VMMC_adverse_event_timing":
    HIE.VMMC_adverse_event_timing


//provider type not provided?
//service site not provided?

define "Stratification":
 HIE."By Administrative Gender Stratifier".code 
  + ':' + HIE."By Age Stratifier 2"
+ ':' + HIE."By Geographic Region Stratifier"
 + ':' + HIE."setting".code
+ ':' + HIE."VMMC_adverse_event_type".code 
+ ':' + HIE."VMMC_adverse_event_timing".code 