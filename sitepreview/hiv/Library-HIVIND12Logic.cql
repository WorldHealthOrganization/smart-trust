/**
 * Library: HIV.IND.12 Logic
 * Ref No: PRV.12
 * Short Name: Total person-years on OAMT
 *
 * Definition: % of person-years of follow-up (PYFU) on OAMT among opioid dependent people
 *
 * Numerator: Total PYFU on OAMT during defined reporting period. | Calculated from the sum of the time on OAMT of each OAMT recipient during the reporting period.
 * Numerator Calculation: SUM of [DIFFERENCE in MIN("Date OAMT initiated", "Reporting period start date") and MAX("Date of loss to follow-up or OAMT stopped", "Reporting period end date")] for all clients with "Medications prescribed" IN 'Methadone', 'Buprenorphine'
 * Numerator Exclusions: 
 *
 * Denominator: a) Programme/service provider level: estimated PYFU for all opioid dependent people accessing service during defined reporting period | b) Population level: estimated PYFU for total population of opioid dependent people in relevant geographic area during defined reporting period
 * Denominator Calculation: Service level: Not calculated in DAK |  | Population denominator:  | *Estimated PYFU for all opioid-dependent people accessing service during defined reporting period |  | Note: Can be reported only as numerator; by population or service level if these denominator estimates available.
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Gender (female, male, other*) 
 *  • Age (15–19, 20–24, 25–49, 50+ years) 
 *  • Provider type (key population-led or community-led organization, public sector provider, other entities such as private for-profit and not-for-profit organizations, including faith-based, international, nongovernmental) 
 *  • Setting: facility-based service (including hospitals, health clinics, general practice offices, etc.) or community-based service (including drop-in centres, community service delivery points, mobile clinics or vans, outreach teams, community support groups, etc.) 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Gender | Age
 *
 * Numerator and Denominator Elements:
 * Date OAMT initiated 
 *  Date of loss to follow-up or OAMT stopped 
 *  Medications prescribed 
 *  Reporting period end date 
 *  Reporting period start date
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
 * HIV.C.DE75: Medications prescribed | Medications the client was prescribed
 * HIV.C.DE76: PrEP for HIV prevention | Client was prescribed pre-exposure prophylaxis (PrEP) for HIV prevention
 * HIV.C.DE77: PEP for HIV prevention | Client was prescribed post-exposure prophylaxis (PEP) for HIV prevention
 * HIV.C.DE78: Other | Client was prescribed other medications
 * HIV.D.DE457: Medications prescribed | Name or regimen code of all other medications prescribed during the visit
 * HIV.PRV.DE17: Date OAMT initiated | Date client initiated opioid agonist maintenance treatment (OAMT)
 * HIV.PRV.DE25: Date of loss to follow-up or OAMT stopped | Date of loss to follow-up or opioid agonist maintenance treatment (OAMT) stopped
 * HIV.Config.DE20: Reporting period end date | End date of the reporting period
 * HIV.Config.DE21: Reporting period start date | Start date of the reporting period
 *
 * Additional Context
 * - what it measures: Measure of the proportion of person time in which individuals who are opioid dependent are covered by OAMT.
 * - rationale: Evidence demonstrates that HIV risk is reduced among individuals who are opioid dependent during periods when receiving OAMT.
 * - method: Individual-level data obtained from programme records.
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

library HIVIND12Logic

// Included Libraries
using FHIR version '4.0.1'

include HIVCommon version '0.0.1' called HIC
include FHIRHelpers version '4.0.1'

include WHOCommon called WCom

include HIVElements called HE
include HIVIndicatorElements called HIE

// Indicator Definition
parameter "Measurement Period" Interval<DateTime> default Interval[@2023-01-01, @2023-01-30]

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
 * Definition: Total PYFU on OAMT during defined reporting period. | Calculated from the sum of the time on OAMT of each OAMT recipient during the reporting period.
 * Calculation: SUM of [DIFFERENCE in MIN("Date OAMT initiated", "Reporting period start date") and MAX("Date of loss to follow-up or OAMT stopped", "Reporting period end date")] for all clients with "Medications prescribed" IN 'Methadone', 'Buprenorphine'
 */

define "Measure Population":
  exists(HIE."buprenorphine_prescribed at date") or exists(HIE."methadone_prescribed at date")


define "Measure Observation":
  (
    difference in days between
    Min(
      {
        ToDate(First(HIE."OAMT start")), 
        ToDate(start of "Measurement Period")
      }
    )

    and ToDate(start of "Measurement Period")
  )
  +
  (
    difference in days between end of "Measurement Period"
    and Coalesce(
        ToDate(First(HIE."OAMT end")), 
        end of "Measurement Period"
      )
  )
  
/**
 * Denominator
 *
 * Definition: a) Programme/service provider level: estimated PYFU for all opioid dependent people accessing service during defined reporting period | b) Population level: estimated PYFU for total population of opioid dependent people in relevant geographic area during defined reporting period
 * Calculation: Service level: Not calculated in DAK |  | Population denominator:  | *Estimated PYFU for all opioid-dependent people accessing service during defined reporting period |  | Note: Can be reported only as numerator; by population or service level if these denominator estimates available.
 */

/* end Populations */

