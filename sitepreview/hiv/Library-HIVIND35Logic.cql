/**
 * Library: HIV.IND.35 Logic
 * Ref No: ART.9
 * Short Name: ARV toxicity prevalence
 *
 * Definition: % of ART patients with treatment-limiting ARV toxicity
 *
 * Numerator: Number of ART patients who have stopped treatment or switched regimen due to toxicity in the reporting period
 * Numerator Calculation: COUNT of clients with "HIV status"='HIV-positive' with a "Date ART stopped" in the reporting period AND "Reason ART stopped"='Toxicity/side effects' | PLUS | COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True AND either "Date of switch to second-line regimen" OR "Date of switch to third-line regimen" in the reporting period with a "Reason for regimen switch"='Toxicity/side effects'  | PLUS | COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True AND either "Date(s) of substitution within second-line regimen" OR "Date(s) of substitution within third-line regimen" in the reporting period AND "Reason for ARV drug regimen substitution"='Toxicity/side effects'
 * Numerator Exclusions: 
 *
 * Denominator: Number of ART patients in the reporting period
 * Denominator Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True within the reporting period
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Gender (female, male, other*) 
 *  • Age (<0–4, 5–9, 10–14, 15-19, >19 years)** 
 *  • Key populations (men who have sex with men, people living in prisons and other closed settings, people who inject drugs, sex workers, trans and gender diverse people)*** 
 *  • ART regimen 
 *  • Pregnancy status 
 *  • Type of toxicity (gastrointestinal, skin, peripheral neuropathy, central nervous system, weight gain, hepatic dysfunction, haematological, fatigue, headache, bone dysfunction, metabolic, kidney dysfunction) 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: Gender | Age | Key population member type | Current ART regimen | Currently pregnant | Type of treatment-limiting toxicity
 *
 * Numerator and Denominator Elements:
 * Date ART stopped 
 *  Date of switch to second-line regimen 
 *  Date of switch to third-line regimen 
 *  Date(s) of substitution within second-line regimen 
 *  Date(s) of substitution within third-line regimen 
 *  HIV status 
 *  On ART 
 *  Reason ART stopped 
 *  Reason for ARV drug regimen substitution 
 *  Reason for regimen switch
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
 * HIV.B.DE29: Currently pregnant | Client is currently pregnant
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
 * HIV.D.DE31: Currently pregnant | Client is currently pregnant
 * HIV.D.DE38: On ART | Client is currently taking ART
 * HIV.D.DE41: Date ART stopped | Date on which client stopped ART
 * HIV.D.DE75: Current ART regimen | The current ART regimen the client is taking
 * HIV.D.DE217: Reason ART stopped | Reason client intentionally stopped ART
 * HIV.D.DE218: Toxicity/side effects | Client stopped ART because of toxicity/side effects
 * HIV.D.DE219: Severe illness, hospitalization | Client stopped ART because of severe illness, hospitalization
 * HIV.D.DE220: Drugs out of stock | Client stopped ART because drugs were out of stock
 * HIV.D.DE221: Client lacks finances | Client stopped ART because of lack of finances
 * HIV.D.DE222: Excluded HIV infection in infant | Client stopped ART because HIV infection in infant was excluded
 * HIV.D.DE223: Other reason for stopping ART | Client stopped ART because of other reason
 * HIV.D.DE418: Reason for ARV drug regimen substitution | Reason why a substitution was made to the antiretroviral (ARV) drug regimen
 * HIV.D.DE419: Toxicity/side effects | A substitution was made to the regimen because of toxicity/side effects
 * HIV.D.DE420: Drug-drug interaction | A substitution was made to the regimen because of a drug-drug interaction
 * HIV.D.DE421: Pregnancy | A substitution was made to the regimen because of pregnancy
 * HIV.D.DE422: New TB | A substitution was made to the regimen because of new tuberculosis (TB)
 * HIV.D.DE423: New drug available | A substitution was made to the regimen because a new drug was available
 * HIV.D.DE424: Drug out of stock | A substitution was made to the regimen because drug was out of stock
 * HIV.D.DE425: Other reason for regimen substitution | A substitution was made for another reason
 * HIV.D.DE466: Type of treatment-limiting toxicity | Type of treatment-limiting toxicity experienced by client. Treatment-limiting toxicity is defined as a serious adverse drug reaction that results in drug discontinuation or substitution. In addition, any reaction that leads to treatment interruption or requires changing the drug or regimen because of an adverse drug reaction is also considered a serious adverse drug reaction.
 * HIV.D.DE467: Gastrointestinal | Treatment-limiting toxicity due to GI issues (nausea, diarrhoea, abdominal pain, vomiting)
 * HIV.D.DE468: Skin issues | Treatment-limiting toxicity due to skin issues (rash, hypersensitivity reaction)
 * HIV.D.DE469: Peripheral neuropathy | Treatment-limiting toxicity due to peripheral neuropathy (burning/numbness/ tingling)
 * HIV.D.DE470: Central nervous system symptoms | Treatment-limiting toxicity due to central nervous system symptoms (dizzy, anxiety, nightmare, depression, seizures)
 * HIV.D.DE471: Weight gain | Treatment-limiting toxicity due to weight gain
 * HIV.D.DE472: Hepatic dysfunction | Treatment-limiting toxicity due to hepatic dysfunction (jaundice)
 * HIV.D.DE473: Haematological disorders | Treatment-limiting toxicity due to haematological (anaemia, neutropenia) disorders
 * HIV.D.DE474: Fatigue | Treatment-limiting toxicity due to fatigue
 * HIV.D.DE475: Headache | Treatment-limiting toxicity due to headache
 * HIV.D.DE476: Bone dysfunction | Treatment-limiting toxicity due to bone dysfunction (fractures, osteopenia)
 * HIV.D.DE477: Metabolic symptoms | Treatment-limiting toxicity due to metabolic symptoms (body fat changes, hyperglycaemia, dyslipidaemia)
 * HIV.D.DE478: Kidney dysfunction | Treatment-limiting toxicity due to kidney dysfunction (nephrolithiasis, renal insufficiency)
 * HIV.D.DE479: Unexpected adverse drug reaction | Client experienced an unexpected adverse drug reaction
 * HIV.D.DE487: Date(s) of substitution within second-line regimen | Date on which ARV drug regimen for client was changed within the second-line regimen (substitution)
 * HIV.D.DE493: Date(s) of substitution within third-line regimen | Date on which ARV drug regimen for client was changed within the third-line (substitution)
 * HIV.E.DE114: Key population member type* | The type of key population that the infant's mother is included in
 * HIV.E.DE115: Sex worker | Infant's mother is a sex worker
 * HIV.E.DE116: People who inject drugs | Infant's mother is a person who injects drugs
 * HIV.E.DE117: Trans and gender-diverse people | Infant's mother identifies as trans and gender-diverse
 * HIV.E.DE118: People living in prisons and other closed setting | Infant's mother is in a prison or closed setting
 * HIV.H.DE47: On ART | Client is currently taking ART 
 * HIV.H.DE73: Date ART stopped | Date on which client stopped ART
 * HIV.H.DE74: Reason ART stopped | Reason why client intentionally stopped ART
 * HIV.H.DE75: Toxicity/side effects | Client stopped ART because of toxicity/side effects
 * HIV.H.DE76: Severe illness, hospitalization | Client stopped ART because of severe illness, hospitalization
 * HIV.H.DE77: Drugs out of stock  | Client stopped ART because of drugs being out of stock 
 * HIV.H.DE78: Client lacks finances  | Client stopped ART because client lacked finances 
 * HIV.H.DE79: Excluded HIV infection in infant | Client stopped ART because the infant was determined to not have HIV
 * HIV.H.DE80: Other reason for stopping ART | Client stopped ART for other reason
 * HIV.SRV.DE7: Currently pregnant | Client is currently pregnant
 *
 * Additional Context
 * - what it measures: Measures the incidence of serious ARV toxicities among ART patients.
 * - rationale: • As use of ARVs is scaled up, people living with HIV have the potential for prolonged exposure to ARVs and the potential to experience ARV-related toxicity. | • ARV-related toxicities are some of the most common reasons reported for ART non- adherence, treatment discontinuation or substitution of drugs and, thus, are important to monitor.
 * - method: For the numerator and denominator: HIV patient monitoring tools (ART registers, patient records/EMRs). To enable reporting codes for reasons for ART stop or switch are provided in patient monitoring tools (Web Annex H HIV patient card and Annex K ART register) |  | "Treatment-limiting" toxicity is defined as follows: A serious adverse drug reaction that results in drug discontinuation or substitution. In addition, any reaction that leads to treatment interruption or requires changing the drug or regimen because of an adverse drug reaction is also considered a serious adverse drug reaction.
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

library HIVIND35Logic

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
 * Definition: Number of ART patients who have stopped treatment or switched regimen due to toxicity in the reporting period
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' with a "Date ART stopped" in the reporting period AND "Reason ART stopped"='Toxicity/side effects' | PLUS | COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True AND either "Date of switch to second-line regimen" OR "Date of switch to third-line regimen" in the reporting period with a "Reason for regimen switch"='Toxicity/side effects'  | PLUS | COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True AND either "Date(s) of substitution within second-line regimen" OR "Date(s) of substitution within third-line regimen" in the reporting period AND "Reason for ARV drug regimen substitution"='Toxicity/side effects'
 */

