/**
 * Library: HIV.IND.3 Logic
 * Ref No: PRV.3
 * Short Name: PrEP coverage
 *
 * Definition: % of people prescribed PrEP among those identified as being at elevated risk for HIV acquisition
 *
 * Numerator: Number of unique individuals prescribed or dispensed any form of PrEP at least once during the reporting period. Individuals prescribed different products or regimens at different times during the reporting period should be counted only once.
 * Numerator Calculation: Count of clients with "Date medications prescribed" within reporting period AND "Medications prescribed"='PrEP for HIV prevention'
 * Numerator Exclusions: 
 *
 * Denominator: a) Programme/service provider level: number of individuals who received a negative HIV test during the reporting period and identified as being at elevated risk for HIV acquisition (includes people requesting/receiving any HIV prevention intervention, people from key populations, people with known risk factors or assessed as being at risk of HIV acquisition) |  | b) Population level: population-level estimate of the number of people who would benefit from PrEP, for example as derived from a PrEP need estimator tool
 * Denominator Calculation: Programme/service provider level:  | COUNT of clients with "HIV test date" within reporting period AND "HIV test result"='HIV-negative' AND "At elevated risk for HIV acquisition"=True † |  | Population level: *Estimate of the number of people who would benefit from PrEP
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Gender (female, male, other*) 
 *  • Age (15–19, 20–24, 25–49, 50+ years) 
 *  • Key populations (men who have sex with men, people living in prisons and other closed settings, people who inject drugs, sex workers, trans and gender diverse people)** 
 *  • PrEP product and formulation (oral, long-acting device, long-acting injectable). Some people may start, continue, stop and restart, one or multiple times with different products or formulations in a given reporting period. Because of this, the percentages of recipients receiving different PrEP products may total more than 100%. 
 *  • Experience with PrEP (first time, continuing or restarting following a period of not taking PrEP) 
 *  • Provider type (key population-led or community-led organization, public sector provider, other entities such as private for-profit and not-for-profit organizations, including faith-based, international, nongovernmental) 
 *  • Setting: facility-based service (including hospitals, health clinics, general practice offices, etc.) or community-based service (including drop-in centres, community service delivery points, mobile clinics or vans, outreach teams, community support groups, etc.) 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Gender | Age | Key population member type | PrEP product prescribed | Experience with PrEP
 *
 * Numerator and Denominator Elements:
 * At elevated risk for HIV acquisition 
 *  Date medications prescribed 
 *  HIV test date 
 *  HIV test result 
 *  Medications prescribed
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
 * HIV.B.DE110: HIV test date | Date of the HIV test
 * HIV.B.DE111: HIV test result | The result from HIV testing after applying the testing algorithm
 * HIV.B.DE112: HIV-positive | Test result is HIV-positive
 * HIV.B.DE113: HIV-negative | Test result is HIV-negative
 * HIV.B.DE114: HIV-inconclusive | Test result is HIV-inconclusive
 * HIV.B.DE225: At elevated risk for HIV acquisition | Client is at elevated risk for HIV acquisition
 * HIV.C.DE24: Experience with PrEP | The client's experience in taking PrEP
 * HIV.C.DE25: First-time user | The client has never used pre-exposure prophylaxis (PrEP) before (naive)
 * HIV.C.DE26: Continuing user | The client has used PrEP before and is continuing to use PrEP
 * HIV.C.DE27: Restarting following a period of not taking PrEP | The client is restarting PrEP following a period of not taking PrEP
 * HIV.C.DE74: Date medications prescribed | Date the client was prescribed medications
 * HIV.C.DE75: Medications prescribed | Medications the client was prescribed
 * HIV.C.DE76: PrEP for HIV prevention | Client was prescribed pre-exposure prophylaxis (PrEP) for HIV prevention
 * HIV.C.DE77: PEP for HIV prevention | Client was prescribed post-exposure prophylaxis (PEP) for HIV prevention
 * HIV.C.DE78: Other | Client was prescribed other medications
 * HIV.C.DE80: PrEP product prescribed | PrEP product that the client was prescribed
 * HIV.C.DE81: Oral PrEP | Client was prescribed oral PrEP
 * HIV.C.DE82: Dapivirine vaginal ring (DVR) | Client was prescribed dapivirine vaginal ring (DVR)
 * HIV.C.DE83: CAB-LA | Client was prescribed long-acting cabotegravir (CAB-LA)
 * HIV.C.DE84: Other | Client was prescribed other PrEP product
 * HIV.D.DE457: Medications prescribed | Name or regimen code of all other medications prescribed during the visit
 * HIV.D.DE458: Date medications prescribed | Date the medications were prescribed
 * HIV.E.DE114: Key population member type* | The type of key population that the infant's mother is included in
 * HIV.E.DE115: Sex worker | Infant's mother is a sex worker
 * HIV.E.DE116: People who inject drugs | Infant's mother is a person who injects drugs
 * HIV.E.DE117: Trans and gender-diverse people | Infant's mother identifies as trans and gender-diverse
 * HIV.E.DE118: People living in prisons and other closed setting | Infant's mother is in a prison or closed setting
 * HIV.E.DE224: HIV test date | Date of the HIV test
 * HIV.PRV.DE1: At elevated risk for HIV acquisition | Client is at elevated risk for HIV acquisition, defined according to country/programme context
 * HIV.PRV.DE27: Date medications prescribed | Date the client was prescribed medications
 * HIV.SRV.DE1: HIV test date | Date of the HIV test
 * HIV.SRV.DE2: HIV test result | The result from HIV testing after applying the testing algorithm
 *
 * Additional Context
 * - what it measures: Measures PrEP uptake among the group estimated to be vulnerable to HIV acquisition. |  | When calculated at the programme/service provider level, the denominator includes all individuals accessing the service identified as being at elevated risk for to HIV acquisition.
 * - rationale: • WHO recommends that PrEP be offered as an additional prevention choice for people at substantial risk of HIV infection as part of combination HIV prevention approaches. |  | • Uptake and use of PrEP reflects people's awareness and interest in lowering their risk for HIV through the use of ARVs.
 * - method: Individual-level data obtained from programme records. |  | If individual-level data are not available, the indicator can be reported using aggregate programme data. Because de-duplication is not possible, individuals prescribed multiple | PrEP products or formulations at different times during the reporting period may be counted multiple times, and the number reported may be greater than the number of unique individuals receiving PrEP during the reporting period.
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 * 
 * Profiles:
 * - HivPrepTreatment
 * - HivPepTreatment
 */