define "Numerator":
  (HIE."Has HIV-positive Status"
  and HIE."Toxicity/side effects H.DE75")
  and ((
    HIE."Has HIV-positive Status" 
    and HIE."On ART H.DE47"
    and 
    (exists(HE."New regimen after switch to second-line regimen" R
    with HE."Toxicity/side effects H.DE75" T
    such that R.partOf.references(T)
    where R.effective.toInterval() during "Measurement Period"
    )
    or 
    (
    exists(HE."New regimen after switch to third-line regimen" R
    with HE."Toxicity/side effects H.DE75" T
    such that R.partOf.references(T)
    where R.effective.toInterval() during "Measurement Period"  
    )
    )
  )
  )
  or
  (
    HIE."Has HIV-positive Status"
    and HIE."On ART H.DE47"
    and 
    (exists(HE."New regimen after substitution within second-line regimen" R
    with HE."Toxicity/side effects H.DE75" T
    such that R.partOf.references(T)
    where R.effective.toInterval() during "Measurement Period"
    )
    or 
    (
    exists(HE."New regimen after substitution within third-line regimen" R
    with HE."Toxicity/side effects H.DE75" T
    such that R.partOf.references(T)
    where R.effective.toInterval() during "Measurement Period"  
    )
    )
  )
  )

  )