library HIVIND3Logic

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
/*
 * As defined by Member State
 */
define "Initial Population":
  true
  
/* Numerator Calculation: Count of clients with "Date medications prescribed" within reporting period AND "Medications prescribed"='PrEP for HIV prevention'*/

define "numerator":
    HIE."PrEP for HIV prevention" and HIE."HIV-negative test result" and 
    HIE."At elevated risk for HIV acquisition B.DE225"

/*  * Denominator Calculation: Programme/service provider level:  | COUNT of clients with "HIV test date" within reporting period AND "HIV test result"='HIV-negative' AND "At elevated risk for HIV acquisition"=True † |  | Population level: *Estimate of the number of people who would benefit from PrEP */
define "denominator":
	HIE."HIV-negative test result" and 
    HIE."At elevated risk for HIV acquisition B.DE225"

    
/*
 * Disaggregators
 */

define "Administrative Gender Stratifier":
	HIE."By Administrative Gender Stratifier"

define "Age Stratifier":
	HIE."By Age Stratifier 3"

define "Geographic Region Stratifier":
	HIE."By Geographic Region Stratifier"

define "patientGroups Stratifier":
	HIE."patientGroups"

define "Setting":
    HIE."setting"

define "prep product":
    HIE."prep_product"

define "prep_experience":
    HIE."prep_experience"

define "prep_dosing":
    HIE."prep_dosing"

// Provider type concepts are not found in DD

define "Stratification":
 HIE."By Administrative Gender Stratifier".code 
  + ':' + HIE."By Age Stratifier 3"
+ ':' + HIE."By Geographic Region Stratifier"
+ Combine(HIE.patientGroups, ':')
 + ':' + HIE."setting".code
+ Combine(HIE.prep_product, ':')
+ Combine(HIE.prep_experience, ':')
+ Combine(HIE.prep_dosing, ':')