/**
 * Denominator
 *
 * Definition: Number of ART patients in the reporting period
 * Calculation: COUNT of clients with "HIV status"='HIV-positive' AND "On ART"=True within the reporting period
 */

define "Denominator":
  HIE."Has HIV-positive Status"
    and HIE."On ART H.DE47"
    

/* end Populations */


/*
 * Disaggregators
 */

define "Administrative Gender Stratifier":
	HIE."By Administrative Gender Stratifier"

define "Age Stratifier 6":
	HIE."By Age Stratifier 6"

define "Geographic Region Stratifier":
	HIE."By Geographic Region Stratifier"

define "patientGroups Stratifier":
	HIE."patientGroups"

define "Current ART regimen":
  HIE."Current ART regimen"

define "pregnancy stratifier":
  HIE."pregnancy stratifier"

define "Type of treatment-limiting toxicity":
  HIE."Type of treatment-limiting toxicity"

define "Stratification":
 HIE."By Administrative Gender Stratifier".code 
  + ':' + HIE."By Age Stratifier 6"
+ ':' + HIE."By Geographic Region Stratifier"
+ Combine(HIE.patientGroups, ':')
+ HIE."Current ART regimen".code 
+ HIE."Type of treatment-limiting toxicity".code
+ HIE."pregnancy stratifier".code

