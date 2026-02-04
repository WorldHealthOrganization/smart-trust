library HIVElements

using FHIR version '4.0.1'

//include fhir.cqf.common.FHIRCommon called FC
include FHIRHelpers version '4.0.1'

include WHOConcepts
include WHOCommon called WC
include WHOElements called WE

include HIVConcepts version '0.0.2' called Concepts
include HIVConceptsCustom version '0.0.1' called ConceptsCustom
include HIVCommon called Common

context Patient

/**
 * HIV Elements
 */

/* General Element Definitions */

// From Common

// Exposure to HIV
define Exposure_Occupational:
  exists (
    [Observation: Concepts."HIV exposure type"] O
    where O.status in { 'final', 'amended', 'corrected' }
    and exists(O.category OC where OC ~ ConceptsCustom."social-history")
    and O.value ~ Concepts."Occupational"
  )

define Exposure_Non_Occupational_violent:
  exists (
    [Observation: Concepts."HIV exposure type"] O
    where O.status in { 'final', 'amended', 'corrected' }
    and exists(O.category OC where OC ~ ConceptsCustom."social-history")
    and O.value ~ Concepts."Non-occupational violent"
  )

define Exposure_Non_Occupational_consensual_sex:
  exists (
    [Observation: Concepts."HIV exposure type"] O
    where O.status in { 'final', 'amended', 'corrected' }
    and exists(O.category OC where OC ~ ConceptsCustom."social-history")
    and O.value ~ Concepts."Non-occupational consensual sex"
  )

// Needle Syringe Dispensed
define "Needle Syringe Dispensed":  
  null
  // Todo: Error with compilation
  // [DeviceUseStatement] DUS
  // with [Observation: Concepts."Key population member - HIV.E.DE113"] O
  //     such that DUS.reasonReference.references(O) 
  //       and O.status in { 'final', 'amended', 'corrected' }
  //       and exists(O.category OC where OC ~ ConceptsCustom."social-history")
  //       and O.value ~ Concepts."People who inject drugs - HIV.B.DE54"
  // where DUS.status = 'completed'

define "HIV PREP Active":
[MedicationStatement] MS
    where MS.status = 'completed'
    and exists(MS.reasonCode C where C ~ Concepts."PrEP for HIV prevention")

 define "Client is at elevated risk for HIV acquisition":
    [Observation] O
    where O.status in { 'final', 'amended', 'corrected' }
    and exists(O.category OC where OC ~ ConceptsCustom."social-history")
    and O.code ~ Concepts."At elevated risk for HIV acquisition - HIV.B.DE225"

define "PREP Prescription":
  [MedicationRequest] MR
    where MR.status = 'completed'
    and MR.intent = 'order'
    and (MR.medication as CodeableConcept in Concepts."PrEP product prescribed Choices"
    or MR.medication as CodeableConcept in Concepts."Current PrEP regimen Choices")

define "PEP Prescription":
  [MedicationRequest] MR
      where MR.status = 'completed'
      and MR.intent = 'order'
      and (MR.medication as CodeableConcept in Concepts."Preferred PEP backbone regimen Choices"
      or MR.medication as CodeableConcept in Concepts."Alternative PEP backbone regimen Choices"
      or MR.medication as CodeableConcept in Concepts."Preferred third PEP drug Choices"
      or MR.medication as CodeableConcept in Concepts."Alternative third PEP drug Choices")



define "viral load sample collection":
  [Procedure] P
  where P.status = 'completed'
  and P.code ~ ConceptsCustom."viral load test"

define "HIV Positive Condition":
[Condition] C
    where C.clinicalStatus ~ ConceptsCustom."active"
    and exists(C.category CC where CC ~ ConceptsCustom."encounter-diagnosis")
    and C.code ~ Concepts."HIV-positive - HIV.B.DE116"
    sort by start of onset.toInterval()

define "First HIV Treatment":
  First("On ART H.DE47")

define "First HIV Positive Condition":
  First("HIV Positive Condition")
  

/* On ART - includes "On ART - HIV.B.DE47" and "On ART - HIV.B.DE48" */
define "ART Medication Statement":
  [MedicationStatement: Concepts."ART regimen Choices"] MS
  sort by start of effective.toInterval()

define "On ART":
  exists "ART Medication Statement"

define "ART start date":
  "ART Medication Statement" MS
  return start of MS.effective.toInterval()

define "First On ART":
  (First("On ART D.DE38"))

define "Viral load tests received after ART intitiation":
  "Viral load test result D.DE387" O
  where start of O.issued.toInterval() after start of "First On ART".effective.toInterval()
  sort by start of issued.toInterval()

// Entries based on DAK Data Dictionary for Data Elements marked as used
// in at least one Decision Support Table or Aggregate Indicator

/*
@dataElement: HIV.A.DE3 - Visit date
@activity: HIV.A2 Gather client details
@description: The date and time of the client's visit
*/
define "Visit date A.DE3":
  [Encounter] E
    where E.type.coding.code contains Concepts."HIV testing services visit".code
  
/* End of Visit date A.DE3 */

/*
@dataElement: HIV.A.DE16 - Estimated age
@activity: HIV.A6.1 Review sociodemographic data with client | HIV.A5 Create new client record
@description: If DOB is unknown, enter the client's estimated age. Display client's age in number of years.
*/
define "Estimated age":
  [Observation: Concepts."Estimated age"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Estimated age Value":
  First("Estimated age" O
    where O.value is not null
    and O.value is Quantity
  ).value as Quantity
/* End of Estimated age */

/*
@dataElement: HIV.A.DE17 - Age
@activity: HIV.A6.1 Review sociodemographic data with client | HIV.A5 Create new client record
@description: Calculated age (number of years) of the client based on date of birth
*/
/** 
 * @dataElement Patient age in years
 */
define "Current Patient Age In Years":
  AgeInYearsAt(Today())

/** 
 * @dataElement Patient age in weeks
 */
define "Current Patient Age In Weeks":
  AgeInWeeksAt(Today())

/** 
 * @dataElement Patient age in months
 */
define "Current Patient Age In Months":
  AgeInMonthsAt(Today())
/* End of Age */

/*
@dataElement: HIV.A.DE18 - Gender
@activity: HIV.A6.1 Review sociodemographic data with client | HIV.A5 Create new client record
@description: Gender of the client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Gender":
  exists "Gender Observation"
define "Gender Observation":
  [Observation: Concepts."Gender"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Gender */

/*
@dataElement: HIV.A.DE19 - Female
@activity: HIV.A6.1 Review sociodemographic data with client | HIV.A5 Create new client record
@description: Client identifies as female
*/
// TODO: Replace placeholder with relevant CQL logic
define "Female":
  exists "Female Condition"
    or exists "Female Observation"
define "Female Condition":
  [Condition: Concepts."Female"]
define "Female Observation":
  "Gender Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Female"
/* End of Female */

/*
@dataElement: HIV.A.DE20 - Male
@activity: HIV.A6.1 Review sociodemographic data with client | HIV.A5 Create new client record
@description: Client identifies as male
*/
// TODO: Replace placeholder with relevant CQL logic
define "Male":
  exists "Male Condition"
    or exists "Male Observation"
define "Male Condition":
  [Condition: Concepts."Male"]
define "Male Observation":
  "Gender Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Male"
/* End of Male */

/*
@dataElement: HIV.A.DE21 - Transgender male
@activity: HIV.A6.1 Review sociodemographic data with client | HIV.A5 Create new client record
@description: Client identifies as transgender male
*/
// TODO: Replace placeholder with relevant CQL logic
define "Transgender male":
  exists "Transgender male Condition"
    or exists "Transgender male Observation"
define "Transgender male Condition":
  [Condition: Concepts."Transgender male"]
define "Transgender male Observation":
  "Gender Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Transgender male"
/* End of Transgender male */

/*
@dataElement: HIV.A.DE22 - Transgender female
@activity: HIV.A6.1 Review sociodemographic data with client | HIV.A5 Create new client record
@description: Client identifies as transgender female
*/
// TODO: Replace placeholder with relevant CQL logic
define "Transgender female":
  exists "Transgender female Condition"
    or exists "Transgender female Observation"
define "Transgender female Condition":
  [Condition: Concepts."Transgender female"]
define "Transgender female Observation":
  "Gender Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Transgender female"
/* End of Transgender female */

/*
@dataElement: HIV.A.DE23 - Other
@activity: HIV.A6.1 Review sociodemographic data with client | HIV.A5 Create new client record
@description: Additional category
*/
// TODO: Replace placeholder with relevant CQL logic
define "Other A.DE23":
  exists "Other A.DE23 Condition"
    or exists "Other A.DE23 Observation"
define "Other A.DE23 Condition":
  [Condition: Concepts."Other - HIV.A.DE23"]
define "Other A.DE23 Observation":
  "Gender Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Other - HIV.A.DE23"
/* End of Other A.DE23 */


/*
@dataElement: HIV.B HTS Visit Enounter
@activity: HIV.B1 Determine reason for visit
@description: Encounter for HIV testing services visit
*/
define "HTS Visit":
  [Encounter] E
    where E.type.coding.code contains ConceptsCustom."HTS Visit".code
    
/*
@dataElement: HIV.B.DE1 - Reason for visit
@activity: HIV.B1 Determine reason for visit
@description: Reason for HIV testing services visit
*/
define "Reason for visit B.DE1":
  flatten("HTS Visit" E
  return E.reasonCode)
/* End of Reason for visit B.DE1 */

/*
@dataElement: HIV.B.DE2 - First-time HIV test
@activity: HIV.B1 Determine reason for visit
@description: First encounter for screening for human immunodeficiency virus
*/
define "First-time HIV test Encounter":
  "HTS Visit" E
  where E.reasonCode.coding.code contains Concepts."First-time HIV test".code
/* End of First-time HIV test */

/*
@dataElement: HIV.B.DE3 - Retesting for HIV
@activity: HIV.B1 Determine reason for visit
@description: Retesting for human immunodeficiency virus
*/
// TODO: Replace placeholder with relevant CQL logic
define "Retesting for HIV B.DE3 Encounter":
  "HTS Visit" E
  where E.reasonCode.coding.code contains Concepts."Retesting for HIV - HIV.B.DE3".code
/* End of Retesting for HIV B.DE3 */

/*
@dataElement: HIV.B.DE4 - HIV testing services visit
@activity: HIV.B1 Determine reason for visit
@description: Client attending facility for HIV testing services visit
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV testing services visit Encounter":
  "HTS Visit" E
  where E.reasonCode.coding.code contains Concepts."HIV testing services visit".code
/* End of HIV testing services visit */

/*
@dataElement: HIV.B.DE5 - Referred through partner services
@activity: HIV.B1 Determine reason for visit
@description: Client reported coming to the facility after receiving a provider-assisted referral or patient referral from a contact or partner
*/
// TODO: Replace placeholder with relevant CQL logic
define "Referred through partner services":
  exists "Referred through partner services Observation"
define "Referred through partner services Observation":
  [Observation: Concepts."Referred through partner services"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Referred through partner services */

/*
@dataElement: HIV.B.DE6 - Partner or contact of an index case
@activity: HIV.B1 Determine reason for visit
@description: The client is a contact or partner of a person diagnosed with HIV (an index case)
*/

define "Partner or contact of an index case":
    [Observation: Concepts."Referred through partner services"] O 
    where O.status in { 'final', 'amended', 'corrected' }
    and exists(O.category OC where OC ~ ConceptsCustom."social-history")
    and O.code ~ Concepts."Partner or contact of an index case"
  
define "Drug-injecting partner":
  [Observation: Concepts."Type of contact or partner for partner services"] O 
  where O.status in { 'final', 'amended', 'corrected' }
  and exists(O.category OC where OC ~ ConceptsCustom."social-history")
  and O.code ~ Concepts."Drug-injecting partner - HIV.B.DE10"

define "Sexual partner":
  [Observation: Concepts."Type of contact or partner for partner services"] O 
  where O.status in { 'final', 'amended', 'corrected' }
  and exists(O.category OC where OC ~ ConceptsCustom."social-history")
  and O.code ~ Concepts."Sexual partner - HIV.B.DE11" 

//HIV status of partner or contact (already known positive, newly diagnosed positive, negative) 

define "already known positive":
  [Observation: Concepts."HIV status of partner or contact"] O 
  where O.status in { 'final', 'amended', 'corrected' }
  and exists(O.category OC where OC ~ ConceptsCustom."social-history")
  and O.code ~ Concepts."Already knew positive"

define "Negative - HIV.H.DE37":
  [Observation: Concepts."HIV status of partner or contact"] O 
  where O.status in { 'final', 'amended', 'corrected' }
  and exists(O.category OC where OC ~ ConceptsCustom."social-history")
  and O.code ~ Concepts."Negative - HIV.H.DE37"

/* End of Partner or contact of an index case */

/*
@dataElement: HIV.B.DE7 - Partner or contact of an HIV testing client non-index case
@activity: HIV.B1 Determine reason for visit
@description: The client is a contact or partner identified through partner or social network services, but is not known to be a partner of an index-case
*/
// TODO: Replace placeholder with relevant CQL logic
define "Partner or contact of an HIV testing client non-index case":
  exists "Partner or contact of an HIV testing client non-index case Condition"
    or exists "Partner or contact of an HIV testing client non-index case Observation"
define "Partner or contact of an HIV testing client non-index case Condition":
  [Condition: Concepts."Partner or contact of an HIV testing client non-index case"]
define "Partner or contact of an HIV testing client non-index case Observation":
  "Referred through partner services Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Partner or contact of an HIV testing client non-index case"
/* End of Partner or contact of an HIV testing client non-index case */

/*
@dataElement: HIV.B.DE8 - Type of contact or partner for partner services
@activity: HIV.B1 Determine reason for visit
@description: Client's relationship to the person that referred the client for partner services or family services
*/
// TODO: Replace placeholder with relevant CQL logic
define "Type of contact or partner for partner services":
  exists "Type of contact or partner for partner services Observation"
define "Type of contact or partner for partner services Observation":
  [Observation: Concepts."Type of contact or partner for partner services"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Type of contact or partner for partner services */

/*
@dataElement: HIV.B.DE9 - Biological child
@activity: HIV.B1 Determine reason for visit
@description: Client is the biological child of the person that referred the client for family services
*/
// TODO: Replace placeholder with relevant CQL logic
define "Biological child":
  exists "Biological child Condition"
    or exists "Biological child Observation"
define "Biological child Condition":
  [Condition: Concepts."Biological child"]
define "Biological child Observation":
  "Type of contact or partner for partner services Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Biological child"
/* End of Biological child */

/*
@dataElement: HIV.B.DE10 - Drug-injecting partner
@activity: HIV.B1 Determine reason for visit
@description: Client is a drug-injecting partner of the person that referred the client for partner services
*/
// TODO: Replace placeholder with relevant CQL logic
define "Drug-injecting partner B.DE10":
  exists "Drug-injecting partner B.DE10 Condition"
    or exists "Drug-injecting partner B.DE10 Observation"
define "Drug-injecting partner B.DE10 Condition":
  [Condition: Concepts."Drug-injecting partner - HIV.B.DE10"]
define "Drug-injecting partner B.DE10 Observation":
  "Type of contact or partner for partner services Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Drug-injecting partner - HIV.B.DE10"
/* End of Drug-injecting partner B.DE10 */

/*
@dataElement: HIV.B.DE11 - Sexual partner
@activity: HIV.B1 Determine reason for visit
@description: Client is a sexual partner of the person that referred the client for partner services
*/
// TODO: Replace placeholder with relevant CQL logic
define "Sexual partner B.DE11":
  exists "Sexual partner B.DE11 Condition"
    or exists "Sexual partner B.DE11 Observation"
define "Sexual partner B.DE11 Condition":
  [Condition: Concepts."Sexual partner - HIV.B.DE11"]
define "Sexual partner B.DE11 Observation":
  "Type of contact or partner for partner services Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Sexual partner - HIV.B.DE11"
/* End of Sexual partner B.DE11 */

/*
@dataElement: HIV.B.DE12 - Social contact
@activity: HIV.B1 Determine reason for visit
@description: Client is a social contact of the person that referred the client for social-network services
*/
// TODO: Replace placeholder with relevant CQL logic
define "Social contact B.DE12":
  exists "Social contact B.DE12 Condition"
    or exists "Social contact B.DE12 Observation"
define "Social contact B.DE12 Condition":
  [Condition: Concepts."Social contact - HIV.B.DE12"]
define "Social contact B.DE12 Observation":
  "Type of contact or partner for partner services Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Social contact - HIV.B.DE12"
/* End of Social contact B.DE12 */

/*
@dataElement: HIV.B.DE14 - Date/time of suspected exposure to HIV
@activity: HIV.B1 Determine reason for visit
@description: Date and time when the client had suspected exposure to HIV
*/
define "Date/time of suspected exposure to HIV B.DE14":
  [Observation: Concepts."Date/time of suspected exposure to HIV - HIV.B.DE14"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Date/time of suspected exposure to HIV B.DE14 */

/*
@dataElement: HIV.B.DE15 - Testing entry point
@activity: HIV.B1 Determine reason for visit
@description: Whether testing is happening in the community or at a facility
*/
// TODO: Replace placeholder with relevant CQL logic
define "Testing entry point":
  exists "Testing entry point Observation"
define "Testing entry point Observation":
  [Observation: Concepts."Testing entry point"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Testing entry point */

/*
@dataElement: HIV.B.DE16 - Community-level testing
@activity: HIV.B1 Determine reason for visit
@description: Testing is happening in the community, which includes mobile testing
*/
// TODO: Replace placeholder with relevant CQL logic
define "Community-level testing":
  exists "Community-level testing Condition"
    or exists "Community-level testing Observation"
define "Community-level testing Condition":
  [Condition: Concepts."Community-level testing"]
define "Community-level testing Observation":
  "Testing entry point Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Community-level testing"
/* End of Community-level testing */

/*
@dataElement: HIV.B.DE17 - Facility-level testing
@activity: HIV.B1 Determine reason for visit
@description: Testing is happening at a facility
*/
// TODO: Replace placeholder with relevant CQL logic
define "Facility-level testing":
  exists "Facility-level testing Condition"
    or exists "Facility-level testing Observation"
define "Facility-level testing Condition":
  [Condition: Concepts."Facility-level testing"]
define "Facility-level testing Observation":
  "Testing entry point Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Facility-level testing"
/* End of Facility-level testing */

/*
@dataElement: HIV.B.DE29 - Currently pregnant
@activity: HIV.B6 Capture or update client history
@description: Client is currently pregnant
*/

define "Currently pregnant B.DE29":
  [Condition: Concepts."Currently pregnant - HIV.B.DE29"] C
  sort by start of prevalenceInterval() 
/* End of Currently pregnant B.DE29 */

/*
@dataElement: HIV.B.DE32 - Breastfeeding
@activity: HIV.B6 Capture or update client history
@description: Infant is being breastfed by mother
*/

define "Breastfeeding B.DE32":
  [Observation: Concepts."Breastfeeding - HIV.B.DE32"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value is true

define "Not Breastfeeding B.DE32":
  [Observation: Concepts."Breastfeeding - HIV.B.DE32"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value is false
/* End of Breastfeeding B.DE32 */

/*
@dataElement: HIV.B.DE33 - Partner HIV status reported
@activity: HIV.B6 Capture or update client history
@description: The HIV status of the client's partner.
*/
// TODO: Replace placeholder with relevant CQL logic
define "Partner HIV status reported":
  exists "Partner HIV status reported Observation"
define "Partner HIV status reported Observation":
  [Observation: Concepts."Partner HIV status reported"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Partner HIV status reported */

/*
@dataElement: HIV.B.DE34 - HIV-positive
@activity: HIV.B6 Capture or update client history
@description: Client's partner is HIV-positive
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV-positive B.DE34":
  exists "HIV-positive B.DE34 Condition"
    or exists "HIV-positive B.DE34 Observation"
define "HIV-positive B.DE34 Condition":
  [Condition: Concepts."HIV-positive"]
define "HIV-positive B.DE34 Observation":
  "Partner HIV status reported Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."HIV-positive"
/* End of HIV-positive B.DE34 */

/*
@dataElement: HIV.B.DE35 - HIV-negative
@activity: HIV.B6 Capture or update client history
@description: Client's partner is HIV-negative
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV-negative B.DE35":
  exists "HIV-negative B.DE35 Condition"
    or exists "HIV-negative B.DE35 Observation"
define "HIV-negative B.DE35 Condition":
  [Condition: Concepts."HIV-negative"]
define "HIV-negative B.DE35 Observation":
  "Partner HIV status reported Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."HIV-negative"
/* End of HIV-negative B.DE35 */

/*
@dataElement: HIV.B.DE36 - Unknown
@activity: HIV.B6 Capture or update client history
@description: Don't know HIV status - client does not know partner's HIV status
*/
// TODO: Replace placeholder with relevant CQL logic
define "Unknown B.DE36":
  exists "Unknown B.DE36 Condition"
    or exists "Unknown B.DE36 Observation"
define "Unknown B.DE36 Condition":
  [Condition: Concepts."Unknown"]
define "Unknown B.DE36 Observation":
  "Partner HIV status reported Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Unknown"
/* End of Unknown B.DE36 */

/*
 * Key populations (men who have sex with men, people living in prisons and other closed settings, people who inject drugs, sex workers, trans and gender diverse people)
 */

/*
@dataElement: HIV.B.DE49 - Key population member
@activity: HIV.B6 Capture or update client history
@description: Client is a member of a key population that has an increased risk of HIV
*/
define "Is Key population member":
  exists "Key population member type Observation"
/* End of Key population member B.DE49 */

/*
@dataElement: HIV.B.DE50 - Key population member type
@activity: HIV.B6 Capture or update client history
@description: The type of key population that the client is included in
*/
define "Key population member type Observation":
  [Observation: Concepts."Key population member - HIV.B.DE49"] O
    where O.status in { 'final', 'amended', 'corrected' }
    and exists(O.category OC where OC ~ ConceptsCustom."social-history")
/* End of Key population member type B.DE50 */

/*
@dataElement: HIV.B.DE51 - Sex worker
@activity: HIV.B6 Capture or update client history
@description: Client is a sex worker
*/
define "Sex worker":
  "Key population member type Observation" O
    where O.value ~ Concepts."Sex worker - HIV.B.DE51"
/* End of Sex worker B.DE51 */

/*
@dataElement: HIV.B.DE52 - Men who have sex with men
@activity: HIV.B6 Capture or update client history
@description: Client is a man who has sex with men
*/
define "Men who have sex with men":
  "Key population member type Observation" O
    where O.value ~ Concepts."Men who have sex with men"
  
/* End of Men who have sex with men */

/*
@dataElement: HIV.B.DE53 - Trans and gender-diverse people
@activity: HIV.B6 Capture or update client history
@description: Client identifies as trans and gender-diverse
*/
define "Trans and gender-diverse people":
  "Key population member type Observation" O
    where O.value ~ Concepts."Trans and gender-diverse people - HIV.B.DE53"
  
/* End of Trans and gender-diverse people B.DE53 */

/*
@dataElement: HIV.B.DE54 - People who inject drugs
@activity: HIV.B6 Capture or update client history
@description: Client is a person who injects drugs
*/
define "People who inject drugs":
  "Key population member type Observation" O
    where O.value ~ Concepts."People who inject drugs - HIV.B.DE54"
  
/* End of People who inject drugs B.DE54 */

/*
@dataElement: HIV.B.DE55 - People living in prisons and other closed settings
@activity: HIV.B6 Capture or update client history
@description: Client lives in a prison or another closed setting
*/
define "People living in prisons and other closed settings":
  "Key population member type Observation" O
    where O.value ~ Concepts."People living in prisons and other closed settings"
/* End of People living in prisons and other closed settings */

/*
@dataElement: HIV.B.DE60 - Date HIV test results returned
@activity: HIV.B6 Capture or update client history
@description: Date HIV test result returned to client
*/
define "Date HIV test results returned":
  "HIV test" O
  return O.issued
/* End of Date HIV test results returned */

/*
@dataElement: HIV.B.DE61 - HIV exposure type
@activity: HIV.B6 Capture or update client history
@description: Ways in which the client was exposed to HIV
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV exposure type":
  exists "HIV exposure type Observation"
define "HIV exposure type Observation":
  [Observation: Concepts."HIV exposure type"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of HIV exposure type */

/*
@dataElement: HIV.B.DE62 - Occupational
@activity: HIV.B6 Capture or update client history
@description: Occupational exposure to HIV
*/
// TODO: Replace placeholder with relevant CQL logic
define "Occupational":
  exists "Occupational Condition"
    or exists "Occupational Observation"
define "Occupational Condition":
  [Condition: Concepts."Occupational"]
define "Occupational Observation":
  "HIV exposure type Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Occupational"
/* End of Occupational */

/*
@dataElement: HIV.B.DE63 - Non-occupational violent
@activity: HIV.B6 Capture or update client history
@description: Non-occupational violent exposure to HIV
*/
// TODO: Replace placeholder with relevant CQL logic
define "Non-occupational violent":
  exists "Non-occupational violent Condition"
    or exists "Non-occupational violent Observation"
define "Non-occupational violent Condition":
  [Condition: Concepts."Non-occupational violent"]
define "Non-occupational violent Observation":
  "HIV exposure type Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Non-occupational violent"
/* End of Non-occupational violent */

/*
@dataElement: HIV.B.DE64 - Non-occupational consensual sex
@activity: HIV.B6 Capture or update client history
@description: Exposure to HIV through non-occupational consensual sex
*/
// TODO: Replace placeholder with relevant CQL logic
define "Non-occupational consensual sex":
  exists "Non-occupational consensual sex Condition"
    or exists "Non-occupational consensual sex Observation"
define "Non-occupational consensual sex Condition":
  [Condition: Concepts."Non-occupational consensual sex"]
define "Non-occupational consensual sex Observation":
  "HIV exposure type Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Non-occupational consensual sex"
/* End of Non-occupational consensual sex */

/*
@dataElement: HIV.B.DE65 - Date informed of HIV-positive diagnosis
@activity: HIV.B6 Capture or update client history
@description: The date on which the client was diagnosed with HIV
*/
// TODO: Replace placeholder with relevant CQL logic
define "Date informed of HIV-positive diagnosis":
  [Observation: Concepts."Date informed of HIV-positive diagnosis"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Date informed of HIV-positive diagnosis Value":
  "Date informed of HIV-positive diagnosis" O
  return O.value as dateTime
/* End of Date informed of HIV-positive diagnosis */

/*
@activity: HIV.B7 Test for HIV using testing algorithm
*/
define "HIV test":
  [Observation: Concepts."HIV test type - HIV.B.DE81 Choices"] O
  where O.status in { 'final', 'amended', 'corrected' }

define "Non-Self HIV test":
  "HIV test" O
  where O.code !~ Concepts."HIV self-test"

/*
@dataElement: HIV.B.DE71 - HIV diagnosis date
@activity: HIV.B8 Provide post-test counselling
@description: Date diagnosis was returned to client
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV diagnosis date":
  [Observation: Concepts."HIV diagnosis date"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "HIV diagnosis date Value":
  "HIV diagnosis date" O
  return O.value as dateTime
/* End of HIV diagnosis date */

/*
@dataElement: HIV.B.DE72 - ART start date
@activity: HIV.B8 Provide post-test counselling
@description: The date on which the client started or restarted antiretroviral therapy (ART)
*/
// TODO: Replace placeholder with relevant CQL logic
define "ART start date B.DE72":
  [Observation: Concepts."ART start date - HIV.B.DE72"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "ART start date B.DE72 Value":
  "ART start date B.DE72" O
  return O.value as dateTime
/* End of ART start date B.DE72 */

/*
@dataElement: HIV.B.DE80 - HIV test conducted
@activity: HIV.B7 Test for HIV using testing algorithm
@description: An HIV test was performed on the client during the visit
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV test conducted":
  exists "HIV test conducted Observation"
define "HIV test conducted Observation":
  [Observation: Concepts."HIV test conducted"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value is true
/* End of HIV test conducted */

/*
@dataElement: HIV.B.DE81 - HIV test type
@activity: HIV.B7 Test for HIV using testing algorithm
@description: Type of HIV test
*/
define "HIV test type B.DE81":
  [Observation: Concepts."HIV test type - HIV.B.DE81"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "HIV test type B.DE81 Value":
  "HIV test type B.DE81" O
  where O.value is CodeableConcept
  and O.value is not null
  return O.value as CodeableConcept
/* End of HIV test type B.DE81 */

/*
@dataElement: HIV.B.DE82 - Rapid diagnostic test for HIV
@activity: HIV.B7 Test for HIV using testing algorithm
@description: Antibody test for HIV performed with a rapid diagnostic
*/

define "Rapid diagnostic test for HIV B.DE82":
  "HIV test type B.DE81" O
      where O.value ~ Concepts."Rapid diagnostic test for HIV - HIV.B.DE82"
/* End of Rapid diagnostic test for HIV B.DE82 */

/*
@dataElement: HIV.B.DE83 - Enzyme immunoassay for HIV
@activity: HIV.B7 Test for HIV using testing algorithm
@description: Antibody test for HIV performed with an enzyme immunoassay
*/

define "Enzyme immunoassay for HIV B.DE83":
  "HIV test type B.DE81" O
      where O.value ~ Concepts."Enzyme immunoassay for HIV - HIV.B.DE83"
/* End of Enzyme immunoassay for HIV B.DE83 */

/*
@dataElement: HIV.B.DE84 - Nucleic acid test for HIV
@activity: HIV.B7 Test for HIV using testing algorithm
@description: Virological test, which includes testing for early infant diagnosis
*/
define "Nucleic acid test for HIV B.DE84":
  "HIV test type B.DE81" O
      where O.value ~ Concepts."Nucleic acid test for HIV - HIV.B.DE84"
/* End of Nucleic acid test for HIV B.DE84 */

/*
@dataElement: HIV.B.DE85 - Dual HIV/syphilis rapid diagnostic test
@activity: HIV.B7 Test for HIV using testing algorithm
@description: Antibody test for HIV and syphilis performed with a rapid diagnostic
*/

define "Dual HIV/syphilis rapid diagnostic test B.DE85":
  "HIV test type B.DE81" O
      where O.value ~ Concepts."Dual HIV/syphilis rapid diagnostic test - HIV.B.DE85"
/* End of Dual HIV/syphilis rapid diagnostic test B.DE85 */

/*
@dataElement: HIV.B.DE86 - HIV self-test
@activity: HIV.B7 Test for HIV using testing algorithm
@description: Antibody test for HIV performed by self-tester using a rapid diagnostic
*/

define "HIV self-test":
  "HIV test type B.DE81" O
      where O.value ~ Concepts."HIV self-test"
/* End of HIV self-test */

/*
@dataElement: HIV.B.DE88 - Assay number in testing strategy
@activity: HIV.B7 Test for HIV using testing algorithm
@description: The number of the assay (test kit) in the HIV testing strategy
*/
// TODO: Replace placeholder with relevant CQL logic
define "Assay number in testing strategy B.DE88":
  exists "Assay number in testing strategy B.DE88 Observation"
define "Assay number in testing strategy B.DE88 Observation":
  [Observation: Concepts."Assay number in testing strategy - HIV.B.DE88"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Assay number in testing strategy B.DE88 */

/*
@dataElement: HIV.B.DE89 - Assay 0
@activity: HIV.B7 Test for HIV using testing algorithm
@description: A community outreach test-for-triage or self-test which is not included in the HIV testing strategy
*/
// TODO: Replace placeholder with relevant CQL logic
define "Assay 0 B.DE89":
  exists "Assay 0 B.DE89 Condition"
    or exists "Assay 0 B.DE89 Observation"
define "Assay 0 B.DE89 Condition":
  [Condition: Concepts."Assay 0 - HIV.B.DE89"]
define "Assay 0 B.DE89 Observation":
  "Assay number in testing strategy B.DE88 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Assay 0 - HIV.B.DE89"
/* End of Assay 0 B.DE89 */

/*
@dataElement: HIV.B.DE90 - Assay 1
@activity: HIV.B7 Test for HIV using testing algorithm
@description: The first test in the HIV testing strategy
*/
define "Assay 1 B.DE90 Observation":
  "Assay number in testing strategy B.DE88 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Assay 1 - HIV.B.DE90"
/* End of Assay 1 B.DE90 */

/*
@dataElement: HIV.B.DE91 - Assay 2
@activity: HIV.B7 Test for HIV using testing algorithm
@description: The second test in the HIV testing strategy
*/
define "Assay 2 B.DE91 Observation":
  "Assay number in testing strategy B.DE88 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Assay 2 - HIV.B.DE91"
/* End of Assay 2 B.DE91 */

/*
@dataElement: HIV.B.DE92 - Assay 3
@activity: HIV.B7 Test for HIV using testing algorithm
@description: The third test in the HIV testing strategy
*/
define "Assay 3 B.DE92 Observation":
  "Assay number in testing strategy B.DE88 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Assay 3 - HIV.B.DE92"
/* End of Assay 3 B.DE92 */

/*
@dataElement: HIV.B.DE93 - Assay 1 repeated
@activity: HIV.B7 Test for HIV using testing algorithm
@description: The first test in the HIV testing strategy
*/
// TODO: Replace placeholder with relevant CQL logic
define "Assay 1 repeated B.DE93":
  exists "Assay 1 repeated B.DE93 Condition"
    or exists "Assay 1 repeated B.DE93 Observation"
define "Assay 1 repeated B.DE93 Condition":
  [Condition: Concepts."Assay 1 repeated - HIV.B.DE93"]
define "Assay 1 repeated B.DE93 Observation":
  "Assay number in testing strategy B.DE88 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Assay 1 repeated - HIV.B.DE93"
/* End of Assay 1 repeated B.DE93 */

/*
@dataElement: HIV.B.DE94 - Test result of HIV assay 1
@activity: HIV.B7 Test for HIV using testing algorithm
@description: The result of the first HIV assay in the testing strategy
*/
// TODO: Replace placeholder with relevant CQL logic
define "Test result of HIV assay 1 B.DE94":
  exists "Test result of HIV assay 1 B.DE94 Observation"
define "Test result of HIV assay 1 B.DE94 Observation":
  [Observation: Concepts."Test result of HIV assay 1 - HIV.B.DE94"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Test result of HIV assay 1 B.DE94 */

/*
@dataElement: HIV.B.DE95 - Reactive
@activity: HIV.B7 Test for HIV using testing algorithm
@description: The result of the HIV assay in the testing strategy was reactive
*/
// TODO: Replace placeholder with relevant CQL logic
define "Reactive B.DE95":
  exists "Reactive B.DE95 Condition"
    or exists "Reactive B.DE95 Observation"
define "Reactive B.DE95 Condition":
  [Condition: Concepts."Reactive - HIV.B.DE95"]
define "Reactive B.DE95 Observation":
  "Test result of HIV assay 1 B.DE94 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Reactive - HIV.B.DE95"
/* End of Reactive B.DE95 */

/*
@dataElement: HIV.B.DE96 - Non-reactive
@activity: HIV.B7 Test for HIV using testing algorithm
@description: The result of the HIV assay in the testing strategy was non-reactive
*/
// TODO: Replace placeholder with relevant CQL logic
define "Non-reactive B.DE96":
  exists "Non-reactive B.DE96 Condition"
    or exists "Non-reactive B.DE96 Observation"
define "Non-reactive B.DE96 Condition":
  [Condition: Concepts."Non-reactive - HIV.B.DE96"]
define "Non-reactive B.DE96 Observation":
  "Test result of HIV assay 1 B.DE94 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Non-reactive - HIV.B.DE96"
/* End of Non-reactive B.DE96 */

/*
@dataElement: HIV.B.DE97 - Invalid
@activity: HIV.B7 Test for HIV using testing algorithm
@description: The result of the HIV assay in the testing strategy was invalid
*/
// TODO: Replace placeholder with relevant CQL logic
define "Invalid B.DE97":
  exists "Invalid B.DE97 Condition"
    or exists "Invalid B.DE97 Observation"
define "Invalid B.DE97 Condition":
  [Condition: Concepts."Invalid - HIV.B.DE97"]
define "Invalid B.DE97 Observation":
  "Test result of HIV assay 1 B.DE94 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Invalid - HIV.B.DE97"
/* End of Invalid B.DE97 */

/*
@dataElement: HIV.B.DE98 - Test result of HIV assay 2
@activity: HIV.B7 Test for HIV using testing algorithm
@description: The result of the second HIV assay in the testing strategy
*/
// TODO: Replace placeholder with relevant CQL logic
define "Test result of HIV assay 2 B.DE98":
  exists "Test result of HIV assay 2 B.DE98 Observation"
define "Test result of HIV assay 2 B.DE98 Observation":
  [Observation: Concepts."Test result of HIV assay 2 - HIV.B.DE98"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Test result of HIV assay 2 B.DE98 */

/*
@dataElement: HIV.B.DE99 - Reactive
@activity: HIV.B7 Test for HIV using testing algorithm
@description: The result of the HIV assay in the testing strategy was reactive
*/
// TODO: Replace placeholder with relevant CQL logic
define "Reactive B.DE99":
  exists "Reactive B.DE99 Condition"
    or exists "Reactive B.DE99 Observation"
define "Reactive B.DE99 Condition":
  [Condition: Concepts."Reactive - HIV.B.DE99"]
define "Reactive B.DE99 Observation":
  "Test result of HIV assay 2 B.DE98 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Reactive - HIV.B.DE99"
/* End of Reactive B.DE99 */

/*
@dataElement: HIV.B.DE100 - Non-reactive
@activity: HIV.B7 Test for HIV using testing algorithm
@description: The result of the HIV assay in the testing strategy was non-reactive
*/
// TODO: Replace placeholder with relevant CQL logic
define "Non-reactive B.DE100":
  exists "Non-reactive B.DE100 Condition"
    or exists "Non-reactive B.DE100 Observation"
define "Non-reactive B.DE100 Condition":
  [Condition: Concepts."Non-reactive - HIV.B.DE100"]
define "Non-reactive B.DE100 Observation":
  "Test result of HIV assay 2 B.DE98 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Non-reactive - HIV.B.DE100"
/* End of Non-reactive B.DE100 */

/*
@dataElement: HIV.B.DE101 - Invalid
@activity: HIV.B7 Test for HIV using testing algorithm
@description: The result of the HIV assay in the testing strategy was invalid
*/
// TODO: Replace placeholder with relevant CQL logic
define "Invalid B.DE101":
  exists "Invalid B.DE101 Condition"
    or exists "Invalid B.DE101 Observation"
define "Invalid B.DE101 Condition":
  [Condition: Concepts."Invalid - HIV.B.DE101"]
define "Invalid B.DE101 Observation":
  "Test result of HIV assay 2 B.DE98 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Invalid - HIV.B.DE101"
/* End of Invalid B.DE101 */

/*
@dataElement: HIV.B.DE102 - Test result of HIV assay 3
@activity: HIV.B7 Test for HIV using testing algorithm
@description: The result of the third HIV assay in the testing strategy
*/
// TODO: Replace placeholder with relevant CQL logic
define "Test result of HIV assay 3 B.DE102":
  exists "Test result of HIV assay 3 B.DE102 Observation"
define "Test result of HIV assay 3 B.DE102 Observation":
  [Observation: Concepts."Test result of HIV assay 3 - HIV.B.DE102"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Test result of HIV assay 3 B.DE102 */

/*
@dataElement: HIV.B.DE103 - Reactive
@activity: HIV.B7 Test for HIV using testing algorithm
@description: The result of the HIV assay in the testing strategy was reactive
*/
// TODO: Replace placeholder with relevant CQL logic
define "Reactive B.DE103":
  exists "Reactive B.DE103 Condition"
    or exists "Reactive B.DE103 Observation"
define "Reactive B.DE103 Condition":
  [Condition: Concepts."Reactive - HIV.B.DE103"]
define "Reactive B.DE103 Observation":
  "Test result of HIV assay 3 B.DE102 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Reactive - HIV.B.DE103"
/* End of Reactive B.DE103 */

/*
@dataElement: HIV.B.DE104 - Non-reactive
@activity: HIV.B7 Test for HIV using testing algorithm
@description: The result of the HIV assay in the testing strategy was non-reactive
*/
// TODO: Replace placeholder with relevant CQL logic
define "Non-reactive B.DE104":
  exists "Non-reactive B.DE104 Condition"
    or exists "Non-reactive B.DE104 Observation"
define "Non-reactive B.DE104 Condition":
  [Condition: Concepts."Non-reactive - HIV.B.DE104"]
define "Non-reactive B.DE104 Observation":
  "Test result of HIV assay 3 B.DE102 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Non-reactive - HIV.B.DE104"
/* End of Non-reactive B.DE104 */

/*
@dataElement: HIV.B.DE105 - Invalid
@activity: HIV.B7 Test for HIV using testing algorithm
@description: The result of the HIV assay in the testing strategy was invalid
*/
// TODO: Replace placeholder with relevant CQL logic
define "Invalid B.DE105":
  exists "Invalid B.DE105 Condition"
    or exists "Invalid B.DE105 Observation"
define "Invalid B.DE105 Condition":
  [Condition: Concepts."Invalid - HIV.B.DE105"]
define "Invalid B.DE105 Observation":
  "Test result of HIV assay 3 B.DE102 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Invalid - HIV.B.DE105"
/* End of Invalid B.DE105 */

/*
@dataElement: HIV.B.DE106 - Test result of HIV assay 1 repeated
@activity: HIV.B7 Test for HIV using testing algorithm
@description: The result of the repeated first HIV assay in the testing strategy
*/
// TODO: Replace placeholder with relevant CQL logic
define "Test result of HIV assay 1 repeated B.DE106":
  exists "Test result of HIV assay 1 repeated B.DE106 Observation"
define "Test result of HIV assay 1 repeated B.DE106 Observation":
  [Observation: Concepts."Test result of HIV assay 1 repeated - HIV.B.DE106"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Test result of HIV assay 1 repeated B.DE106 */

/*
@dataElement: HIV.B.DE107 - Reactive
@activity: HIV.B7 Test for HIV using testing algorithm
@description: The result of the HIV assay in the testing strategy was reactive
*/
// TODO: Replace placeholder with relevant CQL logic
define "Reactive B.DE107":
  exists "Reactive B.DE107 Condition"
    or exists "Reactive B.DE107 Observation"
define "Reactive B.DE107 Condition":
  [Condition: Concepts."Reactive - HIV.B.DE107"]
define "Reactive B.DE107 Observation":
  "Test result of HIV assay 1 repeated B.DE106 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Reactive - HIV.B.DE107"
/* End of Reactive B.DE107 */

/*
@dataElement: HIV.B.DE108 - Non-reactive
@activity: HIV.B7 Test for HIV using testing algorithm
@description: The result of the HIV assay in the testing strategy was non-reactive
*/
// TODO: Replace placeholder with relevant CQL logic
define "Non-reactive B.DE108":
  exists "Non-reactive B.DE108 Condition"
    or exists "Non-reactive B.DE108 Observation"
define "Non-reactive B.DE108 Condition":
  [Condition: Concepts."Non-reactive - HIV.B.DE108"]
define "Non-reactive B.DE108 Observation":
  "Test result of HIV assay 1 repeated B.DE106 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Non-reactive - HIV.B.DE108"
/* End of Non-reactive B.DE108 */

/*
@dataElement: HIV.B.DE109 - Invalid
@activity: HIV.B7 Test for HIV using testing algorithm
@description: The result of the HIV assay in the testing strategy was invalid
*/
// TODO: Replace placeholder with relevant CQL logic
define "Invalid B.DE109":
  exists "Invalid B.DE109 Condition"
    or exists "Invalid B.DE109 Observation"
define "Invalid B.DE109 Condition":
  [Condition: Concepts."Invalid - HIV.B.DE109"]
define "Invalid B.DE109 Observation":
  "Test result of HIV assay 1 repeated B.DE106 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Invalid - HIV.B.DE109"
/* End of Invalid B.DE109 */

/*
@dataElement: HIV.B.DE110 - HIV test date
@activity: HIV.B7 Test for HIV using testing algorithm
@description: Date of the HIV test
*/
define "HIV test date B.DE110":
  "HIV test" O
  return start of O.effective.toInterval()
/* End of HIV test date B.DE110 */

/*
@dataElement: HIV.B.DE111 - HIV test result
@activity: HIV.B7 Test for HIV using testing algorithm
@description: The result from HIV testing after applying the testing algorithm
*/
// Same as test - see profile
define "HIV test result Observation":
  "HIV test" O

define "HIV test result Value":
  "HIV test" O
  where O.value is CodeableConcept
  and O.value is not null
  return O.value as CodeableConcept

// Moved and Redefined in HIE
// define "HIV test resulted":
//   [Observation] O
//     where O.status in {'final', 'amended'}
//     and O.code ~ Concepts."Rapid diagnostic test for HIV - HIV.B.DE82"

/* End of HIV test result B.DE111 */

/*
@dataElement: HIV.B.DE112 - HIV-positive
@activity: HIV.B7 Test for HIV using testing algorithm
@description: Test result is HIV-positive
*/
define "HIV-positive test result":
  "HIV test result Observation" O
    where O.value ~ Concepts."HIV-positive - HIV.B.DE112"
/* End of HIV-positive B.DE112 */

/*
@dataElement: HIV.B.DE113 - HIV-negative
@activity: HIV.B7 Test for HIV using testing algorithm
@description: Test result is HIV-negative
*/
define "HIV-negative test result":
  "HIV test result Observation" O
    where O.value ~ Concepts."HIV-negative - HIV.B.DE113"
/* End of HIV-negative B.DE113 */

/*
@dataElement: HIV.B.DE114 - HIV-inconclusive
@activity: HIV.B7 Test for HIV using testing algorithm
@description: Test result is HIV-inconclusive
*/
define "HIV-inconclusive test result":
  "HIV test result Observation" O
    where O.value ~ Concepts."HIV-inconclusive"
/* End of HIV-inconclusive */

/*
@dataElement: HIV.B.DE115 - HIV status
@activity: HIV.B7 Test for HIV using testing algorithm
@description: HIV status reported after applying the national HIV testing algorithm. No single HIV test can provide an HIV-positive diagnosis.
*/
define "HIV Status Observation":
  [Observation: Concepts."HIV status"] O
    where O.status in { 'final', 'amended', 'corrected' }

/*
@dataElement: HIV.B.DE116 - HIV-positive
@activity: HIV.B7 Test for HIV using testing algorithm
@description: Client is HIV-positive
*/
define "Date HIV Status Positive":
  Min("HIV Status Positive Observation Date" union "HIV Status Positive Condition Date")

define "HIV Status Positive Observation":
"HIV Status Observation" O
    where O.value ~ Concepts."HIV-positive - HIV.B.DE116"
      sort by start of effective.toInterval()

define "HIV Status Positive Observation Date":
  "HIV Status Positive Observation" O
  return start of O.effective.toInterval()

 
define "HIV Status Positive Condition":
  [Condition: Concepts."HIV-positive - HIV.B.DE116"] C
    where C.clinicalStatus ~ ConceptsCustom."active"
      and exists(C.category CC where CC ~ ConceptsCustom."encounter-diagnosis")
    sort by start of onset.toInterval()

define "HIV Status Positive Condition Date":
  "HIV Status Positive Condition" C
  return start of C.onset.toInterval()
  
define "HIV Status Negative Observation":
  "HIV Status Observation" O
    where O.value ~ Concepts."HIV-negative - HIV.B.DE117"
    sort by start of effective.toInterval()

define "HIV Status Negative Condition":
  [Condition: Concepts."HIV-negative - HIV.B.DE117"] C
  where C.clinicalStatus ~ ConceptsCustom."active"
  and exists(C.category CC where CC ~ ConceptsCustom."encounter-diagnosis")
  sort by start of onset.toInterval()
/* End of HIV status */

/*
@dataElement: HIV.B.DE121 - Probable route of transmission
@activity: HIV.B8 Provide post-test counselling
@description: Probable route(s) of transmission of HIV to client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Probable route of transmission":
  exists "Probable route of transmission Observation"
define "Probable route of transmission Observation":
  [Observation: Concepts."Probable route of transmission"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Probable route of transmission */

/*
@dataElement: HIV.B.DE122 - Heterosexual sex
@activity: HIV.B8 Provide post-test counselling
@description: Probable route of HIV transmission was through heterosexual sex
*/
// TODO: Replace placeholder with relevant CQL logic
define "Heterosexual sex":
  exists "Heterosexual sex Condition"
    or exists "Heterosexual sex Observation"
define "Heterosexual sex Condition":
  [Condition: Concepts."Heterosexual sex"]
define "Heterosexual sex Observation":
  "Probable route of transmission Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Heterosexual sex"
/* End of Heterosexual sex */

/*
@dataElement: HIV.B.DE123 - Sex between men
@activity: HIV.B8 Provide post-test counselling
@description: Probable route of HIV transmission was through sex between men
*/
// TODO: Replace placeholder with relevant CQL logic
define "Sex between men":
  exists "Sex between men Condition"
    or exists "Sex between men Observation"
define "Sex between men Condition":
  [Condition: Concepts."Sex between men"]
define "Sex between men Observation":
  "Probable route of transmission Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Sex between men"
/* End of Sex between men */

/*
@dataElement: HIV.B.DE124 - Unprotected intercourse during sex work
@activity: HIV.B8 Provide post-test counselling
@description: Probable route of HIV transmission was through unprotected intercourse during sex work
*/
// TODO: Replace placeholder with relevant CQL logic
define "Unprotected intercourse during sex work":
  exists "Unprotected intercourse during sex work Condition"
    or exists "Unprotected intercourse during sex work Observation"
define "Unprotected intercourse during sex work Condition":
  [Condition: Concepts."Unprotected intercourse during sex work"]
define "Unprotected intercourse during sex work Observation":
  "Probable route of transmission Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Unprotected intercourse during sex work"
/* End of Unprotected intercourse during sex work */

/*
@dataElement: HIV.B.DE125 - Injecting drug use with unsterile equipment
@activity: HIV.B8 Provide post-test counselling
@description: Probable route of HIV transmission was through injecting drug use with unsterile equipment
*/
// TODO: Replace placeholder with relevant CQL logic
define "Injecting drug use with unsterile equipment":
  exists "Injecting drug use with unsterile equipment Condition"
    or exists "Injecting drug use with unsterile equipment Observation"
define "Injecting drug use with unsterile equipment Condition":
  [Condition: Concepts."Injecting drug use with unsterile equipment"]
define "Injecting drug use with unsterile equipment Observation":
  "Probable route of transmission Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Injecting drug use with unsterile equipment"
/* End of Injecting drug use with unsterile equipment */

/*
@dataElement: HIV.B.DE126 - Nosocomial
@activity: HIV.B8 Provide post-test counselling
@description: Probable route of HIV transmission was nosocomial
*/
// TODO: Replace placeholder with relevant CQL logic
define "Nosocomial":
  exists "Nosocomial Condition"
    or exists "Nosocomial Observation"
define "Nosocomial Condition":
  [Condition: Concepts."Nosocomial"]
define "Nosocomial Observation":
  "Probable route of transmission Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Nosocomial"
/* End of Nosocomial */

/*
@dataElement: HIV.B.DE127 - Vertical
@activity: HIV.B8 Provide post-test counselling
@description: Probable route of HIV transmission to an infant was during pregnancy, labour, delivery and breastfeeding (vertical transmission)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Vertical":
  exists "Vertical Condition"
    or exists "Vertical Observation"
define "Vertical Condition":
  [Condition: Concepts."Vertical"]
define "Vertical Observation":
  "Probable route of transmission Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Vertical"
/* End of Vertical */

/*
@dataElement: HIV.B.DE128 - Other
@activity: HIV.B8 Provide post-test counselling
@description: Probable route of HIV transmission was other and may include needle accidents, blood transfusion, blood products or organ/tissue donations, tattoos, piercings, circumcision, or acupuncture.
*/
// TODO: Replace placeholder with relevant CQL logic
define "Other B.DE128":
  exists "Other B.DE128 Condition"
    or exists "Other B.DE128 Observation"
define "Other B.DE128 Condition":
  [Condition: Concepts."Other - HIV.B.DE128"]
define "Other B.DE128 Observation":
  "Probable route of transmission Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Other - HIV.B.DE128"
/* End of Other B.DE128 */

/*
@dataElement: HIV.B.DE141 - Partner virally suppressed on ART
@activity: HIV.B6 Capture or update client history
@description: ART and virally suppression status of a partner of the client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Partner virally suppressed on ART":
  exists "Partner virally suppressed on ART Observation"
define "Partner virally suppressed on ART Observation":
  [Observation: Concepts."Partner virally suppressed on ART"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value is true
/* End of Partner virally suppressed on ART */

/*
@dataElement: HIV.B.DE142 - Counselling provided
@activity: HIV.B8 Provide post-test counselling
@description: Whether counselling was provided to a client during the visit
*/
// TODO: Replace placeholder with relevant CQL logic
define "Counselling provided":
  exists "Counselling provided Observation"
define "Counselling provided Observation":
  [Observation: Concepts."Counselling provided"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Counselling provided */

/*
@dataElement: HIV.B.DE143 - HIV-positive counselling conducted
@activity: HIV.B8 Provide post-test counselling
@description: Whether counselling was provided to a client who has been diagnosed with HIV
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV-positive counselling conducted":
  exists "HIV-positive counselling conducted Condition"
    or exists "HIV-positive counselling conducted Observation"
define "HIV-positive counselling conducted Condition":
  [Condition: Concepts."HIV-positive counselling conducted"]
define "HIV-positive counselling conducted Observation":
  "Counselling provided Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."HIV-positive counselling conducted"
/* End of HIV-positive counselling conducted */

/*
@dataElement: HIV.B.DE144 - Hepatitis B positive counselling conducted
@activity: HIV.B8 Provide post-test counselling
@description: Whether counselling was provided to a client who has been diagnosed with hepatitis B
*/
// TODO: Replace placeholder with relevant CQL logic
define "Hepatitis B positive counselling conducted":
  exists "Hepatitis B positive counselling conducted Condition"
    or exists "Hepatitis B positive counselling conducted Observation"
define "Hepatitis B positive counselling conducted Condition":
  [Condition: Concepts."Hepatitis B positive counselling conducted"]
define "Hepatitis B positive counselling conducted Observation":
  "Counselling provided Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Hepatitis B positive counselling conducted"
/* End of Hepatitis B positive counselling conducted */

/*
@dataElement: HIV.B.DE145 - Hepatitis C positive counselling conducted
@activity: HIV.B8 Provide post-test counselling
@description: Whether counselling was provided to a client who has been diagnosed with hepatitis C
*/
// TODO: Replace placeholder with relevant CQL logic
define "Hepatitis C positive counselling conducted":
  exists "Hepatitis C positive counselling conducted Condition"
    or exists "Hepatitis C positive counselling conducted Observation"
define "Hepatitis C positive counselling conducted Condition":
  [Condition: Concepts."Hepatitis C positive counselling conducted"]
define "Hepatitis C positive counselling conducted Observation":
  "Counselling provided Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Hepatitis C positive counselling conducted"
/* End of Hepatitis C positive counselling conducted */

/*
@dataElement: HIV.B.DE146 - Syphilis counselling, treatment and further testing
@activity: HIV.B8 Provide post-test counselling
@description: Whether counselling and treatment was provided to a client who has been diagnosed with syphilis. Additional testing (RPR test) recommended.
*/
// TODO: Replace placeholder with relevant CQL logic
define "Syphilis counselling, treatment and further testing":
  exists "Syphilis counselling, treatment and further testing Condition"
    or exists "Syphilis counselling, treatment and further testing Observation"
define "Syphilis counselling, treatment and further testing Condition":
  [Condition: Concepts."Syphilis counselling, treatment and further testing"]
define "Syphilis counselling, treatment and further testing Observation":
  "Counselling provided Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Syphilis counselling, treatment and further testing"
/* End of Syphilis counselling, treatment and further testing */

/*
@dataElement: HIV.B.DE147 - Linked to enrolment in care and ART initiation
@activity: HIV.B8 Provide post-test counselling
@description: Linkage made from HIV testing to enrolment in care following an HIV diagnosis
*/
// TODO: Replace placeholder with relevant CQL logic
define "Linked to enrolment in care and ART initiation":
  exists "Linked to enrolment in care and ART initiation Condition"
    or exists "Linked to enrolment in care and ART initiation Observation"
define "Linked to enrolment in care and ART initiation Condition":
  [Condition: Concepts."Linked to enrolment in care and ART initiation"]
define "Linked to enrolment in care and ART initiation Observation":
  "Counselling provided Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Linked to enrolment in care and ART initiation"
/* End of Linked to enrolment in care and ART initiation */

/*
@dataElement: HIV.B.DE148 - VMMC counselling provided
@activity: HIV.B8 Provide post-test counselling
@description: Whether counselling for voluntary medical male circumcision (VMMC) was provided following an HIV-negative test
*/
// TODO: Replace placeholder with relevant CQL logic
define "VMMC counselling provided":
  exists "VMMC counselling provided Condition"
    or exists "VMMC counselling provided Observation"
define "VMMC counselling provided Condition":
  [Condition: Concepts."VMMC counselling provided"]
define "VMMC counselling provided Observation":
  "Counselling provided Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."VMMC counselling provided"
/* End of VMMC counselling provided */

/*
@dataElement: HIV.B.DE149 - Prevention services offered and referrals
@activity: HIV.B9 Determine recommended services
@description: Offer or refer to prevention services
*/
// TODO: Replace placeholder with relevant CQL logic
define "Prevention services offered and referrals B.DE149":
  exists "Prevention services offered and referrals B.DE149 Observation"
define "Prevention services offered and referrals B.DE149 Observation":
  [Observation: Concepts."Prevention services offered and referrals - HIV.B.DE149"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Prevention services offered and referrals B.DE149 */

/*
@dataElement: HIV.B.DE150 - Offer male and female condoms and condom-compatible lubricants
@activity: HIV.B9 Determine recommended services
@description: Offer male and female condoms and condom-compatible lubricants
*/
// TODO: Replace placeholder with relevant CQL logic
define "Offer male and female condoms and condom-compatible lubricants B.DE150":
  exists "Offer male and female condoms and condom-compatible lubricants B.DE150 Condition"
    or exists "Offer male and female condoms and condom-compatible lubricants B.DE150 Observation"
define "Offer male and female condoms and condom-compatible lubricants B.DE150 Condition":
  [Condition: Concepts."Offer male and female condoms and condom-compatible lubricants - HIV.B.DE150"]
define "Offer male and female condoms and condom-compatible lubricants B.DE150 Observation":
  "Prevention services offered and referrals B.DE149 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Offer male and female condoms and condom-compatible lubricants - HIV.B.DE150"
/* End of Offer male and female condoms and condom-compatible lubricants B.DE150 */

/*
@dataElement: HIV.B.DE151 - Offer pre-exposure prophylaxis PrEP for people at elevated risk for HIV acquisition
@activity: HIV.B9 Determine recommended services
@description: Offer pre-exposure prophylaxis (PrEP) to people with substantial ongoing risk of HIV infection
*/
// TODO: Replace placeholder with relevant CQL logic
define "Offer pre-exposure prophylaxis PrEP for people at elevated risk for HIV acquisition":
  exists "Offer pre-exposure prophylaxis PrEP for people at elevated risk for HIV acquisition Condition"
    or exists "Offer pre-exposure prophylaxis PrEP for people at elevated risk for HIV acquisition Observation"
define "Offer pre-exposure prophylaxis PrEP for people at elevated risk for HIV acquisition Condition":
  [Condition: Concepts."Offer pre-exposure prophylaxis PrEP for people at elevated risk for HIV acquisition"]
define "Offer pre-exposure prophylaxis PrEP for people at elevated risk for HIV acquisition Observation":
  "Prevention services offered and referrals B.DE149 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Offer pre-exposure prophylaxis PrEP for people at elevated risk for HIV acquisition"
/* End of Offer pre-exposure prophylaxis PrEP for people at elevated risk for HIV acquisition */

/*
@dataElement: HIV.B.DE152 - Offer post-exposure prophylaxis PEP following suspected exposure
@activity: HIV.B9 Determine recommended services
@description: Offer or refer client for PEP following suspected exposure
*/
// TODO: Replace placeholder with relevant CQL logic
define "Offer post-exposure prophylaxis PEP following suspected exposure":
  exists "Offer post-exposure prophylaxis PEP following suspected exposure Condition"
    or exists "Offer post-exposure prophylaxis PEP following suspected exposure Observation"
define "Offer post-exposure prophylaxis PEP following suspected exposure Condition":
  [Condition: Concepts."Offer post-exposure prophylaxis PEP following suspected exposure"]
define "Offer post-exposure prophylaxis PEP following suspected exposure Observation":
  "Prevention services offered and referrals B.DE149 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Offer post-exposure prophylaxis PEP following suspected exposure"
/* End of Offer post-exposure prophylaxis PEP following suspected exposure */

/*
@dataElement: HIV.B.DE153 - Voluntary medical male circumcision VMMC
@activity: HIV.B9 Determine recommended services
@description: Offer referral for VMMC services
*/
// TODO: Replace placeholder with relevant CQL logic
define "Voluntary medical male circumcision VMMC":
  exists "Voluntary medical male circumcision VMMC Condition"
    or exists "Voluntary medical male circumcision VMMC Observation"
define "Voluntary medical male circumcision VMMC Condition":
  [Condition: Concepts."Voluntary medical male circumcision VMMC referral"]
define "Voluntary medical male circumcision VMMC Observation":
  "Prevention services offered and referrals B.DE149 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Voluntary medical male circumcision VMMC referral"
/* End of Voluntary medical male circumcision VMMC */

/*
@dataElement: HIV.B.DE154 - Harm reduction for people who inject drugs
@activity: HIV.B9 Determine recommended services
@description: Offer or refer to harm reduction services for people who inject drugs (needle and syringe programmes, opioid substitution therapy, other drug-dependence treatment and opioid overdose prevention and management)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Harm reduction for people who inject drugs B.DE154":
  exists "Harm reduction for people who inject drugs B.DE154 Condition"
    or exists "Harm reduction for people who inject drugs B.DE154 Observation"
define "Harm reduction for people who inject drugs B.DE154 Condition":
  [Condition: Concepts."Harm reduction for people who inject drugs - HIV.B.DE154"]
define "Harm reduction for people who inject drugs B.DE154 Observation":
  "Prevention services offered and referrals B.DE149 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Harm reduction for people who inject drugs - HIV.B.DE154"
/* End of Harm reduction for people who inject drugs B.DE154 */

/*
@dataElement: HIV.B.DE155 - Behavioural interventions to support risk reduction, particularly for people with HIV and members of key populations
@activity: HIV.B9 Determine recommended services
@description: Offer or refer to behavioural interventions to support risk reduction, particularly for people with HIV and members of key populations
*/
// TODO: Replace placeholder with relevant CQL logic
define "Behavioural interventions to support risk reduction, particularly for people with HIV and members of key populations":
  exists "Behavioural interventions to support risk reduction, particularly for people with HIV and members of key populations Condition"
    or exists "Behavioural interventions to support risk reduction, particularly for people with HIV and members of key populations Observation"
define "Behavioural interventions to support risk reduction, particularly for people with HIV and members of key populations Condition":
  [Condition: Concepts."Behavioural interventions to support risk reduction, particularly for people with HIV and members of key populations"]
define "Behavioural interventions to support risk reduction, particularly for people with HIV and members of key populations Observation":
  "Prevention services offered and referrals B.DE149 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Behavioural interventions to support risk reduction, particularly for people with HIV and members of key populations"
/* End of Behavioural interventions to support risk reduction, particularly for people with HIV and members of key populations */

/*
@dataElement: HIV.B.DE156 - HIV testing for partners and biological children
@activity: HIV.B9 Determine recommended services
@description: Offer voluntary testing for all partners and biological children of positive cases (includes partner services and index case testing), as welll as partners and social contacts of people from key populations, where appropriate
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV testing for partners and biological children B.DE156":
  exists "HIV testing for partners and biological children B.DE156 Condition"
    or exists "HIV testing for partners and biological children B.DE156 Observation"
define "HIV testing for partners and biological children B.DE156 Condition":
  [Condition: Concepts."HIV testing for partners and biological children - HIV.B.DE156"]
define "HIV testing for partners and biological children B.DE156 Observation":
  "Prevention services offered and referrals B.DE149 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."HIV testing for partners and biological children - HIV.B.DE156"
/* End of HIV testing for partners and biological children B.DE156 */

/*
@dataElement: HIV.B.DE157 - HIV testing for partners and social contacts of people from key populations, where appropriate
@activity: HIV.B9 Determine recommended services
@description: Offer voluntary testing for partners and social contacts of people from key populations, where appropriate
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV testing for partners and social contacts of people from key populations, where appropriate":
  exists "HIV testing for partners and social contacts of people from key populations, where appropriate Condition"
    or exists "HIV testing for partners and social contacts of people from key populations, where appropriate Observation"
define "HIV testing for partners and social contacts of people from key populations, where appropriate Condition":
  [Condition: Concepts."HIV testing for partners and social contacts of people from key populations, where appropriate"]
define "HIV testing for partners and social contacts of people from key populations, where appropriate Observation":
  "Prevention services offered and referrals B.DE149 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."HIV testing for partners and social contacts of people from key populations, where appropriate"
/* End of HIV testing for partners and social contacts of people from key populations, where appropriate */

/*
@dataElement: HIV.B.DE158 - Sexual and reproductive health integrated services
@activity: HIV.B9 Determine recommended services
@description: Offer or refer to sexual and reproductive health services
*/
// TODO: Replace placeholder with relevant CQL logic
define "Sexual and reproductive health integrated services B.DE158":
  exists "Sexual and reproductive health integrated services B.DE158 Observation"
define "Sexual and reproductive health integrated services B.DE158 Observation":
  [Observation: Concepts."Sexual and reproductive health integrated services - HIV.B.DE158"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Sexual and reproductive health integrated services B.DE158 */

/*
@dataElement: HIV.B.DE159 - Contraception and family planning
@activity: HIV.B9 Determine recommended services
@description: Offer contraception and family planning services
*/
// TODO: Replace placeholder with relevant CQL logic
define "Contraception and family planning B.DE159":
  exists "Contraception and family planning B.DE159 Condition"
    or exists "Contraception and family planning B.DE159 Observation"
define "Contraception and family planning B.DE159 Condition":
  [Condition: Concepts."Contraception and family planning - HIV.B.DE159"]
define "Contraception and family planning B.DE159 Observation":
  "Sexual and reproductive health integrated services B.DE158 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Contraception and family planning - HIV.B.DE159"
/* End of Contraception and family planning B.DE159 */

/*
@dataElement: HIV.B.DE160 - Check pregnancy status
@activity: HIV.B9 Determine recommended services
@description: Check women's pregnancy status
*/
// TODO: Replace placeholder with relevant CQL logic
define "Check pregnancy status B.DE160":
  exists "Check pregnancy status B.DE160 Condition"
    or exists "Check pregnancy status B.DE160 Observation"
define "Check pregnancy status B.DE160 Condition":
  [Condition: Concepts."Check pregnancy status - HIV.B.DE160"]
define "Check pregnancy status B.DE160 Observation":
  "Sexual and reproductive health integrated services B.DE158 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Check pregnancy status - HIV.B.DE160"
/* End of Check pregnancy status B.DE160 */

/*
@dataElement: HIV.B.DE161 - Prevention of mother-to-child transmission counselling
@activity: HIV.B9 Determine recommended services
@description: Offer services for prevention of mother-to-child transmission (counselling)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Prevention of mother-to-child transmission counselling":
  exists "Prevention of mother-to-child transmission counselling Condition"
    or exists "Prevention of mother-to-child transmission counselling Observation"
define "Prevention of mother-to-child transmission counselling Condition":
  [Condition: Concepts."Prevention of mother-to-child transmission counselling"]
define "Prevention of mother-to-child transmission counselling Observation":
  "Sexual and reproductive health integrated services B.DE158 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Prevention of mother-to-child transmission counselling"
/* End of Prevention of mother-to-child transmission counselling */

/*
@dataElement: HIV.B.DE162 - Cervical cancer screening and treatment counselling
@activity: HIV.B9 Determine recommended services
@description: Offer cervical cancer screening and treatment counselling and services
*/
// TODO: Replace placeholder with relevant CQL logic
define "Cervical cancer screening and treatment counselling":
  exists "Cervical cancer screening and treatment counselling Condition"
    or exists "Cervical cancer screening and treatment counselling Observation"
define "Cervical cancer screening and treatment counselling Condition":
  [Condition: Concepts."Cervical cancer screening and treatment counselling"]
define "Cervical cancer screening and treatment counselling Observation":
  "Sexual and reproductive health integrated services B.DE158 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Cervical cancer screening and treatment counselling"
/* End of Cervical cancer screening and treatment counselling */

/*
@dataElement: HIV.B.DE163 - Anal cancer screening for men who have sex with men
@activity: HIV.B9 Determine recommended services
@description: Offer services for anal cancer screening (for men who have sex with men)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Anal cancer screening for men who have sex with men B.DE163":
  exists "Anal cancer screening for men who have sex with men B.DE163 Condition"
    or exists "Anal cancer screening for men who have sex with men B.DE163 Observation"
define "Anal cancer screening for men who have sex with men B.DE163 Condition":
  [Condition: Concepts."Anal cancer screening for men who have sex with men - HIV.B.DE163"]
define "Anal cancer screening for men who have sex with men B.DE163 Observation":
  "Sexual and reproductive health integrated services B.DE158 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Anal cancer screening for men who have sex with men - HIV.B.DE163"
/* End of Anal cancer screening for men who have sex with men B.DE163 */

/*
@dataElement: HIV.B.DE164 - STI testing and treatment services
@activity: HIV.B9 Determine recommended services
@description: Offer sexually transmitted infection (STI) testing and treatment services
*/
// TODO: Replace placeholder with relevant CQL logic
define "STI testing and treatment services":
  exists "STI testing and treatment services Condition"
    or exists "STI testing and treatment services Observation"
define "STI testing and treatment services Condition":
  [Condition: Concepts."STI testing and treatment services"]
define "STI testing and treatment services Observation":
  "Sexual and reproductive health integrated services B.DE158 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."STI testing and treatment services"
/* End of STI testing and treatment services */

/*
@dataElement: HIV.B.DE165 - Offer other clinical services
@activity: HIV.B9 Determine recommended services
@description: Other clinical services offered or referrals given to the client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Offer other clinical services B.DE165":
  exists "Offer other clinical services B.DE165 Observation"
define "Offer other clinical services B.DE165 Observation":
  [Observation: Concepts."Offer other clinical services - HIV.B.DE165"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Offer other clinical services B.DE165 */

/*
@dataElement: HIV.B.DE166 - Assessment and provision of vaccinations
@activity: HIV.B9 Determine recommended services
@description: Assessment and provision of vaccinations, such as for people from key populations, pregnant women and infants; and, where appropriate, tetanus vaccination for adolescent boys and men receiving VMMC
*/
// TODO: Replace placeholder with relevant CQL logic
define "Assessment and provision of vaccinations B.DE166":
  exists "Assessment and provision of vaccinations B.DE166 Condition"
    or exists "Assessment and provision of vaccinations B.DE166 Observation"
define "Assessment and provision of vaccinations B.DE166 Condition":
  [Condition: Concepts."Assessment and provision of vaccinations - HIV.B.DE166"]
define "Assessment and provision of vaccinations B.DE166 Observation":
  "Offer other clinical services B.DE165 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Assessment and provision of vaccinations - HIV.B.DE166"
/* End of Assessment and provision of vaccinations B.DE166 */

/*
@dataElement: HIV.B.DE167 - Hepatitis B HBV and hepatitis C virus HCV testing and treatment provided
@activity: HIV.B9 Determine recommended services
@description: Offer or refer for HBV and/or HCV testing and treatment
*/
// TODO: Replace placeholder with relevant CQL logic
define "Hepatitis B HBV and hepatitis C virus HCV testing and treatment provided":
  exists "Hepatitis B HBV and hepatitis C virus HCV testing and treatment provided Condition"
    or exists "Hepatitis B HBV and hepatitis C virus HCV testing and treatment provided Observation"
define "Hepatitis B HBV and hepatitis C virus HCV testing and treatment provided Condition":
  [Condition: Concepts."Hepatitis B HBV and hepatitis C virus HCV testing and treatment provided"]
define "Hepatitis B HBV and hepatitis C virus HCV testing and treatment provided Observation":
  "Offer other clinical services B.DE165 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Hepatitis B HBV and hepatitis C virus HCV testing and treatment provided"
/* End of Hepatitis B HBV and hepatitis C virus HCV testing and treatment provided */

/*
@dataElement: HIV.B.DE168 - Co-trimoxazole chemoprophylaxis to prevent Pneumocystis carinii pneumonia provided
@activity: HIV.B9 Determine recommended services
@description: Offer or refer for co-trimoxazole chemoprophylaxis to prevent pneumocystis carinii pneumonia
*/
// TODO: Replace placeholder with relevant CQL logic
define "Co-trimoxazole chemoprophylaxis to prevent Pneumocystis carinii pneumonia provided":
  exists "Co-trimoxazole chemoprophylaxis to prevent Pneumocystis carinii pneumonia provided Condition"
    or exists "Co-trimoxazole chemoprophylaxis to prevent Pneumocystis carinii pneumonia provided Observation"
define "Co-trimoxazole chemoprophylaxis to prevent Pneumocystis carinii pneumonia provided Condition":
  [Condition: Concepts."Co-trimoxazole chemoprophylaxis to prevent Pneumocystis carinii pneumonia provided"]
define "Co-trimoxazole chemoprophylaxis to prevent Pneumocystis carinii pneumonia provided Observation":
  "Offer other clinical services B.DE165 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Co-trimoxazole chemoprophylaxis to prevent Pneumocystis carinii pneumonia provided"
/* End of Co-trimoxazole chemoprophylaxis to prevent Pneumocystis carinii pneumonia provided */

/*
@dataElement: HIV.B.DE169 - Intensified TB case finding and linkage to TB treatment provided
@activity: HIV.B9 Determine recommended services
@description: Offer or refer for intensified TB case finding and linkage to TB treatment
*/
// TODO: Replace placeholder with relevant CQL logic
define "Intensified TB case finding and linkage to TB treatment provided":
  exists "Intensified TB case finding and linkage to TB treatment provided Condition"
    or exists "Intensified TB case finding and linkage to TB treatment provided Observation"
define "Intensified TB case finding and linkage to TB treatment provided Condition":
  [Condition: Concepts."Intensified TB case finding and linkage to TB treatment provided"]
define "Intensified TB case finding and linkage to TB treatment provided Observation":
  "Offer other clinical services B.DE165 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Intensified TB case finding and linkage to TB treatment provided"
/* End of Intensified TB case finding and linkage to TB treatment provided */

/*
@dataElement: HIV.B.DE170 - Provision of isoniazid preventive therapy if person does not have TB
@activity: HIV.B9 Determine recommended services
@description: Offer or refer for provision of isoniazid preventive therapy if person does not have TB
*/
// TODO: Replace placeholder with relevant CQL logic
define "Provision of isoniazid preventive therapy if person does not have TB B.DE170":
  exists "Provision of isoniazid preventive therapy if person does not have TB B.DE170 Condition"
    or exists "Provision of isoniazid preventive therapy if person does not have TB B.DE170 Observation"
define "Provision of isoniazid preventive therapy if person does not have TB B.DE170 Condition":
  [Condition: Concepts."Provision of isoniazid preventive therapy if person does not have TB - HIV.B.DE170"]
define "Provision of isoniazid preventive therapy if person does not have TB B.DE170 Observation":
  "Offer other clinical services B.DE165 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Provision of isoniazid preventive therapy if person does not have TB - HIV.B.DE170"
/* End of Provision of isoniazid preventive therapy if person does not have TB B.DE170 */

/*
@dataElement: HIV.B.DE171 - Malaria prevention such as bed nets and prophylaxis, depending on epidemiology
@activity: HIV.B9 Determine recommended services
@description: Offer or refer for malaria prevention (such as bed nets and prophylaxis), depending on epidemiology
*/
// TODO: Replace placeholder with relevant CQL logic
define "Malaria prevention such as bed nets and prophylaxis, depending on epidemiology B.DE171":
  exists "Malaria prevention such as bed nets and prophylaxis, depending on epidemiology B.DE171 Condition"
    or exists "Malaria prevention such as bed nets and prophylaxis, depending on epidemiology B.DE171 Observation"
define "Malaria prevention such as bed nets and prophylaxis, depending on epidemiology B.DE171 Condition":
  [Condition: Concepts."Malaria prevention such as bed nets and prophylaxis, depending on epidemiology - HIV.B.DE171"]
define "Malaria prevention such as bed nets and prophylaxis, depending on epidemiology B.DE171 Observation":
  "Offer other clinical services B.DE165 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Malaria prevention such as bed nets and prophylaxis, depending on epidemiology - HIV.B.DE171"
/* End of Malaria prevention such as bed nets and prophylaxis, depending on epidemiology B.DE171 */

/*
@dataElement: HIV.B.DE172 - Other support services
@activity: HIV.B9 Determine recommended services
@description: Offer or refer for other support services
*/
// TODO: Replace placeholder with relevant CQL logic
define "Other support services B.DE172":
  exists "Other support services B.DE172 Observation"
define "Other support services B.DE172 Observation":
  [Observation: Concepts."Other support services - HIV.B.DE172"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Other support services B.DE172 */

/*
@dataElement: HIV.B.DE173 - Mental health services
@activity: HIV.B9 Determine recommended services
@description: Offer or refer for mental health services
*/
// TODO: Replace placeholder with relevant CQL logic
define "Mental health services B.DE173":
  exists "Mental health services B.DE173 Condition"
    or exists "Mental health services B.DE173 Observation"
define "Mental health services B.DE173 Condition":
  [Condition: Concepts."Mental health services - HIV.B.DE173"]
define "Mental health services B.DE173 Observation":
  "Other support services B.DE172 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Mental health services - HIV.B.DE173"
/* End of Mental health services B.DE173 */

/*
@dataElement: HIV.B.DE174 - Psychosocial counselling, support and treatment adherence counselling
@activity: HIV.B9 Determine recommended services
@description: Offer or refer for psychosocial counselling, support and treatment adherence counselling
*/
// TODO: Replace placeholder with relevant CQL logic
define "Psychosocial counselling, support and treatment adherence counselling B.DE174":
  exists "Psychosocial counselling, support and treatment adherence counselling B.DE174 Condition"
    or exists "Psychosocial counselling, support and treatment adherence counselling B.DE174 Observation"
define "Psychosocial counselling, support and treatment adherence counselling B.DE174 Condition":
  [Condition: Concepts."Psychosocial counselling, support and treatment adherence counselling - HIV.B.DE174"]
define "Psychosocial counselling, support and treatment adherence counselling B.DE174 Observation":
  "Other support services B.DE172 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Psychosocial counselling, support and treatment adherence counselling - HIV.B.DE174"
/* End of Psychosocial counselling, support and treatment adherence counselling B.DE174 */

/*
@dataElement: HIV.B.DE175 - Support for disclosure and partner services
@activity: HIV.B9 Determine recommended services
@description: Offer or refer for support for disclosure and partner services
*/
// TODO: Replace placeholder with relevant CQL logic
define "Support for disclosure and partner services B.DE175":
  exists "Support for disclosure and partner services B.DE175 Condition"
    or exists "Support for disclosure and partner services B.DE175 Observation"
define "Support for disclosure and partner services B.DE175 Condition":
  [Condition: Concepts."Support for disclosure and partner services - HIV.B.DE175"]
define "Support for disclosure and partner services B.DE175 Observation":
  "Other support services B.DE172 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Support for disclosure and partner services - HIV.B.DE175"
/* End of Support for disclosure and partner services B.DE175 */

/*
@dataElement: HIV.B.DE176 - Legal and social services
@activity: HIV.B9 Determine recommended services
@description: Offer or refer for legal and social services
*/
// TODO: Replace placeholder with relevant CQL logic
define "Legal and social services B.DE176":
  exists "Legal and social services B.DE176 Condition"
    or exists "Legal and social services B.DE176 Observation"
define "Legal and social services B.DE176 Condition":
  [Condition: Concepts."Legal and social services - HIV.B.DE176"]
define "Legal and social services B.DE176 Observation":
  "Other support services B.DE172 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Legal and social services - HIV.B.DE176"
/* End of Legal and social services B.DE176 */

/*
@dataElement: HIV.B.DE177 - Services for responding to violence against women
@activity: HIV.B9 Determine recommended services
@description: Offer or refer for services for responding to violence against women, including first-line support and psychosocial support, post-rape care and other support services including shelters, legal services and women and child protection services
*/
// TODO: Replace placeholder with relevant CQL logic
define "Services for responding to violence against women B.DE177":
  exists "Services for responding to violence against women B.DE177 Condition"
    or exists "Services for responding to violence against women B.DE177 Observation"
define "Services for responding to violence against women B.DE177 Condition":
  [Condition: Concepts."Services for responding to violence against women - HIV.B.DE177"]
define "Services for responding to violence against women B.DE177 Observation":
  "Other support services B.DE172 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Services for responding to violence against women - HIV.B.DE177"
/* End of Services for responding to violence against women B.DE177 */

/*
@dataElement: HIV.B.DE191 - Type of follow-up appointment
@activity: HIV.B20 Schedule retest
@description: Type of follow-up appointment for testing services
*/
// TODO: Replace placeholder with relevant CQL logic
define "Type of follow-up appointment B.DE191":
  exists "Type of follow-up appointment B.DE191 Observation"
define "Type of follow-up appointment B.DE191 Observation":
  [Observation: Concepts."Type of follow-up appointment - HIV.B.DE191"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Type of follow-up appointment B.DE191 */

/*
@dataElement: HIV.B.DE192 - Retesting for HIV
@activity: HIV.B20 Schedule retest
@description: Retesting follow-up appointment
*/
// TODO: Replace placeholder with relevant CQL logic
define "Retesting for HIV B.DE192":
  exists "Retesting for HIV B.DE192 Condition"
    or exists "Retesting for HIV B.DE192 Observation"
define "Retesting for HIV B.DE192 Condition":
  [Condition: Concepts."Retesting for HIV - HIV.B.DE192"]
define "Retesting for HIV B.DE192 Observation":
  "Type of follow-up appointment B.DE191 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Retesting for HIV - HIV.B.DE192"
/* End of Retesting for HIV B.DE192 */

/*
@dataElement: HIV.B.DE193 - Other
@activity: HIV.B20 Schedule retest
@description: Other reason for the follow-up appointment
*/
// TODO: Replace placeholder with relevant CQL logic
define "Other B.DE193":
  exists "Other B.DE193 Condition"
    or exists "Other B.DE193 Observation"
define "Other B.DE193 Condition":
  [Condition: Concepts."Other - HIV.B.DE193"]
define "Other B.DE193 Observation":
  "Type of follow-up appointment B.DE191 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Other - HIV.B.DE193"
/* End of Other B.DE193 */

/*
@dataElement: HIV.B.DE195 - Date/time of follow-up appointment
@activity: HIV.B20 Schedule retest
@description: Date the patient is to return for monitoring, re-supply or any other reason
*/
// TODO: Replace placeholder with relevant CQL logic
define "Date/time of follow-up appointment B.DE195":
  [Observation: Concepts."Date/time of follow-up appointment - HIV.B.DE195"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Date/time of follow-up appointment B.DE195 Value":
  "Date/time of follow-up appointment B.DE195" O
  where O.value is not null
  and O.value is dateTime
  return O.value as dateTime
/* End of Date/time of follow-up appointment B.DE195 */

/*
@dataElement: HIV.B.DE198 - VMMC procedure date
@activity: HIV.B21 Offer prevention options
@description: Date on which a voluntary medical male circumcision procedure was performed
*/

define "VMMC procedure date":
  "VMMC" P
  return start of P.performed.toInterval()


/* End of VMMC procedure date */

/*
@dataElement: HIV.B.DE201 - Adverse event severity
@activity: HIV.B21 Offer prevention options
@description: Severity of the adverse event associated with voluntary medical male circumcision (VMMC) procedure
*/

define "Adverse event severity":
  [AdverseEvent] AE 
  with [Procedure] P
      such that AE.suspectEntity.instance.references(P) and P.status = 'completed' 
      and P.code ~  Concepts."VMMC"
  where AE.actuality = 'actual'


/* End of Adverse event severity */

/*
@dataElement: HIV.B.DE202 - Moderate
@activity: HIV.B21 Offer prevention options
@description: Severity of the adverse event associated with VMMC procedure was moderate
*/

define "Moderate":
  "Adverse event severity" VMAC
    where (VMAC.severity = ConceptsCustom."moderate")
/* End of Moderate */

/*
@dataElement: HIV.B.DE203 - Severe
@activity: HIV.B21 Offer prevention options
@description: Severity of the adverse event associated with VMMC procedure was severe
*/

define "Severe":
  "Adverse event severity" VMAC
    where (VMAC.severity = ConceptsCustom."severe")
/* End of Severe */

/*
@dataElement: HIV.B.DE204 - Timing of adverse event
@activity: HIV.B21 Offer prevention options
@description: When the adverse event associated with VMMC procedure occurred
*/
// TODO: Replace placeholder with relevant CQL logic
define "Timing of adverse event":
  exists "Timing of adverse event Observation"
define "Timing of adverse event Observation":
  [Observation: Concepts."Timing of adverse event"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Timing of adverse event */

/*
@dataElement: HIV.B.DE205 - Intraoperative
@activity: HIV.B21 Offer prevention options
@description: The adverse event associated with VMMC procedure occurred during the procedure
*/
// TODO: Replace placeholder with relevant CQL logic
define "Intraoperative":
  exists "Intraoperative Condition"
    or exists "Intraoperative Observation"
define "Intraoperative Condition":
  [Condition: Concepts."Intraoperative"]
define "Intraoperative Observation":
  "Timing of adverse event Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Intraoperative"
/* End of Intraoperative */

/*
@dataElement: HIV.B.DE206 - Postoperative
@activity: HIV.B21 Offer prevention options
@description: The adverse event associated with VMMC procedure occurred within the first 30 days after the procedure
*/
// TODO: Replace placeholder with relevant CQL logic
define "Postoperative":
  exists "Postoperative Condition"
    or exists "Postoperative Observation"
define "Postoperative Condition":
  [Condition: Concepts."Postoperative"]
define "Postoperative Observation":
  "Timing of adverse event Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Postoperative"
/* End of Postoperative */

/*
@dataElement: HIV.B.DE207 - Type of adverse VMMC event
@activity: HIV.B21 Offer prevention options
@description: Type of adverse event associated with voluntary medical male circumcision (VMMC) procedure
*/
// TODO: Replace placeholder with relevant CQL logic
define "Type of adverse VMMC event":
  exists "Type of adverse VMMC event Observation"
define "Type of adverse VMMC event Observation":
  [Observation: Concepts."Type of adverse VMMC event"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Type of adverse VMMC event */

/*
@dataElement: HIV.B.DE208 - Abnormal pain
@activity: HIV.B21 Offer prevention options
@description: Client experienced abnormal pain
*/
// TODO: Replace placeholder with relevant CQL logic
define "Abnormal pain":
  exists "Abnormal pain Condition"
    or exists "Abnormal pain Observation"
define "Abnormal pain Condition":
  [Condition: Concepts."Abnormal pain"]
define "Abnormal pain Observation":
  "Type of adverse VMMC event Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Abnormal pain"
/* End of Abnormal pain */

/*
@dataElement: HIV.B.DE209 - Anaesthesia-related effects
@activity: HIV.B21 Offer prevention options
@description: Client had anaesthesia-related effects
*/
// TODO: Replace placeholder with relevant CQL logic
define "Anaesthesia-related effects":
  exists "Anaesthesia-related effects Condition"
    or exists "Anaesthesia-related effects Observation"
define "Anaesthesia-related effects Condition":
  [Condition: Concepts."Anaesthesia-related effects"]
define "Anaesthesia-related effects Observation":
  "Type of adverse VMMC event Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Anaesthesia-related effects"
/* End of Anaesthesia-related effects */

/*
@dataElement: HIV.B.DE210 - Bleeding
@activity: HIV.B21 Offer prevention options
@description: Client had bleeding
*/
// TODO: Replace placeholder with relevant CQL logic
define "Bleeding":
  exists "Bleeding Condition"
    or exists "Bleeding Observation"
define "Bleeding Condition":
  [Condition: Concepts."Bleeding"]
define "Bleeding Observation":
  "Type of adverse VMMC event Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Bleeding"
/* End of Bleeding */

/*
@dataElement: HIV.B.DE211 - Damage to the penis
@activity: HIV.B21 Offer prevention options
@description: Client had damage to the penis
*/
// TODO: Replace placeholder with relevant CQL logic
define "Damage to the penis":
  exists "Damage to the penis Condition"
    or exists "Damage to the penis Observation"
define "Damage to the penis Condition":
  [Condition: Concepts."Damage to the penis"]
define "Damage to the penis Observation":
  "Type of adverse VMMC event Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Damage to the penis"
/* End of Damage to the penis */

/*
@dataElement: HIV.B.DE212 - Difficulty urinating
@activity: HIV.B21 Offer prevention options
@description: Client had difficulty urinating
*/
// TODO: Replace placeholder with relevant CQL logic
define "Difficulty urinating":
  exists "Difficulty urinating Condition"
    or exists "Difficulty urinating Observation"
define "Difficulty urinating Condition":
  [Condition: Concepts."Difficulty urinating"]
define "Difficulty urinating Observation":
  "Type of adverse VMMC event Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Difficulty urinating"
/* End of Difficulty urinating */

/*
@dataElement: HIV.B.DE213 - Excessive bleeding
@activity: HIV.B21 Offer prevention options
@description: Client experienced excessive bleeding
*/
// TODO: Replace placeholder with relevant CQL logic
define "Excessive bleeding":
  exists "Excessive bleeding Condition"
    or exists "Excessive bleeding Observation"
define "Excessive bleeding Condition":
  [Condition: Concepts."Excessive bleeding"]
define "Excessive bleeding Observation":
  "Type of adverse VMMC event Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Excessive bleeding"
/* End of Excessive bleeding */

/*
@dataElement: HIV.B.DE214 - Excessive skin removal
@activity: HIV.B21 Offer prevention options
@description: Client experienced excessive skin removal
*/
// TODO: Replace placeholder with relevant CQL logic
define "Excessive skin removal":
  exists "Excessive skin removal Condition"
    or exists "Excessive skin removal Observation"
define "Excessive skin removal Condition":
  [Condition: Concepts."Excessive skin removal"]
define "Excessive skin removal Observation":
  "Type of adverse VMMC event Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Excessive skin removal"
/* End of Excessive skin removal */

/*
@dataElement: HIV.B.DE215 - Excessive swelling
@activity: HIV.B21 Offer prevention options
@description: Client experienced excessive swelling
*/
// TODO: Replace placeholder with relevant CQL logic
define "Excessive swelling":
  exists "Excessive swelling Condition"
    or exists "Excessive swelling Observation"
define "Excessive swelling Condition":
  [Condition: Concepts."Excessive swelling"]
define "Excessive swelling Observation":
  "Type of adverse VMMC event Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Excessive swelling"
/* End of Excessive swelling */

/*
@dataElement: HIV.B.DE216 - Haematoma
@activity: HIV.B21 Offer prevention options
@description: Client experienced haematoma
*/
// TODO: Replace placeholder with relevant CQL logic
define "Haematoma":
  exists "Haematoma Condition"
    or exists "Haematoma Observation"
define "Haematoma Condition":
  [Condition: Concepts."Haematoma"]
define "Haematoma Observation":
  "Type of adverse VMMC event Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Haematoma"
/* End of Haematoma */

/*
@dataElement: HIV.B.DE217 - Infection
@activity: HIV.B21 Offer prevention options
@description: Client experienced infection
*/
// TODO: Replace placeholder with relevant CQL logic
define "Infection":
  exists "Infection Condition"
    or exists "Infection Observation"
define "Infection Condition":
  [Condition: Concepts."Infection"]
define "Infection Observation":
  "Type of adverse VMMC event Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Infection"
/* End of Infection */

/*
@dataElement: HIV.B.DE218 - Injury to glans
@activity: HIV.B21 Offer prevention options
@description: Client experienced injury to glans
*/
// TODO: Replace placeholder with relevant CQL logic
define "Injury to glans":
  exists "Injury to glans Condition"
    or exists "Injury to glans Observation"
define "Injury to glans Condition":
  [Condition: Concepts."Injury to glans"]
define "Injury to glans Observation":
  "Type of adverse VMMC event Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Injury to glans"
/* End of Injury to glans */

/*
@dataElement: HIV.B.DE219 - Scar or disfigurement
@activity: HIV.B21 Offer prevention options
@description: Client experienced scar or disfigurement
*/
// TODO: Replace placeholder with relevant CQL logic
define "Scar or disfigurement":
  exists "Scar or disfigurement Condition"
    or exists "Scar or disfigurement Observation"
define "Scar or disfigurement Condition":
  [Condition: Concepts."Scar or disfigurement"]
define "Scar or disfigurement Observation":
  "Type of adverse VMMC event Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Scar or disfigurement"
/* End of Scar or disfigurement */

/*
@dataElement: HIV.B.DE220 - Sharps injury to personnel
@activity: HIV.B21 Offer prevention options
@description: During VMMC procedure there was sharps injury to personnel
*/
// TODO: Replace placeholder with relevant CQL logic
define "Sharps injury to personnel":
  exists "Sharps injury to personnel Condition"
    or exists "Sharps injury to personnel Observation"
define "Sharps injury to personnel Condition":
  [Condition: Concepts."Sharps injury to personnel"]
define "Sharps injury to personnel Observation":
  "Type of adverse VMMC event Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Sharps injury to personnel"
/* End of Sharps injury to personnel */

/*
@dataElement: HIV.B.DE221 - Wound disruption
@activity: HIV.B21 Offer prevention options
@description: Client experienced wound disruption
*/
// TODO: Replace placeholder with relevant CQL logic
define "Wound disruption":
  exists "Wound disruption Condition"
    or exists "Wound disruption Observation"
define "Wound disruption Condition":
  [Condition: Concepts."Wound disruption"]
define "Wound disruption Observation":
  "Type of adverse VMMC event Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Wound disruption"
/* End of Wound disruption */

/*
@dataElement: HIV.B.DE222 - Other
@activity: HIV.B21 Offer prevention options
@description: Client experienced other adverse VMMC event
*/
// TODO: Replace placeholder with relevant CQL logic
define "Other B.DE222":
  exists "Other B.DE222 Condition"
    or exists "Other B.DE222 Observation"
define "Other B.DE222 Condition":
  [Condition: Concepts."Other - HIV.B.DE222"]
define "Other B.DE222 Observation":
  "Type of adverse VMMC event Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Other - HIV.B.DE222"
/* End of Other B.DE222 */

/*
@dataElement: HIV.B.DE224 - HIV retest prior to starting ART conducted
@activity: HIV.B20 Schedule retest
@description: HIV retest prior to starting ART conducted
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV retest prior to starting ART conducted":
  exists "HIV retest prior to starting ART conducted Observation"
define "HIV retest prior to starting ART conducted Observation":
  [Observation: Concepts."HIV retest prior to starting ART conducted"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value is true
/* End of HIV retest prior to starting ART conducted */

/*
@dataElement: HIV.B.DE225 - At elevated risk for HIV acquisition
@activity: HIV.B6 Capture or update client history
@description: Client is at elevated risk for HIV acquisition
*/

define "At elevated risk for HIV acquisition B.DE225":
  [Condition] C
    where C.code ~ Concepts."At elevated risk for HIV acquisition - HIV.B.DE225"

/* End of At elevated risk for HIV acquisition B.DE225 */

/*
@dataElement: HIV.B.DE226 - Syndrome/STI diagnosed
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Syndrome or STI for which client is diagnosed
*/

define "Syndrome/STI diagnosed B.DE226":
    exists("Urethral discharge syndrome B.DE227") or exists("Vaginal discharge syndrome B.DE228") or exists("Lower Abdominal pain B.DE229") or exists("Genital ulcer disease syndrome B.DE230") or
    exists("Anorectal discharge B.DE231")

define "Syndrome/STI diagnosed B.DE226 Condition":
  [Condition] C
    where C.code in Concepts."Syndrome/STI diagnosed - HIV.B.DE226 Choices"
      and C.verificationStatus.text = 'confirmed'

/* End of Syndrome/STI diagnosed B.DE226 */

/*
@dataElement: HIV.B.DE227 - Urethral discharge syndrome
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Client diagnosed with urethral discharge syndrome
*/

define "Urethral discharge syndrome B.DE227":
  [Condition: Concepts."Urethral discharge syndrome - HIV.B.DE227"]
/* End of Urethral discharge syndrome B.DE227 */

/*
@dataElement: HIV.B.DE228 - Vaginal discharge syndrome
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Client diagnosed with vaginal discharge syndrome
*/
define "Vaginal discharge syndrome B.DE228":
  [Condition: Concepts."Vaginal discharge syndrome - HIV.B.DE228"]
/* End of Vaginal discharge syndrome B.DE228 */

/*
@dataElement: HIV.B.DE229 - Lower Abdominal pain 
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Client diagnosed with lower abdominal pain
*/
define "Lower Abdominal pain B.DE229":
  [Condition: Concepts."Lower Abdominal pain  - HIV.B.DE229"]

/* End of Lower Abdominal pain B.DE229 */

/*
@dataElement: HIV.B.DE230 - Genital ulcer disease syndrome
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Client diagnosed with genital ulcer disease syndrome
*/

define "Genital ulcer disease syndrome B.DE230":
  [Condition: Concepts."Genital ulcer disease syndrome - HIV.B.DE230"]

/* End of Genital ulcer disease syndrome B.DE230 */

/*
@dataElement: HIV.B.DE231 - Anorectal discharge
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Client diagnosed with anorectal discharge
*/
define "Anorectal discharge B.DE231":
  [Condition: Concepts."Anorectal discharge - HIV.B.DE231"]
/* End of Anorectal discharge B.DE231 */

/*
@dataElement: HIV.B.DE232 - Sent for testing
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Specimen sent for testing
*/
define "Sent for testing B.DE232":
  [Condition: Concepts."Sent for testing - HIV.B.DE232"]
/* End of Sent for testing B.DE232 */

/*
@dataElement: HIV.B.DE233 - Other
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Other syndrome/STI diagnosed
*/
define "Other B.DE233":
  [Condition: Concepts."Other - HIV.B.DE233"]
/* End of Other B.DE233 */

/*
@dataElement: HIV.B.DE235 - Any STI syndrome diagnosed
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Was the client diagnosed with any of the five STI syndromes during this visit?
*/
// TODO: Replace placeholder with relevant CQL logic
define "Any STI syndrome diagnosed B.DE235":
  exists "Any STI syndrome diagnosed B.DE235 Observation"
define "Any STI syndrome diagnosed B.DE235 Observation":
  [Observation: Concepts."Any STI syndrome diagnosed - HIV.B.DE235"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value is true
/* End of Any STI syndrome diagnosed B.DE235 */

/*
@dataElement: HIV.B.DE249 - Syphilis test date
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Date of syphilis test
*/

define "Syphilis test date B.DE249":
  [Procedure] P
  where P.status = 'completed'
  and P.code ~ ConceptsCustom."syphilis test"
/* End of Syphilis test date B.DE249 */

/*
@dataElement: HIV.B.DE250 - Syphilis test result
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Result from syphilis test
*/

define "Syphilis test result B.DE250":
  [Observation: Concepts."Syphilis test result - HIV.B.DE250"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Syphilis test result B.DE250 */

/*
@dataElement: HIV.B.DE251 - Positive
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Test result is positive for syphilis
*/

define "Positive B.DE251":
  "Syphilis test result B.DE250" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Positive - HIV.B.DE251"
/* End of Positive B.DE251 */

/*
@dataElement: HIV.B.DE252 - Negative
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Test result is negative for syphilis
*/

define "Negative B.DE252":
  "Syphilis test result B.DE250" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Negative - HIV.B.DE252"
/* End of Negative B.DE252 */

/*
@dataElement: HIV.B.DE253 - Inconclusive
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Test result is inconclusive
*/

define "Inconclusive B.DE253":
  "Syphilis test result B.DE250" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Inconclusive - HIV.B.DE253"
/* End of Inconclusive B.DE253 */

/*
@dataElement: HIV.B.DE254 - Syphilis treatment start date
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Date of initiation of syphilis treatment
*/

define "Syphilis treatment start date B.DE254":
  [MedicationStatement] MS
    where MS.status = 'completed'
    and exists(MS.reasonCode C where C ~ ConceptsCustom."syphilis treatment")
/* End of Syphilis treatment start date B.DE254 */

/*
@dataElement: HIV.B.DE255 - Gonorrhoea test date
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Date of Gonorrhoea test
*/

define "Gonorrhoea test date B.DE255":
  "Gonorrhoea test result B.DE256" O
  return start of O.effective.toInterval()
/* End of Gonorrhoea test date B.DE255 */

/*
@dataElement: HIV.B.DE256 - Gonorrhoea test result
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Result from Gonorrhoea test
*/

define "Gonorrhoea test result B.DE256":
  [Observation: Concepts."Gonorrhoea test result - HIV.B.DE256"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Gonorrhoea test result B.DE256 */

/*
@dataElement: HIV.B.DE257 - Positive
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Test result is positive for Neisseria gonorrhoeae
*/

define "Positive B.DE257":
  "Gonorrhoea test result B.DE256" O
  where O.value ~ Concepts."Positive - HIV.B.DE257"
/* End of Positive B.DE257 */

/*
@dataElement: HIV.B.DE258 - Negative
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Test result is negative for Neisseria gonorrhoeae
*/

define "Negative B.DE258":
  "Gonorrhoea test result B.DE256" O
  where O.value ~ Concepts."Negative - HIV.B.DE258"

/* End of Negative B.DE258 */

/*
@dataElement: HIV.B.DE259 - Inconclusive
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Test result is inconclusive
*/

define "Inconclusive B.DE259":
  "Gonorrhoea test result B.DE256" O
  where O.value ~ Concepts."Inconclusive - HIV.B.DE259"
/* End of Inconclusive B.DE259 */

/*
@dataElement: HIV.B.DE260 - Gonorrhoea treatment start date
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Date of initiation of Gonorrhoea treatment
*/

define "Gonorrhoea treatment start date B.DE260":
  [MedicationStatement] MS
    where MS.status = 'completed'
    and exists(MS.reasonCode C where C ~ ConceptsCustom."Gonorrhoea treatment")
/* End of Gonorrhoea treatment start date B.DE260 */

/*
@dataElement: HIV.B.DE261 - Type of specimen
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Type of specimen to be collected
*/
// TODO: Replace placeholder with relevant CQL logic
define "Type of specimen B.DE261":
  exists "Type of specimen B.DE261 Observation"
define "Type of specimen B.DE261 Observation":
  [Observation: Concepts."Type of specimen - HIV.B.DE261"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Type of specimen B.DE261 */

/*
@dataElement: HIV.B.DE262 - Blood
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Blood specimen to be collected
*/

define "Blood B.DE262":
  "Gonorrhoea test result B.DE256" O where O.method ~ Concepts."Blood - HIV.B.DE262"
/* End of Blood B.DE262 */

/*
@dataElement: HIV.B.DE263 - Urine
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Urine specimen to be collected
*/

define "Urine B.DE263":
  "Gonorrhoea test result B.DE256" O where O.method ~ Concepts."Urine - HIV.B.DE263"
/* End of Urine B.DE263 */

/*
@dataElement: HIV.B.DE264 - Cervical or vaginal swab
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Cervical or vaginal swab to be collected
*/

define "Cervical or vaginal swab B.DE264":
  "Gonorrhoea test result B.DE256" O where O.method ~ Concepts."Cervical or vaginal swab - HIV.B.DE264"
/* End of Cervical or vaginal swab B.DE264 */

/*
@dataElement: HIV.B.DE265 - Urethral or penile swab
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Urethral or penile swab to be collected
*/

define "Urethral or penile swab B.DE265":
  "Gonorrhoea test result B.DE256" O where O.method ~ Concepts."Urethral or penile swab - HIV.B.DE265"
/* End of Urethral or penile swab B.DE265 */

/*
@dataElement: HIV.B.DE266 - Rectal swab
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Rectal swab to be collected
*/
// TODO: Replace placeholder with relevant CQL logic
define "Rectal swab B.DE266":
  "Gonorrhoea test result B.DE256" O where O.method ~ Concepts."Rectal swab - HIV.B.DE266"
/* End of Rectal swab B.DE266 */

/*
@dataElement: HIV.B.DE267 - Other
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Other specimen type to be collected
*/
// TODO: Replace placeholder with relevant CQL logic
define "Other B.DE267":
  "Gonorrhoea test result B.DE256" O where O.method ~ Concepts."Other - HIV.B.DE267"
/* End of Other B.DE267 */

/*
@dataElement: HIV.B.DE276 - Neisseria gonorrhoeae test type
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Type of diagnostic test used for Neisseria gonorrhoeae
*/

define "Neisseria gonorrhoeae test type B.DE276":
  [Observation: Concepts."Neisseria gonorrhoeae test type - HIV.B.DE276"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Neisseria gonorrhoeae test type B.DE276 */

/*
@dataElement: HIV.B.DE277 - NAAT
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Nucleic Acid Amplification Test (NAAT) used
*/

define "NAAT B.DE277":
  [Observation: Concepts."NAAT - HIV.B.DE277"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of NAAT B.DE277 */

/*
@dataElement: HIV.B.DE278 - POC Test
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Point-of-care (POC) test used
*/

define "POC Test B.DE278":
  [Observation: Concepts."POC Test - HIV.B.DE278"] O
    where O.status in { 'final', 'amended', 'corrected' }

/* End of POC Test B.DE278 */

/*
@dataElement: HIV.B.DE279 - Culture
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Culture test used
*/

define "Culture B.DE279":
  [Observation: Concepts."Culture - HIV.B.DE279"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Culture B.DE279 */

/*
@dataElement: HIV.B.DE280 - Microscopy
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Microscopy test used
*/
 
define "Microscopy B.DE280":
  [Observation: Concepts."Microscopy - HIV.B.DE280"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Microscopy B.DE280 */

/*
@dataElement: HIV.B.DE281 - Other
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Other type of test used
*/

define "Other B.DE281":
  [Observation: Concepts."Other - HIV.B.DE281"] O
    where O.status in { 'final', 'amended', 'corrected' }

/* End of Other B.DE281 */

/*
@dataElement: HIV.C.DE9 - Date/time of suspected exposure to HIV
@activity: HIV.C3 Capture or update client history
@description: When the suspect exposure to HIV took place
*/
// TODO: Replace placeholder with relevant CQL logic
define "Date/time of suspected exposure to HIV C.DE9":
  [Observation: Concepts."Date/time of suspected exposure to HIV - HIV.C.DE9"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Date/time of suspected exposure to HIV C.DE9 Value":
  "Date/time of suspected exposure to HIV C.DE9" O
  where O.value is dateTime
  and O.value is not null
  return O.value as dateTime
/* End of Date/time of suspected exposure to HIV C.DE9 */

/*
@dataElement: HIV.C.DE10 - Currently on PrEP
@activity: HIV.C3 Capture or update client history
@description: The client is currently taking PrEP. Oral pre-exposure prophylaxis (PrEP) of HIV is the use of ARV drugs by people who are not infected with HIV to block the acquisition of HIV.
*/

/*@triggeredBy Encounter with location = community level testing*/

define "Currently on PrEP":
  [MedicationStatement] MS
    where MS.status = 'completed'
    and exists(MS.reasonCode C where C ~ Concepts."Currently on PrEP")
    and MS.medication ~ Concepts."PrEP for HIV prevention"

/* End of Currently on PrEP */

/*
@dataElement: HIV.C.DE11 - PrEP dosing type
@activity: HIV.C3 Capture or update client history
@description: Way in which pre-exposure prophylaxis (PrEP) is taken (daily or event-driven)
*/
// TODO: Replace placeholder with relevant CQL logic
define "PrEP dosing type":
  exists "PrEP dosing type Observation"
define "PrEP dosing type Observation":
  [Observation: Concepts."PrEP dosing type"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of PrEP dosing type */

/*
@dataElement: HIV.C.DE12 - Daily oral PrEP
@activity: HIV.C3 Capture or update client history
@description: Pre-exposure prophylaxis (PrEP) is taken every day
*/

define "Daily oral PrEP":
  "Currently on PrEP" MS
  where exists(MS.dosage.additionalInstruction AI where AI ~ Concepts."Daily oral PrEP")
/* End of Daily oral PrEP */

/*
@dataElement: HIV.C.DE13 - Event-driven PrEP 2+1+1
@activity: HIV.C3 Capture or update client history
@description: Event-driven pre-exposure prophylaxis (PrEP) is taken on an even-driven basis (2+1+1)
*/

define "Event-driven PrEP 2+1+1":
  "Currently on PrEP" MS
  where exists(MS.dosage.additionalInstruction AI where AI ~ Concepts."Event-driven PrEP 2+1+1")
/* End of Event-driven PrEP 2+1+1 */

/*
@dataElement: HIV.C.DE14 - Other PrEP dosing type
@activity: HIV.C3 Capture or update client history
@description: Other PrEP dosing type
*/

define "Other PrEP dosing type":
   "Currently on PrEP" MS
  where exists(MS.dosage.additionalInstruction AI where AI ~ Concepts."Other PrEP dosing type")

/* End of Other PrEP dosing type */

/*
@dataElement: HIV.C.DE17 - Current PrEP regimen
@activity: HIV.C3 Capture or update client history
@description: HIV pre-exposure prophylaxis (PrEP) regimen
*/
// TODO: Replace placeholder with relevant CQL logic
define "Current PrEP regimen":
  exists "Current PrEP regimen Observation"
define "Current PrEP regimen Observation":
  [Observation: Concepts."Current PrEP regimen"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Current PrEP regimen */

/*
@dataElement: HIV.C.DE18 - TDF + FTC
@activity: HIV.C3 Capture or update client history
@description: Treated with tenofovir disoproxil fumarate (TDF) and emtricitabine (FTC) pre-exposure prophylaxis (PrEP) regimen (oral PrEP)
*/

define "TDF + FTC C.DE18":
  "Currently on PrEP" MS
  where MS.medication ~ Concepts."TDF + FTC - HIV.C.DE18" 
/* End of TDF + FTC C.DE18 */

/*
@dataElement: HIV.C.DE19 - TDF
@activity: HIV.C3 Capture or update client history
@description: Treated with single-agent tenofovir disoproxil fumarate (TDF) pre-exposure prophylaxis (PrEP) regimen (oral PrEP)
*/

define "TDF C.DE19":
  "Currently on PrEP" MS
  where MS.medication ~ Concepts."TDF - HIV.C.DE19" 

/* End of TDF C.DE19 */

/*
@dataElement: HIV.C.DE20 - TDF + 3TC
@activity: HIV.C3 Capture or update client history
@description: Treated with tenofovir disoproxil fumarate (TDF) and lamivudine (3TC) pre-exposure prophylaxis (PrEP) regimen (oral PrEP)
*/

define "TDF + 3TC C.DE20":
  "Currently on PrEP" MS
  where MS.medication ~ Concepts."TDF + 3TC - HIV.C.DE20"
/* End of TDF + 3TC C.DE20 */

/*
@dataElement: HIV.C.DE21 - Other TDF-based regimen
@activity: HIV.C3 Capture or update client history
@description: Treated with other tenofovir disoproxil fumarate (TDF)-based regimen (oral PrEP)
*/

define "Other TDF-based regimen":
  "Currently on PrEP" MS
  where MS.medication ~ Concepts."Other TDF-based regimen"
/* End of Other TDF-based regimen */

/*
@dataElement: HIV.C.DE22 - Dapivirine vaginal ring DVR
@activity: HIV.C3 Capture or update client history
@description: Dapivirine vaginal ring (DVR) for HIV prevention
*/

define "Dapivirine vaginal ring DVR C.DE22":
  "Currently on PrEP" MS
  where MS.medication ~ Concepts."Dapivirine vaginal ring DVR - HIV.C.DE22"

/*
@dataElement: HIV.C.DE23 - CAB-LA
@activity: HIV.C3 Capture or update client history
@description: Long-acting injectable cabotegravir
*/

define "CAB-LA C.DE23":
  "Currently on PrEP" MS
  where MS.medication ~ Concepts."CAB-LA - HIV.C.DE23"
/* End of CAB-LA C.DE23 */

/*
@dataElement: HIV.C.DE24 - Experience with PrEP
@activity: HIV.C3 Capture or update client history
@description: The client's experience in taking PrEP
*/
// TODO: Replace placeholder with relevant CQL logic
define "Experience with PrEP":
  exists "Experience with PrEP Observation"
define "Experience with PrEP Observation":
  [Observation: Concepts."Experience with PrEP"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Experience with PrEP */

/*
@dataElement: HIV.C.DE25 - First-time user
@activity: HIV.C3 Capture or update client history
@description: The client has never used pre-exposure prophylaxis (PrEP) before (naive)
*/

define "First-time user C.DE25":
  "Currently on PrEP" MS
  where exists(MS.statusReason SR where SR ~ Concepts."First-time user - HIV.C.DE25")
/* End of First-time user C.DE25 */

/*
@dataElement: HIV.C.DE26 - Continuing user
@activity: HIV.C3 Capture or update client history
@description: The client has used PrEP before and is continuing to use PrEP
*/

define "Continuing user":
  "Currently on PrEP" MS
  where exists(MS.statusReason SR where SR ~ Concepts."Continuing user") 

/* End of Continuing user */

/*
@dataElement: HIV.C.DE27 - Restarting following a period of not taking PrEP
@activity: HIV.C3 Capture or update client history
@description: The client is restarting PrEP following a period of not taking PrEP
*/

define "Restarting following a period of not taking PrEP":
  "Currently on PrEP" MS
  where exists(MS.statusReason SR where SR ~ Concepts."Restarting following a period of not taking PrEP")
/* End of Restarting following a period of not taking PrEP */

/*
@dataElement: HIV.C.DE31 - PEP history
@activity: HIV.C3 Capture or update client history
@description: The client's history in taking post-exposure prophylaxis (PEP) for HIV prevention
*/
// TODO: Replace placeholder with relevant CQL logic
define "PEP history":
  [Observation: Concepts."PEP history"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of PEP history */

/*
@dataElement: HIV.C.DE35 - Date client completes PEP course
@activity: HIV.C3 Capture or update client history
@description: Date client completes PEP course
*/

define "Date client completes PEP course":
  [MedicationStatement] MS
  where (MS.status = 'completed'
  and exists(MS.reasonCode C where C ~ Concepts."PEP for HIV prevention")
  )
/* End of Date client completes PEP course */

/*
@dataElement: HIV.C.DE36 - Signs of substantial risk of HIV infection
@activity: HIV.C3 Capture or update client history
@description: Signs the client is at a substantial risk of HIV infection
*/
define "Signs of substantial risk of HIV infection C.DE36":
  [Observation: Concepts."Signs of substantial risk of HIV infection - HIV.C.DE36"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Signs of substantial risk of HIV infection C.DE36 */

/*
@dataElement: HIV.C.DE46 - Acute HIV infection symptoms
@activity: HIV.C3 Capture or update client history
@description: Symptoms that could suggest an acute HIV infection
*/
// TODO: Replace placeholder with relevant CQL logic
define "Acute HIV infection symptoms C.DE46":
  exists "Acute HIV infection symptoms C.DE46 Observation"
define "Acute HIV infection symptoms C.DE46 Observation":
  [Observation: Concepts."Acute HIV infection symptoms - HIV.C.DE46"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Acute HIV infection symptoms C.DE46 */

/*
@dataElement: HIV.C.DE47 - Fever
@activity: HIV.C3 Capture or update client history
@description: Client's symptoms include a fever
*/
// TODO: Replace placeholder with relevant CQL logic
define "Fever":
  exists "Fever Condition"
    or exists "Fever Observation"
define "Fever Condition":
  [Condition: Concepts."Fever"]
define "Fever Observation":
  "Acute HIV infection symptoms C.DE46 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Fever"
/* End of Fever */

/*
@dataElement: HIV.C.DE48 - Sore throat
@activity: HIV.C3 Capture or update client history
@description: Client's symptoms include a sore throat
*/
// TODO: Replace placeholder with relevant CQL logic
define "Sore throat":
  exists "Sore throat Condition"
    or exists "Sore throat Observation"
define "Sore throat Condition":
  [Condition: Concepts."Sore throat"]
define "Sore throat Observation":
  "Acute HIV infection symptoms C.DE46 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Sore throat"
/* End of Sore throat */

/*
@dataElement: HIV.C.DE49 - Aches
@activity: HIV.C3 Capture or update client history
@description: Client's symptoms include aches
*/
// TODO: Replace placeholder with relevant CQL logic
define "Aches":
  exists "Aches Condition"
    or exists "Aches Observation"
define "Aches Condition":
  [Condition: Concepts."Aches"]
define "Aches Observation":
  "Acute HIV infection symptoms C.DE46 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Aches"
/* End of Aches */

/*
@dataElement: HIV.C.DE50 - Pains
@activity: HIV.C3 Capture or update client history
@description: Client's symptoms include pains
*/
// TODO: Replace placeholder with relevant CQL logic
define "Pains":
  exists "Pains Condition"
    or exists "Pains Observation"
define "Pains Condition":
  [Condition: Concepts."Pains"]
define "Pains Observation":
  "Acute HIV infection symptoms C.DE46 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Pains"
/* End of Pains */

/*
@dataElement: HIV.C.DE51 - Swollen glands
@activity: HIV.C3 Capture or update client history
@description: Client's symptoms include swollen glands
*/
// TODO: Replace placeholder with relevant CQL logic
define "Swollen glands":
  exists "Swollen glands Condition"
    or exists "Swollen glands Observation"
define "Swollen glands Condition":
  [Condition: Concepts."Swollen glands"]
define "Swollen glands Observation":
  "Acute HIV infection symptoms C.DE46 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Swollen glands"
/* End of Swollen glands */

/*
@dataElement: HIV.C.DE52 - Mouth sores
@activity: HIV.C3 Capture or update client history
@description: Client's symptoms include a mouth sores
*/
// TODO: Replace placeholder with relevant CQL logic
define "Mouth sores":
  exists "Mouth sores Condition"
    or exists "Mouth sores Observation"
define "Mouth sores Condition":
  [Condition: Concepts."Mouth sores"]
define "Mouth sores Observation":
  "Acute HIV infection symptoms C.DE46 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Mouth sores"
/* End of Mouth sores */

/*
@dataElement: HIV.C.DE53 - Headaches
@activity: HIV.C3 Capture or update client history
@description: Client's symptoms include a headaches
*/
// TODO: Replace placeholder with relevant CQL logic
define "Headaches":
  exists "Headaches Condition"
    or exists "Headaches Observation"
define "Headaches Condition":
  [Condition: Concepts."Headaches"]
define "Headaches Observation":
  "Acute HIV infection symptoms C.DE46 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Headaches"
/* End of Headaches */

/*
@dataElement: HIV.C.DE54 - Rash
@activity: HIV.C3 Capture or update client history
@description: Client's symptoms include a rash
*/
// TODO: Replace placeholder with relevant CQL logic
define "Rash":
  exists "Rash Condition"
    or exists "Rash Observation"
define "Rash Condition":
  [Condition: Concepts."Rash"]
define "Rash Observation":
  "Acute HIV infection symptoms C.DE46 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Rash"
/* End of Rash */

/*
@dataElement: HIV.C.DE55 - Sex partners HIV treatment status
@activity: HIV.C3 Capture or update client history
@description: Treatment adherence of client's sex partner for partners that are HIV-positive
*/
// TODO: Replace placeholder with relevant CQL logic
define "Sex partners HIV treatment status":
  [Observation: Concepts."Sex partners HIV treatment status"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Sex partners HIV treatment status */

/*
@dataElement: HIV.C.DE61 - Suitable for PrEP
@activity: HIV.C8 Suitable for PrEP or PEP?
@description: The client is suitable for PrEP
*/
// TODO: Replace placeholder with relevant CQL logic
define "Suitable for PrEP":
  exists "Suitable for PrEP Observation"
define "Suitable for PrEP Observation":
  [Observation: Concepts."Suitable for PrEP"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value is true
/* End of Suitable for PrEP */

/*
@dataElement: HIV.C.DE74 - Date medications prescribed
@activity: HIV.C23 Prescribe or administer PrEP or PEP
@description: Date the client was prescribed medications
*/
// TODO: Replace placeholder with relevant CQL logic
define "Date medications prescribed C.DE74":
  [Observation: Concepts."Date medications prescribed - HIV.C.DE74"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Date medications prescribed C.DE74 Value":
  "Date medications prescribed C.DE74" O
  return O.value as dateTime
/* End of Date medications prescribed C.DE74 */

/*
@dataElement: HIV.C.DE75 - Medications prescribed
@activity: HIV.C23 Prescribe or administer PrEP or PEP
@description: Medications the client was prescribed
*/
// TODO: Replace placeholder with relevant CQL logic
define "Medications prescribed C.DE75":
  exists "Medications prescribed C.DE75 Observation"
define "Medications prescribed C.DE75 Observation":
  [Observation: Concepts."Medications prescribed - HIV.C.DE75"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Medications prescribed C.DE75 */

/*
@dataElement: HIV.C.DE76 - PrEP for HIV prevention
@activity: HIV.C23 Prescribe or administer PrEP or PEP
@description: Client was prescribed pre-exposure prophylaxis (PrEP) for HIV prevention
*/

define "PrEP for HIV prevention":
  [MedicationStatement] MS
    where MS.status = 'completed'
    and MS.medication ~ Concepts."PrEP for HIV prevention"
/* End of PrEP for HIV prevention */

/*
@dataElement: HIV.C.DE77 - PEP for HIV prevention
@activity: HIV.C23 Prescribe or administer PrEP or PEP
@description: Client was prescribed post-exposure prophylaxis (PEP) for HIV prevention
*/

define "PEP for HIV prevention":
  [MedicationRequest] MR
      where MR.status = 'completed'
      and MR.intent = 'order'
      and MR.medication ~ Concepts."PEP for HIV prevention"

/* End of PEP for HIV prevention */

/*
@dataElement: HIV.C.DE78 - Other
@activity: HIV.C23 Prescribe or administer PrEP or PEP
@description: Client was prescribed other medications
*/
// TODO: Replace placeholder with relevant CQL logic
define "Other C.DE78":
  exists "Other C.DE78 Condition"
    or exists "Other C.DE78 Observation"
define "Other C.DE78 Condition":
  [Condition: Concepts."Other - HIV.C.DE78"]
define "Other C.DE78 Observation":
  "Medications prescribed C.DE75 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Other - HIV.C.DE78"
/* End of Other C.DE78 */

/*
@dataElement: HIV.C.DE80 - PrEP product prescribed
@activity: HIV.C23 Prescribe or administer PrEP or PEP
@description: PrEP product that the client was prescribed
*/
// TODO: Replace placeholder with relevant CQL logic
define "PrEP product prescribed":
  exists "PrEP product prescribed Observation"
define "PrEP product prescribed Observation":
  [Observation: Concepts."PrEP product prescribed"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of PrEP product prescribed */

/*
@dataElement: HIV.C.DE81 - Oral PrEP
@activity: HIV.C23 Prescribe or administer PrEP or PEP
@description: Client was prescribed oral PrEP
*/
// TODO: Replace placeholder with relevant CQL logic
define "Oral PrEP":
  exists "Oral PrEP Condition"
    or exists "Oral PrEP Observation"
define "Oral PrEP Condition":
  [Condition: Concepts."Oral PrEP"]
define "Oral PrEP Observation":
  "PrEP product prescribed Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Oral PrEP"
/* End of Oral PrEP */

/*
@dataElement: HIV.C.DE82 - Dapivirine vaginal ring DVR
@activity: HIV.C23 Prescribe or administer PrEP or PEP
@description: Client was prescribed dapivirine vaginal ring (DVR)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Dapivirine vaginal ring DVR C.DE82":
  exists "Dapivirine vaginal ring DVR C.DE82 Condition"
    or exists "Dapivirine vaginal ring DVR C.DE82 Observation"
define "Dapivirine vaginal ring DVR C.DE82 Condition":
  [Condition: Concepts."Dapivirine vaginal ring DVR - HIV.C.DE82"]
define "Dapivirine vaginal ring DVR C.DE82 Observation":
  "PrEP product prescribed Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Dapivirine vaginal ring DVR - HIV.C.DE82"
/* End of Dapivirine vaginal ring DVR C.DE82 */

/*
@dataElement: HIV.C.DE83 - CAB-LA
@activity: HIV.C23 Prescribe or administer PrEP or PEP
@description: Client was prescribed long-acting cabotegravir (CAB-LA)
*/
// TODO: Replace placeholder with relevant CQL logic
define "CAB-LA C.DE83":
  exists "CAB-LA C.DE83 Condition"
    or exists "CAB-LA C.DE83 Observation"
define "CAB-LA C.DE83 Condition":
  [Condition: Concepts."CAB-LA - HIV.C.DE83"]
define "CAB-LA C.DE83 Observation":
  "PrEP product prescribed Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."CAB-LA - HIV.C.DE83"
/* End of CAB-LA C.DE83 */

/*
@dataElement: HIV.C.DE84 - Other
@activity: HIV.C23 Prescribe or administer PrEP or PEP
@description: Client was prescribed other PrEP product
*/
// TODO: Replace placeholder with relevant CQL logic
define "Other C.DE84":
  exists "Other C.DE84 Condition"
    or exists "Other C.DE84 Observation"
define "Other C.DE84 Condition":
  [Condition: Concepts."Other - HIV.C.DE84"]
define "Other C.DE84 Observation":
  "PrEP product prescribed Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Other - HIV.C.DE84"
/* End of Other C.DE84 */

/*
@dataElement: HIV.C.DE91 - Preferred PEP backbone regimen
@activity: HIV.C23 Prescribe or administer PrEP or PEP
@description: Preferred backbone regimen for PEP
*/
// TODO: Replace placeholder with relevant CQL logic
define "Preferred PEP backbone regimen":
  exists "Preferred PEP backbone regimen Observation"
define "Preferred PEP backbone regimen Observation":
  [Observation: Concepts."Preferred PEP backbone regimen"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Preferred PEP backbone regimen */

/*
@dataElement: HIV.C.DE92 - TDF + 3TC
@activity: HIV.C23 Prescribe or administer PrEP or PEP
@description: Preferred backbone containing tenofovir disoproxil fumarate and lamivudine
*/
// TODO: Replace placeholder with relevant CQL logic
define "TDF + 3TC C.DE92":
  exists "TDF + 3TC C.DE92 Condition"
    or exists "TDF + 3TC C.DE92 Observation"
define "TDF + 3TC C.DE92 Condition":
  [Condition: Concepts."TDF + 3TC - HIV.C.DE92"]
define "TDF + 3TC C.DE92 Observation":
  "Preferred PEP backbone regimen Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."TDF + 3TC - HIV.C.DE92"
/* End of TDF + 3TC C.DE92 */

/*
@dataElement: HIV.C.DE93 - TDF + FTC
@activity: HIV.C23 Prescribe or administer PrEP or PEP
@description: Preferred backbone containing tenofovir disoproxil fumarate and emtricitabine
*/
// TODO: Replace placeholder with relevant CQL logic
define "TDF + FTC C.DE93":
  exists "TDF + FTC C.DE93 Condition"
    or exists "TDF + FTC C.DE93 Observation"
define "TDF + FTC C.DE93 Condition":
  [Condition: Concepts."TDF + FTC - HIV.C.DE93"]
define "TDF + FTC C.DE93 Observation":
  "Preferred PEP backbone regimen Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."TDF + FTC - HIV.C.DE93"
/* End of TDF + FTC C.DE93 */

/*
@dataElement: HIV.C.DE94 - AZT + 3TC
@activity: HIV.C23 Prescribe or administer PrEP or PEP
@description: Preferred backbone containing zidovudine and lamivudine
*/
// TODO: Replace placeholder with relevant CQL logic
define "AZT + 3TC":
  exists "AZT + 3TC Condition"
    or exists "AZT + 3TC Observation"
define "AZT + 3TC Condition":
  [Condition: Concepts."AZT + 3TC"]
define "AZT + 3TC Observation":
  "Preferred PEP backbone regimen Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."AZT + 3TC"
/* End of AZT + 3TC */

/*
@dataElement: HIV.C.DE95 - Alternative PEP backbone regimen
@activity: HIV.C3 Capture or update client history
@description: Alternative backbone regimen for PEP
*/
// TODO: Replace placeholder with relevant CQL logic
define "Alternative PEP backbone regimen":
  exists "Alternative PEP backbone regimen Observation"
define "Alternative PEP backbone regimen Observation":
  [Observation: Concepts."Alternative PEP backbone regimen"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Alternative PEP backbone regimen */

/*
@dataElement: HIV.C.DE96 - ABC + 3TC
@activity: HIV.C3 Capture or update client history
@description: Alternative backbone containing abacavir and lamivudine
*/
// TODO: Replace placeholder with relevant CQL logic
define "ABC + 3TC":
  exists "ABC + 3TC Condition"
    or exists "ABC + 3TC Observation"
define "ABC + 3TC Condition":
  [Condition: Concepts."ABC + 3TC"]
define "ABC + 3TC Observation":
  "Alternative PEP backbone regimen Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."ABC + 3TC"
/* End of ABC + 3TC */

/*
@dataElement: HIV.C.DE97 - TDF + 3TC
@activity: HIV.C3 Capture or update client history
@description: Alternative backbone containing tenofovir disoproxil fumarate and lamivudine
*/
// TODO: Replace placeholder with relevant CQL logic
define "TDF + 3TC C.DE97":
  exists "TDF + 3TC C.DE97 Condition"
    or exists "TDF + 3TC C.DE97 Observation"
define "TDF + 3TC C.DE97 Condition":
  [Condition: Concepts."TDF + 3TC - HIV.C.DE97"]
define "TDF + 3TC C.DE97 Observation":
  "Alternative PEP backbone regimen Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."TDF + 3TC - HIV.C.DE97"
/* End of TDF + 3TC C.DE97 */

/*
@dataElement: HIV.C.DE98 - TDF + FTC
@activity: HIV.C3 Capture or update client history
@description: Alternative backbone containing tenofovir disoproxil fumarate and emtricitabine
*/
// TODO: Replace placeholder with relevant CQL logic
define "TDF + FTC C.DE98":
  exists "TDF + FTC C.DE98 Condition"
    or exists "TDF + FTC C.DE98 Observation"
define "TDF + FTC C.DE98 Condition":
  [Condition: Concepts."TDF + FTC - HIV.C.DE98"]
define "TDF + FTC C.DE98 Observation":
  "Alternative PEP backbone regimen Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."TDF + FTC - HIV.C.DE98"
/* End of TDF + FTC C.DE98 */

/*
@dataElement: HIV.C.DE99 - Preferred third PEP drug
@activity: HIV.C23 Prescribe or administer PrEP or PEP
@description: Preferred third drug for PEP
*/
// TODO: Replace placeholder with relevant CQL logic
define "Preferred third PEP drug":
  exists "Preferred third PEP drug Observation"
define "Preferred third PEP drug Observation":
  [Observation: Concepts."Preferred third PEP drug"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Preferred third PEP drug */

/*
@dataElement: HIV.C.DE100 - DTG
@activity: HIV.C23 Prescribe or administer PrEP or PEP
@description: Preferred third drug of dolutegravir
*/
// TODO: Replace placeholder with relevant CQL logic
define "DTG C.DE100":
  exists "DTG C.DE100 Condition"
    or exists "DTG C.DE100 Observation"
define "DTG C.DE100 Condition":
  [Condition: Concepts."DTG - HIV.C.DE100"]
define "DTG C.DE100 Observation":
  "Preferred third PEP drug Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."DTG - HIV.C.DE100"
/* End of DTG C.DE100 */

/*
@dataElement: HIV.C.DE101 - Alternative third PEP drug
@activity: HIV.C3 Capture or update client history
@description: Alternative third drug for PEP
*/
// TODO: Replace placeholder with relevant CQL logic
define "Alternative third PEP drug":
  exists "Alternative third PEP drug Observation"
define "Alternative third PEP drug Observation":
  [Observation: Concepts."Alternative third PEP drug"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Alternative third PEP drug */

/*
@dataElement: HIV.C.DE102 - ATV/r
@activity: HIV.C3 Capture or update client history
@description: Alternative third drug of atazanavir/ritonavir (ATV/r)
*/
// TODO: Replace placeholder with relevant CQL logic
define "ATV/r C.DE102":
  exists "ATV/r C.DE102 Condition"
    or exists "ATV/r C.DE102 Observation"
define "ATV/r C.DE102 Condition":
  [Condition: Concepts."ATV/r - HIV.C.DE102"]
define "ATV/r C.DE102 Observation":
  "Alternative third PEP drug Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."ATV/r - HIV.C.DE102"
/* End of ATV/r C.DE102 */

/*
@dataElement: HIV.C.DE103 - DRV/r
@activity: HIV.C3 Capture or update client history
@description: Alternative third drug of darunavir/ritonavir (DRV/r)
*/
// TODO: Replace placeholder with relevant CQL logic
define "DRV/r C.DE103":
  exists "DRV/r C.DE103 Condition"
    or exists "DRV/r C.DE103 Observation"
define "DRV/r C.DE103 Condition":
  [Condition: Concepts."DRV/r - HIV.C.DE103"]
define "DRV/r C.DE103 Observation":
  "Alternative third PEP drug Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."DRV/r - HIV.C.DE103"
/* End of DRV/r C.DE103 */

/*
@dataElement: HIV.C.DE104 - LPV/r
@activity: HIV.C3 Capture or update client history
@description: Alternative third drug of lopinavir/ritonavir (LPV/r)
*/
// TODO: Replace placeholder with relevant CQL logic
define "LPV/r C.DE104":
  exists "LPV/r C.DE104 Condition"
    or exists "LPV/r C.DE104 Observation"
define "LPV/r C.DE104 Condition":
  [Condition: Concepts."LPV/r - HIV.C.DE104"]
define "LPV/r C.DE104 Observation":
  "Alternative third PEP drug Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."LPV/r - HIV.C.DE104"
/* End of LPV/r C.DE104 */

/*
@dataElement: HIV.C.DE105 - RAL
@activity: HIV.C3 Capture or update client history
@description: Alternative third drug of raltegravir (RAL)
*/
// TODO: Replace placeholder with relevant CQL logic
define "RAL C.DE105":
  exists "RAL C.DE105 Condition"
    or exists "RAL C.DE105 Observation"
define "RAL C.DE105 Condition":
  [Condition: Concepts."RAL - HIV.C.DE105"]
define "RAL C.DE105 Observation":
  "Alternative third PEP drug Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."RAL - HIV.C.DE105"
/* End of RAL C.DE105 */

/*
@dataElement: HIV.C.DE106 - Estimated creatinine clearance
@activity: HIV.C23 Prescribe or administer PrEP or PEP
@description: Estimated creatinine clearance of the client returned from lab in mL/min
*/
// TODO: Replace placeholder with relevant CQL logic
define "Estimated creatinine clearance":
  [Observation: Concepts."Estimated creatinine clearance"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Estimated creatinine clearance Value":
  "Estimated creatinine clearance" O
  return O.value as Quantity
/* End of Estimated creatinine clearance */

/*
@dataElement: HIV.C.DE112 - Contraindications to PrEP usage
@activity: HIV.C23 Prescribe or administer PrEP or PEP
@description: Listing of contraindications to pre-exposure prophylaxis (PrEP)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Contraindications to PrEP usage":
  exists "Contraindications to PrEP usage Observation"
define "Contraindications to PrEP usage Observation":
  [Observation: Concepts."Contraindications to PrEP usage"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Contraindications to PrEP usage */

/*
@dataElement: HIV.C.DE113 - Tenofovir disoproxil fumarate TDF allergy or contraindication
@activity: HIV.C23 Prescribe or administer PrEP or PEP
@description: Allergy to pre-exposure prophylaxis (PrEP) tenofovir disoproxil fumarate (TDF)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Tenofovir disoproxil fumarate TDF allergy or contraindication":
  exists "Tenofovir disoproxil fumarate TDF allergy or contraindication Condition"
    or exists "Tenofovir disoproxil fumarate TDF allergy or contraindication Observation"
define "Tenofovir disoproxil fumarate TDF allergy or contraindication Condition":
  [Condition: Concepts."Tenofovir disoproxil fumarate TDF allergy or contraindication"]
define "Tenofovir disoproxil fumarate TDF allergy or contraindication Observation":
  "Contraindications to PrEP usage Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Tenofovir disoproxil fumarate TDF allergy or contraindication"
/* End of Tenofovir disoproxil fumarate TDF allergy or contraindication */

/*
@dataElement: HIV.C.DE114 - HIV-positive
@activity: HIV.C23 Prescribe or administer PrEP or PEP
@description: Client is HIV-positive
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV-positive C.DE114":
  exists "HIV-positive C.DE114 Condition"
    or exists "HIV-positive C.DE114 Observation"
define "HIV-positive C.DE114 Condition":
  [Condition: Concepts."HIV-positive - HIV.C.DE114"]
define "HIV-positive C.DE114 Observation":
  "Contraindications to PrEP usage Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."HIV-positive - HIV.C.DE114"
/* End of HIV-positive C.DE114 */

/*
@dataElement: HIV.C.DE115 - Low estimated creatinine clearance
@activity: HIV.C23 Prescribe or administer PrEP or PEP
@description: Estimated creatinine clearance of less than 60 ml/min (if known)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Low estimated creatinine clearance":
  exists "Low estimated creatinine clearance Condition"
    or exists "Low estimated creatinine clearance Observation"
define "Low estimated creatinine clearance Condition":
  [Condition: Concepts."Low estimated creatinine clearance"]
define "Low estimated creatinine clearance Observation":
  "Contraindications to PrEP usage Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Low estimated creatinine clearance"
/* End of Low estimated creatinine clearance */

/*
@dataElement: HIV.C.DE116 - Acute HIV infection symptoms
@activity: HIV.C23 Prescribe or administer PrEP or PEP
@description: Symptoms that could suggest an acute HIV infection
*/
// TODO: Replace placeholder with relevant CQL logic
define "Acute HIV infection symptoms C.DE116":
  "Contraindications to PrEP usage Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Acute HIV infection symptoms - HIV.C.DE116"
/* End of Acute HIV infection symptoms C.DE116 */

/*
@dataElement: HIV.C.DE117 - Probable recent exposure to HIV
@activity: HIV.C23 Prescribe or administer PrEP or PEP
@description: When the client is reported to have had probable recent exposure to HIV
*/
// TODO: Replace placeholder with relevant CQL logic
define "Probable recent exposure to HIV":
  "Contraindications to PrEP usage Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Probable recent exposure to HIV"
/* End of Probable recent exposure to HIV */

/*
@dataElement: HIV.C.DE118 - Other allergy or contraindication to a medicine in the PrEP regimen
@activity: HIV.C23 Prescribe or administer PrEP or PEP
@description: Client has another allergy or contraindication to a medicine in the pre-exposure prophylaxis (PrEP) regimen
*/
// TODO: Replace placeholder with relevant CQL logic
define "Other allergy or contraindication to a medicine in the PrEP regimen":
  exists "Other allergy or contraindication to a medicine in the PrEP regimen Condition"
    or exists "Other allergy or contraindication to a medicine in the PrEP regimen Observation"
define "Other allergy or contraindication to a medicine in the PrEP regimen Condition":
  [Condition: Concepts."Other allergy or contraindication to a medicine in the PrEP regimen"]
define "Other allergy or contraindication to a medicine in the PrEP regimen Observation":
  "Contraindications to PrEP usage Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Other allergy or contraindication to a medicine in the PrEP regimen"
/* End of Other allergy or contraindication to a medicine in the PrEP regimen */

/*
@dataElement: HIV.C.DE121 - Number of days prescribed
@activity: HIV.C23 Prescribe or administer PrEP or PEP
@description: Days of medication client has been prescribed
*/
// TODO: Replace placeholder with relevant CQL logic
define "Number of days prescribed C.DE121":
  [Observation: Concepts."Number of days prescribed - HIV.C.DE121"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Number of days prescribed C.DE121 Value":
  "Number of days prescribed C.DE121" O
  return O.value as Quantity
/* End of Number of days prescribed C.DE121 */

/*
@dataElement: HIV.C.DE123 - Adherence counselling provided
@activity: HIV.C23 Prescribe or administer PrEP or PEP
@description: Whether adherence counselling was provided
*/
// TODO: Replace placeholder with relevant CQL logic
define "Adherence counselling provided C.DE123":
  exists "Adherence counselling provided C.DE123 Observation"
define "Adherence counselling provided C.DE123 Observation":
  [Observation: Concepts."Adherence counselling provided - HIV.C.DE123"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value is true
/* End of Adherence counselling provided C.DE123 */

/*
@dataElement: HIV.C.DE124 - Date/time of follow-up appointment
@activity: HIV.C24 Schedule follow-up
@description: Date the client is to return for monitoring, re-supply, or any other reason
*/
// TODO: Replace placeholder with relevant CQL logic
define "Date/time of follow-up appointment C.DE124":
  [Observation: Concepts."Date/time of follow-up appointment - HIV.C.DE124"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Date/time of follow-up appointment C.DE124 Value":
  "Date/time of follow-up appointment C.DE124" O
  return O.value as dateTime
/* End of Date/time of follow-up appointment C.DE124 */

/*
@dataElement: HIV.C.DE125 - Type of follow-up appointment
@activity: HIV.C24 Schedule follow-up
@description: Type of follow-up appointment for testing services
*/
// TODO: Replace placeholder with relevant CQL logic
define "Type of follow-up appointment C.DE125":
  exists "Type of follow-up appointment C.DE125 Observation"
define "Type of follow-up appointment C.DE125 Observation":
  [Observation: Concepts."Type of follow-up appointment - HIV.C.DE125"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Type of follow-up appointment C.DE125 */

/*
@dataElement: HIV.C.DE126 - Retesting for HIV
@activity: HIV.C24 Schedule follow-up
@description: Retesting follow-up appointment
*/
// TODO: Replace placeholder with relevant CQL logic
define "Retesting for HIV C.DE126":
  exists "Retesting for HIV C.DE126 Condition"
    or exists "Retesting for HIV C.DE126 Observation"
define "Retesting for HIV C.DE126 Condition":
  [Condition: Concepts."Retesting for HIV - HIV.C.DE126"]
define "Retesting for HIV C.DE126 Observation":
  "Type of follow-up appointment C.DE125 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Retesting for HIV - HIV.C.DE126"
/* End of Retesting for HIV C.DE126 */

/*
@dataElement: HIV.C.DE127 - Follow-up appointment for PrEP
@activity: HIV.C24 Schedule follow-up
@description: Retesting follow-up appointment
*/
// TODO: Replace placeholder with relevant CQL logic
define "Follow-up appointment for PrEP":
  exists "Follow-up appointment for PrEP Condition"
    or exists "Follow-up appointment for PrEP Observation"
define "Follow-up appointment for PrEP Condition":
  [Condition: Concepts."Follow-up appointment for PrEP"]
define "Follow-up appointment for PrEP Observation":
  "Type of follow-up appointment C.DE125 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Follow-up appointment for PrEP"
/* End of Follow-up appointment for PrEP */

/*
@dataElement: HIV.C.DE128 - Other
@activity: HIV.C24 Schedule follow-up
@description: Other reason for the follow-up appointment
*/
// TODO: Replace placeholder with relevant CQL logic
define "Other C.DE128":
  exists "Other C.DE128 Condition"
    or exists "Other C.DE128 Observation"
define "Other C.DE128 Condition":
  [Condition: Concepts."Other - HIV.C.DE128"]
define "Other C.DE128 Observation":
  "Type of follow-up appointment C.DE125 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Other - HIV.C.DE128"
/* End of Other C.DE128 */

/*
@dataElement: HIV.C.DE131 - Prevention services offered and referrals
@activity: HIV.C10 Counsel on risk and prevention
@description: Offer or refer to prevention services
*/
// TODO: Replace placeholder with relevant CQL logic
define "Prevention services offered and referrals C.DE131":
  exists "Prevention services offered and referrals C.DE131 Observation"
define "Prevention services offered and referrals C.DE131 Observation":
  [Observation: Concepts."Prevention services offered and referrals - HIV.C.DE131"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Prevention services offered and referrals C.DE131 */

/*
@dataElement: HIV.C.DE132 - Male and female condoms and condom-compatible lubricants offered
@activity: HIV.C10 Counsel on risk and prevention
@description: Offer male and female condoms and condom-compatible lubricants
*/
// TODO: Replace placeholder with relevant CQL logic
define "Male and female condoms and condom-compatible lubricants offered":
  exists "Male and female condoms and condom-compatible lubricants offered Condition"
    or exists "Male and female condoms and condom-compatible lubricants offered Observation"
define "Male and female condoms and condom-compatible lubricants offered Condition":
  [Condition: Concepts."Male and female condoms and condom-compatible lubricants offered"]
define "Male and female condoms and condom-compatible lubricants offered Observation":
  "Prevention services offered and referrals C.DE131 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Male and female condoms and condom-compatible lubricants offered"
/* End of Male and female condoms and condom-compatible lubricants offered */

/*
@dataElement: HIV.C.DE133 - Voluntary medical male circumcision VMMC referral
@activity: HIV.C10 Counsel on risk and prevention
@description: Offer referral for VMMC services
*/
// TODO: Replace placeholder with relevant CQL logic
define "Voluntary medical male circumcision VMMC referral":
  exists "Voluntary medical male circumcision VMMC referral Condition"
    or exists "Voluntary medical male circumcision VMMC referral Observation"
define "Voluntary medical male circumcision VMMC referral Condition":
  [Condition: Concepts."Voluntary medical male circumcision VMMC referral"]
define "Voluntary medical male circumcision VMMC referral Observation":
  "Prevention services offered and referrals C.DE131 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Voluntary medical male circumcision VMMC referral"
/* End of Voluntary medical male circumcision VMMC referral */

/*
@dataElement: HIV.C.DE134 - Harm reduction for people who inject drugs
@activity: HIV.C10 Counsel on risk and prevention
@description: Offer or refer to harm reduction for people who inject drugs (needle and syringe programmes, opioid substitution therapy, other drug-dependence treatment and opioid overdose prevention and management) services
*/
// TODO: Replace placeholder with relevant CQL logic
define "Harm reduction for people who inject drugs C.DE134":
  exists "Harm reduction for people who inject drugs C.DE134 Condition"
    or exists "Harm reduction for people who inject drugs C.DE134 Observation"
define "Harm reduction for people who inject drugs C.DE134 Condition":
  [Condition: Concepts."Harm reduction for people who inject drugs - HIV.C.DE134"]
define "Harm reduction for people who inject drugs C.DE134 Observation":
  "Prevention services offered and referrals C.DE131 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Harm reduction for people who inject drugs - HIV.C.DE134"
/* End of Harm reduction for people who inject drugs C.DE134 */

/*
@dataElement: HIV.C.DE135 - Behavioural interventions to support risk reduction
@activity: HIV.C10 Counsel on risk and prevention
@description: Offer or refer to services for behavioural interventions to support risk reduction, particularly for people with HIV and members of key populations
*/
// TODO: Replace placeholder with relevant CQL logic
define "Behavioural interventions to support risk reduction C.DE135":
  exists "Behavioural interventions to support risk reduction C.DE135 Condition"
    or exists "Behavioural interventions to support risk reduction C.DE135 Observation"
define "Behavioural interventions to support risk reduction C.DE135 Condition":
  [Condition: Concepts."Behavioural interventions to support risk reduction - HIV.C.DE135"]
define "Behavioural interventions to support risk reduction C.DE135 Observation":
  "Prevention services offered and referrals C.DE131 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Behavioural interventions to support risk reduction - HIV.C.DE135"
/* End of Behavioural interventions to support risk reduction C.DE135 */

/*
@dataElement: HIV.C.DE138 - Condom type
@activity: HIV.C10 Counsel on risk and prevention
@description: Type of condom provided to client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Condom type":
  exists "Condom type Observation"
define "Condom type Observation":
  [Observation: Concepts."Condom type"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Condom type */

/*
@dataElement: HIV.C.DE139 - Male condom
@activity: HIV.C10 Counsel on risk and prevention
@description: Male condoms were provided to the client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Male condom":
  exists "Male condom Condition"
    or exists "Male condom Observation"
define "Male condom Condition":
  [Condition: Concepts."Male condom"]
define "Male condom Observation":
  "Condom type Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Male condom"
/* End of Male condom */

/*
@dataElement: HIV.C.DE140 - Female condom
@activity: HIV.C10 Counsel on risk and prevention
@description: Female condoms were provided to the client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Female condom":
  exists "Female condom Condition"
    or exists "Female condom Observation"
define "Female condom Condition":
  [Condition: Concepts."Female condom"]
define "Female condom Observation":
  "Condom type Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Female condom"
/* End of Female condom */

/*
@dataElement: HIV.C.DE142 - Number of HIV self-test kits distributed
@activity: HIV.C10 Counsel on risk and prevention
@description: Number of HIV self-test kits distributed to the client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Number of HIV self-test kits distributed":
  [Observation: Concepts."Number of HIV self-test kits distributed"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Number of HIV self-test kits distributed Value":
  "Number of HIV self-test kits distributed" O
  return O.value as Quantity
/* End of Number of HIV self-test kits distributed */

/*
@dataElement: HIV.C.DE143 - HIV self-test distributed for use by
@activity: HIV.C10 Counsel on risk and prevention
@description: Whom the client plans to give the HIV self-test kit (self, sexual partner, social contact, etc.)
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV self-test distributed for use by":
  exists "HIV self-test distributed for use by Observation"
define "HIV self-test distributed for use by Observation":
  [Observation: Concepts."HIV self-test distributed for use by"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of HIV self-test distributed for use by */

/*
@dataElement: HIV.C.DE144 - Self
@activity: HIV.C10 Counsel on risk and prevention
@description: Client plans to use the self-test kit
*/
// TODO: Replace placeholder with relevant CQL logic
define "Self":
  exists "Self Condition"
    or exists "Self Observation"
define "Self Condition":
  [Condition: Concepts."Self"]
define "Self Observation":
  "HIV self-test distributed for use by Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Self"
/* End of Self */

/*
@dataElement: HIV.C.DE145 - Family member
@activity: HIV.C10 Counsel on risk and prevention
@description: Client plans to give the self-test kit to a family member to use
*/
// TODO: Replace placeholder with relevant CQL logic
define "Family member":
  exists "Family member Condition"
    or exists "Family member Observation"
define "Family member Condition":
  [Condition: Concepts."Family member"]
define "Family member Observation":
  "HIV self-test distributed for use by Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Family member"
/* End of Family member */

/*
@dataElement: HIV.C.DE146 - Drug-injecting partner
@activity: HIV.C10 Counsel on risk and prevention
@description: Client plans to give the self-test kit to a drug-injecting partner
*/
// TODO: Replace placeholder with relevant CQL logic
define "Drug-injecting partner C.DE146":
  exists "Drug-injecting partner C.DE146 Condition"
    or exists "Drug-injecting partner C.DE146 Observation"
define "Drug-injecting partner C.DE146 Condition":
  [Condition: Concepts."Drug-injecting partner - HIV.C.DE146"]
define "Drug-injecting partner C.DE146 Observation":
  "HIV self-test distributed for use by Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Drug-injecting partner - HIV.C.DE146"
/* End of Drug-injecting partner C.DE146 */

/*
@dataElement: HIV.C.DE147 - Sexual partner
@activity: HIV.C10 Counsel on risk and prevention
@description: Client plans to give the self-test kit to a sexual partner
*/
// TODO: Replace placeholder with relevant CQL logic
define "Sexual partner C.DE147":
  exists "Sexual partner C.DE147 Condition"
    or exists "Sexual partner C.DE147 Observation"
define "Sexual partner C.DE147 Condition":
  [Condition: Concepts."Sexual partner - HIV.C.DE147"]
define "Sexual partner C.DE147 Observation":
  "HIV self-test distributed for use by Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Sexual partner - HIV.C.DE147"
/* End of Sexual partner C.DE147 */

/*
@dataElement: HIV.C.DE148 - Social contact
@activity: HIV.C10 Counsel on risk and prevention
@description: Client plans to give the self-test kit to a social contact
*/
// TODO: Replace placeholder with relevant CQL logic
define "Social contact C.DE148":
  exists "Social contact C.DE148 Condition"
    or exists "Social contact C.DE148 Observation"
define "Social contact C.DE148 Condition":
  [Condition: Concepts."Social contact - HIV.C.DE148"]
define "Social contact C.DE148 Observation":
  "HIV self-test distributed for use by Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Social contact - HIV.C.DE148"
/* End of Social contact C.DE148 */

/*
@dataElement: HIV.C.DE149 - Sexual and reproductive health integrated services
@activity: HIV.C10 Counsel on risk and prevention
@description: Offer or refer to sexual and reproductive health services
*/
// TODO: Replace placeholder with relevant CQL logic
define "Sexual and reproductive health integrated services C.DE149":
  exists "Sexual and reproductive health integrated services C.DE149 Observation"
define "Sexual and reproductive health integrated services C.DE149 Observation":
  [Observation: Concepts."Sexual and reproductive health integrated services - HIV.C.DE149"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Sexual and reproductive health integrated services C.DE149 */

/*
@dataElement: HIV.C.DE150 - Contraception and family planning
@activity: HIV.C10 Counsel on risk and prevention
@description: Offer contraception and family planning services
*/
// TODO: Replace placeholder with relevant CQL logic
define "Contraception and family planning C.DE150":
  exists "Contraception and family planning C.DE150 Condition"
    or exists "Contraception and family planning C.DE150 Observation"
define "Contraception and family planning C.DE150 Condition":
  [Condition: Concepts."Contraception and family planning - HIV.C.DE150"]
define "Contraception and family planning C.DE150 Observation":
  "Sexual and reproductive health integrated services C.DE149 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Contraception and family planning - HIV.C.DE150"
/* End of Contraception and family planning C.DE150 */

/*
@dataElement: HIV.C.DE151 - Check pregnancy status
@activity: HIV.C10 Counsel on risk and prevention
@description: Check woman's pregnancy status
*/
// TODO: Replace placeholder with relevant CQL logic
define "Check pregnancy status C.DE151":
  exists "Check pregnancy status C.DE151 Condition"
    or exists "Check pregnancy status C.DE151 Observation"
define "Check pregnancy status C.DE151 Condition":
  [Condition: Concepts."Check pregnancy status - HIV.C.DE151"]
define "Check pregnancy status C.DE151 Observation":
  "Sexual and reproductive health integrated services C.DE149 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Check pregnancy status - HIV.C.DE151"
/* End of Check pregnancy status C.DE151 */

/*
@dataElement: HIV.C.DE152 - Prevent mother-to-child transmission
@activity: HIV.C10 Counsel on risk and prevention
@description: Offer services (counselling) to help prevent of mother-to-child transmission
*/
// TODO: Replace placeholder with relevant CQL logic
define "Prevent mother-to-child transmission":
  exists "Prevent mother-to-child transmission Condition"
    or exists "Prevent mother-to-child transmission Observation"
define "Prevent mother-to-child transmission Condition":
  [Condition: Concepts."Prevent mother-to-child transmission"]
define "Prevent mother-to-child transmission Observation":
  "Sexual and reproductive health integrated services C.DE149 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Prevent mother-to-child transmission"
/* End of Prevent mother-to-child transmission */

/*
@dataElement: HIV.C.DE153 - Cervical cancer screening and treatment
@activity: HIV.C10 Counsel on risk and prevention
@description: Offer cervical cancer screening and treatment services
*/
// TODO: Replace placeholder with relevant CQL logic
define "Cervical cancer screening and treatment":
  exists "Cervical cancer screening and treatment Condition"
    or exists "Cervical cancer screening and treatment Observation"
define "Cervical cancer screening and treatment Condition":
  [Condition: Concepts."Cervical cancer screening and treatment"]
define "Cervical cancer screening and treatment Observation":
  "Sexual and reproductive health integrated services C.DE149 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Cervical cancer screening and treatment"
/* End of Cervical cancer screening and treatment */

/*
@dataElement: HIV.C.DE154 - Anal cancer screening for men who have sex with men
@activity: HIV.C10 Counsel on risk and prevention
@description: Offer anal cancer screening (for men who have sex with men) services
*/
// TODO: Replace placeholder with relevant CQL logic
define "Anal cancer screening for men who have sex with men C.DE154":
  exists "Anal cancer screening for men who have sex with men C.DE154 Condition"
    or exists "Anal cancer screening for men who have sex with men C.DE154 Observation"
define "Anal cancer screening for men who have sex with men C.DE154 Condition":
  [Condition: Concepts."Anal cancer screening for men who have sex with men - HIV.C.DE154"]
define "Anal cancer screening for men who have sex with men C.DE154 Observation":
  "Sexual and reproductive health integrated services C.DE149 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Anal cancer screening for men who have sex with men - HIV.C.DE154"
/* End of Anal cancer screening for men who have sex with men C.DE154 */

/*
@dataElement: HIV.C.DE155 - STI testing and treatment
@activity: HIV.C10 Counsel on risk and prevention
@description: Offer STI testing and treatment services
*/
// TODO: Replace placeholder with relevant CQL logic
define "STI testing and treatment C.DE155":
  exists "STI testing and treatment C.DE155 Condition"
    or exists "STI testing and treatment C.DE155 Observation"
define "STI testing and treatment C.DE155 Condition":
  [Condition: Concepts."STI testing and treatment - HIV.C.DE155"]
define "STI testing and treatment C.DE155 Observation":
  "Sexual and reproductive health integrated services C.DE149 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."STI testing and treatment - HIV.C.DE155"
/* End of STI testing and treatment C.DE155 */

/*
@dataElement: HIV.C.DE156 - HIV testing for partners and biological children
@activity: HIV.C10 Counsel on risk and prevention
@description: Offer testing for all partners and biological children of positive cases (includes partner services and index case testing), as well as partners and social contacts of people from key populations, where appropriate
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV testing for partners and biological children C.DE156":
  exists "HIV testing for partners and biological children C.DE156 Condition"
    or exists "HIV testing for partners and biological children C.DE156 Observation"
define "HIV testing for partners and biological children C.DE156 Condition":
  [Condition: Concepts."HIV testing for partners and biological children - HIV.C.DE156"]
define "HIV testing for partners and biological children C.DE156 Observation":
  "Sexual and reproductive health integrated services C.DE149 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."HIV testing for partners and biological children - HIV.C.DE156"
/* End of HIV testing for partners and biological children C.DE156 */

/*
@dataElement: HIV.C.DE157 - Offer other clinical services
@activity: HIV.C10 Counsel on risk and prevention
@description: Other clinical services offered or referrals given to the client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Offer other clinical services C.DE157":
  exists "Offer other clinical services C.DE157 Observation"
define "Offer other clinical services C.DE157 Observation":
  [Observation: Concepts."Offer other clinical services - HIV.C.DE157"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Offer other clinical services C.DE157 */

/*
@dataElement: HIV.C.DE158 - Assessment and provision of vaccinations
@activity: HIV.C10 Counsel on risk and prevention
@description: Assessment and provision of vaccinations, such as for people from key populations, pregnant women and infants; and, where appropriate, tetanus vaccination for adolescent boys and men receiving VMMC
*/
// TODO: Replace placeholder with relevant CQL logic
define "Assessment and provision of vaccinations C.DE158":
  exists "Assessment and provision of vaccinations C.DE158 Condition"
    or exists "Assessment and provision of vaccinations C.DE158 Observation"
define "Assessment and provision of vaccinations C.DE158 Condition":
  [Condition: Concepts."Assessment and provision of vaccinations - HIV.C.DE158"]
define "Assessment and provision of vaccinations C.DE158 Observation":
  "Offer other clinical services C.DE157 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Assessment and provision of vaccinations - HIV.C.DE158"
/* End of Assessment and provision of vaccinations C.DE158 */

/*
@dataElement: HIV.C.DE159 - Hepatitis B virus HBV and hepatitis C virus HCV testing and treatment
@activity: HIV.C10 Counsel on risk and prevention
@description: Offer or refer for HBV testing and vaccination and HCV testing and treatment
*/
// TODO: Replace placeholder with relevant CQL logic
define "Hepatitis B virus HBV and hepatitis C virus HCV testing and treatment":
  exists "Hepatitis B virus HBV and hepatitis C virus HCV testing and treatment Condition"
    or exists "Hepatitis B virus HBV and hepatitis C virus HCV testing and treatment Observation"
define "Hepatitis B virus HBV and hepatitis C virus HCV testing and treatment Condition":
  [Condition: Concepts."Hepatitis B virus HBV and hepatitis C virus HCV testing and treatment"]
define "Hepatitis B virus HBV and hepatitis C virus HCV testing and treatment Observation":
  "Offer other clinical services C.DE157 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Hepatitis B virus HBV and hepatitis C virus HCV testing and treatment"
/* End of Hepatitis B virus HBV and hepatitis C virus HCV testing and treatment */

/*
@dataElement: HIV.C.DE160 - Co-trimoxazole chemoprophylaxis to prevent pneumocystis carinii pneumonia
@activity: HIV.C10 Counsel on risk and prevention
@description: Offer or refer for co-trimoxazole chemoprophylaxis to prevent pneumocystis carinii pneumonia
*/
// TODO: Replace placeholder with relevant CQL logic
define "Co-trimoxazole chemoprophylaxis to prevent pneumocystis carinii pneumonia C.DE160":
  exists "Co-trimoxazole chemoprophylaxis to prevent pneumocystis carinii pneumonia C.DE160 Condition"
    or exists "Co-trimoxazole chemoprophylaxis to prevent pneumocystis carinii pneumonia C.DE160 Observation"
define "Co-trimoxazole chemoprophylaxis to prevent pneumocystis carinii pneumonia C.DE160 Condition":
  [Condition: Concepts."Co-trimoxazole chemoprophylaxis to prevent pneumocystis carinii pneumonia - HIV.C.DE160"]
define "Co-trimoxazole chemoprophylaxis to prevent pneumocystis carinii pneumonia C.DE160 Observation":
  "Offer other clinical services C.DE157 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Co-trimoxazole chemoprophylaxis to prevent pneumocystis carinii pneumonia - HIV.C.DE160"
/* End of Co-trimoxazole chemoprophylaxis to prevent pneumocystis carinii pneumonia C.DE160 */

/*
@dataElement: HIV.C.DE161 - Intensified TB case finding and linkage to TB treatment
@activity: HIV.C10 Counsel on risk and prevention
@description: Offer or refer for TB case finding and linkage to TB treatment
*/
// TODO: Replace placeholder with relevant CQL logic
define "Intensified TB case finding and linkage to TB treatment C.DE161":
  exists "Intensified TB case finding and linkage to TB treatment C.DE161 Condition"
    or exists "Intensified TB case finding and linkage to TB treatment C.DE161 Observation"
define "Intensified TB case finding and linkage to TB treatment C.DE161 Condition":
  [Condition: Concepts."Intensified TB case finding and linkage to TB treatment - HIV.C.DE161"]
define "Intensified TB case finding and linkage to TB treatment C.DE161 Observation":
  "Offer other clinical services C.DE157 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Intensified TB case finding and linkage to TB treatment - HIV.C.DE161"
/* End of Intensified TB case finding and linkage to TB treatment C.DE161 */

/*
@dataElement: HIV.C.DE162 - Provision of isoniazid preventive therapy if person does not have TB
@activity: HIV.C10 Counsel on risk and prevention
@description: Offer or refer for provision of isoniazid preventive therapy if person does not have TB
*/
// TODO: Replace placeholder with relevant CQL logic
define "Provision of isoniazid preventive therapy if person does not have TB C.DE162":
  exists "Provision of isoniazid preventive therapy if person does not have TB C.DE162 Condition"
    or exists "Provision of isoniazid preventive therapy if person does not have TB C.DE162 Observation"
define "Provision of isoniazid preventive therapy if person does not have TB C.DE162 Condition":
  [Condition: Concepts."Provision of isoniazid preventive therapy if person does not have TB - HIV.C.DE162"]
define "Provision of isoniazid preventive therapy if person does not have TB C.DE162 Observation":
  "Offer other clinical services C.DE157 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Provision of isoniazid preventive therapy if person does not have TB - HIV.C.DE162"
/* End of Provision of isoniazid preventive therapy if person does not have TB C.DE162 */

/*
@dataElement: HIV.C.DE163 - Malaria prevention such as bed nets and prophylaxis, depending on epidemiology
@activity: HIV.C10 Counsel on risk and prevention
@description: Offer or refer for malaria prevention (such as bed nets and prophylaxis), depending on epidemiology
*/
// TODO: Replace placeholder with relevant CQL logic
define "Malaria prevention such as bed nets and prophylaxis, depending on epidemiology C.DE163":
  exists "Malaria prevention such as bed nets and prophylaxis, depending on epidemiology C.DE163 Condition"
    or exists "Malaria prevention such as bed nets and prophylaxis, depending on epidemiology C.DE163 Observation"
define "Malaria prevention such as bed nets and prophylaxis, depending on epidemiology C.DE163 Condition":
  [Condition: Concepts."Malaria prevention such as bed nets and prophylaxis, depending on epidemiology - HIV.C.DE163"]
define "Malaria prevention such as bed nets and prophylaxis, depending on epidemiology C.DE163 Observation":
  "Offer other clinical services C.DE157 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Malaria prevention such as bed nets and prophylaxis, depending on epidemiology - HIV.C.DE163"
/* End of Malaria prevention such as bed nets and prophylaxis, depending on epidemiology C.DE163 */

/*
@dataElement: HIV.C.DE164 - Other support services
@activity: HIV.C10 Counsel on risk and prevention
@description: Offer or refer for other support services
*/
// TODO: Replace placeholder with relevant CQL logic
define "Other support services C.DE164":
  exists "Other support services C.DE164 Observation"
define "Other support services C.DE164 Observation":
  [Observation: Concepts."Other support services - HIV.C.DE164"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Other support services C.DE164 */

/*
@dataElement: HIV.C.DE165 - Mental health services
@activity: HIV.C10 Counsel on risk and prevention
@description: Offer or refer for mental health services
*/
// TODO: Replace placeholder with relevant CQL logic
define "Mental health services C.DE165":
  exists "Mental health services C.DE165 Condition"
    or exists "Mental health services C.DE165 Observation"
define "Mental health services C.DE165 Condition":
  [Condition: Concepts."Mental health services - HIV.C.DE165"]
define "Mental health services C.DE165 Observation":
  "Other support services C.DE164 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Mental health services - HIV.C.DE165"
/* End of Mental health services C.DE165 */

/*
@dataElement: HIV.C.DE166 - Psychosocial counselling, support and treatment adherence counselling
@activity: HIV.C10 Counsel on risk and prevention
@description: Offer or refer for psychosocial counselling, support and treatment adherence counselling
*/
// TODO: Replace placeholder with relevant CQL logic
define "Psychosocial counselling, support and treatment adherence counselling C.DE166":
  exists "Psychosocial counselling, support and treatment adherence counselling C.DE166 Condition"
    or exists "Psychosocial counselling, support and treatment adherence counselling C.DE166 Observation"
define "Psychosocial counselling, support and treatment adherence counselling C.DE166 Condition":
  [Condition: Concepts."Psychosocial counselling, support and treatment adherence counselling - HIV.C.DE166"]
define "Psychosocial counselling, support and treatment adherence counselling C.DE166 Observation":
  "Other support services C.DE164 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Psychosocial counselling, support and treatment adherence counselling - HIV.C.DE166"
/* End of Psychosocial counselling, support and treatment adherence counselling C.DE166 */

/*
@dataElement: HIV.C.DE167 - Support for disclosure and partner services
@activity: HIV.C10 Counsel on risk and prevention
@description: Offer or refer for support for disclosure and partner services
*/
// TODO: Replace placeholder with relevant CQL logic
define "Support for disclosure and partner services C.DE167":
  exists "Support for disclosure and partner services C.DE167 Condition"
    or exists "Support for disclosure and partner services C.DE167 Observation"
define "Support for disclosure and partner services C.DE167 Condition":
  [Condition: Concepts."Support for disclosure and partner services - HIV.C.DE167"]
define "Support for disclosure and partner services C.DE167 Observation":
  "Other support services C.DE164 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Support for disclosure and partner services - HIV.C.DE167"
/* End of Support for disclosure and partner services C.DE167 */

/*
@dataElement: HIV.C.DE168 - Legal and social services
@activity: HIV.C10 Counsel on risk and prevention
@description: Offer or refer for legal and social services
*/
// TODO: Replace placeholder with relevant CQL logic
define "Legal and social services C.DE168":
  exists "Legal and social services C.DE168 Condition"
    or exists "Legal and social services C.DE168 Observation"
define "Legal and social services C.DE168 Condition":
  [Condition: Concepts."Legal and social services - HIV.C.DE168"]
define "Legal and social services C.DE168 Observation":
  "Other support services C.DE164 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Legal and social services - HIV.C.DE168"
/* End of Legal and social services C.DE168 */

/*
@dataElement: HIV.C.DE169 - Services for responding to violence against women
@activity: HIV.C10 Counsel on risk and prevention
@description: Offer or refer for services for responding to violence against women, including first-line support and psychosocial support, post-rape care and other support services including shelters, legal services and women and child protection services
*/
// TODO: Replace placeholder with relevant CQL logic
define "Services for responding to violence against women C.DE169":
  exists "Services for responding to violence against women C.DE169 Condition"
    or exists "Services for responding to violence against women C.DE169 Observation"
define "Services for responding to violence against women C.DE169 Condition":
  [Condition: Concepts."Services for responding to violence against women - HIV.C.DE169"]
define "Services for responding to violence against women C.DE169 Observation":
  "Other support services C.DE164 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Services for responding to violence against women - HIV.C.DE169"
/* End of Services for responding to violence against women C.DE169 */

/*
@dataElement: HIV.D.DE1 - Reason for visit
@activity: HIV.D1 Determine reason for visit
@description: Whether visit was scheduled or unscheduled, clinical only, or for ARV drug pick-up
*/
define "Reason for visit D.DE1":
  [Observation: Concepts."Reason for visit - HIV.D.DE1"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Reason for visit D.DE1 */

/*
@dataElement: HIV.D.DE9 - Body temperature
@activity: HIV.D2 Take vital signs
@description: Temperature of the client in Celsius
*/
// TODO: Replace placeholder with relevant CQL logic
define "Body temperature":
  [Observation: Concepts."Body temperature"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Body temperature Value":
  "Body temperature" O
  return O.value as Quantity
/* End of Body temperature */

/*
@dataElement: HIV.D.DE13 - Body weight
@activity: HIV.D2 Take vital signs
@description: The client's current weight in kilograms
*/
// TODO: Replace placeholder with relevant CQL logic
define "Body weight":
  [Observation: Concepts."Body weight"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Body weight Value":
  "Body weight" O
  return O.value as Quantity
/* End of Body weight */

/*
@dataElement: HIV.D.DE17 - Signs of serious illness
@activity: HIV.D3 Check for signs of serious illness
@description: Signs that may indicate the client has a serious illness and needs triage or an emergency referral
*/
define "Signs of serious illness":
  exists "Signs of serious illness Observation"
define "Signs of serious illness Observation":
  [Observation: Concepts."Signs of serious illness"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Signs of serious illness */

/*
@dataElement: HIV.D.DE18 - Fever of 39 C or greater
@activity: HIV.D3 Check for signs of serious illness
@description: Client has a fever with a measured temperature of 102.2 F/39 C or greater
*/
// TODO: Replace placeholder with relevant CQL logic
define "Fever of 39 C or greater":
  exists "Fever of 39 C or greater Condition"
    or exists "Fever of 39 C or greater Observation"
define "Fever of 39 C or greater Condition":
  [Condition: Concepts."Fever of 39 C or greater"]
define "Fever of 39 C or greater Observation":
  "Signs of serious illness Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Fever of 39 C or greater"
/* End of Fever of 39 C or greater */

/*
@dataElement: HIV.D.DE19 - Tachycardia
@activity: HIV.D3 Check for signs of serious illness
@description: Heart rate above a rate per minute based on age
*/
// TODO: Replace placeholder with relevant CQL logic
define "Tachycardia":
  exists "Tachycardia Condition"
    or exists "Tachycardia Observation"
define "Tachycardia Condition":
  [Condition: Concepts."Tachycardia"]
define "Tachycardia Observation":
  "Signs of serious illness Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Tachycardia"
/* End of Tachycardia */

/*
@dataElement: HIV.D.DE20 - Tachypnea
@activity: HIV.D3 Check for signs of serious illness
@description: Respiratory rate above a number of breaths per minute based on age
*/
// TODO: Replace placeholder with relevant CQL logic
define "Tachypnea":
  exists "Tachypnea Condition"
    or exists "Tachypnea Observation"
define "Tachypnea Condition":
  [Condition: Concepts."Tachypnea"]
define "Tachypnea Observation":
  "Signs of serious illness Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Tachypnea"
/* End of Tachypnea */

/*
@dataElement: HIV.D.DE21 - Unable to walk unaided
@activity: HIV.D3 Check for signs of serious illness
@description: Client is not able to walk without help
*/
// TODO: Replace placeholder with relevant CQL logic
define "Unable to walk unaided":
  exists "Unable to walk unaided Condition"
    or exists "Unable to walk unaided Observation"
define "Unable to walk unaided Condition":
  [Condition: Concepts."Unable to walk unaided"]
define "Unable to walk unaided Observation":
  "Signs of serious illness Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Unable to walk unaided"
/* End of Unable to walk unaided */

/*
@dataElement: HIV.D.DE22 - Lethargy
@activity: HIV.D3 Check for signs of serious illness
@description: Client is exhibiting lethargy as a sign of serious illness
*/
// TODO: Replace placeholder with relevant CQL logic
define "Lethargy D.DE22":
  exists "Lethargy D.DE22 Condition"
    or exists "Lethargy D.DE22 Observation"
define "Lethargy D.DE22 Condition":
  [Condition: Concepts."Lethargy - HIV.D.DE22"]
define "Lethargy D.DE22 Observation":
  "Signs of serious illness Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Lethargy - HIV.D.DE22"
/* End of Lethargy D.DE22 */

/*
@dataElement: HIV.D.DE23 - Unconsciousness
@activity: HIV.D3 Check for signs of serious illness
@description: Client is currently unconscious
*/
// TODO: Replace placeholder with relevant CQL logic
define "Unconsciousness":
  exists "Unconsciousness Condition"
    or exists "Unconsciousness Observation"
define "Unconsciousness Condition":
  [Condition: Concepts."Unconsciousness"]
define "Unconsciousness Observation":
  "Signs of serious illness Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Unconsciousness"
/* End of Unconsciousness */

/*
@dataElement: HIV.D.DE24 - Convulsions
@activity: HIV.D3 Check for signs of serious illness
@description: Client is convulsing
*/
// TODO: Replace placeholder with relevant CQL logic
define "Convulsions":
  exists "Convulsions Condition"
    or exists "Convulsions Observation"
define "Convulsions Condition":
  [Condition: Concepts."Convulsions"]
define "Convulsions Observation":
  "Signs of serious illness Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Convulsions"
/* End of Convulsions */

/*
@dataElement: HIV.D.DE25 - Unable to drink
@activity: HIV.D3 Check for signs of serious illness
@description: Child is not able to drink
*/
// TODO: Replace placeholder with relevant CQL logic
define "Unable to drink":
  exists "Unable to drink Condition"
    or exists "Unable to drink Observation"
define "Unable to drink Condition":
  [Condition: Concepts."Unable to drink"]
define "Unable to drink Observation":
  "Signs of serious illness Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Unable to drink"
/* End of Unable to drink */

/*
@dataElement: HIV.D.DE26 - Unable to breastfeed
@activity: HIV.D3 Check for signs of serious illness
@description: Infant or child is not able to breastfeed
*/
// TODO: Replace placeholder with relevant CQL logic
define "Unable to breastfeed":
  exists "Unable to breastfeed Condition"
    or exists "Unable to breastfeed Observation"
define "Unable to breastfeed Condition":
  [Condition: Concepts."Unable to breastfeed"]
define "Unable to breastfeed Observation":
  "Signs of serious illness Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Unable to breastfeed"
/* End of Unable to breastfeed */

/*
@dataElement: HIV.D.DE27 - Repeated vomiting
@activity: HIV.D3 Check for signs of serious illness
@description: Client is repeatedly vomiting
*/
// TODO: Replace placeholder with relevant CQL logic
define "Repeated vomiting":
  exists "Repeated vomiting Condition"
    or exists "Repeated vomiting Observation"
define "Repeated vomiting Condition":
  [Condition: Concepts."Repeated vomiting"]
define "Repeated vomiting Observation":
  "Signs of serious illness Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Repeated vomiting"
/* End of Repeated vomiting */

/*
@dataElement: HIV.D.DE28 - Headache
@activity: HIV.D3 Check for signs of serious illness
@description: Client is exhibiting a headache
*/
// TODO: Replace placeholder with relevant CQL logic
define "Headache D.DE28":
  exists "Headache D.DE28 Condition"
    or exists "Headache D.DE28 Observation"
define "Headache D.DE28 Condition":
  [Condition: Concepts."Headache - HIV.D.DE28"]
define "Headache D.DE28 Observation":
  "Signs of serious illness Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Headache - HIV.D.DE28"
/* End of Headache D.DE28 */

/*
@dataElement: HIV.D.DE29 - Other sign of serious illness
@activity: HIV.D3 Check for signs of serious illness
@description: Client is exhibiting another sign of a serious illness
*/
// TODO: Replace placeholder with relevant CQL logic
define "Other sign of serious illness":
  exists "Other sign of serious illness Condition"
    or exists "Other sign of serious illness Observation"
define "Other sign of serious illness Condition":
  [Condition: Concepts."Other sign of serious illness"]
define "Other sign of serious illness Observation":
  "Signs of serious illness Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Other sign of serious illness"
/* End of Other sign of serious illness */

/*
@dataElement: HIV.D.DE31 - Currently pregnant
@activity: HIV.D8 Capture or update client history
@description: Client is currently pregnant
*/
// TODO: Replace placeholder with relevant CQL logic
define "Currently pregnant D.DE31":
  exists "Currently pregnant D.DE31 Observation"
define "Currently pregnant D.DE31 Observation":
  [Observation: Concepts."Currently pregnant - HIV.D.DE31"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value is true
/* End of Currently pregnant D.DE31 */

/*
@dataElement: HIV.D.DE32 - Breastfeeding
@activity: HIV.D8 Capture or update client history
@description: Client is giving infant breast milk
*/
// TODO: Replace placeholder with relevant CQL logic
define "Breastfeeding D.DE32":
  exists "Breastfeeding D.DE32 Observation"
define "Breastfeeding D.DE32 Observation":
  [Observation: Concepts."Breastfeeding - HIV.D.DE32"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value is true
/* End of Breastfeeding D.DE32 */

/*
@dataElement: HIV.D.DE37 - Serodiscordant partner
@activity: HIV.D8 Capture or update client history
@description: Client's HIV status is different from a current partner's HIV status
*/
// TODO: Replace placeholder with relevant CQL logic
define "Serodiscordant partner D.DE37":
  exists "Serodiscordant partner D.DE37 Observation"
define "Serodiscordant partner D.DE37 Observation":
  [Observation: Concepts."Serodiscordant partner - HIV.D.DE37"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value is true
/* End of Serodiscordant partner D.DE37 */

/*
@dataElement: HIV.D.DE38 - On ART
@activity: HIV.D8 Capture or update client history
@description: Client is currently taking ART
*/

define "On ART D.DE38":
    [MedicationStatement] MS
    where exists(MS.reasonCode C where C ~ Concepts."On ART - HIV.D.DE38")
    sort by start of effective.toInterval()
/* End of On ART D.DE38 */

/*
@dataElement: HIV.D.DE39 - ART start date
@activity: HIV.D8 Capture or update client history
@description: The date on which the client started or restarted ART
*/
define "ART start date D.DE39":
  "On ART D.DE38" MS
  return start of MS.effective.toInterval()
/* End of ART start date D.DE39 */

/*
@dataElement: HIV.D.DE41 - Date ART stopped
@activity: HIV.D8 Capture or update client history
@description: Date on which client stopped ART
*/
define "Date ART stopped D.DE41":
  "On ART D.DE38" MS
  return end of MS.effective.toInterval()
/* End of Date ART stopped D.DE41 */

/*
@dataElement: HIV.D.DE42 - Established on ART
@activity: HIV.D8 Capture or update client history
@description: Is the client successfully established on ART?
*/
// TODO: Replace placeholder with relevant CQL logic
define "Established on ART":
  exists "Established on ART Observation"
define "Established on ART Observation":
  [Observation: Concepts."Established on ART"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value is true
/* End of Established on ART */

/*
@dataElement: HIV.D.DE43 - ART start type
@activity: HIV.D8 Capture or update client history
@description: Whether the client is ART naive or is restarting ART
*/

define "ART start type":
  [MedicationStatement] MS
    where exists(MS.reasonCode C where C ~ Concepts."On ART - HIV.D.DE38")
    sort by start of effective.toInterval()
/* End of ART start type */

/*
@dataElement: HIV.D.DE44 - First-time user of ART
@activity: HIV.D8 Capture or update client history
@description: Client is ART naive, having never taken ART to treat HIV before
*/

define "First-time user of ART":
  "ART start type" MS
      where exists(MS.reasonCode C where C ~ Concepts."First-time user of ART") 
/* End of First-time user of ART */

/*
@dataElement: HIV.D.DE45 - Restarting ART
@activity: HIV.D8 Capture or update client history
@description: Client is restarting ART after stopping treatment for any reason
*/

define "Restarting ART":
   "ART start type" MS
      where exists(MS.reasonCode C where C ~ Concepts."Restarting ART") 

/* End of Restarting ART */

/*
@dataElement: HIV.D.DE75 - Current ART regimen
@activity: HIV.D8 Capture or update client history
@description: The current ART regimen the client is taking
*/
// TODO: Replace placeholder with relevant CQL logic
define "Current ART regimen":
  exists "Current ART regimen Observation"
define "Current ART regimen Observation":
  [Observation: Concepts."Current ART regimen"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Current ART regimen */

/*
@dataElement: HIV.D.DE77 - Preferred first-line ART regimen
@activity: HIV.D8 Capture or update client history
@description: The preferred first-line ART regimen for the client according to WHO (or national) guidelines
*/

define "Preferred first-line ART regimen":
[MedicationStatement] MS
    where MS.status = 'completed'
    and MS.medication ~ Concepts."Preferred first-line ART regimen"
/* End of Preferred first-line ART regimen */

/*
@dataElement: HIV.D.DE78 - Alternative first-line ART regimen
@activity: HIV.D8 Capture or update client history
@description: The alternative first-line ART regimen for the client according to WHO (or national) guidelines
*/

define "Alternative first-line ART regimen":
  [MedicationStatement] MS
    where MS.status = 'completed'
    and MS.medication ~ Concepts."Alternative first-line ART regimen"
/* End of Alternative first-line ART regimen */

/*
@dataElement: HIV.D.DE79 - First-line ART regimen under special circumstances
@activity: HIV.D8 Capture or update client history
@description: The first-line ART regimen for the client under special circumstances according to WHO (or national) guidelines
*/

define "First-line ART regimen under special circumstances":
    [MedicationStatement] MS
    where MS.status = 'completed'
    and MS.medication ~ Concepts."First-line ART regimen under special circumstances"
/* End of First-line ART regimen under special circumstances */

/*
@dataElement: HIV.D.DE80 - Preferred second-line ART regimen
@activity: HIV.D8 Capture or update client history
@description: The preferred second-line ART regimen for the client according to WHO (or national) guidelines
*/

define "Preferred second-line ART regimen":
    [MedicationStatement] MS
    where MS.status = 'completed'
    and MS.medication ~ Concepts."Preferred second-line ART regimen"
/* End of Preferred second-line ART regimen */

/*
@dataElement: HIV.D.DE81 - Alternative second-line ART regimen
@activity: HIV.D8 Capture or update client history
@description: The alternative second-line ART regimen for the client according to WHO (or national) guidelines
*/

define "Alternative second-line ART regimen":
    [MedicationStatement] MS
    where MS.status = 'completed'
    and MS.medication ~ Concepts."Alternative second-line ART regimen"
/* End of Alternative second-line ART regimen */

/*
@dataElement: HIV.D.DE82 - Optimal regimen for transition
@activity: HIV.D8 Capture or update client history
@description: The optimal regimen for transition to DTG-based regimens for children established on ART
*/
// TODO: Replace placeholder with relevant CQL logic
define "Optimal regimen for transition":
  exists "Optimal regimen for transition Observation"
define "Optimal regimen for transition Observation":
  [Observation: Concepts."Optimal regimen for transition"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Optimal regimen for transition */

/*
@dataElement: HIV.D.DE83 - Current ART regimen first-, second-, or third-line
@activity: HIV.D8 Capture or update client history
@description: ART regimen for treating clients living with HIV, based on national guidance
*/
// TODO: Replace placeholder with relevant CQL logic
define "Current ART regimen first-, second-, or third-line":
  exists "Current ART regimen first-, second-, or third-line Observation"
define "Current ART regimen first-, second-, or third-line Observation":
  [Observation: Concepts."Current ART regimen first-, second-, or third-line"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Current ART regimen first-, second-, or third-line */

/*
@dataElement: HIV.D.DE84 - First-line ART regimen for adults and adolescents
@activity: HIV.D8 Capture or update client history
@description: First-line ART regimen for adults and adolescents living with HIV
*/
// TODO: Replace placeholder with relevant CQL logic
define "First-line ART regimen for adults and adolescents":
  exists "First-line ART regimen for adults and adolescents Condition"
    or exists "First-line ART regimen for adults and adolescents Observation"
define "First-line ART regimen for adults and adolescents Condition":
  [Condition: Concepts."First-line ART regimen for adults and adolescents"]
define "First-line ART regimen for adults and adolescents Observation":
  "Current ART regimen first-, second-, or third-line Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."First-line ART regimen for adults and adolescents"
/* End of First-line ART regimen for adults and adolescents */

/*
@dataElement: HIV.D.DE85 - First-line ART regimen for children
@activity: HIV.D8 Capture or update client history
@description: First-line ART regimen for children living with HIV
*/
// TODO: Replace placeholder with relevant CQL logic
define "First-line ART regimen for children":
  exists "First-line ART regimen for children Condition"
    or exists "First-line ART regimen for children Observation"
define "First-line ART regimen for children Condition":
  [Condition: Concepts."First-line ART regimen for children"]
define "First-line ART regimen for children Observation":
  "Current ART regimen first-, second-, or third-line Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."First-line ART regimen for children"
/* End of First-line ART regimen for children */

/*
@dataElement: HIV.D.DE86 - First-line ART regimen for neonates
@activity: HIV.D8 Capture or update client history
@description: First-line ART regimen for neonates living with HIV
*/
// TODO: Replace placeholder with relevant CQL logic
define "First-line ART regimen for neonates":
  exists "First-line ART regimen for neonates Condition"
    or exists "First-line ART regimen for neonates Observation"
define "First-line ART regimen for neonates Condition":
  [Condition: Concepts."First-line ART regimen for neonates"]
define "First-line ART regimen for neonates Observation":
  "Current ART regimen first-, second-, or third-line Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."First-line ART regimen for neonates"
/* End of First-line ART regimen for neonates */

/*
@dataElement: HIV.D.DE87 - Second-line ART regimen for adults and adolescents
@activity: HIV.D8 Capture or update client history
@description: Second-line ART regimen for adults and adolescents living with HIV
*/
// TODO: Replace placeholder with relevant CQL logic
define "Second-line ART regimen for adults and adolescents":
  exists "Second-line ART regimen for adults and adolescents Condition"
    or exists "Second-line ART regimen for adults and adolescents Observation"
define "Second-line ART regimen for adults and adolescents Condition":
  [Condition: Concepts."Second-line ART regimen for adults and adolescents"]
define "Second-line ART regimen for adults and adolescents Observation":
  "Current ART regimen first-, second-, or third-line Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Second-line ART regimen for adults and adolescents"
/* End of Second-line ART regimen for adults and adolescents */

/*
@dataElement: HIV.D.DE88 - Second-line ART regimen for children
@activity: HIV.D8 Capture or update client history
@description: Second-line ART regimen for children living with HIV
*/
// TODO: Replace placeholder with relevant CQL logic
define "Second-line ART regimen for children":
  exists "Second-line ART regimen for children Condition"
    or exists "Second-line ART regimen for children Observation"
define "Second-line ART regimen for children Condition":
  [Condition: Concepts."Second-line ART regimen for children"]
define "Second-line ART regimen for children Observation":
  "Current ART regimen first-, second-, or third-line Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Second-line ART regimen for children"
/* End of Second-line ART regimen for children */

/*
@dataElement: HIV.D.DE89 - Third-line ART regimen
@activity: HIV.D8 Capture or update client history
@description: Third-line ART regimen for people living with HIV (Not defined by WHO. National programmes should develop policies for third-line ART)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Third-line ART regimen":
  exists "Third-line ART regimen Condition"
    or exists "Third-line ART regimen Observation"
define "Third-line ART regimen Condition":
  [Condition: Concepts."Third-line ART regimen"]
define "Third-line ART regimen Observation":
  "Current ART regimen first-, second-, or third-line Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Third-line ART regimen"
/* End of Third-line ART regimen */

/*
@dataElement: HIV.D.DE128 - ART regimen composition
@activity: HIV.D8 Capture or update client history
@description: Drug composition of client's current ART regimen
*/
// TODO: Replace placeholder with relevant CQL logic
define "ART regimen composition":
  exists "ART regimen composition Observation"
define "ART regimen composition Observation":
  [Observation: Concepts."ART regimen composition"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of ART regimen composition */

/*
@dataElement: HIV.D.DE129 - ABC
@activity: HIV.D8 Capture or update client history
@description: Treated with abacavir (ABC)
*/
// TODO: Replace placeholder with relevant CQL logic
define "ABC":
  exists "ABC Condition"
    or exists "ABC Observation"
define "ABC Condition":
  [Condition: Concepts."ABC"]
define "ABC Observation":
  "ART regimen composition Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."ABC"
/* End of ABC */

/*
@dataElement: HIV.D.DE130 - FTC
@activity: HIV.D8 Capture or update client history
@description: Treated with emtricitabine (FTC)
*/
// TODO: Replace placeholder with relevant CQL logic
define "FTC":
  exists "FTC Condition"
    or exists "FTC Observation"
define "FTC Condition":
  [Condition: Concepts."FTC"]
define "FTC Observation":
  "ART regimen composition Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."FTC"
/* End of FTC */

/*
@dataElement: HIV.D.DE131 - 3TC
@activity: HIV.D8 Capture or update client history
@description: Treated with lamivudine (3TC)
*/
// TODO: Replace placeholder with relevant CQL logic
define "3TC":
  exists "3TC Condition"
    or exists "3TC Observation"
define "3TC Condition":
  [Condition: Concepts."3TC"]
define "3TC Observation":
  "ART regimen composition Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."3TC"
/* End of 3TC */

/*
@dataElement: HIV.D.DE132 - AZT
@activity: HIV.D8 Capture or update client history
@description: Treated with zidovudine (AZT)
*/
// TODO: Replace placeholder with relevant CQL logic
define "AZT":
  exists "AZT Condition"
    or exists "AZT Observation"
define "AZT Condition":
  [Condition: Concepts."AZT"]
define "AZT Observation":
  "ART regimen composition Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."AZT"
/* End of AZT */

/*
@dataElement: HIV.D.DE133 - DDI
@activity: HIV.D8 Capture or update client history
@description: Treated with didanosine (DDI)
*/
// TODO: Replace placeholder with relevant CQL logic
define "DDI":
  exists "DDI Condition"
    or exists "DDI Observation"
define "DDI Condition":
  [Condition: Concepts."DDI"]
define "DDI Observation":
  "ART regimen composition Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."DDI"
/* End of DDI */

/*
@dataElement: HIV.D.DE134 - D4T
@activity: HIV.D8 Capture or update client history
@description: Treated with stavudine (D4T)
*/
// TODO: Replace placeholder with relevant CQL logic
define "D4T":
  exists "D4T Condition"
    or exists "D4T Observation"
define "D4T Condition":
  [Condition: Concepts."D4T"]
define "D4T Observation":
  "ART regimen composition Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."D4T"
/* End of D4T */

/*
@dataElement: HIV.D.DE135 - TDF
@activity: HIV.D8 Capture or update client history
@description: Treated with tenofovir (TDF)
*/
// TODO: Replace placeholder with relevant CQL logic
define "TDF D.DE135":
  exists "TDF D.DE135 Condition"
    or exists "TDF D.DE135 Observation"
define "TDF D.DE135 Condition":
  [Condition: Concepts."TDF - HIV.D.DE135"]
define "TDF D.DE135 Observation":
  "ART regimen composition Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."TDF - HIV.D.DE135"
/* End of TDF D.DE135 */

/*
@dataElement: HIV.D.DE136 - EFV
@activity: HIV.D8 Capture or update client history
@description: Treated with efavirenz (EFV)
*/
// TODO: Replace placeholder with relevant CQL logic
define "EFV":
  exists "EFV Condition"
    or exists "EFV Observation"
define "EFV Condition":
  [Condition: Concepts."EFV"]
define "EFV Observation":
  "ART regimen composition Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."EFV"
/* End of EFV */

/*
@dataElement: HIV.D.DE137 - ETV
@activity: HIV.D8 Capture or update client history
@description: Treated with etravirine (ETV)
*/
// TODO: Replace placeholder with relevant CQL logic
define "ETV":
  exists "ETV Condition"
    or exists "ETV Observation"
define "ETV Condition":
  [Condition: Concepts."ETV"]
define "ETV Observation":
  "ART regimen composition Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."ETV"
/* End of ETV */

/*
@dataElement: HIV.D.DE138 - NVP
@activity: HIV.D8 Capture or update client history
@description: Treated with nevirapine (NVP)
*/
// TODO: Replace placeholder with relevant CQL logic
define "NVP":
  exists "NVP Condition"
    or exists "NVP Observation"
define "NVP Condition":
  [Condition: Concepts."NVP"]
define "NVP Observation":
  "ART regimen composition Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."NVP"
/* End of NVP */

/*
@dataElement: HIV.D.DE139 - RIL
@activity: HIV.D8 Capture or update client history
@description: Treated with rilpivirine (RIL)
*/
// TODO: Replace placeholder with relevant CQL logic
define "RIL":
  exists "RIL Condition"
    or exists "RIL Observation"
define "RIL Condition":
  [Condition: Concepts."RIL"]
define "RIL Observation":
  "ART regimen composition Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."RIL"
/* End of RIL */

/*
@dataElement: HIV.D.DE140 - ATV/r
@activity: HIV.D8 Capture or update client history
@description: Treated with atazanavir/ritonavir (ATV/r)
*/
// TODO: Replace placeholder with relevant CQL logic
define "ATV/r D.DE140":
  exists "ATV/r D.DE140 Condition"
    or exists "ATV/r D.DE140 Observation"
define "ATV/r D.DE140 Condition":
  [Condition: Concepts."ATV/r - HIV.D.DE140"]
define "ATV/r D.DE140 Observation":
  "ART regimen composition Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."ATV/r - HIV.D.DE140"
/* End of ATV/r D.DE140 */

/*
@dataElement: HIV.D.DE141 - LPV/r
@activity: HIV.D8 Capture or update client history
@description: Treated with lopinavir/ritonavir (LPV/r)
*/
// TODO: Replace placeholder with relevant CQL logic
define "LPV/r D.DE141":
  exists "LPV/r D.DE141 Condition"
    or exists "LPV/r D.DE141 Observation"
define "LPV/r D.DE141 Condition":
  [Condition: Concepts."LPV/r - HIV.D.DE141"]
define "LPV/r D.DE141 Observation":
  "ART regimen composition Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."LPV/r - HIV.D.DE141"
/* End of LPV/r D.DE141 */

/*
@dataElement: HIV.D.DE142 - DRV/r
@activity: HIV.D8 Capture or update client history
@description: Treated with darunavir/ritonavir (DRV/r)
*/
// TODO: Replace placeholder with relevant CQL logic
define "DRV/r D.DE142":
  exists "DRV/r D.DE142 Condition"
    or exists "DRV/r D.DE142 Observation"
define "DRV/r D.DE142 Condition":
  [Condition: Concepts."DRV/r - HIV.D.DE142"]
define "DRV/r D.DE142 Observation":
  "ART regimen composition Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."DRV/r - HIV.D.DE142"
/* End of DRV/r D.DE142 */

/*
@dataElement: HIV.D.DE143 - RTV
@activity: HIV.D8 Capture or update client history
@description: Treated with ritonavir (RTV)
*/
// TODO: Replace placeholder with relevant CQL logic
define "RTV":
  exists "RTV Condition"
    or exists "RTV Observation"
define "RTV Condition":
  [Condition: Concepts."RTV"]
define "RTV Observation":
  "ART regimen composition Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."RTV"
/* End of RTV */

/*
@dataElement: HIV.D.DE144 - DTG
@activity: HIV.D8 Capture or update client history
@description: Treated with dolutegravir (DTG)
*/
// TODO: Replace placeholder with relevant CQL logic
define "DTG D.DE144":
  exists "DTG D.DE144 Condition"
    or exists "DTG D.DE144 Observation"
define "DTG D.DE144 Condition":
  [Condition: Concepts."DTG - HIV.D.DE144"]
define "DTG D.DE144 Observation":
  "ART regimen composition Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."DTG - HIV.D.DE144"
/* End of DTG D.DE144 */

/*
@dataElement: HIV.D.DE145 - RAL
@activity: HIV.D8 Capture or update client history
@description: Treated with raltegravir (RAL)
*/
// TODO: Replace placeholder with relevant CQL logic
define "RAL D.DE145":
  exists "RAL D.DE145 Condition"
    or exists "RAL D.DE145 Observation"
define "RAL D.DE145 Condition":
  [Condition: Concepts."RAL - HIV.D.DE145"]
define "RAL D.DE145 Observation":
  "ART regimen composition Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."RAL - HIV.D.DE145"
/* End of RAL D.DE145 */

/*
@dataElement: HIV.D.DE152 - Prevention services offered and referrals
@activity: HIV.D12 Determine recommended screenings and tests
@description: Offer or refer for prevention services
*/
// TODO: Replace placeholder with relevant CQL logic
define "Prevention services offered and referrals D.DE152":
  exists "Prevention services offered and referrals D.DE152 Observation"
define "Prevention services offered and referrals D.DE152 Observation":
  [Observation: Concepts."Prevention services offered and referrals - HIV.D.DE152"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Prevention services offered and referrals D.DE152 */

/*
@dataElement: HIV.D.DE153 - Offer male and female condoms and condom-compatible lubricants
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Offer male and female condoms and condom-compatible lubricants
*/
// TODO: Replace placeholder with relevant CQL logic
define "Offer male and female condoms and condom-compatible lubricants D.DE153":
  exists "Offer male and female condoms and condom-compatible lubricants D.DE153 Condition"
    or exists "Offer male and female condoms and condom-compatible lubricants D.DE153 Observation"
define "Offer male and female condoms and condom-compatible lubricants D.DE153 Condition":
  [Condition: Concepts."Offer male and female condoms and condom-compatible lubricants - HIV.D.DE153"]
define "Offer male and female condoms and condom-compatible lubricants D.DE153 Observation":
  "Prevention services offered and referrals D.DE152 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Offer male and female condoms and condom-compatible lubricants - HIV.D.DE153"
/* End of Offer male and female condoms and condom-compatible lubricants D.DE153 */

/*
@dataElement: HIV.D.DE154 - Harm reduction for people who inject drugs
@activity: HIV.D12 Determine recommended screenings and tests
@description: Offer or refer people who inject drugs to harm reduction services (needle and syringe programmes, opioid substitution therapy, other drug-dependence treatment and opioid overdose prevention and management)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Harm reduction for people who inject drugs D.DE154":
  exists "Harm reduction for people who inject drugs D.DE154 Condition"
    or exists "Harm reduction for people who inject drugs D.DE154 Observation"
define "Harm reduction for people who inject drugs D.DE154 Condition":
  [Condition: Concepts."Harm reduction for people who inject drugs - HIV.D.DE154"]
define "Harm reduction for people who inject drugs D.DE154 Observation":
  "Prevention services offered and referrals D.DE152 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Harm reduction for people who inject drugs - HIV.D.DE154"
/* End of Harm reduction for people who inject drugs D.DE154 */

/*
@dataElement: HIV.D.DE155 - Behavioural interventions to support risk reduction
@activity: HIV.D12 Determine recommended screenings and tests
@description: Offer or refer to services for behavioural interventions to support risk reduction, particularly for people with HIV and members of key populations
*/
// TODO: Replace placeholder with relevant CQL logic
define "Behavioural interventions to support risk reduction D.DE155":
  exists "Behavioural interventions to support risk reduction D.DE155 Condition"
    or exists "Behavioural interventions to support risk reduction D.DE155 Observation"
define "Behavioural interventions to support risk reduction D.DE155 Condition":
  [Condition: Concepts."Behavioural interventions to support risk reduction - HIV.D.DE155"]
define "Behavioural interventions to support risk reduction D.DE155 Observation":
  "Prevention services offered and referrals D.DE152 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Behavioural interventions to support risk reduction - HIV.D.DE155"
/* End of Behavioural interventions to support risk reduction D.DE155 */

/*
@dataElement: HIV.D.DE156 - Sexual and reproductive health integrated services
@activity: HIV.D12 Determine recommended screenings and tests
@description: Offer or refer to sexual and reproductive health services
*/
// TODO: Replace placeholder with relevant CQL logic
define "Sexual and reproductive health integrated services D.DE156":
  exists "Sexual and reproductive health integrated services D.DE156 Observation"
define "Sexual and reproductive health integrated services D.DE156 Observation":
  [Observation: Concepts."Sexual and reproductive health integrated services - HIV.D.DE156"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Sexual and reproductive health integrated services D.DE156 */

/*
@dataElement: HIV.D.DE157 - Contraception and family planning
@activity: HIV.D12 Determine recommended screenings and tests
@description: Offer contraception and family planning services
*/
// TODO: Replace placeholder with relevant CQL logic
define "Contraception and family planning D.DE157":
  exists "Contraception and family planning D.DE157 Condition"
    or exists "Contraception and family planning D.DE157 Observation"
define "Contraception and family planning D.DE157 Condition":
  [Condition: Concepts."Contraception and family planning - HIV.D.DE157"]
define "Contraception and family planning D.DE157 Observation":
  "Sexual and reproductive health integrated services D.DE156 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Contraception and family planning - HIV.D.DE157"
/* End of Contraception and family planning D.DE157 */

/*
@dataElement: HIV.D.DE158 - Check pregnancy status
@activity: HIV.D12 Determine recommended screenings and tests
@description: Check woman's pregnancy status
*/
// TODO: Replace placeholder with relevant CQL logic
define "Check pregnancy status D.DE158":
  exists "Check pregnancy status D.DE158 Condition"
    or exists "Check pregnancy status D.DE158 Observation"
define "Check pregnancy status D.DE158 Condition":
  [Condition: Concepts."Check pregnancy status - HIV.D.DE158"]
define "Check pregnancy status D.DE158 Observation":
  "Sexual and reproductive health integrated services D.DE156 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Check pregnancy status - HIV.D.DE158"
/* End of Check pregnancy status D.DE158 */

/*
@dataElement: HIV.D.DE159 - Prevention of mother-to-child transmission
@activity: HIV.D12 Determine recommended screenings and tests
@description: Offer prevention of mother-to-child transmission services (counselling)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Prevention of mother-to-child transmission":
  exists "Prevention of mother-to-child transmission Condition"
    or exists "Prevention of mother-to-child transmission Observation"
define "Prevention of mother-to-child transmission Condition":
  [Condition: Concepts."Prevention of mother-to-child transmission"]
define "Prevention of mother-to-child transmission Observation":
  "Sexual and reproductive health integrated services D.DE156 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Prevention of mother-to-child transmission"
/* End of Prevention of mother-to-child transmission */

/*
@dataElement: HIV.D.DE160 - STI testing and treatment
@activity: HIV.D12 Determine recommended screenings and tests
@description: Offer STI testing and treatment services
*/
// TODO: Replace placeholder with relevant CQL logic
define "STI testing and treatment D.DE160":
  exists "STI testing and treatment D.DE160 Condition"
    or exists "STI testing and treatment D.DE160 Observation"
define "STI testing and treatment D.DE160 Condition":
  [Condition: Concepts."STI testing and treatment - HIV.D.DE160"]
define "STI testing and treatment D.DE160 Observation":
  "Sexual and reproductive health integrated services D.DE156 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."STI testing and treatment - HIV.D.DE160"
/* End of STI testing and treatment D.DE160 */

/*
@dataElement: HIV.D.DE161 - HBsAg test date
@activity: HIV.D12 Determine recommended screenings and tests
@description: Date client was tested for hepatitis B virus (HBV)
*/

define "HBsAg test date D.DE161":
  [Procedure] P
  where P.status = 'completed'
  and P.code ~ ConceptsCustom."HBsAg test"

/* End of HBsAg test date D.DE161 */


/*
@dataElement: HIV.D.DE162 - HBsAg test result
@activity: HIV.D12 Determine recommended screenings and tests
@description: Hepatitis B virus test result (HBsAg)
*/

define "HBsAg test result D.DE162":
  [Observation: Concepts."HBsAg test result - HIV.D.DE162"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of HBsAg test result D.DE162 */

/*
@dataElement: HIV.D.DE163 - Positive
@activity: HIV.D12 Determine recommended screenings and tests
@description: HBsAg test result was positive
*/

define "Positive D.DE163":
  "HBsAg test result D.DE162" O
  where O.value ~ Concepts."Positive - HIV.D.DE163"

/* End of Positive D.DE163 */

/*
@dataElement: HIV.D.DE164 - Negative
@activity: HIV.D12 Determine recommended screenings and tests
@description: HBsAg test result was negative
*/

define "Negative D.DE164":
  "HBsAg test result D.DE162" O
  where O.value ~ Concepts."Negative - HIV.D.DE164"

/* End of Negative D.DE164 */

/*
@dataElement: HIV.D.DE165 - Indeterminate
@activity: HIV.D12 Determine recommended screenings and tests
@description: HBsAg test result was indeterminate
*/

define "Indeterminate D.DE165":
    "HBsAg test result D.DE162" O
  where O.value ~ Concepts."Indeterminate - HIV.D.DE165"
/* End of Indeterminate D.DE165 */

/*
@dataElement: HIV.D.DE167 - HBV treatment TDF start date
@activity: HIV.D12 Determine recommended screenings and tests
@description: Date when client started treatment (TDF) for hepatitis B virus (HBV)
*/

define "HBV treatment TDF start date":
  "Currently on TDF-based ART" MS
  sort by start of effective.toInterval()

/* End of HBV treatment TDF start date */

/*
@dataElement: HIV.D.DE169 - HCV test date
@activity: HIV.D12 Determine recommended screenings and tests
@description: Date client was tested for hepatitis C virus (HCV antibody, HCV RNA or HCV core antigen)
*/

define "HCV test date D.DE169":
  "HCV test result D.DE170" O
  return O.effective.toInterval().low
/* End of HCV test date D.DE169 */


/*
@dataElement: HIV.D.DE170 - HCV test result
@activity: HIV.D12 Determine recommended screenings and tests
@description: Hepatitis C virus test result (HCV antibody, HCV RNA or HCV core antigen)
*/

define "HCV test result D.DE170":
  [Observation: Concepts."HCV test result - HIV.D.DE170"] O
    where O.status in { 'final', 'amended', 'corrected' }

/* End of HCV test result D.DE170 */

/*
@dataElement: HIV.D.DE171 - Positive
@activity: HIV.D12 Determine recommended screenings and tests
@description: HCV test result was positive
*/

define "Positive D.DE171":
  "HCV test result D.DE170" O
  where O.value ~ Concepts."Positive - HIV.D.DE171"
/* End of Positive D.DE171 */

/*
@dataElement: HIV.D.DE172 - Negative
@activity: HIV.D12 Determine recommended screenings and tests
@description: HCV test result was negative
*/

define "Negative D.DE172":
  "HCV test result D.DE170" O
  where O.value ~ Concepts."Negative - HIV.D.DE172"
/* End of Negative D.DE172 */

/*
@dataElement: HIV.D.DE173 - Indeterminate
@activity: HIV.D12 Determine recommended screenings and tests
@description: HCV test result was indeterminate
*/

define "Indeterminate D.DE173":
  "HCV test result D.DE170" O
  where O.value ~ Concepts."Indeterminate - HIV.D.DE173"
/* End of Indeterminate D.DE173 */

/*
@dataElement: HIV.D.DE175 - HCV treatment start date
@activity: HIV.D12 Determine recommended screenings and tests
@description: Date when client started treatment for hepatitis C virus (HCV)
*/

define "HCV treatment start date":
  "HCV medicine type" MS
  sort by start of effective.toInterval()
/* End of HCV treatment start date */

/*
@dataElement: HIV.D.DE176 - HCV treatment completion date
@activity: HIV.D12 Determine recommended screenings and tests
@description: Date when client completed treatment for hepatitis C virus (HCV)
*/

define "HCV treatment completion date":
  "HCV medicine type" MS
  sort by end of effective.toInterval()
/* End of HCV treatment completion date */

/*
@dataElement: HIV.D.DE178 - HCV viral load test date
@activity: HIV.D12 Determine recommended screenings and tests
@description: Hepatitis C viral load test date
*/

define "HCV viral load test date D.DE178":
  [Procedure] P
  where P.status = 'completed'
  and P.code ~ ConceptsCustom."HCV viral load"

/* End of HCV viral load test date D.DE178 */

/*
@dataElement: HIV.D.DE179 - HCV viral load test result
@activity: HIV.D12 Determine recommended screenings and tests
@description: Hepatitis C viral load test result (qualitative)
*/

define "HCV viral load test result D.DE179":
  [Observation: Concepts."HCV test result - HIV.D.DE170"] O
    where O.status in { 'final', 'amended', 'corrected' }

/* End of HCV viral load test result D.DE179 */

/*
@dataElement: HIV.D.DE180 - Detected
@activity: HIV.D12 Determine recommended screenings and tests
@description: HCV was detected
*/

define "Detected D.DE180":
  "HCV viral load test result D.DE179" O where O.value ~ Concepts."Detected - HIV.D.DE180"
/* End of Detected D.DE180 */

/*
@dataElement: HIV.D.DE181 - Not detected
@activity: HIV.D12 Determine recommended screenings and tests
@description: HCV was not detected
*/

define "Not detected D.DE181":
  "HCV viral load test result D.DE179" O where O.value ~ Concepts."Not detected - HIV.D.DE181"
/* End of Not detected D.DE181 */

/*
@dataElement: HIV.D.DE182 - HCV medicine type
@activity: HIV.D12 Determine recommended screenings and tests
@description: Type of medicine client is prescribed
*/

define "HCV medicine type":
[MedicationStatement] MS
    where exists(MS.reasonCode C where C ~ Concepts."Positive - HIV.D.DE171")
/* End of HCV medicine type */

/*
@dataElement: HIV.D.DE183 - Interferon
@activity: HIV.D12 Determine recommended screenings and tests
@description: Client is prescribed interferon
*/

define "Interferon":
  "HCV medicine type" MS where (MS.medication ~ Concepts."Interferon")
/* End of Interferon */

/*
@dataElement: HIV.D.DE184 - Direct acting antivirals
@activity: HIV.D12 Determine recommended screenings and tests
@description: Client is prescribed direct acting antivirals
*/
 
define "Direct acting antivirals":
  "HCV medicine type" MS where (MS.medication ~ Concepts."Direct acting antivirals")
/* End of Direct acting antivirals */

/*
@dataElement: HIV.D.DE185 - Currently on TDF-based ART
@activity: HIV.D12 Determine recommended screenings and tests
@description: Client is currently on TDF-based ART regimen
*/

define "Currently on TDF-based ART":
  "TDF D.DE912" MS where exists(MS.reasonCode C where C ~ Concepts."Currently on TDF-based ART")
  
/* End of Currently on TDF-based ART */

/*
@dataElement: HIV.D.DE186 - HIV clinical stage
@activity: HIV.D8 Capture or update client history
@description: WHO clinical stage of client based on signs and symptoms. WHO clinical staging is a way to categorize HIV disease severity based on new or recurrent clinical events. There are 4 WHO clinical stages that range from mild symptoms (WHO clinical stage 1) to severe symptoms (WHO clinical stage 4).
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV clinical stage D.DE186":
  exists "HIV clinical stage D.DE186 Observation"
define "HIV clinical stage D.DE186 Observation":
  [Observation: Concepts."HIV clinical stage - HIV.D.DE186"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of HIV clinical stage D.DE186 */

/*
@dataElement: HIV.D.DE187 - WHO HIV clinical stage 1
@activity: HIV.D8 Capture or update client history
@description: Client is currently assessed to be at a clinical stage 1, based on clinical assessment and diagnostics
*/
// TODO: Replace placeholder with relevant CQL logic
define "WHO HIV clinical stage 1":
  exists "WHO HIV clinical stage 1 Condition"
    or exists "WHO HIV clinical stage 1 Observation"
define "WHO HIV clinical stage 1 Condition":
  [Condition: Concepts."WHO HIV clinical stage 1"]
define "WHO HIV clinical stage 1 Observation":
  "HIV clinical stage D.DE186 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."WHO HIV clinical stage 1"
/* End of WHO HIV clinical stage 1 */

/*
@dataElement: HIV.D.DE188 - WHO HIV clinical stage 2
@activity: HIV.D8 Capture or update client history
@description: Client is currently assessed to be at a clinical stage 2, based on clinical assessment and diagnostics
*/
// TODO: Replace placeholder with relevant CQL logic
define "WHO HIV clinical stage 2":
  exists "WHO HIV clinical stage 2 Condition"
    or exists "WHO HIV clinical stage 2 Observation"
define "WHO HIV clinical stage 2 Condition":
  [Condition: Concepts."WHO HIV clinical stage 2"]
define "WHO HIV clinical stage 2 Observation":
  "HIV clinical stage D.DE186 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."WHO HIV clinical stage 2"
/* End of WHO HIV clinical stage 2 */

/*
@dataElement: HIV.D.DE189 - WHO HIV clinical stage 3
@activity: HIV.D8 Capture or update client history
@description: Client is currently assessed to be at a clinical stage 3, based on clinical assessment and diagnostics
*/
// TODO: Replace placeholder with relevant CQL logic
define "WHO HIV clinical stage 3":
  exists "WHO HIV clinical stage 3 Condition"
    or exists "WHO HIV clinical stage 3 Observation"
define "WHO HIV clinical stage 3 Condition":
  [Condition: Concepts."WHO HIV clinical stage 3"]
define "WHO HIV clinical stage 3 Observation":
  "HIV clinical stage D.DE186 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."WHO HIV clinical stage 3"
/* End of WHO HIV clinical stage 3 */

/*
@dataElement: HIV.D.DE190 - WHO HIV clinical stage 4
@activity: HIV.D8 Capture or update client history
@description: Client is currently assessed to be at a clinical stage 4, based on clinical assessment and diagnostics
*/
// TODO: Replace placeholder with relevant CQL logic
define "WHO HIV clinical stage 4":
  exists "WHO HIV clinical stage 4 Condition"
    or exists "WHO HIV clinical stage 4 Observation"
define "WHO HIV clinical stage 4 Condition":
  [Condition: Concepts."WHO HIV clinical stage 4"]
define "WHO HIV clinical stage 4 Observation":
  "HIV clinical stage D.DE186 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."WHO HIV clinical stage 4"
/* End of WHO HIV clinical stage 4 */

/*
@dataElement: HIV.D.DE193 - Date viral load test results received by client
@activity: HIV.D10 Counsel returning client
@description: The date on which the client received results from viral load test
*/

define "Date viral load test results received by client D.DE193":
  [Observation: Concepts."Viral load test result - HIV.D.DE387"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Date viral load test results received by client D.DE193 */

/*
@dataElement: HIV.D.DE194 - Date of viral load sample collection
@activity: HIV.D10 Counsel returning client
@description: Date and time when the sample was collected to test the client's HIV viral load
*/

define "Date of viral load sample collection D.DE194":
  [Procedure] P
  where P.status = 'completed'
  and P.code ~ ConceptsCustom."viral load test"
/* End of Date of viral load sample collection D.DE194 */

/*
@dataElement: HIV.D.DE195 - Date of scheduled review of viral load test results
@activity: HIV.D10 Counsel returning client
@description: Expected date when client's viral load test results will be returned and reviewed
*/
// TODO: Replace placeholder with relevant CQL logic
define "Date of scheduled review of viral load test results":
  [Observation: Concepts."Date of scheduled review of viral load test results"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Date of scheduled review of viral load test results Value":
  "Date of scheduled review of viral load test results" O
  return O.value as dateTime
/* End of Date of scheduled review of viral load test results */

/*
@dataElement: HIV.D.DE217 - Reason ART stopped
@activity: HIV.D10 Counsel returning client
@description: Reason client intentionally stopped ART
*/
// TODO: Replace placeholder with relevant CQL logic
define "Reason ART stopped D.DE217":
  exists "Reason ART stopped D.DE217 Observation"
define "Reason ART stopped D.DE217 Observation":
  [Observation: Concepts."Reason ART stopped - HIV.D.DE217"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Reason ART stopped D.DE217 */

/*
@dataElement: HIV.D.DE218 - Toxicity/side effects
@activity: HIV.D10 Counsel returning client
@description: Client stopped ART because of toxicity/side effects
*/
// TODO: Replace placeholder with relevant CQL logic
define "Toxicity/side effects D.DE218":
  exists "Toxicity/side effects D.DE218 Condition"
    or exists "Toxicity/side effects D.DE218 Observation"
define "Toxicity/side effects D.DE218 Condition":
  [Condition: Concepts."Toxicity/side effects - HIV.D.DE218"]
define "Toxicity/side effects D.DE218 Observation":
  "Reason ART stopped D.DE217 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Toxicity/side effects - HIV.D.DE218"
/* End of Toxicity/side effects D.DE218 */

/*
@dataElement: HIV.D.DE219 - Severe illness, hospitalization
@activity: HIV.D10 Counsel returning client
@description: Client stopped ART because of severe illness, hospitalization
*/

define "Severe illness, hospitalization D.DE219":
  exists "Severe illness, hospitalization D.DE219 Condition"
    or exists "Severe illness, hospitalization D.DE219 Observation"
define "Severe illness, hospitalization D.DE219 Condition":
  [Condition: Concepts."Severe illness, hospitalization - HIV.D.DE219"]
define "Severe illness, hospitalization D.DE219 Observation":
  "Reason ART stopped D.DE217 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Severe illness, hospitalization - HIV.D.DE219"
/* End of Severe illness, hospitalization D.DE219 */

/*
@dataElement: HIV.D.DE220 - Drugs out of stock
@activity: HIV.D10 Counsel returning client
@description: Client stopped ART because drugs were out of stock
*/
// TODO: Replace placeholder with relevant CQL logic
define "Drugs out of stock":
  exists "Drugs out of stock Condition"
    or exists "Drugs out of stock Observation"
define "Drugs out of stock Condition":
  [Condition: Concepts."Drugs out of stock"]
define "Drugs out of stock Observation":
  "Reason ART stopped D.DE217 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Drugs out of stock"
/* End of Drugs out of stock */

/*
@dataElement: HIV.D.DE221 - Client lacks finances
@activity: HIV.D10 Counsel returning client
@description: Client stopped ART because of lack of finances
*/
// TODO: Replace placeholder with relevant CQL logic
define "Client lacks finances":
  exists "Client lacks finances Condition"
    or exists "Client lacks finances Observation"
define "Client lacks finances Condition":
  [Condition: Concepts."Client lacks finances"]
define "Client lacks finances Observation":
  "Reason ART stopped D.DE217 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Client lacks finances"
/* End of Client lacks finances */

/*
@dataElement: HIV.D.DE222 - Excluded HIV infection in infant
@activity: HIV.D10 Counsel returning client
@description: Client stopped ART because HIV infection in infant was excluded
*/
// TODO: Replace placeholder with relevant CQL logic
define "Excluded HIV infection in infant D.DE222":
  exists "Excluded HIV infection in infant D.DE222 Condition"
    or exists "Excluded HIV infection in infant D.DE222 Observation"
define "Excluded HIV infection in infant D.DE222 Condition":
  [Condition: Concepts."Excluded HIV infection in infant - HIV.D.DE222"]
define "Excluded HIV infection in infant D.DE222 Observation":
  "Reason ART stopped D.DE217 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Excluded HIV infection in infant - HIV.D.DE222"
/* End of Excluded HIV infection in infant D.DE222 */

/*
@dataElement: HIV.D.DE223 - Other reason for stopping ART
@activity: HIV.D10 Counsel returning client
@description: Client stopped ART because of other reason
*/
// TODO: Replace placeholder with relevant CQL logic
define "Other reason for stopping ART D.DE223":
  exists "Other reason for stopping ART D.DE223 Condition"
    or exists "Other reason for stopping ART D.DE223 Observation"
define "Other reason for stopping ART D.DE223 Condition":
  [Condition: Concepts."Other reason for stopping ART - HIV.D.DE223"]
define "Other reason for stopping ART D.DE223 Observation":
  "Reason ART stopped D.DE217 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Other reason for stopping ART - HIV.D.DE223"
/* End of Other reason for stopping ART D.DE223 */

/*
@dataElement: HIV.D.DE225 - Treatment failure
@activity: HIV.D17 Check for signs of treatment failure
@description: ART treatment failure
*/
// TODO: Replace placeholder with relevant CQL logic
define "Treatment failure":
  exists "Treatment failure Observation"
define "Treatment failure Observation":
  [Observation: Concepts."Treatment failure"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Treatment failure */

/*
@dataElement: HIV.D.DE226 - Clinical failure
@activity: HIV.D17 Check for signs of treatment failure
@description: New or recurrent clinical event indicating severe immunodeficiency in adults or advanced or severe immunodeficiency in children
*/
// TODO: Replace placeholder with relevant CQL logic
define "Clinical failure":
  exists "Clinical failure Condition"
    or exists "Clinical failure Observation"
define "Clinical failure Condition":
  [Condition: Concepts."Clinical failure"]
define "Clinical failure Observation":
  "Treatment failure Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Clinical failure"
/* End of Clinical failure */

/*
@dataElement: HIV.D.DE227 - Immunological failure
@activity: HIV.D17 Check for signs of treatment failure
@description: CD4 count at or below 250 cells/mm3 following clinical failure
*/
// TODO: Replace placeholder with relevant CQL logic
define "Immunological failure":
  exists "Immunological failure Condition"
    or exists "Immunological failure Observation"
define "Immunological failure Condition":
  [Condition: Concepts."Immunological failure"]
define "Immunological failure Observation":
  "Treatment failure Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Immunological failure"
/* End of Immunological failure */

/*
@dataElement: HIV.D.DE228 - Virological failure
@activity: HIV.D17 Check for signs of treatment failure
@description: The inability to achieve or maintain viral suppression below a certain threshold indicated by viral load above 1000 copies/mL based on two consecutive viral load measurements in 3 months, with adherence support following the first viral load test
*/
// TODO: Replace placeholder with relevant CQL logic
define "Virological failure":
  exists "Virological failure Condition"
    or exists "Virological failure Observation"
define "Virological failure Condition":
  [Condition: Concepts."Virological failure"]
define "Virological failure Observation":
  "Treatment failure Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Virological failure"
/* End of Virological failure */

/*
@dataElement: HIV.D.DE259 - Risk factors, comorbidities and coinfections signs and symptoms
@activity: HIV.D14 Prevent, screen, and manage comorbidities and coinfections
@description: Signs and symptoms of opportunistic infections or other comorbidities experienced by client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Risk factors, comorbidities and coinfections signs and symptoms":
  exists "Risk factors, comorbidities and coinfections signs and symptoms Observation"
define "Risk factors, comorbidities and coinfections signs and symptoms Observation":
  [Observation: Concepts."Risk factors, comorbidities and coinfections signs and symptoms"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Risk factors, comorbidities and coinfections signs and symptoms */

/*
@dataElement: HIV.D.DE282 - Presumptive TB
@activity: HIV.D14 Prevent, screen, and manage comorbidities and coinfections
@description: Client's comorbidities or coinfections or symptoms of these include presumptive TB
*/
// TODO: Replace placeholder with relevant CQL logic
define "Presumptive TB D.DE282":
  exists "Presumptive TB D.DE282 Condition"
    or exists "Presumptive TB D.DE282 Observation"
define "Presumptive TB D.DE282 Condition":
  [Condition: Concepts."Presumptive TB - HIV.D.DE282"]
define "Presumptive TB D.DE282 Observation":
  "Risk factors, comorbidities and coinfections signs and symptoms Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Presumptive TB - HIV.D.DE282"
/* End of Presumptive TB D.DE282 */

/*
@dataElement: HIV.D.DE289 - WHO HIV clinical stage condition or symptom
@activity: HIV.D15 Determine clinical stage of HIV
@description: New or recurrent clinical events used to categorize HIV disease severity based at baseline and follow up
*/
// TODO: Replace placeholder with relevant CQL logic
define "WHO HIV clinical stage condition or symptom D.DE289":
  exists "WHO HIV clinical stage condition or symptom D.DE289 Observation"
define "WHO HIV clinical stage condition or symptom D.DE289 Observation":
  [Observation: Concepts."WHO HIV clinical stage condition or symptom - HIV.D.DE289"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of WHO HIV clinical stage condition or symptom D.DE289 */

/*
@dataElement: HIV.D.DE290 - Asymptomatic
@activity: HIV.D15 Determine clinical stage of HIV
@description: No HIV-related symptoms reported and no clinical signs on examination
*/
// TODO: Replace placeholder with relevant CQL logic
define "Asymptomatic":
  exists "Asymptomatic Condition"
    or exists "Asymptomatic Observation"
define "Asymptomatic Condition":
  [Condition: Concepts."Asymptomatic"]
define "Asymptomatic Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Asymptomatic"
/* End of Asymptomatic */

/*
@dataElement: HIV.D.DE291 - Persistent generalized lymphadenopathy
@activity: HIV.D15 Determine clinical stage of HIV
@description: Persistent enlarged lymph nodes >1 cm at two or more non-contiguous sites (excluding inguinal) without known cause
*/
// TODO: Replace placeholder with relevant CQL logic
define "Persistent generalized lymphadenopathy":
  exists "Persistent generalized lymphadenopathy Condition"
    or exists "Persistent generalized lymphadenopathy Observation"
define "Persistent generalized lymphadenopathy Condition":
  [Condition: Concepts."Persistent generalized lymphadenopathy"]
define "Persistent generalized lymphadenopathy Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Persistent generalized lymphadenopathy"
/* End of Persistent generalized lymphadenopathy */

/*
@dataElement: HIV.D.DE292 - Moderate unexplained weight loss
@activity: HIV.D15 Determine clinical stage of HIV
@description: Moderate unexplained weight loss (<10% of presumed or measured body weight)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Moderate unexplained weight loss":
  exists "Moderate unexplained weight loss Condition"
    or exists "Moderate unexplained weight loss Observation"
define "Moderate unexplained weight loss Condition":
  [Condition: Concepts."Moderate unexplained weight loss"]
define "Moderate unexplained weight loss Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Moderate unexplained weight loss"
/* End of Moderate unexplained weight loss */

/*
@dataElement: HIV.D.DE293 - Recurrent respiratory tract infections
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include recurrent respiratory tract infections including sinusitis, tonsillitis, otitis media or pharyngitis
*/
// TODO: Replace placeholder with relevant CQL logic
define "Recurrent respiratory tract infections":
  exists "Recurrent respiratory tract infections Condition"
    or exists "Recurrent respiratory tract infections Observation"
define "Recurrent respiratory tract infections Condition":
  [Condition: Concepts."Recurrent respiratory tract infections"]
define "Recurrent respiratory tract infections Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Recurrent respiratory tract infections"
/* End of Recurrent respiratory tract infections */

/*
@dataElement: HIV.D.DE294 - Unexplained persistent hepatosplenomegaly
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include unexplained persistent hepatosplenomegaly
*/
// TODO: Replace placeholder with relevant CQL logic
define "Unexplained persistent hepatosplenomegaly":
  exists "Unexplained persistent hepatosplenomegaly Condition"
    or exists "Unexplained persistent hepatosplenomegaly Observation"
define "Unexplained persistent hepatosplenomegaly Condition":
  [Condition: Concepts."Unexplained persistent hepatosplenomegaly"]
define "Unexplained persistent hepatosplenomegaly Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Unexplained persistent hepatosplenomegaly"
/* End of Unexplained persistent hepatosplenomegaly */

/*
@dataElement: HIV.D.DE295 - Herpes zoster
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include herpes zoster
*/
// TODO: Replace placeholder with relevant CQL logic
define "Herpes zoster":
  exists "Herpes zoster Condition"
    or exists "Herpes zoster Observation"
define "Herpes zoster Condition":
  [Condition: Concepts."Herpes zoster"]
define "Herpes zoster Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Herpes zoster"
/* End of Herpes zoster */

/*
@dataElement: HIV.D.DE296 - Angular cheilitis
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include angular cheilitis
*/
// TODO: Replace placeholder with relevant CQL logic
define "Angular cheilitis":
  exists "Angular cheilitis Condition"
    or exists "Angular cheilitis Observation"
define "Angular cheilitis Condition":
  [Condition: Concepts."Angular cheilitis"]
define "Angular cheilitis Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Angular cheilitis"
/* End of Angular cheilitis */

/*
@dataElement: HIV.D.DE297 - Linear gingival erythema
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include linear gingival erythema
*/
// TODO: Replace placeholder with relevant CQL logic
define "Linear gingival erythema":
  exists "Linear gingival erythema Condition"
    or exists "Linear gingival erythema Observation"
define "Linear gingival erythema Condition":
  [Condition: Concepts."Linear gingival erythema"]
define "Linear gingival erythema Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Linear gingival erythema"
/* End of Linear gingival erythema */

/*
@dataElement: HIV.D.DE298 - Recurrent oral ulceration
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include recurrent oral ulceration
*/
// TODO: Replace placeholder with relevant CQL logic
define "Recurrent oral ulceration":
  exists "Recurrent oral ulceration Condition"
    or exists "Recurrent oral ulceration Observation"
define "Recurrent oral ulceration Condition":
  [Condition: Concepts."Recurrent oral ulceration"]
define "Recurrent oral ulceration Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Recurrent oral ulceration"
/* End of Recurrent oral ulceration */

/*
@dataElement: HIV.D.DE299 - Papular pruritic eruption
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include papular pruritic eruption
*/
// TODO: Replace placeholder with relevant CQL logic
define "Papular pruritic eruption":
  exists "Papular pruritic eruption Condition"
    or exists "Papular pruritic eruption Observation"
define "Papular pruritic eruption Condition":
  [Condition: Concepts."Papular pruritic eruption"]
define "Papular pruritic eruption Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Papular pruritic eruption"
/* End of Papular pruritic eruption */

/*
@dataElement: HIV.D.DE300 - Fungal nail infections
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include fungal nail infections
*/
// TODO: Replace placeholder with relevant CQL logic
define "Fungal nail infections":
  exists "Fungal nail infections Condition"
    or exists "Fungal nail infections Observation"
define "Fungal nail infections Condition":
  [Condition: Concepts."Fungal nail infections"]
define "Fungal nail infections Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Fungal nail infections"
/* End of Fungal nail infections */

/*
@dataElement: HIV.D.DE301 - Seborrhoeic dermatitis
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include seborrhoeic dermatitis
*/
// TODO: Replace placeholder with relevant CQL logic
define "Seborrhoeic dermatitis":
  exists "Seborrhoeic dermatitis Condition"
    or exists "Seborrhoeic dermatitis Observation"
define "Seborrhoeic dermatitis Condition":
  [Condition: Concepts."Seborrhoeic dermatitis"]
define "Seborrhoeic dermatitis Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Seborrhoeic dermatitis"
/* End of Seborrhoeic dermatitis */

/*
@dataElement: HIV.D.DE302 - Extensive wart virus infection
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include extensive wart virus infection
*/
// TODO: Replace placeholder with relevant CQL logic
define "Extensive wart virus infection":
  exists "Extensive wart virus infection Condition"
    or exists "Extensive wart virus infection Observation"
define "Extensive wart virus infection Condition":
  [Condition: Concepts."Extensive wart virus infection"]
define "Extensive wart virus infection Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Extensive wart virus infection"
/* End of Extensive wart virus infection */

/*
@dataElement: HIV.D.DE303 - Extensive molluscum contagiosum
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include extensive molluscum contagiosum
*/
// TODO: Replace placeholder with relevant CQL logic
define "Extensive molluscum contagiosum":
  exists "Extensive molluscum contagiosum Condition"
    or exists "Extensive molluscum contagiosum Observation"
define "Extensive molluscum contagiosum Condition":
  [Condition: Concepts."Extensive molluscum contagiosum"]
define "Extensive molluscum contagiosum Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Extensive molluscum contagiosum"
/* End of Extensive molluscum contagiosum */

/*
@dataElement: HIV.D.DE304 - Unexplained persistent parotid enlargement
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include unexplained persistent parotid enlargement
*/
// TODO: Replace placeholder with relevant CQL logic
define "Unexplained persistent parotid enlargement":
  exists "Unexplained persistent parotid enlargement Condition"
    or exists "Unexplained persistent parotid enlargement Observation"
define "Unexplained persistent parotid enlargement Condition":
  [Condition: Concepts."Unexplained persistent parotid enlargement"]
define "Unexplained persistent parotid enlargement Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Unexplained persistent parotid enlargement"
/* End of Unexplained persistent parotid enlargement */

/*
@dataElement: HIV.D.DE305 - Unexplained severe weight loss in adults
@activity: HIV.D15 Determine clinical stage of HIV
@description: Unexplained severe weight loss (>10% of presumed or measured body weight)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Unexplained severe weight loss in adults":
  exists "Unexplained severe weight loss in adults Condition"
    or exists "Unexplained severe weight loss in adults Observation"
define "Unexplained severe weight loss in adults Condition":
  [Condition: Concepts."Unexplained severe weight loss in adults"]
define "Unexplained severe weight loss in adults Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Unexplained severe weight loss in adults"
/* End of Unexplained severe weight loss in adults */

/*
@dataElement: HIV.D.DE306 - Unexplained moderate malnutrition not adequately responding to standard therapy
@activity: HIV.D15 Determine clinical stage of HIV
@description: Defined as weight-for-height < - 2 z-score or mid-upper arm circumference 115 mm to <125 mm. For children younger than five years of age: stunting is defined as severe acute malnutrition - either weight for height < -3 z-score or mid-upper arm circumference <115 mm or the presence of oedema.
*/
// TODO: Replace placeholder with relevant CQL logic
define "Unexplained moderate malnutrition not adequately responding to standard therapy":
  exists "Unexplained moderate malnutrition not adequately responding to standard therapy Condition"
    or exists "Unexplained moderate malnutrition not adequately responding to standard therapy Observation"
define "Unexplained moderate malnutrition not adequately responding to standard therapy Condition":
  [Condition: Concepts."Unexplained moderate malnutrition not adequately responding to standard therapy"]
define "Unexplained moderate malnutrition not adequately responding to standard therapy Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Unexplained moderate malnutrition not adequately responding to standard therapy"
/* End of Unexplained moderate malnutrition not adequately responding to standard therapy */

/*
@dataElement: HIV.D.DE307 - Unexplained chronic diarrhoea for longer than 1 month
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include unexplained chronic diarrhoea for longer than 1 month
*/
// TODO: Replace placeholder with relevant CQL logic
define "Unexplained chronic diarrhoea for longer than 1 month":
  exists "Unexplained chronic diarrhoea for longer than 1 month Condition"
    or exists "Unexplained chronic diarrhoea for longer than 1 month Observation"
define "Unexplained chronic diarrhoea for longer than 1 month Condition":
  [Condition: Concepts."Unexplained chronic diarrhoea for longer than 1 month"]
define "Unexplained chronic diarrhoea for longer than 1 month Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Unexplained chronic diarrhoea for longer than 1 month"
/* End of Unexplained chronic diarrhoea for longer than 1 month */

/*
@dataElement: HIV.D.DE308 - Unexplained persistent diarrhoea 14 days or more
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include unexplained persistent diarrhoea (14 days or more)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Unexplained persistent diarrhoea 14 days or more":
  exists "Unexplained persistent diarrhoea 14 days or more Condition"
    or exists "Unexplained persistent diarrhoea 14 days or more Observation"
define "Unexplained persistent diarrhoea 14 days or more Condition":
  [Condition: Concepts."Unexplained persistent diarrhoea 14 days or more"]
define "Unexplained persistent diarrhoea 14 days or more Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Unexplained persistent diarrhoea 14 days or more"
/* End of Unexplained persistent diarrhoea 14 days or more */

/*
@dataElement: HIV.D.DE309 - Unexplained persistent fever above 37.5 C, intermittent or constant, for longer than one 1 month
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include unexplained persistent fever (above 37.5 C, intermittent or constant, for longer than one 1 month)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Unexplained persistent fever above 37.5 C, intermittent or constant, for longer than one 1 month":
  exists "Unexplained persistent fever above 37.5 C, intermittent or constant, for longer than one 1 month Condition"
    or exists "Unexplained persistent fever above 37.5 C, intermittent or constant, for longer than one 1 month Observation"
define "Unexplained persistent fever above 37.5 C, intermittent or constant, for longer than one 1 month Condition":
  [Condition: Concepts."Unexplained persistent fever above 37.5 C, intermittent or constant, for longer than one 1 month"]
define "Unexplained persistent fever above 37.5 C, intermittent or constant, for longer than one 1 month Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Unexplained persistent fever above 37.5 C, intermittent or constant, for longer than one 1 month"
/* End of Unexplained persistent fever above 37.5 C, intermittent or constant, for longer than one 1 month */

/*
@dataElement: HIV.D.DE310 - Persistent oral candidiasis
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include persistent oral candidiasis
*/
// TODO: Replace placeholder with relevant CQL logic
define "Persistent oral candidiasis":
  exists "Persistent oral candidiasis Condition"
    or exists "Persistent oral candidiasis Observation"
define "Persistent oral candidiasis Condition":
  [Condition: Concepts."Persistent oral candidiasis"]
define "Persistent oral candidiasis Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Persistent oral candidiasis"
/* End of Persistent oral candidiasis */

/*
@dataElement: HIV.D.DE311 - Oral hairy leukoplakia
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client has fine white small linear or corrugated lesions on lateral borders of the tongue that do not scrape off
*/
// TODO: Replace placeholder with relevant CQL logic
define "Oral hairy leukoplakia":
  exists "Oral hairy leukoplakia Condition"
    or exists "Oral hairy leukoplakia Observation"
define "Oral hairy leukoplakia Condition":
  [Condition: Concepts."Oral hairy leukoplakia"]
define "Oral hairy leukoplakia Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Oral hairy leukoplakia"
/* End of Oral hairy leukoplakia */

/*
@dataElement: HIV.D.DE312 - Pulmonary TB
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include pulmonary TB
*/
// TODO: Replace placeholder with relevant CQL logic
define "Pulmonary TB D.DE312":
  exists "Pulmonary TB D.DE312 Condition"
    or exists "Pulmonary TB D.DE312 Observation"
define "Pulmonary TB D.DE312 Condition":
  [Condition: Concepts."Pulmonary TB - HIV.D.DE312"]
define "Pulmonary TB D.DE312 Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Pulmonary TB - HIV.D.DE312"
/* End of Pulmonary TB D.DE312 */

/*
@dataElement: HIV.D.DE313 - Lymph node TB
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include lymph node TB
*/
// TODO: Replace placeholder with relevant CQL logic
define "Lymph node TB D.DE313":
  exists "Lymph node TB D.DE313 Condition"
    or exists "Lymph node TB D.DE313 Observation"
define "Lymph node TB D.DE313 Condition":
  [Condition: Concepts."Lymph node TB - HIV.D.DE313"]
define "Lymph node TB D.DE313 Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Lymph node TB - HIV.D.DE313"
/* End of Lymph node TB D.DE313 */

/*
@dataElement: HIV.D.DE314 - Severe bacterial infections such as pneumonia, empyema, pyomyositis, bone or joint infection, meningitis, bacteraemia
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include severe bacterial infections (such as pneumonia, empyema, pyomyositis, bone or joint infection, meningitis, bacteraemia)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Severe bacterial infections such as pneumonia, empyema, pyomyositis, bone or joint infection, meningitis, bacteraemia":
  exists "Severe bacterial infections such as pneumonia, empyema, pyomyositis, bone or joint infection, meningitis, bacteraemia Condition"
    or exists "Severe bacterial infections such as pneumonia, empyema, pyomyositis, bone or joint infection, meningitis, bacteraemia Observation"
define "Severe bacterial infections such as pneumonia, empyema, pyomyositis, bone or joint infection, meningitis, bacteraemia Condition":
  [Condition: Concepts."Severe bacterial infections such as pneumonia, empyema, pyomyositis, bone or joint infection, meningitis, bacteraemia"]
define "Severe bacterial infections such as pneumonia, empyema, pyomyositis, bone or joint infection, meningitis, bacteraemia Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Severe bacterial infections such as pneumonia, empyema, pyomyositis, bone or joint infection, meningitis, bacteraemia"
/* End of Severe bacterial infections such as pneumonia, empyema, pyomyositis, bone or joint infection, meningitis, bacteraemia */

/*
@dataElement: HIV.D.DE315 - Severe recurrent bacterial pneumonia
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include severe recurrent bacterial pneumonia
*/
// TODO: Replace placeholder with relevant CQL logic
define "Severe recurrent bacterial pneumonia":
  exists "Severe recurrent bacterial pneumonia Condition"
    or exists "Severe recurrent bacterial pneumonia Observation"
define "Severe recurrent bacterial pneumonia Condition":
  [Condition: Concepts."Severe recurrent bacterial pneumonia"]
define "Severe recurrent bacterial pneumonia Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Severe recurrent bacterial pneumonia"
/* End of Severe recurrent bacterial pneumonia */

/*
@dataElement: HIV.D.DE316 - Acute necrotizing ulcerative stomatitis
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include acute necrotizing ulcerative stomatitis
*/
// TODO: Replace placeholder with relevant CQL logic
define "Acute necrotizing ulcerative stomatitis":
  exists "Acute necrotizing ulcerative stomatitis Condition"
    or exists "Acute necrotizing ulcerative stomatitis Observation"
define "Acute necrotizing ulcerative stomatitis Condition":
  [Condition: Concepts."Acute necrotizing ulcerative stomatitis"]
define "Acute necrotizing ulcerative stomatitis Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Acute necrotizing ulcerative stomatitis"
/* End of Acute necrotizing ulcerative stomatitis */

/*
@dataElement: HIV.D.DE317 - Acute necrotizing ulcerative gingivitis
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include acute necrotizing ulcerative gingivitis
*/
// TODO: Replace placeholder with relevant CQL logic
define "Acute necrotizing ulcerative gingivitis":
  exists "Acute necrotizing ulcerative gingivitis Condition"
    or exists "Acute necrotizing ulcerative gingivitis Observation"
define "Acute necrotizing ulcerative gingivitis Condition":
  [Condition: Concepts."Acute necrotizing ulcerative gingivitis"]
define "Acute necrotizing ulcerative gingivitis Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Acute necrotizing ulcerative gingivitis"
/* End of Acute necrotizing ulcerative gingivitis */

/*
@dataElement: HIV.D.DE318 - Acute necrotizing ulcerative periodontitis
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include acute necrotizing ulcerative periodontitis
*/
// TODO: Replace placeholder with relevant CQL logic
define "Acute necrotizing ulcerative periodontitis":
  exists "Acute necrotizing ulcerative periodontitis Condition"
    or exists "Acute necrotizing ulcerative periodontitis Observation"
define "Acute necrotizing ulcerative periodontitis Condition":
  [Condition: Concepts."Acute necrotizing ulcerative periodontitis"]
define "Acute necrotizing ulcerative periodontitis Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Acute necrotizing ulcerative periodontitis"
/* End of Acute necrotizing ulcerative periodontitis */

/*
@dataElement: HIV.D.DE319 - Unexplained anaemia <8 g/dL
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include unexplained anaemia (<8 g/dL)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Unexplained anaemia <8 g/dL":
  exists "Unexplained anaemia <8 g/dL Condition"
    or exists "Unexplained anaemia <8 g/dL Observation"
define "Unexplained anaemia <8 g/dL Condition":
  [Condition: Concepts."Unexplained anaemia <8 g/dL"]
define "Unexplained anaemia <8 g/dL Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Unexplained anaemia <8 g/dL"
/* End of Unexplained anaemia <8 g/dL */

/*
@dataElement: HIV.D.DE320 - Neutropaenia <0.5 x 10^9/L
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include neutropaenia (<0.5 x 10^9/L)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Neutropaenia <0.5 x 10^9/L":
  exists "Neutropaenia <0.5 x 10^9/L Condition"
    or exists "Neutropaenia <0.5 x 10^9/L Observation"
define "Neutropaenia <0.5 x 10^9/L Condition":
  [Condition: Concepts."Neutropaenia <0.5 x 10^9/L"]
define "Neutropaenia <0.5 x 10^9/L Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Neutropaenia <0.5 x 10^9/L"
/* End of Neutropaenia <0.5 x 10^9/L */

/*
@dataElement: HIV.D.DE321 - Chronic thrombocytopaenia <50 x 10^9/L
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include chronic thrombocytopaenia (<50 x 10^9/L)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Chronic thrombocytopaenia <50 x 10^9/L":
  exists "Chronic thrombocytopaenia <50 x 10^9/L Condition"
    or exists "Chronic thrombocytopaenia <50 x 10^9/L Observation"
define "Chronic thrombocytopaenia <50 x 10^9/L Condition":
  [Condition: Concepts."Chronic thrombocytopaenia <50 x 10^9/L"]
define "Chronic thrombocytopaenia <50 x 10^9/L Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Chronic thrombocytopaenia <50 x 10^9/L"
/* End of Chronic thrombocytopaenia <50 x 10^9/L */

/*
@dataElement: HIV.D.DE322 - Symptomatic lymphoid interstitial pneumonitis
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include symptomatic lymphoid interstitial pneumonitis
*/
// TODO: Replace placeholder with relevant CQL logic
define "Symptomatic lymphoid interstitial pneumonitis":
  exists "Symptomatic lymphoid interstitial pneumonitis Condition"
    or exists "Symptomatic lymphoid interstitial pneumonitis Observation"
define "Symptomatic lymphoid interstitial pneumonitis Condition":
  [Condition: Concepts."Symptomatic lymphoid interstitial pneumonitis"]
define "Symptomatic lymphoid interstitial pneumonitis Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Symptomatic lymphoid interstitial pneumonitis"
/* End of Symptomatic lymphoid interstitial pneumonitis */

/*
@dataElement: HIV.D.DE323 - Chronic HIV-associated lung disease, including bronchiectasis
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include chronic HIV-associated lung disease, including bronchiectasis
*/
// TODO: Replace placeholder with relevant CQL logic
define "Chronic HIV-associated lung disease, including bronchiectasis":
  exists "Chronic HIV-associated lung disease, including bronchiectasis Condition"
    or exists "Chronic HIV-associated lung disease, including bronchiectasis Observation"
define "Chronic HIV-associated lung disease, including bronchiectasis Condition":
  [Condition: Concepts."Chronic HIV-associated lung disease, including bronchiectasis"]
define "Chronic HIV-associated lung disease, including bronchiectasis Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Chronic HIV-associated lung disease, including bronchiectasis"
/* End of Chronic HIV-associated lung disease, including bronchiectasis */

/*
@dataElement: HIV.D.DE324 - HIV wasting syndrome
@activity: HIV.D15 Determine clinical stage of HIV
@description: Unexplained involuntary weight loss (>10% baseline body weight), with obvious wasting or body mass index <18.5; PLUS EITHER unexplained chronic reported for longer than one month; OR reports of fever or night sweats for more than one month without other cause and lack of response to antibiotics or antimalarial agents; malaria must be excluded in malarious areas.
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV wasting syndrome":
  exists "HIV wasting syndrome Condition"
    or exists "HIV wasting syndrome Observation"
define "HIV wasting syndrome Condition":
  [Condition: Concepts."HIV wasting syndrome"]
define "HIV wasting syndrome Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."HIV wasting syndrome"
/* End of HIV wasting syndrome */

/*
@dataElement: HIV.D.DE325 - Unexplained severe wasting not responding to standard therapy
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client has unexplained severe wasting not responding to standard therapy . For under 5 years old, defined as weight-for-height < -3 z-score
*/
// TODO: Replace placeholder with relevant CQL logic
define "Unexplained severe wasting not responding to standard therapy":
  exists "Unexplained severe wasting not responding to standard therapy Condition"
    or exists "Unexplained severe wasting not responding to standard therapy Observation"
define "Unexplained severe wasting not responding to standard therapy Condition":
  [Condition: Concepts."Unexplained severe wasting not responding to standard therapy"]
define "Unexplained severe wasting not responding to standard therapy Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Unexplained severe wasting not responding to standard therapy"
/* End of Unexplained severe wasting not responding to standard therapy */

/*
@dataElement: HIV.D.DE326 - Unexplained stunting not responding to standard therapy
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client has unexplained stunting not responding to standard therapy . For under 5 years old, defined as length-for- age/height-for-age < -2 z-score
*/
// TODO: Replace placeholder with relevant CQL logic
define "Unexplained stunting not responding to standard therapy":
  exists "Unexplained stunting not responding to standard therapy Condition"
    or exists "Unexplained stunting not responding to standard therapy Observation"
define "Unexplained stunting not responding to standard therapy Condition":
  [Condition: Concepts."Unexplained stunting not responding to standard therapy"]
define "Unexplained stunting not responding to standard therapy Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Unexplained stunting not responding to standard therapy"
/* End of Unexplained stunting not responding to standard therapy */

/*
@dataElement: HIV.D.DE327 - Unexplained severe malnutrition not responding to standard therapy
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client has unexplained severe malnutrition not responding to standard therapy . For under 5 years old, weight for height < -3 z-score or mid-upper arm circumference <115 mm or the presence of oedema
*/
// TODO: Replace placeholder with relevant CQL logic
define "Unexplained severe malnutrition not responding to standard therapy":
  exists "Unexplained severe malnutrition not responding to standard therapy Condition"
    or exists "Unexplained severe malnutrition not responding to standard therapy Observation"
define "Unexplained severe malnutrition not responding to standard therapy Condition":
  [Condition: Concepts."Unexplained severe malnutrition not responding to standard therapy"]
define "Unexplained severe malnutrition not responding to standard therapy Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Unexplained severe malnutrition not responding to standard therapy"
/* End of Unexplained severe malnutrition not responding to standard therapy */

/*
@dataElement: HIV.D.DE328 - Pneumocystis jirovecii pneumonia
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include pneumocystis (jirovecii) pneumonia
*/
// TODO: Replace placeholder with relevant CQL logic
define "Pneumocystis jirovecii pneumonia":
  exists "Pneumocystis jirovecii pneumonia Condition"
    or exists "Pneumocystis jirovecii pneumonia Observation"
define "Pneumocystis jirovecii pneumonia Condition":
  [Condition: Concepts."Pneumocystis jirovecii pneumonia"]
define "Pneumocystis jirovecii pneumonia Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Pneumocystis jirovecii pneumonia"
/* End of Pneumocystis jirovecii pneumonia */

/*
@dataElement: HIV.D.DE329 - Recurrent severe bacterial pneumonia
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include recurrent severe bacterial pneumonia
*/
// TODO: Replace placeholder with relevant CQL logic
define "Recurrent severe bacterial pneumonia":
  exists "Recurrent severe bacterial pneumonia Condition"
    or exists "Recurrent severe bacterial pneumonia Observation"
define "Recurrent severe bacterial pneumonia Condition":
  [Condition: Concepts."Recurrent severe bacterial pneumonia"]
define "Recurrent severe bacterial pneumonia Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Recurrent severe bacterial pneumonia"
/* End of Recurrent severe bacterial pneumonia */

/*
@dataElement: HIV.D.DE330 - Recurrent severe bacterial infections such as empyema, pyomyositis, bone or joint infection, meningitis, but excluding pneumonia
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include recurrent severe bacterial infections (such as empyema, pyomyositis, bone or joint infection, meningitis, but excluding pneumonia)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Recurrent severe bacterial infections such as empyema, pyomyositis, bone or joint infection, meningitis, but excluding pneumonia":
  exists "Recurrent severe bacterial infections such as empyema, pyomyositis, bone or joint infection, meningitis, but excluding pneumonia Condition"
    or exists "Recurrent severe bacterial infections such as empyema, pyomyositis, bone or joint infection, meningitis, but excluding pneumonia Observation"
define "Recurrent severe bacterial infections such as empyema, pyomyositis, bone or joint infection, meningitis, but excluding pneumonia Condition":
  [Condition: Concepts."Recurrent severe bacterial infections such as empyema, pyomyositis, bone or joint infection, meningitis, but excluding pneumonia"]
define "Recurrent severe bacterial infections such as empyema, pyomyositis, bone or joint infection, meningitis, but excluding pneumonia Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Recurrent severe bacterial infections such as empyema, pyomyositis, bone or joint infection, meningitis, but excluding pneumonia"
/* End of Recurrent severe bacterial infections such as empyema, pyomyositis, bone or joint infection, meningitis, but excluding pneumonia */

/*
@dataElement: HIV.D.DE331 - Empyema
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include recurrent empyema
*/
// TODO: Replace placeholder with relevant CQL logic
define "Empyema":
  exists "Empyema Condition"
    or exists "Empyema Observation"
define "Empyema Condition":
  [Condition: Concepts."Empyema"]
define "Empyema Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Empyema"
/* End of Empyema */

/*
@dataElement: HIV.D.DE332 - Pyomyositis
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include recurrent pyomyositis
*/
// TODO: Replace placeholder with relevant CQL logic
define "Pyomyositis":
  exists "Pyomyositis Condition"
    or exists "Pyomyositis Observation"
define "Pyomyositis Condition":
  [Condition: Concepts."Pyomyositis"]
define "Pyomyositis Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Pyomyositis"
/* End of Pyomyositis */

/*
@dataElement: HIV.D.DE333 - Bone or joint infection
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include recurrent bone or joint infections
*/
// TODO: Replace placeholder with relevant CQL logic
define "Bone or joint infection":
  exists "Bone or joint infection Condition"
    or exists "Bone or joint infection Observation"
define "Bone or joint infection Condition":
  [Condition: Concepts."Bone or joint infection"]
define "Bone or joint infection Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Bone or joint infection"
/* End of Bone or joint infection */

/*
@dataElement: HIV.D.DE334 - Meningitis
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include recurrent meningitis
*/
// TODO: Replace placeholder with relevant CQL logic
define "Meningitis":
  exists "Meningitis Condition"
    or exists "Meningitis Observation"
define "Meningitis Condition":
  [Condition: Concepts."Meningitis"]
define "Meningitis Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Meningitis"
/* End of Meningitis */

/*
@dataElement: HIV.D.DE335 - Chronic herpes simplex infection orolabial or cutaneous of more than 1 month duration or visceral at any site
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include chronic herpes simplex infection (orolabial or cutaneous of more than 1 month duration or visceral at any site)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Chronic herpes simplex infection orolabial or cutaneous of more than 1 month duration or visceral at any site":
  exists "Chronic herpes simplex infection orolabial or cutaneous of more than 1 month duration or visceral at any site Condition"
    or exists "Chronic herpes simplex infection orolabial or cutaneous of more than 1 month duration or visceral at any site Observation"
define "Chronic herpes simplex infection orolabial or cutaneous of more than 1 month duration or visceral at any site Condition":
  [Condition: Concepts."Chronic herpes simplex infection orolabial or cutaneous of more than 1 month duration or visceral at any site"]
define "Chronic herpes simplex infection orolabial or cutaneous of more than 1 month duration or visceral at any site Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Chronic herpes simplex infection orolabial or cutaneous of more than 1 month duration or visceral at any site"
/* End of Chronic herpes simplex infection orolabial or cutaneous of more than 1 month duration or visceral at any site */

/*
@dataElement: HIV.D.DE336 - Chronic herpes simplex infection orolabial, genital or anorectal of more than 1 month in duration or visceral at any site
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include chronic herpes simplex infection (orolabial, genital or anorectal of more than one month in duration or visceral at any site)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Chronic herpes simplex infection orolabial, genital or anorectal of more than 1 month in duration or visceral at any site":
  exists "Chronic herpes simplex infection orolabial, genital or anorectal of more than 1 month in duration or visceral at any site Condition"
    or exists "Chronic herpes simplex infection orolabial, genital or anorectal of more than 1 month in duration or visceral at any site Observation"
define "Chronic herpes simplex infection orolabial, genital or anorectal of more than 1 month in duration or visceral at any site Condition":
  [Condition: Concepts."Chronic herpes simplex infection orolabial, genital or anorectal of more than 1 month in duration or visceral at any site"]
define "Chronic herpes simplex infection orolabial, genital or anorectal of more than 1 month in duration or visceral at any site Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Chronic herpes simplex infection orolabial, genital or anorectal of more than 1 month in duration or visceral at any site"
/* End of Chronic herpes simplex infection orolabial, genital or anorectal of more than 1 month in duration or visceral at any site */

/*
@dataElement: HIV.D.DE337 - Oesophageal candidiasis or candidiasis of trachea, bronchi or lungs
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include oesophageal candidiasis (or candidiasis of trachea, bronchi or lungs)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Oesophageal candidiasis or candidiasis of trachea, bronchi or lungs":
  exists "Oesophageal candidiasis or candidiasis of trachea, bronchi or lungs Condition"
    or exists "Oesophageal candidiasis or candidiasis of trachea, bronchi or lungs Observation"
define "Oesophageal candidiasis or candidiasis of trachea, bronchi or lungs Condition":
  [Condition: Concepts."Oesophageal candidiasis or candidiasis of trachea, bronchi or lungs"]
define "Oesophageal candidiasis or candidiasis of trachea, bronchi or lungs Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Oesophageal candidiasis or candidiasis of trachea, bronchi or lungs"
/* End of Oesophageal candidiasis or candidiasis of trachea, bronchi or lungs */

/*
@dataElement: HIV.D.DE338 - Extrapulmonary TB
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include extrapulmonary tuberculosis
*/
// TODO: Replace placeholder with relevant CQL logic
define "Extrapulmonary TB D.DE338":
  exists "Extrapulmonary TB D.DE338 Condition"
    or exists "Extrapulmonary TB D.DE338 Observation"
define "Extrapulmonary TB D.DE338 Condition":
  [Condition: Concepts."Extrapulmonary TB - HIV.D.DE338"]
define "Extrapulmonary TB D.DE338 Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Extrapulmonary TB - HIV.D.DE338"
/* End of Extrapulmonary TB D.DE338 */

/*
@dataElement: HIV.D.DE339 - Kaposi sarcoma
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include Kaposi sarcoma
*/
// TODO: Replace placeholder with relevant CQL logic
define "Kaposi sarcoma":
  exists "Kaposi sarcoma Condition"
    or exists "Kaposi sarcoma Observation"
define "Kaposi sarcoma Condition":
  [Condition: Concepts."Kaposi sarcoma"]
define "Kaposi sarcoma Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Kaposi sarcoma"
/* End of Kaposi sarcoma */

/*
@dataElement: HIV.D.DE340 - Cytomegalovirus infection retinitis or infection of other organs
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include cytomegalovirus infection (retinitis or infection of other organs)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Cytomegalovirus infection retinitis or infection of other organs":
  exists "Cytomegalovirus infection retinitis or infection of other organs Condition"
    or exists "Cytomegalovirus infection retinitis or infection of other organs Observation"
define "Cytomegalovirus infection retinitis or infection of other organs Condition":
  [Condition: Concepts."Cytomegalovirus infection retinitis or infection of other organs"]
define "Cytomegalovirus infection retinitis or infection of other organs Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Cytomegalovirus infection retinitis or infection of other organs"
/* End of Cytomegalovirus infection retinitis or infection of other organs */

/*
@dataElement: HIV.D.DE341 - Central nervous system toxoplasmosis
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include central nervous system toxoplasmosis
*/
// TODO: Replace placeholder with relevant CQL logic
define "Central nervous system toxoplasmosis":
  exists "Central nervous system toxoplasmosis Condition"
    or exists "Central nervous system toxoplasmosis Observation"
define "Central nervous system toxoplasmosis Condition":
  [Condition: Concepts."Central nervous system toxoplasmosis"]
define "Central nervous system toxoplasmosis Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Central nervous system toxoplasmosis"
/* End of Central nervous system toxoplasmosis */

/*
@dataElement: HIV.D.DE342 - HIV encephalopathy
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include HIV encephalopathy
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV encephalopathy":
  exists "HIV encephalopathy Condition"
    or exists "HIV encephalopathy Observation"
define "HIV encephalopathy Condition":
  [Condition: Concepts."HIV encephalopathy"]
define "HIV encephalopathy Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."HIV encephalopathy"
/* End of HIV encephalopathy */

/*
@dataElement: HIV.D.DE343 - Extrapulmonary cryptococcosis, including meningitis
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include extrapulmonary cryptococcosis, including meningitis
*/
// TODO: Replace placeholder with relevant CQL logic
define "Extrapulmonary cryptococcosis, including meningitis":
  exists "Extrapulmonary cryptococcosis, including meningitis Condition"
    or exists "Extrapulmonary cryptococcosis, including meningitis Observation"
define "Extrapulmonary cryptococcosis, including meningitis Condition":
  [Condition: Concepts."Extrapulmonary cryptococcosis, including meningitis"]
define "Extrapulmonary cryptococcosis, including meningitis Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Extrapulmonary cryptococcosis, including meningitis"
/* End of Extrapulmonary cryptococcosis, including meningitis */

/*
@dataElement: HIV.D.DE344 - Disseminated nontuberculous mycobacterial infection
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include disseminated nontuberculous mycobacterial infection
*/
// TODO: Replace placeholder with relevant CQL logic
define "Disseminated nontuberculous mycobacterial infection":
  exists "Disseminated nontuberculous mycobacterial infection Condition"
    or exists "Disseminated nontuberculous mycobacterial infection Observation"
define "Disseminated nontuberculous mycobacterial infection Condition":
  [Condition: Concepts."Disseminated nontuberculous mycobacterial infection"]
define "Disseminated nontuberculous mycobacterial infection Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Disseminated nontuberculous mycobacterial infection"
/* End of Disseminated nontuberculous mycobacterial infection */

/*
@dataElement: HIV.D.DE345 - Progressive multifocal leukoencephalopathy
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include progressive multifocal leukoencephalopathy
*/
// TODO: Replace placeholder with relevant CQL logic
define "Progressive multifocal leukoencephalopathy":
  exists "Progressive multifocal leukoencephalopathy Condition"
    or exists "Progressive multifocal leukoencephalopathy Observation"
define "Progressive multifocal leukoencephalopathy Condition":
  [Condition: Concepts."Progressive multifocal leukoencephalopathy"]
define "Progressive multifocal leukoencephalopathy Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Progressive multifocal leukoencephalopathy"
/* End of Progressive multifocal leukoencephalopathy */

/*
@dataElement: HIV.D.DE346 - Chronic cryptosporidiosis
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include chronic cryptosporidiosis
*/
// TODO: Replace placeholder with relevant CQL logic
define "Chronic cryptosporidiosis":
  exists "Chronic cryptosporidiosis Condition"
    or exists "Chronic cryptosporidiosis Observation"
define "Chronic cryptosporidiosis Condition":
  [Condition: Concepts."Chronic cryptosporidiosis"]
define "Chronic cryptosporidiosis Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Chronic cryptosporidiosis"
/* End of Chronic cryptosporidiosis */

/*
@dataElement: HIV.D.DE347 - Chronic cryptosporidiosis with diarrhoea
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include chronic cryptosporidiosis (with diarrhoea)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Chronic cryptosporidiosis with diarrhoea":
  exists "Chronic cryptosporidiosis with diarrhoea Condition"
    or exists "Chronic cryptosporidiosis with diarrhoea Observation"
define "Chronic cryptosporidiosis with diarrhoea Condition":
  [Condition: Concepts."Chronic cryptosporidiosis with diarrhoea"]
define "Chronic cryptosporidiosis with diarrhoea Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Chronic cryptosporidiosis with diarrhoea"
/* End of Chronic cryptosporidiosis with diarrhoea */

/*
@dataElement: HIV.D.DE348 - Chronic isosporiasis
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include chronic isosporiasis
*/
// TODO: Replace placeholder with relevant CQL logic
define "Chronic isosporiasis":
  exists "Chronic isosporiasis Condition"
    or exists "Chronic isosporiasis Observation"
define "Chronic isosporiasis Condition":
  [Condition: Concepts."Chronic isosporiasis"]
define "Chronic isosporiasis Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Chronic isosporiasis"
/* End of Chronic isosporiasis */

/*
@dataElement: HIV.D.DE349 - Disseminated mycosis extrapulmonary histoplasmosis, coccidioidomycosis
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include disseminated mycosis (extrapulmonary histoplasmosis, coccidioidomycosis)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Disseminated mycosis extrapulmonary histoplasmosis, coccidioidomycosis":
  exists "Disseminated mycosis extrapulmonary histoplasmosis, coccidioidomycosis Condition"
    or exists "Disseminated mycosis extrapulmonary histoplasmosis, coccidioidomycosis Observation"
define "Disseminated mycosis extrapulmonary histoplasmosis, coccidioidomycosis Condition":
  [Condition: Concepts."Disseminated mycosis extrapulmonary histoplasmosis, coccidioidomycosis"]
define "Disseminated mycosis extrapulmonary histoplasmosis, coccidioidomycosis Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Disseminated mycosis extrapulmonary histoplasmosis, coccidioidomycosis"
/* End of Disseminated mycosis extrapulmonary histoplasmosis, coccidioidomycosis */

/*
@dataElement: HIV.D.DE350 - Disseminated endemic mycosis extrapulmonary histoplasmosis, coccidioidomycosis, penicilliosis
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include disseminated endemic mycosis (extrapulmonary histoplasmosis, coccidioidomycosis, penicilliosis)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Disseminated endemic mycosis extrapulmonary histoplasmosis, coccidioidomycosis, penicilliosis":
  exists "Disseminated endemic mycosis extrapulmonary histoplasmosis, coccidioidomycosis, penicilliosis Condition"
    or exists "Disseminated endemic mycosis extrapulmonary histoplasmosis, coccidioidomycosis, penicilliosis Observation"
define "Disseminated endemic mycosis extrapulmonary histoplasmosis, coccidioidomycosis, penicilliosis Condition":
  [Condition: Concepts."Disseminated endemic mycosis extrapulmonary histoplasmosis, coccidioidomycosis, penicilliosis"]
define "Disseminated endemic mycosis extrapulmonary histoplasmosis, coccidioidomycosis, penicilliosis Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Disseminated endemic mycosis extrapulmonary histoplasmosis, coccidioidomycosis, penicilliosis"
/* End of Disseminated endemic mycosis extrapulmonary histoplasmosis, coccidioidomycosis, penicilliosis */

/*
@dataElement: HIV.D.DE351 - Cerebral lymphoma
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include cerebral lymphoma
*/
// TODO: Replace placeholder with relevant CQL logic
define "Cerebral lymphoma":
  exists "Cerebral lymphoma Condition"
    or exists "Cerebral lymphoma Observation"
define "Cerebral lymphoma Condition":
  [Condition: Concepts."Cerebral lymphoma"]
define "Cerebral lymphoma Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Cerebral lymphoma"
/* End of Cerebral lymphoma */

/*
@dataElement: HIV.D.DE352 - B-cell non-Hodgkin lymphoma
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include b-cell non-Hodgkin lymphoma
*/
// TODO: Replace placeholder with relevant CQL logic
define "B-cell non-Hodgkin lymphoma":
  exists "B-cell non-Hodgkin lymphoma Condition"
    or exists "B-cell non-Hodgkin lymphoma Observation"
define "B-cell non-Hodgkin lymphoma Condition":
  [Condition: Concepts."B-cell non-Hodgkin lymphoma"]
define "B-cell non-Hodgkin lymphoma Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."B-cell non-Hodgkin lymphoma"
/* End of B-cell non-Hodgkin lymphoma */

/*
@dataElement: HIV.D.DE353 - HIV-associated nephropathy or cardiomyopathy
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include HIV- associated nephropathy or cardiomyopathy
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV-associated nephropathy or cardiomyopathy":
  exists "HIV-associated nephropathy or cardiomyopathy Condition"
    or exists "HIV-associated nephropathy or cardiomyopathy Observation"
define "HIV-associated nephropathy or cardiomyopathy Condition":
  [Condition: Concepts."HIV-associated nephropathy or cardiomyopathy"]
define "HIV-associated nephropathy or cardiomyopathy Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."HIV-associated nephropathy or cardiomyopathy"
/* End of HIV-associated nephropathy or cardiomyopathy */

/*
@dataElement: HIV.D.DE354 - Recurrent septicaemia including nontyphoidal Salmonella
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include recurrent bacteraemia (septicaemia) (including nontyphoidal salmonella)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Recurrent septicaemia including nontyphoidal Salmonella":
  exists "Recurrent septicaemia including nontyphoidal Salmonella Condition"
    or exists "Recurrent septicaemia including nontyphoidal Salmonella Observation"
define "Recurrent septicaemia including nontyphoidal Salmonella Condition":
  [Condition: Concepts."Recurrent septicaemia including nontyphoidal Salmonella"]
define "Recurrent septicaemia including nontyphoidal Salmonella Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Recurrent septicaemia including nontyphoidal Salmonella"
/* End of Recurrent septicaemia including nontyphoidal Salmonella */

/*
@dataElement: HIV.D.DE355 - Invasive cervical carcinoma
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include invasive cervical carcinoma
*/
// TODO: Replace placeholder with relevant CQL logic
define "Invasive cervical carcinoma":
  exists "Invasive cervical carcinoma Condition"
    or exists "Invasive cervical carcinoma Observation"
define "Invasive cervical carcinoma Condition":
  [Condition: Concepts."Invasive cervical carcinoma"]
define "Invasive cervical carcinoma Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Invasive cervical carcinoma"
/* End of Invasive cervical carcinoma */

/*
@dataElement: HIV.D.DE356 - Atypical disseminated leishmaniasis
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include atypical disseminated leishmaniasis
*/
// TODO: Replace placeholder with relevant CQL logic
define "Atypical disseminated leishmaniasis":
  exists "Atypical disseminated leishmaniasis Condition"
    or exists "Atypical disseminated leishmaniasis Observation"
define "Atypical disseminated leishmaniasis Condition":
  [Condition: Concepts."Atypical disseminated leishmaniasis"]
define "Atypical disseminated leishmaniasis Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Atypical disseminated leishmaniasis"
/* End of Atypical disseminated leishmaniasis */

/*
@dataElement: HIV.D.DE357 - Neutropenia
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include neutropenia, an abnormally low count of a type of white blood cell (neutrophils)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Neutropenia":
  exists "Neutropenia Condition"
    or exists "Neutropenia Observation"
define "Neutropenia Condition":
  [Condition: Concepts."Neutropenia"]
define "Neutropenia Observation":
  "WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Neutropenia"
/* End of Neutropenia */

/*
@dataElement: HIV.D.DE364 - CD4 count
@activity: HIV.D20 Diagnostics
@description: CD4 cell count in cells/mm^3
*/
// TODO: Replace placeholder with relevant CQL logic
define "CD4 count D.DE364":
  [Observation: Concepts."CD4 count - HIV.D.DE364"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "CD4 count D.DE364 Value":
  "CD4 count D.DE364" O
  return O.value as Quantity
/* End of CD4 count D.DE364 */

/*
@dataElement: HIV.D.DE367 - Baseline CD4 count
@activity: HIV.D20 Diagnostics
@description: CD4 count performed at HIV diagnosis
*/
// TODO: Replace placeholder with relevant CQL logic
define "Baseline CD4 count D.DE367":
  [Observation: Concepts."Baseline CD4 count - HIV.D.DE367"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Baseline CD4 count D.DE367 Value":
  "Baseline CD4 count D.DE367" O
  return O.value as Quantity
/* End of Baseline CD4 count D.DE367 */

/*
@dataElement: HIV.D.DE368 - Date of baseline CD4 count test
@activity: HIV.D20 Diagnostics
@description: Date and time when baseline CD4 count test was conducted
*/
// TODO: Replace placeholder with relevant CQL logic
define "Date of baseline CD4 count test D.DE368":
  [Observation: Concepts."Date of baseline CD4 count test - HIV.D.DE368"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Date of baseline CD4 count test D.DE368 Value":
  "Date of baseline CD4 count test D.DE368" O
  return O.value as dateTime
/* End of Date of baseline CD4 count test D.DE368 */

/*
@dataElement: HIV.D.DE383 - Time to start ART
@activity: HIV.D8 Capture or update client history
@description: Time from HIV diagnosis to when client started ART
*/
define "Time to start ART":
  case 
      when difference in days between start of "First HIV Treatment".effective.toInterval() and start of "First HIV Positive Condition".onset.toInterval() <= 7 then Concepts."Within 7 days of HIV diagnosis"
      when difference in days between start of "First HIV Treatment".effective.toInterval() and start of "First HIV Positive Condition".onset.toInterval() <= 30 then Concepts."Within 30 days of HIV diagnosis"
      when difference in days between start of "First HIV Treatment".effective.toInterval() and start of "First HIV Positive Condition".onset.toInterval() <= 90 then Concepts."Within 90 days of HIV diagnosis"
  else null
  end
/* End of Time to start ART */

/*
@dataElement: HIV.D.DE387 - Viral load test result
@activity: HIV.D20 Diagnostics
@description: Result from the viral load test in number of copies/mL
*/

define "Viral load test result D.DE387":
  [Observation: Concepts."Viral load test result - HIV.D.DE387"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Viral load test result D.DE387 Value":
  "Viral load test result D.DE387" O
  return O.value as Quantity
/* End of Viral load test result D.DE387 */

/*
@dataElement: HIV.D.DE391 - Reason for HIV viral load test
@activity: HIV.D20 Diagnostics
@description: Whether the viral load is being tested for routine monitoring on a set schedule or for targeted monitoring for suspected treatment failure
*/
// TODO: Replace placeholder with relevant CQL logic
define "Reason for HIV viral load test":
  exists "Reason for HIV viral load test Observation"
define "Reason for HIV viral load test Observation":
  [Observation: Concepts."Reason for HIV viral load test"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Reason for HIV viral load test */

/*
@dataElement: HIV.D.DE392 - Routine viral load test
@activity: HIV.D20 Diagnostics
@description: Routine refers to viral load tests obtained at standard intervals following ART initiation to monitor viral load response to ART
*/
// TODO: Replace placeholder with relevant CQL logic
define "Routine viral load test":
  exists "Routine viral load test Condition"
    or exists "Routine viral load test Observation"
define "Routine viral load test Condition":
  [Condition: Concepts."Routine viral load test"]
define "Routine viral load test Observation":
  "Reason for HIV viral load test Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Routine viral load test"

define "routine viral load sample collection":
  [Procedure] P
  where P.status = 'completed'
  and P.code ~ ConceptsCustom."viral load test"
  and exists(P.reasonCode RC where RC ~ Concepts."Routine viral load test")



/* End of Routine viral load test */

/*
@dataElement: HIV.D.DE393 - Targeted viral load monitoring
@activity: HIV.D20 Diagnostics
@description: Targeted refers to viral load tests obtained based on a specific clinical indication (such as concern about disease progression or failure to respond to ART)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Targeted viral load monitoring":
  exists "Targeted viral load monitoring Condition"
    or exists "Targeted viral load monitoring Observation"
define "Targeted viral load monitoring Condition":
  [Condition: Concepts."Targeted viral load monitoring"]
define "Targeted viral load monitoring Observation":
  "Reason for HIV viral load test Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Targeted viral load monitoring"
/* End of Targeted viral load monitoring */

/*
@dataElement: HIV.D.DE394 - Initial viral load test
@activity: HIV.D20 Diagnostics
@description: The first viral load test of the client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Initial viral load test":
  exists "Initial viral load test Condition"
    or exists "Initial viral load test Observation"
define "Initial viral load test Condition":
  [Condition: Concepts."Initial viral load test"]
define "Initial viral load test Observation":
  "Reason for HIV viral load test Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Initial viral load test"
/* End of Initial viral load test */

/*
@dataElement: HIV.D.DE395 - Follow-up viral load test after receiving enhanced adherence counselling
@activity: HIV.D20 Diagnostics
@description: A follow-up viral load test within 3-6 months after enhanced adherence counselling after client received a high viral load test result
*/
// TODO: Replace placeholder with relevant CQL logic
define "Follow-up viral load test after receiving enhanced adherence counselling":
  exists "Follow-up viral load test after receiving enhanced adherence counselling Condition"
    or exists "Follow-up viral load test after receiving enhanced adherence counselling Observation"
define "Follow-up viral load test after receiving enhanced adherence counselling Condition":
  [Condition: Concepts."Follow-up viral load test after receiving enhanced adherence counselling"]
define "Follow-up viral load test after receiving enhanced adherence counselling Observation":
  "Reason for HIV viral load test Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Follow-up viral load test after receiving enhanced adherence counselling"
/* End of Follow-up viral load test after receiving enhanced adherence counselling */

/*
@dataElement: HIV.D.DE399 - Monitoring examinations
@activity: HIV.D20 Diagnostics
@description: Name of examinations, test and results for any relevant investigations carried out for client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Monitoring examinations":
  exists "Monitoring examinations Observation"
define "Monitoring examinations Observation":
  [Observation: Concepts."Monitoring examinations"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Monitoring examinations */

/*
@dataElement: HIV.D.DE400 - Haemoglobin Hb
@activity: HIV.D20 Diagnostics
@description: Provider ordered a Haemoglobin (Hb) test, number in g/dL test
*/
// TODO: Replace placeholder with relevant CQL logic
define "Haemoglobin Hb":
  exists "Haemoglobin Hb Condition"
    or exists "Haemoglobin Hb Observation"
define "Haemoglobin Hb Condition":
  [Condition: Concepts."Haemoglobin Hb"]
define "Haemoglobin Hb Observation":
  "Monitoring examinations Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Haemoglobin Hb"
/* End of Haemoglobin Hb */

/*
@dataElement: HIV.D.DE401 - Pregnancy test
@activity: HIV.D20 Diagnostics
@description: Provider ordered a pregnancy test for client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Pregnancy test":
  exists "Pregnancy test Condition"
    or exists "Pregnancy test Observation"
define "Pregnancy test Condition":
  [Condition: Concepts."Pregnancy test"]
define "Pregnancy test Observation":
  "Monitoring examinations Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Pregnancy test"
/* End of Pregnancy test */

/*
@dataElement: HIV.D.DE402 - Syphilis test
@activity: HIV.D20 Diagnostics
@description: Provider ordered a syphilis test
*/
// TODO: Replace placeholder with relevant CQL logic
define "Syphilis test":
  exists "Syphilis test Condition"
    or exists "Syphilis test Observation"
define "Syphilis test Condition":
  [Condition: Concepts."Syphilis test"]
define "Syphilis test Observation":
  "Monitoring examinations Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Syphilis test"
/* End of Syphilis test */

/*
@dataElement: HIV.D.DE403 - Chest X-ray CXR
@activity: HIV.D20 Diagnostics
@description: Provider ordered a chest X-ray (CXR)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Chest X-ray CXR":
  exists "Chest X-ray CXR Condition"
    or exists "Chest X-ray CXR Observation"
define "Chest X-ray CXR Condition":
  [Condition: Concepts."Chest X-ray CXR"]
define "Chest X-ray CXR Observation":
  "Monitoring examinations Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Chest X-ray CXR"
/* End of Chest X-ray CXR */

/*
@dataElement: HIV.D.DE404 - Sputum or culture for TB
@activity: HIV.D20 Diagnostics
@description: Provider ordered sputum or culture for TB
*/
// TODO: Replace placeholder with relevant CQL logic
define "Sputum or culture for TB":
  exists "Sputum or culture for TB Condition"
    or exists "Sputum or culture for TB Observation"
define "Sputum or culture for TB Condition":
  [Condition: Concepts."Sputum or culture for TB"]
define "Sputum or culture for TB Observation":
  "Monitoring examinations Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Sputum or culture for TB"
/* End of Sputum or culture for TB */

/*
@dataElement: HIV.D.DE405 - HBsAg test HBV
@activity: HIV.D20 Diagnostics
@description: Provider ordered an HBsAg test (HBV) test
*/
// TODO: Replace placeholder with relevant CQL logic
define "HBsAg test HBV":
  exists "HBsAg test HBV Condition"
    or exists "HBsAg test HBV Observation"
define "HBsAg test HBV Condition":
  [Condition: Concepts."HBsAg test HBV"]
define "HBsAg test HBV Observation":
  "Monitoring examinations Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."HBsAg test HBV"
/* End of HBsAg test HBV */

/*
@dataElement: HIV.D.DE406 - HIV viral load test ordered
@activity: HIV.D20 Diagnostics
@description: Provider ordered an HIV viral load test
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV viral load test ordered":
  exists "HIV viral load test ordered Condition"
    or exists "HIV viral load test ordered Observation"
define "HIV viral load test ordered Condition":
  [Condition: Concepts."HIV viral load test ordered"]
define "HIV viral load test ordered Observation":
  "Monitoring examinations Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."HIV viral load test ordered"
/* End of HIV viral load test ordered */

/*
@dataElement: HIV.D.DE407 - HIV viral load test scheduled
@activity: HIV.D20 Diagnostics
@description: Scheduled an HIV viral load test with client
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV viral load test scheduled":
  exists "HIV viral load test scheduled Condition"
    or exists "HIV viral load test scheduled Observation"
define "HIV viral load test scheduled Condition":
  [Condition: Concepts."HIV viral load test scheduled"]
define "HIV viral load test scheduled Observation":
  "Monitoring examinations Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."HIV viral load test scheduled"
/* End of HIV viral load test scheduled */

/*
@dataElement: HIV.D.DE408 - CD4 count ordered
@activity: HIV.D20 Diagnostics
@description: Provider ordered a CD4 cell count
*/
// TODO: Replace placeholder with relevant CQL logic
define "CD4 count ordered":
  exists "CD4 count ordered Condition"
    or exists "CD4 count ordered Observation"
define "CD4 count ordered Condition":
  [Condition: Concepts."CD4 count ordered"]
define "CD4 count ordered Observation":
  "Monitoring examinations Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."CD4 count ordered"
/* End of CD4 count ordered */

/*
@dataElement: HIV.D.DE409 - CD4 count test scheduled
@activity: HIV.D20 Diagnostics
@description: Scheduled a CD4 test with client
*/
// TODO: Replace placeholder with relevant CQL logic
define "CD4 count test scheduled":
  exists "CD4 count test scheduled Condition"
    or exists "CD4 count test scheduled Observation"
define "CD4 count test scheduled Condition":
  [Condition: Concepts."CD4 count test scheduled"]
define "CD4 count test scheduled Observation":
  "Monitoring examinations Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."CD4 count test scheduled"
/* End of CD4 count test scheduled */

/*
@dataElement: HIV.D.DE410 - Cryptococcal antigen test
@activity: HIV.D20 Diagnostics
@description: Provider ordered a cryptococcal antigen test
*/
// TODO: Replace placeholder with relevant CQL logic
define "Cryptococcal antigen test":
  exists "Cryptococcal antigen test Condition"
    or exists "Cryptococcal antigen test Observation"
define "Cryptococcal antigen test Condition":
  [Condition: Concepts."Cryptococcal antigen test"]
define "Cryptococcal antigen test Observation":
  "Monitoring examinations Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Cryptococcal antigen test"
/* End of Cryptococcal antigen test */

/*
@dataElement: HIV.D.DE411 - Histoplasmosis antigen test
@activity: HIV.D20 Diagnostics
@description: Provider ordered a histoplasmosis antigen test
*/
// TODO: Replace placeholder with relevant CQL logic
define "Histoplasmosis antigen test":
  exists "Histoplasmosis antigen test Condition"
    or exists "Histoplasmosis antigen test Observation"
define "Histoplasmosis antigen test Condition":
  [Condition: Concepts."Histoplasmosis antigen test"]
define "Histoplasmosis antigen test Observation":
  "Monitoring examinations Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Histoplasmosis antigen test"
/* End of Histoplasmosis antigen test */

/*
@dataElement: HIV.D.DE412 - Cervical cancer screening scheduled
@activity: HIV.D28 Offer other services
@description: Scheduled cervical cancer screening with client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Cervical cancer screening scheduled":
  exists "Cervical cancer screening scheduled Condition"
    or exists "Cervical cancer screening scheduled Observation"
define "Cervical cancer screening scheduled Condition":
  [Condition: Concepts."Cervical cancer screening scheduled"]
define "Cervical cancer screening scheduled Observation":
  "Monitoring examinations Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Cervical cancer screening scheduled"
/* End of Cervical cancer screening scheduled */

/*
@dataElement: HIV.D.DE413 - Date of scheduled monitoring examination
@activity: HIV.D28 Offer other services
@description: Date of scheduled monitoring examination
*/
// TODO: Replace placeholder with relevant CQL logic
define "Date of scheduled monitoring examination":
  [Observation: Concepts."Date of scheduled monitoring examination"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Date of scheduled monitoring examination Value":
  "Date of scheduled monitoring examination" O
  return O.value as dateTime
/* End of Date of scheduled monitoring examination */

/*
@dataElement: HIV.D.DE417 - Date viral load test results received by client
@activity: HIV.D20 Diagnostics
@description: The date on which the client received results from a viral load test
*/
// TODO: Replace placeholder with relevant CQL logic
define "Date viral load test results received by client D.DE417":
  [Observation: Concepts."Date viral load test results received by client - HIV.D.DE417"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Date viral load test results received by client D.DE417 Value":
  "Date viral load test results received by client D.DE417" O
  return O.value as dateTime
/* End of Date viral load test results received by client D.DE417 */

/*
@dataElement: HIV.D.DE418 - Reason for ARV drug regimen substitution
@activity: HIV.D21 Determine regimen and treatment options
@description: Reason why a substitution was made to the antiretroviral (ARV) drug regimen
*/
// TODO: Replace placeholder with relevant CQL logic
define "Reason for ARV drug regimen substitution":
  exists "Reason for ARV drug regimen substitution Observation"
define "Reason for ARV drug regimen substitution Observation":
  [Observation: Concepts."Reason for ARV drug regimen substitution"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Reason for ARV drug regimen substitution */

/*
@dataElement: HIV.D.DE419 - Toxicity/side effects
@activity: HIV.D21 Determine regimen and treatment options
@description: A substitution was made to the regimen because of toxicity/side effects
*/
// TODO: Replace placeholder with relevant CQL logic
define "Toxicity/side effects D.DE419":
  exists "Toxicity/side effects D.DE419 Condition"
    or exists "Toxicity/side effects D.DE419 Observation"
define "Toxicity/side effects D.DE419 Condition":
  [Condition: Concepts."Toxicity/side effects - HIV.D.DE419"]
define "Toxicity/side effects D.DE419 Observation":
  "Reason for ARV drug regimen substitution Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Toxicity/side effects - HIV.D.DE419"
/* End of Toxicity/side effects D.DE419 */

/*
@dataElement: HIV.D.DE420 - Drug-drug interaction
@activity: HIV.D21 Determine regimen and treatment options
@description: A substitution was made to the regimen because of a drug-drug interaction
*/
// TODO: Replace placeholder with relevant CQL logic
define "Drug-drug interaction":
  exists "Drug-drug interaction Condition"
    or exists "Drug-drug interaction Observation"
define "Drug-drug interaction Condition":
  [Condition: Concepts."Drug-drug interaction"]
define "Drug-drug interaction Observation":
  "Reason for ARV drug regimen substitution Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Drug-drug interaction"
/* End of Drug-drug interaction */

/*
@dataElement: HIV.D.DE421 - Pregnancy
@activity: HIV.D21 Determine regimen and treatment options
@description: A substitution was made to the regimen because of pregnancy
*/
// TODO: Replace placeholder with relevant CQL logic
define "Pregnancy":
  exists "Pregnancy Condition"
    or exists "Pregnancy Observation"
define "Pregnancy Condition":
  [Condition: Concepts."Pregnancy"]
define "Pregnancy Observation":
  "Reason for ARV drug regimen substitution Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Pregnancy"
/* End of Pregnancy */

/*
@dataElement: HIV.D.DE422 - New TB
@activity: HIV.D21 Determine regimen and treatment options
@description: A substitution was made to the regimen because of new tuberculosis (TB)
*/
// TODO: Replace placeholder with relevant CQL logic
define "New TB":
  exists "New TB Condition"
    or exists "New TB Observation"
define "New TB Condition":
  [Condition: Concepts."New TB"]
define "New TB Observation":
  "Reason for ARV drug regimen substitution Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."New TB"
/* End of New TB */

/*
@dataElement: HIV.D.DE423 - New drug available
@activity: HIV.D21 Determine regimen and treatment options
@description: A substitution was made to the regimen because a new drug was available
*/
// TODO: Replace placeholder with relevant CQL logic
define "New drug available":
  exists "New drug available Condition"
    or exists "New drug available Observation"
define "New drug available Condition":
  [Condition: Concepts."New drug available"]
define "New drug available Observation":
  "Reason for ARV drug regimen substitution Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."New drug available"
/* End of New drug available */

/*
@dataElement: HIV.D.DE424 - Drug out of stock
@activity: HIV.D21 Determine regimen and treatment options
@description: A substitution was made to the regimen because drug was out of stock
*/
// TODO: Replace placeholder with relevant CQL logic
define "Drug out of stock":
  exists "Drug out of stock Condition"
    or exists "Drug out of stock Observation"
define "Drug out of stock Condition":
  [Condition: Concepts."Drug out of stock"]
define "Drug out of stock Observation":
  "Reason for ARV drug regimen substitution Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Drug out of stock"
/* End of Drug out of stock */

/*
@dataElement: HIV.D.DE425 - Other reason for regimen substitution
@activity: HIV.D21 Determine regimen and treatment options
@description: A substitution was made for another reason
*/
// TODO: Replace placeholder with relevant CQL logic
define "Other reason for regimen substitution":
  exists "Other reason for regimen substitution Condition"
    or exists "Other reason for regimen substitution Observation"
define "Other reason for regimen substitution Condition":
  [Condition: Concepts."Other reason for regimen substitution"]
define "Other reason for regimen substitution Observation":
  "Reason for ARV drug regimen substitution Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Other reason for regimen substitution"
/* End of Other reason for regimen substitution */

/*
@dataElement: HIV.D.DE427 - Switch to second-line ART regimen recommended
@activity: HIV.D21 Determine regimen and treatment options
@description: A switch to second-line ART regimen is recommended
*/
// TODO: Replace placeholder with relevant CQL logic
define "Switch to second-line ART regimen recommended":
  exists "Switch to second-line ART regimen recommended Observation"
define "Switch to second-line ART regimen recommended Observation":
  [Observation: Concepts."Switch to second-line ART regimen recommended"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value is true
/* End of Switch to second-line ART regimen recommended */

/*
@dataElement: HIV.D.DE436 - Regimen substitution recommended
@activity: HIV.D23 Prescribe
@description: A drug substitution is recommended
*/
// TODO: Replace placeholder with relevant CQL logic
define "Regimen substitution recommended":
  exists "Regimen substitution recommended Observation"
define "Regimen substitution recommended Observation":
  [Observation: Concepts."Regimen substitution recommended"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value is true
/* End of Regimen substitution recommended */

/*
@dataElement: HIV.D.DE437 - Dose adjustment recommended
@activity: HIV.D23 Prescribe
@description: A dosage change is recommended
*/
// TODO: Replace placeholder with relevant CQL logic
define "Dose adjustment recommended":
  exists "Dose adjustment recommended Observation"
define "Dose adjustment recommended Observation":
  [Observation: Concepts."Dose adjustment recommended"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value is true
/* End of Dose adjustment recommended */

/*
@dataElement: HIV.D.DE443 - Suspicion of treatment failure or interruption
@activity: HIV.D23 Prescribe
@description: Client has been on ART, but has stopped taking it or a treatment failure is suspected
*/
// TODO: Replace placeholder with relevant CQL logic
define "Suspicion of treatment failure or interruption":
  exists "Suspicion of treatment failure or interruption Observation"
define "Suspicion of treatment failure or interruption Observation":
  [Observation: Concepts."Suspicion of treatment failure or interruption"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value is true
/* End of Suspicion of treatment failure or interruption */

/*
@dataElement: HIV.D.DE457 - Medications prescribed
@activity: HIV.D23 Prescribe
@description: Name or regimen code of all other medications prescribed during the visit
*/
// TODO: Replace placeholder with relevant CQL logic
define "Medications prescribed D.DE457":
  exists "Medications prescribed D.DE457 Observation"
define "Medications prescribed D.DE457 Observation":
  [Observation: Concepts."Medications prescribed - HIV.D.DE457"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Medications prescribed D.DE457 */

/*
@dataElement: HIV.D.DE458 - Date medications prescribed
@activity: HIV.D23 Prescribe
@description: Date the medications were prescribed
*/
// TODO: Replace placeholder with relevant CQL logic
define "Date medications prescribed D.DE458":
  [Observation: Concepts."Date medications prescribed - HIV.D.DE458"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Date medications prescribed D.DE458 Value":
  "Date medications prescribed D.DE458" O
  return O.value as dateTime
/* End of Date medications prescribed D.DE458 */

/*
@dataElement: HIV.D.DE459 - Dose of medications prescribed
@activity: HIV.D23 Prescribe
@description: Number of doses (quantity taken at a single point in time) of drugs prescribed/dispensed
*/

define "Dose of medications prescribed":
  [MedicationRequest] P
    return P.dailyDose()
/* End of Dose of medications prescribed */

/*
@dataElement: HIV.D.DE460 - Number of days medications prescribed
@activity: HIV.D23 Prescribe
@description: Number of days supply of each medication or regimen prescribed during the visit
*/
// TODO: Replace placeholder with relevant CQL logic
define "Number of days medications prescribed":
  [Observation: Concepts."Number of days medications prescribed"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Number of days medications prescribed Value":
  "Number of days medications prescribed" O
  return O.value as Quantity
/* End of Number of days medicat ions prescribed */

/*
@dataElement: HIV.D.DE465 - Adherence counselling provided
@activity: HIV.D24 Counsel
@description: Counselling was carried out during visit
*/
// TODO: Replace placeholder with relevant CQL logic
define "Adherence counselling provided D.DE465":
  exists "Adherence counselling provided D.DE465 Observation"
define "Adherence counselling provided D.DE465 Observation":
  [Observation: Concepts."Adherence counselling provided - HIV.D.DE465"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value is true
/* End of Adherence counselling provided D.DE465 */

/*
@dataElement: HIV.D.DE466 - Type of treatment-limiting toxicity
@activity: HIV.D21 Determine regimen and treatment options
@description: Type of treatment-limiting toxicity experienced by client. Treatment-limiting toxicity is defined as a serious adverse drug reaction that results in drug discontinuation or substitution. In addition, any reaction that leads to treatment interruption or requires changing the drug or regimen because of an adverse drug reaction is also considered a serious adverse drug reaction.
*/
// TODO: Replace placeholder with relevant CQL logic
define "Type of treatment-limiting toxicity":
  exists "Type of treatment-limiting toxicity Observation"
define "Type of treatment-limiting toxicity Observation":
  [Observation: Concepts."Type of treatment-limiting toxicity"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Type of treatment-limiting toxicity */

/*
@dataElement: HIV.D.DE467 - Gastrointestinal
@activity: HIV.D21 Determine regimen and treatment options
@description: Treatment-limiting toxicity due to GI issues (nausea, diarrhoea, abdominal pain, vomiting)
*/

define "Gastrointestinal":
  [AdverseEvent] AE 
  where AE.actuality = 'actual'
  and AE.event ~ Concepts."Gastrointestinal"
/* End of Gastrointestinal */

/*
@dataElement: HIV.D.DE468 - Skin issues
@activity: HIV.D21 Determine regimen and treatment options
@description: Treatment-limiting toxicity due to skin issues (rash, hypersensitivity reaction)
*/

define "Skin issues":
  [AdverseEvent] AE 
  where AE.actuality = 'actual'
  and AE.event ~ Concepts."Skin issues"
/* End of Skin issues */

/*
@dataElement: HIV.D.DE469 - Peripheral neuropathy
@activity: HIV.D21 Determine regimen and treatment options
@description: Treatment-limiting toxicity due to peripheral neuropathy (burning/numbness/ tingling)
*/

define "Peripheral neuropathy":
  [AdverseEvent] AE 
  where AE.actuality = 'actual'
  and AE.event ~  Concepts."Peripheral neuropathy"
/* End of Peripheral neuropathy */

/*
@dataElement: HIV.D.DE470 - Central nervous system symptoms
@activity: HIV.D21 Determine regimen and treatment options
@description: Treatment-limiting toxicity due to central nervous system symptoms (dizzy, anxiety, nightmare, depression, seizures)
*/

define "Central nervous system symptoms":
  [AdverseEvent] AE 
  where AE.actuality = 'actual'
  and AE.event ~ Concepts."Central nervous system symptoms"
/* End of Central nervous system symptoms */

/*
@dataElement: HIV.D.DE471 - Weight gain
@activity: HIV.D21 Determine regimen and treatment options
@description: Treatment-limiting toxicity due to weight gain
*/

define "Weight gain":
  [AdverseEvent] AE 
  where AE.actuality = 'actual'
  and AE.event ~ Concepts."Weight gain"
/* End of Weight gain */

/*
@dataElement: HIV.D.DE472 - Hepatic dysfunction
@activity: HIV.D21 Determine regimen and treatment options
@description: Treatment-limiting toxicity due to hepatic dysfunction (jaundice)
*/

define "Hepatic dysfunction":
  [AdverseEvent] AE 
  where AE.actuality = 'actual'
  and AE.event ~ Concepts."Hepatic dysfunction"
/* End of Hepatic dysfunction */

/*
@dataElement: HIV.D.DE473 - Haematological disorders
@activity: HIV.D21 Determine regimen and treatment options
@description: Treatment-limiting toxicity due to haematological (anaemia, neutropenia) disorders
*/

define "Haematological disorders":
  [AdverseEvent] AE 
  where AE.actuality = 'actual'
  and AE.event ~ Concepts."Haematological disorders"
/* End of Haematological disorders */

/*
@dataElement: HIV.D.DE474 - Fatigue
@activity: HIV.D21 Determine regimen and treatment options
@description: Treatment-limiting toxicity due to fatigue
*/

define "Fatigue":
  [AdverseEvent] AE 
  where AE.actuality = 'actual'
  and AE.event ~ Concepts."Fatigue"
/* End of Fatigue */

/*
@dataElement: HIV.D.DE475 - Headache
@activity: HIV.D21 Determine regimen and treatment options
@description: Treatment-limiting toxicity due to headache
*/

define "Headache D.DE475":
  [AdverseEvent] AE 
  where AE.actuality = 'actual'
  and AE.event ~  Concepts."Headache - HIV.D.DE475"
/* End of Headache D.DE475 */

/*
@dataElement: HIV.D.DE476 - Bone dysfunction
@activity: HIV.D21 Determine regimen and treatment options
@description: Treatment-limiting toxicity due to bone dysfunction (fractures, osteopenia)
*/

define "Bone dysfunction":
  [AdverseEvent] AE 
  where AE.actuality = 'actual'
  and AE.event ~  Concepts."Bone dysfunction"
/* End of Bone dysfunction */

/*
@dataElement: HIV.D.DE477 - Metabolic symptoms
@activity: HIV.D21 Determine regimen and treatment options
@description: Treatment-limiting toxicity due to metabolic symptoms (body fat changes, hyperglycaemia, dyslipidaemia)
*/

define "Metabolic symptoms":
  [AdverseEvent] AE 
  where AE.actuality = 'actual'
  and AE.event ~ Concepts."Metabolic symptoms"
/* End of Metabolic symptoms */

/*
@dataElement: HIV.D.DE478 - Kidney dysfunction
@activity: HIV.D21 Determine regimen and treatment options
@description: Treatment-limiting toxicity due to kidney dysfunction (nephrolithiasis, renal insufficiency)
*/

define "Kidney dysfunction":
  [AdverseEvent] AE 
  where AE.actuality = 'actual'
  and AE.event ~  Concepts."Kidney dysfunction"
/* End of Kidney dysfunction */

/*
@dataElement: HIV.D.DE479 - Unexpected adverse drug reaction
@activity: HIV.D21 Determine regimen and treatment options
@description: Client experienced an unexpected adverse drug reaction
*/

define "Unexpected adverse drug reaction":
  [AdverseEvent] AE 
  where AE.actuality = 'actual'
  and AE.event ~ Concepts."Unexpected adverse drug reaction"
/* End of Unexpected adverse drug reaction */

/*
HIV.D.DE485
New regimen after switch to second-line regimen
*/

define "New regimen after switch to second-line regimen":
  [MedicationStatement] MS
    where exists(MS.reasonCode C where C ~ Concepts."New regimen after switch to second-line regimen")
    sort by start of effective.toInterval()


/*
HIV.D.DE491
New regimen after switch to third-line regimen
*/

define "New regimen after switch to third-line regimen":
  [MedicationStatement] MS
    where exists(MS.reasonCode C where C ~ Concepts."New regimen after switch to third-line regimen")
    sort by start of effective.toInterval()


/*
HIV.D.DE489	New regimen(s) after substitution within second-line regimen
*/

define "New regimen after substitution within second-line regimen":
  [MedicationStatement] MS
    where exists(MS.reasonCode C where C ~ Concepts."New regimen after switch to second-line regimen")
    sort by start of effective.toInterval()


/*
HIV.D.DE495	New regimen(s) after substitution within third-line regimen
*/

define "New regimen after substitution within third-line regimen":
  [MedicationStatement] MS
    where exists(MS.reasonCode C where C ~ Concepts."New regimen after switch to third-line regimen")
    sort by start of effective.toInterval()

/*
@dataElement: HIV.D.DE487 - Dates of substitution within second-line regimen
@activity: HIV.D21 Determine regimen and treatment options
@description: Date on which ARV drug regimen for client was changed within the second-line regimen (substitution)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Dates of substitution within second-line regimen":
  [Observation: Concepts."Dates of substitution within second-line regimen"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Dates of substitution within second-line regimen Value":
  "Dates of substitution within second-line regimen" O
  return O.value as dateTime
/* End of Dates of substitution within second-line regimen */

/*
@dataElement: HIV.D.DE493 - Dates of substitution within third-line regimen
@activity: HIV.D21 Determine regimen and treatment options
@description: Date on which ARV drug regimen for client was changed within the third-line (substitution)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Dates of substitution within third-line regimen":
  [Observation: Concepts."Dates of substitution within third-line regimen"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Dates of substitution within third-line regimen Value":
  "Dates of substitution within third-line regimen" O
  return O.value as dateTime
/* End of Dates of substitution within third-line regimen */

/*
@dataElement: HIV.D.DE496 - Enhanced adherence counselling provided
@activity: HIV.D24 Counsel
@description: Enhanced adherence counselling was provided to the client during the visit
*/
 
define "Enhanced adherence counselling provided":
  [Communication] C
  where C.topic ~ Concepts."Enhanced adherence counselling provided"

/* End of Enhanced adherence counselling provided */

/*
@dataElement: HIV.D.DE507 - Counselling provided on diagnoses
@activity: HIV.D24 Counsel
@description: Counselling provided on diagnoses
*/
// TODO: Replace placeholder with relevant CQL logic
define "Counselling provided on diagnoses":
  exists "Counselling provided on diagnoses Observation"
define "Counselling provided on diagnoses Observation":
  [Observation: Concepts."Counselling provided on diagnoses"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value is true
/* End of Counselling provided on diagnoses */

/*
@dataElement: HIV.D.DE510 - Syphilis counselling and treatment
@activity: HIV.D24 Counsel
@description: Whether counselling and treatment was provided to a client who has been diagnosed with syphilis
*/
// TODO: Replace placeholder with relevant CQL logic
define "Syphilis counselling and treatment":
  exists "Syphilis counselling and treatment Observation"
define "Syphilis counselling and treatment Observation":
  [Observation: Concepts."Syphilis counselling and treatment"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value is true
/* End of Syphilis counselling and treatment */

/*
@dataElement: HIV.D.DE519 - Other support services
@activity: HIV.D28 Offer other services
@description: Offer or refer for other support services
*/
// TODO: Replace placeholder with relevant CQL logic
define "Other support services D.DE519":
  exists "Other support services D.DE519 Observation"
define "Other support services D.DE519 Observation":
  [Observation: Concepts."Other support services - HIV.D.DE519"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Other support services D.DE519 */

/*
@dataElement: HIV.D.DE520 - Mental health services
@activity: HIV.D28 Offer other services
@description: Offer or refer for mental health services
*/
// TODO: Replace placeholder with relevant CQL logic
define "Mental health services D.DE520":
  exists "Mental health services D.DE520 Condition"
    or exists "Mental health services D.DE520 Observation"
define "Mental health services D.DE520 Condition":
  [Condition: Concepts."Mental health services - HIV.D.DE520"]
define "Mental health services D.DE520 Observation":
  "Other support services D.DE519 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Mental health services - HIV.D.DE520"
/* End of Mental health services D.DE520 */

/*
@dataElement: HIV.D.DE521 - Psychosocial counselling, support and treatment adherence counselling
@activity: HIV.D28 Offer other services
@description: Offer or refer for psychosocial counselling, support and treatment adherence counselling
*/
// TODO: Replace placeholder with relevant CQL logic
define "Psychosocial counselling, support and treatment adherence counselling D.DE521":
  exists "Psychosocial counselling, support and treatment adherence counselling D.DE521 Condition"
    or exists "Psychosocial counselling, support and treatment adherence counselling D.DE521 Observation"
define "Psychosocial counselling, support and treatment adherence counselling D.DE521 Condition":
  [Condition: Concepts."Psychosocial counselling, support and treatment adherence counselling - HIV.D.DE521"]
define "Psychosocial counselling, support and treatment adherence counselling D.DE521 Observation":
  "Other support services D.DE519 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Psychosocial counselling, support and treatment adherence counselling - HIV.D.DE521"
/* End of Psychosocial counselling, support and treatment adherence counselling D.DE521 */

/*
@dataElement: HIV.D.DE522 - Legal and social services
@activity: HIV.D28 Offer other services
@description: Offer or refer for legal and social services
*/
// TODO: Replace placeholder with relevant CQL logic
define "Legal and social services D.DE522":
  exists "Legal and social services D.DE522 Condition"
    or exists "Legal and social services D.DE522 Observation"
define "Legal and social services D.DE522 Condition":
  [Condition: Concepts."Legal and social services - HIV.D.DE522"]
define "Legal and social services D.DE522 Observation":
  "Other support services D.DE519 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Legal and social services - HIV.D.DE522"
/* End of Legal and social services D.DE522 */

/*
@dataElement: HIV.D.DE523 - Services for responding to violence against women
@activity: HIV.D28 Offer other services
@description: Offer or refer for services for responding to violence against women, including first-line support and psychosocial support, post-rape care and other support services including shelters, legal services and women and child protection services
*/
// TODO: Replace placeholder with relevant CQL logic
define "Services for responding to violence against women D.DE523":
  exists "Services for responding to violence against women D.DE523 Condition"
    or exists "Services for responding to violence against women D.DE523 Observation"
define "Services for responding to violence against women D.DE523 Condition":
  [Condition: Concepts."Services for responding to violence against women - HIV.D.DE523"]
define "Services for responding to violence against women D.DE523 Observation":
  "Other support services D.DE519 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Services for responding to violence against women - HIV.D.DE523"
/* End of Services for responding to violence against women D.DE523 */

/*
@dataElement: HIV.D.DE524 - Date/time of follow-up appointment
@activity: HIV.D29 Schedule follow-up
@description: Date the client is to return for monitoring, re-supply or any other reason
*/
// TODO: Replace placeholder with relevant CQL logic
define "Date/time of follow-up appointment D.DE524":
  [Observation: Concepts."Date/time of follow-up appointment - HIV.D.DE524"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Date/time of follow-up appointment D.DE524 Value":
  "Date/time of follow-up appointment D.DE524" O
  return O.value as dateTime
/* End of Date/time of follow-up appointment D.DE524 */

/*
@dataElement: HIV.D.DE525 - Type of follow-up appointment
@activity: HIV.D29 Schedule follow-up
@description: Whether the visit will be clinical only, ARV drug pick-up or other. Client may have multiple follow-ups scheduled.
*/
// TODO: Replace placeholder with relevant CQL logic
define "Type of follow-up appointment D.DE525":
  exists "Type of follow-up appointment D.DE525 Observation"
define "Type of follow-up appointment D.DE525 Observation":
  [Observation: Concepts."Type of follow-up appointment - HIV.D.DE525"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Type of follow-up appointment D.DE525 */

/*
@dataElement: HIV.D.DE526 - Clinical visit
@activity: HIV.D29 Schedule follow-up
@description: Appointment for clinical care by a provider
*/
// TODO: Replace placeholder with relevant CQL logic
define "Clinical visit D.DE526":
  exists "Clinical visit D.DE526 Condition"
    or exists "Clinical visit D.DE526 Observation"
define "Clinical visit D.DE526 Condition":
  [Condition: Concepts."Clinical visit - HIV.D.DE526"]
define "Clinical visit D.DE526 Observation":
  "Type of follow-up appointment D.DE525 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Clinical visit - HIV.D.DE526"
/* End of Clinical visit D.DE526 */

/*
@dataElement: HIV.D.DE527 - Antiretroviral drug pick up
@activity: HIV.D29 Schedule follow-up
@description: Appointment for a drug pick up
*/
// TODO: Replace placeholder with relevant CQL logic
define "Antiretroviral drug pick up":
  exists "Antiretroviral drug pick up Condition"
    or exists "Antiretroviral drug pick up Observation"
define "Antiretroviral drug pick up Condition":
  [Condition: Concepts."Antiretroviral drug pick up"]
define "Antiretroviral drug pick up Observation":
  "Type of follow-up appointment D.DE525 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Antiretroviral drug pick up"
/* End of Antiretroviral drug pick up */

/*
@dataElement: HIV.D.DE528 - Post-treatment follow-up visit for cervical precancer lesions or invasive cervical cancer
@activity: HIV.D29 Schedule follow-up
@description: Appointment for a post-treatment follow-up visit for cervical precancer lesions or invasive cervical cancer
*/
// TODO: Replace placeholder with relevant CQL logic
define "Post-treatment follow-up visit for cervical precancer lesions or invasive cervical cancer D.DE528":
  exists "Post-treatment follow-up visit for cervical precancer lesions or invasive cervical cancer D.DE528 Condition"
    or exists "Post-treatment follow-up visit for cervical precancer lesions or invasive cervical cancer D.DE528 Observation"
define "Post-treatment follow-up visit for cervical precancer lesions or invasive cervical cancer D.DE528 Condition":
  [Condition: Concepts."Post-treatment follow-up visit for cervical precancer lesions or invasive cervical cancer - HIV.D.DE528"]
define "Post-treatment follow-up visit for cervical precancer lesions or invasive cervical cancer D.DE528 Observation":
  "Type of follow-up appointment D.DE525 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Post-treatment follow-up visit for cervical precancer lesions or invasive cervical cancer - HIV.D.DE528"
/* End of Post-treatment follow-up visit for cervical precancer lesions or invasive cervical cancer D.DE528 */

/*
@dataElement: HIV.D.DE529 - Other
@activity: HIV.D29 Schedule follow-up
@description: Other reason for the follow-up appointment
*/
// TODO: Replace placeholder with relevant CQL logic
define "Other D.DE529":
  exists "Other D.DE529 Condition"
    or exists "Other D.DE529 Observation"
define "Other D.DE529 Condition":
  [Condition: Concepts."Other - HIV.D.DE529"]
define "Other D.DE529 Observation":
  "Type of follow-up appointment D.DE525 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Other - HIV.D.DE529"
/* End of Other D.DE529 */

/*
@dataElement: HIV.D.DE531 - Follow-up test recommended date
@activity: HIV.D29 Schedule follow-up
@description: A test or screening recommended for the client's care plan at a future date
*/
// TODO: Replace placeholder with relevant CQL logic
define "Follow-up test recommended date":
  [Observation: Concepts."Follow-up test recommended date"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Follow-up test recommended date Value":
  "Follow-up test recommended date" O
  return O.value as dateTime
/* End of Follow-up test recommended date */

/*
@dataElement: HIV.D.DE537 - Current medications
@activity: HIV.D8 Capture or update client history
@description: List of all of the medications the client is currently taking
*/
// TODO: Replace placeholder with relevant CQL logic
define "Current medications":
  exists "Current medications Observation"
define "Current medications Observation":
  [Observation: Concepts."Current medications"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Current medications */

/*
@dataElement: HIV.D.DE538 - No medications
@activity: HIV.D8 Capture or update client history
@description: The client is currently not on any medications
*/
// TODO: Replace placeholder with relevant CQL logic
define "No medications":
  exists "No medications Condition"
    or exists "No medications Observation"
define "No medications Condition":
  [Condition: Concepts."No medications"]
define "No medications Observation":
  "Current medications Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."No medications"
/* End of No medications */

/*
@dataElement: HIV.D.DE539 - Dont know of any current medications
@activity: HIV.D8 Capture or update client history
@description: The client does not know if she is on any medications
*/
// TODO: Replace placeholder with relevant CQL logic
define "Dont know of any current medications":
  exists "Dont know of any current medications Condition"
    or exists "Dont know of any current medications Observation"
define "Dont know of any current medications Condition":
  [Condition: Concepts."Dont know of any current medications"]
define "Dont know of any current medications Observation":
  "Current medications Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Dont know of any current medications"
/* End of Dont know of any current medications */

/*
@dataElement: HIV.D.DE540 - Analgesic
@activity: HIV.D8 Capture or update client history
@description: Analgesic medication (painkiller)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Analgesic":
  exists "Analgesic Condition"
    or exists "Analgesic Observation"
define "Analgesic Condition":
  [Condition: Concepts."Analgesic"]
define "Analgesic Observation":
  "Current medications Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Analgesic"
/* End of Analgesic */

/*
@dataElement: HIV.D.DE541 - Antacids
@activity: HIV.D8 Capture or update client history
@description: Antacids
*/
// TODO: Replace placeholder with relevant CQL logic
define "Antacids":
  exists "Antacids Condition"
    or exists "Antacids Observation"
define "Antacids Condition":
  [Condition: Concepts."Antacids"]
define "Antacids Observation":
  "Current medications Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Antacids"
/* End of Antacids */

/*
@dataElement: HIV.D.DE542 - Antibiotics broad-spectrum
@activity: HIV.D8 Capture or update client history
@description: Client is currently taking broad-spectrum antibiotics
*/
// TODO: Replace placeholder with relevant CQL logic
define "Antibiotics broad-spectrum":
  exists "Antibiotics broad-spectrum Condition"
    or exists "Antibiotics broad-spectrum Observation"
define "Antibiotics broad-spectrum Condition":
  [Condition: Concepts."Antibiotics broad-spectrum"]
define "Antibiotics broad-spectrum Observation":
  "Current medications Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Antibiotics broad-spectrum"
/* End of Antibiotics broad-spectrum */

/*
@dataElement: HIV.D.DE543 - Anticonvulsive
@activity: HIV.D8 Capture or update client history
@description: Anticonvulsive medication
*/
// TODO: Replace placeholder with relevant CQL logic
define "Anticonvulsive":
  exists "Anticonvulsive Condition"
    or exists "Anticonvulsive Observation"
define "Anticonvulsive Condition":
  [Condition: Concepts."Anticonvulsive"]
define "Anticonvulsive Observation":
  "Current medications Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Anticonvulsive"
/* End of Anticonvulsive */

/*
@dataElement: HIV.D.DE544 - Antidiabetic
@activity: HIV.D8 Capture or update client history
@description: Antidiabetic medication
*/
// TODO: Replace placeholder with relevant CQL logic
define "Antidiabetic":
  exists "Antidiabetic Condition"
    or exists "Antidiabetic Observation"
define "Antidiabetic Condition":
  [Condition: Concepts."Antidiabetic"]
define "Antidiabetic Observation":
  "Current medications Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Antidiabetic"
/* End of Antidiabetic */

/*
@dataElement: HIV.D.DE545 - Antifungals
@activity: HIV.D8 Capture or update client history
@description: Client is currently taking antifungals
*/
// TODO: Replace placeholder with relevant CQL logic
define "Antifungals":
  exists "Antifungals Condition"
    or exists "Antifungals Observation"
define "Antifungals Condition":
  [Condition: Concepts."Antifungals"]
define "Antifungals Observation":
  "Current medications Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Antifungals"
/* End of Antifungals */

/*
@dataElement: HIV.D.DE546 - Antihelmintic
@activity: HIV.D8 Capture or update client history
@description: Antihelmintic or antiparasitic medication
*/
// TODO: Replace placeholder with relevant CQL logic
define "Antihelmintic":
  exists "Antihelmintic Condition"
    or exists "Antihelmintic Observation"
define "Antihelmintic Condition":
  [Condition: Concepts."Antihelmintic"]
define "Antihelmintic Observation":
  "Current medications Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Antihelmintic"
/* End of Antihelmintic */

/*
@dataElement: HIV.D.DE547 - Antihypertensive
@activity: HIV.D8 Capture or update client history
@description: Antihypertensive medication
*/
// TODO: Replace placeholder with relevant CQL logic
define "Antihypertensive":
  exists "Antihypertensive Condition"
    or exists "Antihypertensive Observation"
define "Antihypertensive Condition":
  [Condition: Concepts."Antihypertensive"]
define "Antihypertensive Observation":
  "Current medications Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Antihypertensive"
/* End of Antihypertensive */

/*
@dataElement: HIV.D.DE548 - Antimalarials
@activity: HIV.D8 Capture or update client history
@description: Antimalarial medication
*/
// TODO: Replace placeholder with relevant CQL logic
define "Antimalarials":
  exists "Antimalarials Condition"
    or exists "Antimalarials Observation"
define "Antimalarials Condition":
  [Condition: Concepts."Antimalarials"]
define "Antimalarials Observation":
  "Current medications Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Antimalarials"
/* End of Antimalarials */

/*
@dataElement: HIV.D.DE549 - Antiretrovirals ARVs
@activity: HIV.D8 Capture or update client history
@description: Antiretrovirals (ARVs)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Antiretrovirals ARVs":
  exists "Antiretrovirals ARVs Condition"
    or exists "Antiretrovirals ARVs Observation"
define "Antiretrovirals ARVs Condition":
  [Condition: Concepts."Antiretrovirals ARVs"]
define "Antiretrovirals ARVs Observation":
  "Current medications Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Antiretrovirals ARVs"
/* End of Antiretrovirals ARVs */

/*
@dataElement: HIV.D.DE550 - Antiparasitics
@activity: HIV.D8 Capture or update client history
@description: Client is currently taking antiparasitics
*/
// TODO: Replace placeholder with relevant CQL logic
define "Antiparasitics":
  exists "Antiparasitics Condition"
    or exists "Antiparasitics Observation"
define "Antiparasitics Condition":
  [Condition: Concepts."Antiparasitics"]
define "Antiparasitics Observation":
  "Current medications Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Antiparasitics"
/* End of Antiparasitics */

/*
@dataElement: HIV.D.DE551 - Antivirals
@activity: HIV.D8 Capture or update client history
@description: Antiviral medication
*/
// TODO: Replace placeholder with relevant CQL logic
define "Antivirals":
  exists "Antivirals Condition"
    or exists "Antivirals Observation"
define "Antivirals Condition":
  [Condition: Concepts."Antivirals"]
define "Antivirals Observation":
  "Current medications Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Antivirals"
/* End of Antivirals */

/*
@dataElement: HIV.D.DE552 - Buprenorphine
@activity: HIV.D8 Capture or update client history
@description: Opioid substitution to treat opioid dependence
*/
define "buprenorphine_prescribed":
[MedicationRequest] MR
        where MR.status = 'completed'
        and MR.intent = 'order'
        and MR.medication ~ ConceptsCustom."buprenorphine"


define "Buprenorphine D.DE552":
  [MedicationRequest] MR
        where MR.intent = 'order'
        and MR.medication ~ ConceptsCustom."buprenorphine"

/* End of Buprenorphine D.DE552 */

/*
@dataElement: HIV.D.DE553 - Co-trimoxazole preventive therapy CPT
@activity: HIV.D8 Capture or update client history
@description: Combination of two antimicrobial drugs (sulfamethoxazole and trimethoprim) that covers a variety of bacterial, fungal and protozoan infections
*/
// TODO: Replace placeholder with relevant CQL logic
define "Co-trimoxazole preventive therapy CPT":
  exists "Co-trimoxazole preventive therapy CPT Condition"
    or exists "Co-trimoxazole preventive therapy CPT Observation"
define "Co-trimoxazole preventive therapy CPT Condition":
  [Condition: Concepts."Co-trimoxazole preventive therapy CPT"]
define "Co-trimoxazole preventive therapy CPT Observation":
  "Current medications Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Co-trimoxazole preventive therapy CPT"
/* End of Co-trimoxazole preventive therapy CPT */

/*
@dataElement: HIV.D.DE554 - Hormonal family planning method
@activity: HIV.D8 Capture or update client history
@description: Hormonal family planning method
*/
// TODO: Replace placeholder with relevant CQL logic
define "Hormonal family planning method":
  exists "Hormonal family planning method Condition"
    or exists "Hormonal family planning method Observation"
define "Hormonal family planning method Condition":
  [Condition: Concepts."Hormonal family planning method"]
define "Hormonal family planning method Observation":
  "Current medications Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Hormonal family planning method"
/* End of Hormonal family planning method */

/*
@dataElement: HIV.D.DE555 - Methadone
@activity: HIV.D8 Capture or update client history
@description: Opioid substitution to treat opioid dependence
*/
define "methadone_prescribed":
[MedicationRequest] MR
        where MR.status = 'completed'
        and MR.intent = 'order'
        and MR.medication ~ ConceptsCustom."methadone"


define "Methadone D.DE555":
  [MedicationRequest] MR
        where MR.intent = 'order'
        and MR.medication ~ ConceptsCustom."methadone"
/* End of Methadone D.DE555 */

/*
@dataElement: HIV.D.DE556 - PrEP to prevent HIV
@activity: HIV.D8 Capture or update client history
@description: Pre-exposure prophylaxis (PrEP) medication for preventing the acquisition of HIV
*/
// TODO: Replace placeholder with relevant CQL logic
define "PrEP to prevent HIV":
  exists "PrEP to prevent HIV Condition"
    or exists "PrEP to prevent HIV Observation"
define "PrEP to prevent HIV Condition":
  [Condition: Concepts."PrEP to prevent HIV"]
define "PrEP to prevent HIV Observation":
  "Current medications Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."PrEP to prevent HIV"
/* End of PrEP to prevent HIV */

/*
@dataElement: HIV.D.DE557 - Other antibiotics
@activity: HIV.D8 Capture or update client history
@description: Other antibiotics not listed above
*/
// TODO: Replace placeholder with relevant CQL logic
define "Other antibiotics":
  exists "Other antibiotics Condition"
    or exists "Other antibiotics Observation"
define "Other antibiotics Condition":
  [Condition: Concepts."Other antibiotics"]
define "Other antibiotics Observation":
  "Current medications Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Other antibiotics"
/* End of Other antibiotics */

/*
@dataElement: HIV.D.DE558 - Other medications
@activity: HIV.D8 Capture or update client history
@description: Other medications or supplements that are not listed above
*/
// TODO: Replace placeholder with relevant CQL logic
define "Other medications":
  exists "Other medications Condition"
    or exists "Other medications Observation"
define "Other medications Condition":
  [Condition: Concepts."Other medications"]
define "Other medications Observation":
  "Current medications Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Other medications"
/* End of Other medications */

/*
@dataElement: HIV.D.DE656 - Date of cervical cancer screening test
@activity: HIV.D28 Offer other services
@description: Date of cervical cancer screening test
*/

define "Date of cervical cancer screening test":
  "Cervical cancer primary screening test" O
  return O.effective.toInterval().low
/* End of Date of cervical cancer screening test */

/*
@dataElement: HIV.D.DE657 - Lifetime screening test number
@activity: HIV.D28 Offer other services
@description: Client's lifetime number of screenings for cervical cancer
*/

define "Lifetime screening test number":
  [Observation: Concepts."Lifetime screening test number"] O
    where O.status in { 'final', 'amended', 'corrected' }

define "Lifetime screening test number Value":
  "Lifetime screening test number" O
  return O.value as FHIR.string 
/* End of Lifetime screening test number */

/*
@dataElement: HIV.D.DE658 - Cervical cancer primary screening test type
@activity: HIV.D28 Offer other services
@description: Type of cervical cancer screening test used in primary screening
*/

define "Cervical cancer primary screening test":
  [Observation] O
    where O.status in { 'final', 'amended', 'corrected' }
    and O.code in Concepts."Cervical cancer primary screening test type Choices"

  // and P.category ~ Concepts."Procedure" we could 
/* End of Cervical cancer primary screening test type */

/*
@dataElement: HIV.D.DE659 - HPV-DNA
@activity: HIV.D28 Offer other services
@description: Screened for cervical cancer using HPV-DNA test
*/

define "HPV-DNA":
  "Cervical cancer primary screening test" P
  where P.code ~ Concepts."HPV-DNA"
/* End of HPV-DNA */

/*
@dataElement: HIV.D.DE660 - VIA
@activity: HIV.D28 Offer other services
@description: Screened for cervical cancer using visual inspection with acetic acid (VIA)
*/

define "VIA":
  "Cervical cancer primary screening test" P
  where P.code ~ Concepts."VIA"
/* End of VIA */

/*
@dataElement: HIV.D.DE661 - Cervical cytology
@activity: HIV.D28 Offer other services
@description: Screened for cervical cancer using cervical cytology
*/

define "Cervical cytology":
    "Cervical cancer primary screening test" P
  where P.code ~ Concepts."Cervical cytology"
/* End of Cervical cytology */

/*
@dataElement: HIV.D.DE662 - Other
@activity: HIV.D28 Offer other services
@description: Screened for cervical cancer using other method
*/

define "Other D.DE662":
  "Cervical cancer primary screening test" P
  where P.code ~  Concepts."Other - HIV.D.DE662"
/* End of Other D.DE662 */

/*
@dataElement: HIV.D.DE705 - Date of diagnosis of cervical precancer lesions or invasive cervical cancer
@activity: HIV.D28 Offer other services
@description: Date of diagnosis of cervical precancer lesions or invasive cervical cancer
*/

/* End of Date of diagnosis of cervical precancer lesions or invasive cervical cancer */

/*
@dataElement: HIV.D.DE706 - Cervical cancer screening outcome
@activity: HIV.D28 Offer other services
@description: Client's screening outcome for cervical cancer
*/

define "Cervical cancer screening outcome":
  "Cervical cancer screening outcome Observation"

define "Cervical cancer screening outcome Observation":
  [Observation: Concepts."Cervical cancer screening outcome"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Cervical cancer screening outcome */

/*
@dataElement: HIV.D.DE707 - Positive for cervical precancer lesions
@activity: HIV.D28 Offer other services
@description: Screening outcome for cervical precancer lesions is positive
*/

define "Positive for cervical precancer lesions":
  "Positive for cervical precancer lesions Observation"

define "Positive for cervical precancer lesions Observation":
  "Cervical cancer screening outcome Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Positive for cervical precancer lesions"
/* End of Positive for cervical precancer lesions */

/*
@dataElement: HIV.D.DE708 - Negative for cervical precancer lesions
@activity: HIV.D28 Offer other services
@description: Screening outcome for cervical precancer lesions is negative
*/

define "Negative for cervical precancer lesions":
  "Negative for cervical precancer lesions Observation"

define "Negative for cervical precancer lesions Observation":
  "Cervical cancer screening outcome Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Negative for cervical precancer lesions"
/* End of Negative for cervical precancer lesions */

/*
@dataElement: HIV.D.DE709 - Cervical cancer diagnosis
@activity: HIV.D28 Offer other services
@description: Type of cervical cancer diagnosis
*/

define "Cervical cancer diagnosis":
  "Cervical precancer lesions" union "Invasive cervical cancer"

/* End of Cervical cancer diagnosis */

/*
@dataElement: HIV.D.DE710 - Cervical precancer lesions
@activity: HIV.D28 Offer other services
@description: Client is diagnosed with cervical precancer lesions
*/

define "Cervical precancer lesions":
  [Condition: Concepts."Cervical precancer lesions"]

/* End of Cervical precancer lesions */

/*
@dataElement: HIV.D.DE711 - Invasive cervical cancer
@activity: HIV.D28 Offer other services
@description: Client is diagnosed with invasive cervical cancer disease
*/

define "Invasive cervical cancer":
  [Condition: Concepts."Invasive cervical cancer"] C
    where exists (C.clinicalStatus.coding CStatus where CStatus.code in { 'active', 'recurrence', 'relapse' })

/* End of Invasive cervical cancer */

/*
@dataElement: HIV.D.DE712 - Cervical cancer stage at diagnosis
@activity: HIV.D28 Offer other services
@description: Cervical cancer stage at diagnosis of cervical cancer
*/

define "Cervical cancer stage at diagnosis":
  [Observation: Concepts."Cervical cancer stage at diagnosis"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Cervical cancer stage at diagnosis */

/*
@dataElement: HIV.D.DE713 - Stage 0
@activity: HIV.D28 Offer other services
@description: Stage 0 cervical cancer at diagnosis of cervical cancer
*/

define "Stage 0":
  "Cervical cancer stage at diagnosis" O
    where O.value ~ Concepts."Stage 0"
/* End of Stage 0 */

/*
@dataElement: HIV.D.DE714 - Stage I
@activity: HIV.D28 Offer other services
@description: Stage I cervical cancer at diagnosis of cervical cancer
*/

define "Stage I":
  "Cervical cancer stage at diagnosis" O
    where O.value ~ Concepts."Stage I"
/* End of Stage I */

/*
@dataElement: HIV.D.DE715 - Stage II
@activity: HIV.D28 Offer other services
@description: Stage II cervical cancer at diagnosis of cervical cancer
*/

define "Stage II":
  "Cervical cancer stage at diagnosis" O
    where O.value ~ Concepts."Stage II"
/* End of Stage II */

/*
@dataElement: HIV.D.DE716 - Stage III
@activity: HIV.D28 Offer other services
@description: Stage III cervical cancer at diagnosis of cervical cancer
*/

define "Stage III":
  "Cervical cancer stage at diagnosis" O
    where O.value ~ Concepts."Stage III"
/* End of Stage III */

/*
@dataElement: HIV.D.DE717 - Stage IV
@activity: HIV.D28 Offer other services
@description: Stage IV cervical cancer at diagnosis of cervical cancer
*/

define "Stage IV":
  "Cervical cancer stage at diagnosis" O
    where O.value ~ Concepts."Stage IV"
/* End of Stage IV */

/*
@dataElement: HIV.D.DE718 - Date of treatment for cervical precancer lesions
@activity: HIV.D28 Offer other services
@description: Date of treatment for cervical precancer lesions
*/

define "Date of treatment for cervical precancer lesions":
  [Procedure] P
  where P.status = 'completed'
  and P.code in Concepts."Invasive cervical cancer treatment method Choices"
/* End of Date of treatment for cervical precancer lesions */

/*
@dataElement: HIV.D.DE730 - Invasive cervical cancer treatment episode
@activity: HIV.D28 Offer other services
@description: Client's lifetime number of treatments for invasive cervical cancer
*/

define "Invasive cervical cancer treatment episode":
  [Observation: Concepts."Invasive cervical cancer treatment episode"] O
    where O.status in { 'final', 'amended', 'corrected' }

define "Invasive cervical cancer treatment episode Value":
  "Lifetime screening test number" O
  return O.value as FHIR.string 
/* End of Invasive cervical cancer treatment episode */

/*
@dataElement: HIV.D.DE731 - Invasive cervical cancer treatment method
@activity: HIV.D28 Offer other services
@description: Invasive cervical cancer treatment method
*/

define "Invasive cervical cancer treatment method":
  [Procedure] P
  where P.status in { 'completed', 'in-progress' }
  and P.code in Concepts."Invasive cervical cancer treatment method Choices"

/* End of Invasive cervical cancer treatment method */

/*
@dataElement: HIV.D.DE732 - Conization
@activity: HIV.D28 Offer other services
@description: Invasive cervical cancer treatment method is a conization
*/

define "Conization":
  "Invasive cervical cancer treatment method" P
  where P.code ~ Concepts."Conization"

/* End of Conization */

/*
@dataElement: HIV.D.DE733 - Trachelectomy
@activity: HIV.D28 Offer other services
@description: Invasive cervical cancer treatment method is a trachelectomy
*/

define "Trachelectomy":
  "Invasive cervical cancer treatment method" P
  where P.code ~ Concepts."Trachelectomy"
/* End of Trachelectomy */

/*
@dataElement: HIV.D.DE734 - Hysterectomy
@activity: HIV.D28 Offer other services
@description: Invasive cervical cancer treatment method is a hysterectomy
*/

define "Hysterectomy":
  "Invasive cervical cancer treatment method" P
  where P.code ~ Concepts."Hysterectomy"
/* End of Hysterectomy */

/*
@dataElement: HIV.D.DE735 - Management of invasive cervical cancer
@activity: HIV.D28 Offer other services
@description: Invasive cervical cancer treatment method is management of invasive cervical cancer
*/
// TODO: Replace placeholder with relevant CQL logic
define "Management of invasive cervical cancer":
  exists "Management of invasive cervical cancer Condition"

define "Management of invasive cervical cancer Condition":
  [Condition: Concepts."Management of invasive cervical cancer"]

/* End of Management of invasive cervical cancer */

/*
@dataElement: HIV.D.DE736 - Radiotherapy
@activity: HIV.D28 Offer other services
@description: Invasive cervical cancer treatment method is a radiotherapy
*/
// TODO: Replace placeholder with relevant CQL logic
define "Radiotherapy":
  exists "Radiotherapy Condition"

define "Radiotherapy Condition":
  [Condition: Concepts."Radiotherapy"]

/* End of Radiotherapy */

/*
@dataElement: HIV.D.DE737 - Chemotherapy
@activity: HIV.D28 Offer other services
@description: Invasive cervical cancer treatment method is a chemotherapy
*/
// TODO: Replace placeholder with relevant CQL logic
define "Chemotherapy":
  exists "Chemotherapy Condition"

define "Chemotherapy Condition":
  [Condition: Concepts."Chemotherapy"]

/* End of Chemotherapy */

/*
@dataElement: HIV.D.DE738 - Chemoradiation
@activity: HIV.D28 Offer other services
@description: Invasive cervical cancer treatment method is a chemoradiation
*/
// TODO: Replace placeholder with relevant CQL logic
define "Chemoradiation":
  exists "Chemoradiation Condition"

define "Chemoradiation Condition":
  [Condition: Concepts."Chemoradiation"]

/* End of Chemoradiation */

/*
@dataElement: HIV.D.DE739 - Other
@activity: HIV.D28 Offer other services
@description: Invasive cervical cancer treatment method is a not in list
*/
// TODO: Replace placeholder with relevant CQL logic
define "Other D.DE739":
  exists "Other D.DE739 Condition"

define "Other D.DE739 Condition":
  [Condition: Concepts."Other - HIV.D.DE739"]

/* End of Other D.DE739 */

/*
@dataElement: HIV.D.DE745 - Cervical cancer screening interval amongst WLHIV
@activity: HIV.D28 Offer other services
@description: Country-specific interval between cancer screenings amongst women living with HIV (typically 3 or 5 years)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Cervical cancer screening interval amongst WLHIV":
  [Observation: Concepts."Cervical cancer screening interval amongst WLHIV"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Cervical cancer screening interval amongst WLHIV Value":
  "Cervical cancer screening interval amongst WLHIV" O
  return O.value as Quantity
/* End of Cervical cancer screening interval amongst WLHIV */

/*
@dataElement: HIV.D.DE753 - Offer other clinical services
@activity: HIV.D28 Offer other services
@description: Other clinical services offered or referrals given to the client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Offer other clinical services D.DE753":
  exists "Offer other clinical services D.DE753 Observation"
define "Offer other clinical services D.DE753 Observation":
  [Observation: Concepts."Offer other clinical services - HIV.D.DE753"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Offer other clinical services D.DE753 */

/*
@dataElement: HIV.D.DE754 - Assessment and provision of vaccinations
@activity: HIV.D28 Offer other services
@description: Assessment and provision of vaccinations, such as for people from Key population member type, pregnant women and infants; and, where appropriate, tetanus vaccination for adolescent boys and men receiving VMMC
*/
// TODO: Replace placeholder with relevant CQL logic
define "Assessment and provision of vaccinations D.DE754":
  exists "Assessment and provision of vaccinations D.DE754 Condition"
    or exists "Assessment and provision of vaccinations D.DE754 Observation"
define "Assessment and provision of vaccinations D.DE754 Condition":
  [Condition: Concepts."Assessment and provision of vaccinations - HIV.D.DE754"]
define "Assessment and provision of vaccinations D.DE754 Observation":
  "Offer other clinical services D.DE753 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Assessment and provision of vaccinations - HIV.D.DE754"
/* End of Assessment and provision of vaccinations D.DE754 */

/*
@dataElement: HIV.D.DE755 - Hepatitis B HBV and hepatitis C virus HCV testing and treatment
@activity: HIV.D28 Offer other services
@description: Offer or refer for HBV and/or HCV testing and treatment
*/
// TODO: Replace placeholder with relevant CQL logic
define "Hepatitis B HBV and hepatitis C virus HCV testing and treatment":
  exists "Hepatitis B HBV and hepatitis C virus HCV testing and treatment Condition"
    or exists "Hepatitis B HBV and hepatitis C virus HCV testing and treatment Observation"
define "Hepatitis B HBV and hepatitis C virus HCV testing and treatment Condition":
  [Condition: Concepts."Hepatitis B HBV and hepatitis C virus HCV testing and treatment"]
define "Hepatitis B HBV and hepatitis C virus HCV testing and treatment Observation":
  "Offer other clinical services D.DE753 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Hepatitis B HBV and hepatitis C virus HCV testing and treatment"
/* End of Hepatitis B HBV and hepatitis C virus HCV testing and treatment */

/*
@dataElement: HIV.D.DE756 - Co-trimoxazole chemoprophylaxis to prevent pneumocystis carinii pneumonia
@activity: HIV.D28 Offer other services
@description: Offer or refer for co-trimoxazole chemoprophylaxis to prevent pneumocystis carinii pneumonia
*/
// TODO: Replace placeholder with relevant CQL logic
define "Co-trimoxazole chemoprophylaxis to prevent pneumocystis carinii pneumonia D.DE756":
  exists "Co-trimoxazole chemoprophylaxis to prevent pneumocystis carinii pneumonia D.DE756 Condition"
    or exists "Co-trimoxazole chemoprophylaxis to prevent pneumocystis carinii pneumonia D.DE756 Observation"
define "Co-trimoxazole chemoprophylaxis to prevent pneumocystis carinii pneumonia D.DE756 Condition":
  [Condition: Concepts."Co-trimoxazole chemoprophylaxis to prevent pneumocystis carinii pneumonia - HIV.D.DE756"]
define "Co-trimoxazole chemoprophylaxis to prevent pneumocystis carinii pneumonia D.DE756 Observation":
  "Offer other clinical services D.DE753 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Co-trimoxazole chemoprophylaxis to prevent pneumocystis carinii pneumonia - HIV.D.DE756"
/* End of Co-trimoxazole chemoprophylaxis to prevent pneumocystis carinii pneumonia D.DE756 */

/*
@dataElement: HIV.D.DE757 - Intensified TB case finding and linkage to TB treatment
@activity: HIV.D28 Offer other services
@description: Offer or refer for intensified TB case finding and linkage to TB treatment
*/
// TODO: Replace placeholder with relevant CQL logic
define "Intensified TB case finding and linkage to TB treatment D.DE757":
  exists "Intensified TB case finding and linkage to TB treatment D.DE757 Condition"
    or exists "Intensified TB case finding and linkage to TB treatment D.DE757 Observation"
define "Intensified TB case finding and linkage to TB treatment D.DE757 Condition":
  [Condition: Concepts."Intensified TB case finding and linkage to TB treatment - HIV.D.DE757"]
define "Intensified TB case finding and linkage to TB treatment D.DE757 Observation":
  "Offer other clinical services D.DE753 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Intensified TB case finding and linkage to TB treatment - HIV.D.DE757"
/* End of Intensified TB case finding and linkage to TB treatment D.DE757 */

/*
@dataElement: HIV.D.DE758 - Provision of isoniazid preventive therapy if person does not have TB
@activity: HIV.D28 Offer other services
@description: Offer or refer for provision of isoniazid preventive therapy if person does not have TB
*/
// TODO: Replace placeholder with relevant CQL logic
define "Provision of isoniazid preventive therapy if person does not have TB D.DE758":
  exists "Provision of isoniazid preventive therapy if person does not have TB D.DE758 Condition"
    or exists "Provision of isoniazid preventive therapy if person does not have TB D.DE758 Observation"
define "Provision of isoniazid preventive therapy if person does not have TB D.DE758 Condition":
  [Condition: Concepts."Provision of isoniazid preventive therapy if person does not have TB - HIV.D.DE758"]
define "Provision of isoniazid preventive therapy if person does not have TB D.DE758 Observation":
  "Offer other clinical services D.DE753 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Provision of isoniazid preventive therapy if person does not have TB - HIV.D.DE758"
/* End of Provision of isoniazid preventive therapy if person does not have TB D.DE758 */

/*
@dataElement: HIV.D.DE759 - Malaria prevention such as bed nets and prophylaxis, depending on epidemiology
@activity: HIV.D28 Offer other services
@description: Offer or refer for malaria prevention (such as bed nets and prophylaxis), depending on epidemiology
*/
// TODO: Replace placeholder with relevant CQL logic
define "Malaria prevention such as bed nets and prophylaxis, depending on epidemiology D.DE759":
  exists "Malaria prevention such as bed nets and prophylaxis, depending on epidemiology D.DE759 Condition"
    or exists "Malaria prevention such as bed nets and prophylaxis, depending on epidemiology D.DE759 Observation"
define "Malaria prevention such as bed nets and prophylaxis, depending on epidemiology D.DE759 Condition":
  [Condition: Concepts."Malaria prevention such as bed nets and prophylaxis, depending on epidemiology - HIV.D.DE759"]
define "Malaria prevention such as bed nets and prophylaxis, depending on epidemiology D.DE759 Observation":
  "Offer other clinical services D.DE753 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Malaria prevention such as bed nets and prophylaxis, depending on epidemiology - HIV.D.DE759"
/* End of Malaria prevention such as bed nets and prophylaxis, depending on epidemiology D.DE759 */

/*
@dataElement: HIV.D.DE760 - Eligible for DSD ART
@activity: HIV.D21 Determine regimen and treatment options
@description: Client is eligible for differentiated service delivery (DSD) for ART
*/

define "Eligible for DSD ART":
  [Observation: Concepts."Eligible for DSD ART"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value is true
/* End of Eligible for DSD ART */

/*
@dataElement: HIV.D.DE761 - Date DSD ART eligibility assessed
@activity: HIV.D21 Determine regimen and treatment options
@description: Date client was assessed for eligibility for differentiated service delivery (DSD) for ART
*/

define "Date DSD ART eligibility assessed":
  [Procedure: ConceptsCustom."DSD ART eligibility assessed"] P
    where P.status in { 'completed' }
  return P.performed.toInterval()
/* End of Date DSD ART eligibility assessed */

/*
@dataElement: HIV.D.DE762 - Currently enrolled in DSD ART model
@activity: HIV.D21 Determine regimen and treatment options
@description: Client currently enrolled in differentiated service delivery (DSD) ART model
*/

define "Currently enrolled in DSD ART model":
  [EpisodeOfCare] EOC
    where exists(EOC.type T where T ~ Concepts."Currently enrolled in DSD ART model")
  
/* End of Currently enrolled in DSD ART model */

/*
@dataElement: HIV.D.DE763 - DSD ART start date
@activity: HIV.D21 Determine regimen and treatment options
@description: Date client started on differentiated service delivery (DSD) for ART
*/

define "DSD ART start date":
  flatten{"DSD ART status","DSD ART statusHistory".statusHistory.period}

define "DSD ART status":
    [EpisodeOfCare] EOC
    where exists(EOC.type T where T ~ Concepts."Currently enrolled in DSD ART model")
      and EOC.status = 'finished'
    return EOC.period

define "DSD ART statusHistory":
    [EpisodeOfCare] EOC
    where exists(EOC.type T where T ~ Concepts."Currently enrolled in DSD ART model") 
    and (exists (
      EOC.statusHistory H
      where H.status = 'finished'
      and H.period is not null))
/* End of DSD ART start date */

/*
@dataElement: HIV.D.DE764 - DSD ART models
@activity: HIV.D21 Determine regimen and treatment options
@description: Type of DSD ART model client is enrolled in (country-specific)
*/

define "DSD ART models":
    [EpisodeOfCare] EOC
    where exists(EOC.type T where T ~ Concepts."DSD ART models")
/* End of DSD ART models */

/*
@dataElement: HIV.D.DE765 - Fast track ART refill
@activity: HIV.D21 Determine regimen and treatment options
@description: Client is enrolled in fast track ART refill (DSD ART model)
*/

define "Fast track ART refill":
    [EpisodeOfCare] EOC
    where exists(EOC.type T where T ~ Concepts."Fast track ART refill")
/* End of Fast track ART refill */

/*
@dataElement: HIV.D.DE766 - Facility adherence club
@activity: HIV.D21 Determine regimen and treatment options
@description: Client is enrolled in facility adherence club (DSD ART model)
*/

define "Facility adherence club":
    [EpisodeOfCare] EOC
    where exists(EOC.type T where T ~ Concepts."Facility adherence club")
/* End of Facility adherence club */

/*
@dataElement: HIV.D.DE767 - Community ART distribution point
@activity: HIV.D21 Determine regimen and treatment options
@description: Client is enrolled in community ART distribution point (DSD ART model)
*/

define "Community ART distribution point":
  [EpisodeOfCare] EOC
    where exists(EOC.type T where T ~ Concepts."Community ART distribution point")
/* End of Community ART distribution point */

/*
@dataElement: HIV.D.DE768 - CHW/peer educator community ART group
@activity: HIV.D21 Determine regimen and treatment options
@description: Client is enrolled in community health worker/peer educator community ART group (DSD ART model)
*/

define "CHW/peer educator community ART group":
  [EpisodeOfCare] EOC
    where exists(EOC.type T where T ~  Concepts."CHW/peer educator community ART group")
/* End of CHW/peer educator community ART group */

/*
@dataElement: HIV.D.DE769 - Patient/client community ART group
@activity: HIV.D21 Determine regimen and treatment options
@description: Client is enrolled in patient/client community ART group (DSD ART model)
*/

define "Patient/client community ART group":
  [EpisodeOfCare] EOC
    where exists(EOC.type T where T ~ Concepts."Patient/client community ART group")
/* End of Patient/client community ART group */

/*
@dataElement: HIV.D.DE770 - Other DSD ART model
@activity: HIV.D21 Determine regimen and treatment options
@description: Client is enrolled in another DSD ART model
*/

define "Other DSD ART model":
  [EpisodeOfCare] EOC
    where exists(EOC.type T where T ~ Concepts."Other DSD ART model")
/* End of Other DSD ART model */

/*
@dataElement: HIV.D.DE778 - Syndrome/STI diagnosed
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Syndrome or STI for which client is diagnosed
*/
// TODO: Replace placeholder with relevant CQL logic
define "Syndrome/STI diagnosed D.DE778":
  exists "Syndrome/STI diagnosed D.DE778 Observation"
define "Syndrome/STI diagnosed D.DE778 Observation":
  [Observation: Concepts."Syndrome/STI diagnosed - HIV.D.DE778"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Syndrome/STI diagnosed D.DE778 */

/*
@dataElement: HIV.D.DE779 - Urethral discharge syndrome
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Client diagnosed with urethral discharge syndrome
*/
// TODO: Replace placeholder with relevant CQL logic
define "Urethral discharge syndrome D.DE779":
  exists "Urethral discharge syndrome D.DE779 Condition"
    or exists "Urethral discharge syndrome D.DE779 Observation"
define "Urethral discharge syndrome D.DE779 Condition":
  [Condition: Concepts."Urethral discharge syndrome - HIV.D.DE779"]
define "Urethral discharge syndrome D.DE779 Observation":
  "Syndrome/STI diagnosed D.DE778 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Urethral discharge syndrome - HIV.D.DE779"
/* End of Urethral discharge syndrome D.DE779 */

/*
@dataElement: HIV.D.DE780 - Vaginal discharge syndrome
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Client diagnosed with vaginal discharge syndrome
*/
// TODO: Replace placeholder with relevant CQL logic
define "Vaginal discharge syndrome D.DE780":
  exists "Vaginal discharge syndrome D.DE780 Condition"
    or exists "Vaginal discharge syndrome D.DE780 Observation"
define "Vaginal discharge syndrome D.DE780 Condition":
  [Condition: Concepts."Vaginal discharge syndrome - HIV.D.DE780"]
define "Vaginal discharge syndrome D.DE780 Observation":
  "Syndrome/STI diagnosed D.DE778 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Vaginal discharge syndrome - HIV.D.DE780"
/* End of Vaginal discharge syndrome D.DE780 */

/*
@dataElement: HIV.D.DE781 - Lower Abdominal pain 
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Client diagnosed with lower abdominal pain
*/
// TODO: Replace placeholder with relevant CQL logic
define "Lower Abdominal pain D.DE781":
  exists "Lower Abdominal pain D.DE781 Condition"
    or exists "Lower Abdominal pain D.DE781 Observation"
define "Lower Abdominal pain D.DE781 Condition":
  [Condition: Concepts."Lower Abdominal pain  - HIV.D.DE781"]
define "Lower Abdominal pain D.DE781 Observation":
  "Syndrome/STI diagnosed D.DE778 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Lower Abdominal pain  - HIV.D.DE781"
/* End of Lower Abdominal pain D.DE781 */

/*
@dataElement: HIV.D.DE782 - Genital ulcer disease syndrome
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Client diagnosed with genital ulcer disease syndrome
*/
// TODO: Replace placeholder with relevant CQL logic
define "Genital ulcer disease syndrome D.DE782":
  exists "Genital ulcer disease syndrome D.DE782 Condition"
    or exists "Genital ulcer disease syndrome D.DE782 Observation"
define "Genital ulcer disease syndrome D.DE782 Condition":
  [Condition: Concepts."Genital ulcer disease syndrome - HIV.D.DE782"]
define "Genital ulcer disease syndrome D.DE782 Observation":
  "Syndrome/STI diagnosed D.DE778 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Genital ulcer disease syndrome - HIV.D.DE782"
/* End of Genital ulcer disease syndrome D.DE782 */

/*
@dataElement: HIV.D.DE783 - Anorectal discharge
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Client diagnosed with anorectal discharge
*/
// TODO: Replace placeholder with relevant CQL logic
define "Anorectal discharge D.DE783":
  exists "Anorectal discharge D.DE783 Condition"
    or exists "Anorectal discharge D.DE783 Observation"
define "Anorectal discharge D.DE783 Condition":
  [Condition: Concepts."Anorectal discharge - HIV.D.DE783"]
define "Anorectal discharge D.DE783 Observation":
  "Syndrome/STI diagnosed D.DE778 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Anorectal discharge - HIV.D.DE783"
/* End of Anorectal discharge D.DE783 */

/*
@dataElement: HIV.D.DE784 - Sent for testing
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Specimen sent for testing
*/
// TODO: Replace placeholder with relevant CQL logic
define "Sent for testing D.DE784":
  exists "Sent for testing D.DE784 Condition"
    or exists "Sent for testing D.DE784 Observation"
define "Sent for testing D.DE784 Condition":
  [Condition: Concepts."Sent for testing - HIV.D.DE784"]
define "Sent for testing D.DE784 Observation":
  "Syndrome/STI diagnosed D.DE778 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Sent for testing - HIV.D.DE784"
/* End of Sent for testing D.DE784 */

/*
@dataElement: HIV.D.DE785 - Other
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Other syndrome/STI diagnosed
*/
// TODO: Replace placeholder with relevant CQL logic
define "Other D.DE785":
  exists "Other D.DE785 Condition"
    or exists "Other D.DE785 Observation"
define "Other D.DE785 Condition":
  [Condition: Concepts."Other - HIV.D.DE785"]
define "Other D.DE785 Observation":
  "Syndrome/STI diagnosed D.DE778 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Other - HIV.D.DE785"
/* End of Other D.DE785 */

/*
@dataElement: HIV.D.DE787 - Any STI syndrome diagnosed
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Was the client diagnosed with any of the five STI syndromes during this visit?
*/
// TODO: Replace placeholder with relevant CQL logic
define "Any STI syndrome diagnosed D.DE787":
  exists "Any STI syndrome diagnosed D.DE787 Observation"
define "Any STI syndrome diagnosed D.DE787 Observation":
  [Observation: Concepts."Any STI syndrome diagnosed - HIV.D.DE787"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value is true
/* End of Any STI syndrome diagnosed D.DE787 */

/*
@dataElement: HIV.D.DE801 - Syphilis test date
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Date of syphilis test
*/
// TODO: Replace placeholder with relevant CQL logic
define "Syphilis test date D.DE801":
  [Observation: Concepts."Syphilis test date - HIV.D.DE801"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Syphilis test date D.DE801 Value":
  "Syphilis test date D.DE801" O
  return O.value as dateTime
/* End of Syphilis test date D.DE801 */

/*
@dataElement: HIV.D.DE802 - Syphilis test result
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Result from syphilis test
*/
// TODO: Replace placeholder with relevant CQL logic
define "Syphilis test result D.DE802":
  exists "Syphilis test result D.DE802 Observation"
define "Syphilis test result D.DE802 Observation":
  [Observation: Concepts."Syphilis test result - HIV.D.DE802"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Syphilis test result D.DE802 */

/*
@dataElement: HIV.D.DE803 - Positive
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Test result is positive for syphilis
*/
// TODO: Replace placeholder with relevant CQL logic
define "Positive D.DE803":
  exists "Positive D.DE803 Condition"
    or exists "Positive D.DE803 Observation"
define "Positive D.DE803 Condition":
  [Condition: Concepts."Positive - HIV.D.DE803"]
define "Positive D.DE803 Observation":
  "Syphilis test result D.DE802 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Positive - HIV.D.DE803"
/* End of Positive D.DE803 */

/*
@dataElement: HIV.D.DE804 - Negative
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Test result is negative for syphilis
*/
// TODO: Replace placeholder with relevant CQL logic
define "Negative D.DE804":
  exists "Negative D.DE804 Condition"
    or exists "Negative D.DE804 Observation"
define "Negative D.DE804 Condition":
  [Condition: Concepts."Negative - HIV.D.DE804"]
define "Negative D.DE804 Observation":
  "Syphilis test result D.DE802 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Negative - HIV.D.DE804"
/* End of Negative D.DE804 */

/*
@dataElement: HIV.D.DE805 - Inconclusive
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Test result is inconclusive
*/
// TODO: Replace placeholder with relevant CQL logic
define "Inconclusive D.DE805":
  exists "Inconclusive D.DE805 Condition"
    or exists "Inconclusive D.DE805 Observation"
define "Inconclusive D.DE805 Condition":
  [Condition: Concepts."Inconclusive - HIV.D.DE805"]
define "Inconclusive D.DE805 Observation":
  "Syphilis test result D.DE802 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Inconclusive - HIV.D.DE805"
/* End of Inconclusive D.DE805 */

/*
@dataElement: HIV.D.DE806 - Syphilis treatment start date
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Date of initiation of syphilis treatment
*/
// TODO: Replace placeholder with relevant CQL logic
define "Syphilis treatment start date D.DE806":
  [Observation: Concepts."Syphilis treatment start date - HIV.D.DE806"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Syphilis treatment start date D.DE806 Value":
  "Syphilis treatment start date D.DE806" O
  return O.value as dateTime
/* End of Syphilis treatment start date D.DE806 */

/*
@dataElement: HIV.D.DE807 - Gonorrhoea test date
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Date of Gonorrhoea test
*/
// TODO: Replace placeholder with relevant CQL logic
define "Gonorrhoea test date D.DE807":
  [Observation: Concepts."Gonorrhoea test date - HIV.D.DE807"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Gonorrhoea test date D.DE807 Value":
  "Gonorrhoea test date D.DE807" O
  return O.value as dateTime
/* End of Gonorrhoea test date D.DE807 */

/*
@dataElement: HIV.D.DE808 - Gonorrhoea test result
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Result from Gonorrhoea test
*/
// TODO: Replace placeholder with relevant CQL logic
define "Gonorrhoea test result D.DE808":
  exists "Gonorrhoea test result D.DE808 Observation"
define "Gonorrhoea test result D.DE808 Observation":
  [Observation: Concepts."Gonorrhoea test result - HIV.D.DE808"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Gonorrhoea test result D.DE808 */

/*
@dataElement: HIV.D.DE809 - Positive
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Test result is positive for Neisseria gonorrhoeae
*/
// TODO: Replace placeholder with relevant CQL logic
define "Positive D.DE809":
  exists "Positive D.DE809 Condition"
    or exists "Positive D.DE809 Observation"
define "Positive D.DE809 Condition":
  [Condition: Concepts."Positive - HIV.D.DE809"]
define "Positive D.DE809 Observation":
  "Gonorrhoea test result D.DE808 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Positive - HIV.D.DE809"
/* End of Positive D.DE809 */

/*
@dataElement: HIV.D.DE810 - Negative
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Test result is negative for Neisseria gonorrhoeae
*/
// TODO: Replace placeholder with relevant CQL logic
define "Negative D.DE810":
  exists "Negative D.DE810 Condition"
    or exists "Negative D.DE810 Observation"
define "Negative D.DE810 Condition":
  [Condition: Concepts."Negative - HIV.D.DE810"]
define "Negative D.DE810 Observation":
  "Gonorrhoea test result D.DE808 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Negative - HIV.D.DE810"
/* End of Negative D.DE810 */

/*
@dataElement: HIV.D.DE811 - Inconclusive
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Test result is inconclusive
*/
// TODO: Replace placeholder with relevant CQL logic
define "Inconclusive D.DE811":
  exists "Inconclusive D.DE811 Condition"
    or exists "Inconclusive D.DE811 Observation"
define "Inconclusive D.DE811 Condition":
  [Condition: Concepts."Inconclusive - HIV.D.DE811"]
define "Inconclusive D.DE811 Observation":
  "Gonorrhoea test result D.DE808 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Inconclusive - HIV.D.DE811"
/* End of Inconclusive D.DE811 */

/*
@dataElement: HIV.D.DE812 - Gonorrhoea treatment start date
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Date of initiation of Gonorrhoea treatment
*/
// TODO: Replace placeholder with relevant CQL logic
define "Gonorrhoea treatment start date D.DE812":
  [Observation: Concepts."Gonorrhoea treatment start date - HIV.D.DE812"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Gonorrhoea treatment start date D.DE812 Value":
  "Gonorrhoea treatment start date D.DE812" O
  return O.value as dateTime
/* End of Gonorrhoea treatment start date D.DE812 */

/*
@dataElement: HIV.D.DE813 - Type of specimen
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Type of specimen to be collected
*/
// TODO: Replace placeholder with relevant CQL logic
define "Type of specimen D.DE813":
  exists "Type of specimen D.DE813 Observation"
define "Type of specimen D.DE813 Observation":
  [Observation: Concepts."Type of specimen - HIV.D.DE813"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Type of specimen D.DE813 */

/*
@dataElement: HIV.D.DE814 - Blood
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Blood specimen to be collected
*/
// TODO: Replace placeholder with relevant CQL logic
define "Blood D.DE814":
  exists "Blood D.DE814 Condition"
    or exists "Blood D.DE814 Observation"
define "Blood D.DE814 Condition":
  [Condition: Concepts."Blood - HIV.D.DE814"]
define "Blood D.DE814 Observation":
  "Type of specimen D.DE813 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Blood - HIV.D.DE814"
/* End of Blood D.DE814 */

/*
@dataElement: HIV.D.DE815 - Urine
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Urine specimen to be collected
*/
// TODO: Replace placeholder with relevant CQL logic
define "Urine D.DE815":
  exists "Urine D.DE815 Condition"
    or exists "Urine D.DE815 Observation"
define "Urine D.DE815 Condition":
  [Condition: Concepts."Urine - HIV.D.DE815"]
define "Urine D.DE815 Observation":
  "Type of specimen D.DE813 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Urine - HIV.D.DE815"
/* End of Urine D.DE815 */

/*
@dataElement: HIV.D.DE816 - Cervical or vaginal swab
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Cervical or vaginal swab to be collected
*/
// TODO: Replace placeholder with relevant CQL logic
define "Cervical or vaginal swab D.DE816":
  exists "Cervical or vaginal swab D.DE816 Condition"
    or exists "Cervical or vaginal swab D.DE816 Observation"
define "Cervical or vaginal swab D.DE816 Condition":
  [Condition: Concepts."Cervical or vaginal swab - HIV.D.DE816"]
define "Cervical or vaginal swab D.DE816 Observation":
  "Type of specimen D.DE813 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Cervical or vaginal swab - HIV.D.DE816"
/* End of Cervical or vaginal swab D.DE816 */

/*
@dataElement: HIV.D.DE817 - Urethral or penile swab
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Urethral or penile swab to be collected
*/
// TODO: Replace placeholder with relevant CQL logic
define "Urethral or penile swab D.DE817":
  exists "Urethral or penile swab D.DE817 Condition"
    or exists "Urethral or penile swab D.DE817 Observation"
define "Urethral or penile swab D.DE817 Condition":
  [Condition: Concepts."Urethral or penile swab - HIV.D.DE817"]
define "Urethral or penile swab D.DE817 Observation":
  "Type of specimen D.DE813 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Urethral or penile swab - HIV.D.DE817"
/* End of Urethral or penile swab D.DE817 */

/*
@dataElement: HIV.D.DE818 - Rectal swab
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Rectal swab to be collected
*/
// TODO: Replace placeholder with relevant CQL logic
define "Rectal swab D.DE818":
  exists "Rectal swab D.DE818 Condition"
    or exists "Rectal swab D.DE818 Observation"
define "Rectal swab D.DE818 Condition":
  [Condition: Concepts."Rectal swab - HIV.D.DE818"]
define "Rectal swab D.DE818 Observation":
  "Type of specimen D.DE813 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Rectal swab - HIV.D.DE818"
/* End of Rectal swab D.DE818 */

/*
@dataElement: HIV.D.DE819 - Other
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Other specimen type to be collected
*/
// TODO: Replace placeholder with relevant CQL logic
define "Other D.DE819":
  exists "Other D.DE819 Condition"
    or exists "Other D.DE819 Observation"
define "Other D.DE819 Condition":
  [Condition: Concepts."Other - HIV.D.DE819"]
define "Other D.DE819 Observation":
  "Type of specimen D.DE813 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Other - HIV.D.DE819"
/* End of Other D.DE819 */

/*
@dataElement: HIV.D.DE828 - Neisseria gonorrhoeae test type
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Type of diagnostic test used for Neisseria gonorrhoeae
*/
// TODO: Replace placeholder with relevant CQL logic
define "Neisseria gonorrhoeae test type D.DE828":
  exists "Neisseria gonorrhoeae test type D.DE828 Observation"
define "Neisseria gonorrhoeae test type D.DE828 Observation":
  [Observation: Concepts."Neisseria gonorrhoeae test type - HIV.D.DE828"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Neisseria gonorrhoeae test type D.DE828 */

/*
@dataElement: HIV.D.DE829 - NAAT
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Nucleic Acid Amplification Test (NAAT) used
*/
// TODO: Replace placeholder with relevant CQL logic
define "NAAT D.DE829":
  exists "NAAT D.DE829 Condition"
    or exists "NAAT D.DE829 Observation"
define "NAAT D.DE829 Condition":
  [Condition: Concepts."NAAT - HIV.D.DE829"]
define "NAAT D.DE829 Observation":
  "Neisseria gonorrhoeae test type D.DE828 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."NAAT - HIV.D.DE829"
/* End of NAAT D.DE829 */

/*
@dataElement: HIV.D.DE830 - POC Test
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Point-of-care (POC) test used
*/
// TODO: Replace placeholder with relevant CQL logic
define "POC Test D.DE830":
  exists "POC Test D.DE830 Condition"
    or exists "POC Test D.DE830 Observation"
define "POC Test D.DE830 Condition":
  [Condition: Concepts."POC Test - HIV.D.DE830"]
define "POC Test D.DE830 Observation":
  "Neisseria gonorrhoeae test type D.DE828 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."POC Test - HIV.D.DE830"
/* End of POC Test D.DE830 */

/*
@dataElement: HIV.D.DE831 - Culture
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Culture test used
*/
// TODO: Replace placeholder with relevant CQL logic
define "Culture D.DE831":
  exists "Culture D.DE831 Condition"
    or exists "Culture D.DE831 Observation"
define "Culture D.DE831 Condition":
  [Condition: Concepts."Culture - HIV.D.DE831"]
define "Culture D.DE831 Observation":
  "Neisseria gonorrhoeae test type D.DE828 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Culture - HIV.D.DE831"
/* End of Culture D.DE831 */

/*
@dataElement: HIV.D.DE832 - Microscopy
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Microscopy test used
*/
// TODO: Replace placeholder with relevant CQL logic
define "Microscopy D.DE832":
  exists "Microscopy D.DE832 Condition"
    or exists "Microscopy D.DE832 Observation"
define "Microscopy D.DE832 Condition":
  [Condition: Concepts."Microscopy - HIV.D.DE832"]
define "Microscopy D.DE832 Observation":
  "Neisseria gonorrhoeae test type D.DE828 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Microscopy - HIV.D.DE832"
/* End of Microscopy D.DE832 */

/*
@dataElement: HIV.D.DE833 - Other
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Other type of test used
*/
// TODO: Replace placeholder with relevant CQL logic
define "Other D.DE833":
  exists "Other D.DE833 Condition"
    or exists "Other D.DE833 Observation"
define "Other D.DE833 Condition":
  [Condition: Concepts."Other - HIV.D.DE833"]
define "Other D.DE833 Observation":
  "Neisseria gonorrhoeae test type D.DE828 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Other - HIV.D.DE833"
/* End of Other D.DE833 */

/*
@dataElement: HIV.D.DE903 - Medication/drug
@activity: HIV.D21 Determine regimen and treatment options
@description: Current or considered medication/drug, for the purpose of determining drug interactions
*/
// TODO: Replace placeholder with relevant CQL logic
define "Medication/drug":
  exists "Medication/drug Observation"
define "Medication/drug Observation":
  [Observation: Concepts."Medication/drug"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Medication/drug */

/*
@dataElement: HIV.D.DE904 - Rifampicin
@activity: HIV.D21 Determine regimen and treatment options
@description: Rifampicin currently being taken by, or considered for, client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Rifampicin":
  exists "Rifampicin Condition"
    or exists "Rifampicin Observation"
define "Rifampicin Condition":
  [Condition: Concepts."Rifampicin"]
define "Rifampicin Observation":
  "Medication/drug Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Rifampicin"
/* End of Rifampicin */

/*
@dataElement: HIV.D.DE905 - Halofantrine
@activity: HIV.D21 Determine regimen and treatment options
@description: Halofantrine currently being taken by, or considered for, client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Halofantrine":
  exists "Halofantrine Condition"
    or exists "Halofantrine Observation"
define "Halofantrine Condition":
  [Condition: Concepts."Halofantrine"]
define "Halofantrine Observation":
  "Medication/drug Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Halofantrine"
/* End of Halofantrine */

/*
@dataElement: HIV.D.DE906 - Lovastatin
@activity: HIV.D21 Determine regimen and treatment options
@description: Lovastatin currently being taken by, or considered for, client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Lovastatin":
  exists "Lovastatin Condition"
    or exists "Lovastatin Observation"
define "Lovastatin Condition":
  [Condition: Concepts."Lovastatin"]
define "Lovastatin Observation":
  "Medication/drug Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Lovastatin"
/* End of Lovastatin */

/*
@dataElement: HIV.D.DE907 - Simvastatin
@activity: HIV.D21 Determine regimen and treatment options
@description: Simvastatin currently being taken by, or considered for, client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Simvastatin":
  exists "Simvastatin Condition"
    or exists "Simvastatin Observation"
define "Simvastatin Condition":
  [Condition: Concepts."Simvastatin"]
define "Simvastatin Observation":
  "Medication/drug Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Simvastatin"
/* End of Simvastatin */

/*
@dataElement: HIV.D.DE908 - Hormonal contraception
@activity: HIV.D21 Determine regimen and treatment options
@description: Hormonal contraception currently being taken by, or considered for, client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Hormonal contraception":
  exists "Hormonal contraception Condition"
    or exists "Hormonal contraception Observation"
define "Hormonal contraception Condition":
  [Condition: Concepts."Hormonal contraception"]
define "Hormonal contraception Observation":
  "Medication/drug Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Hormonal contraception"
/* End of Hormonal contraception */

/*
@dataElement: HIV.D.DE909 - Metformin
@activity: HIV.D21 Determine regimen and treatment options
@description: Metformin currently being taken by, or considered for, client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Metformin":
  exists "Metformin Condition"
    or exists "Metformin Observation"
define "Metformin Condition":
  [Condition: Concepts."Metformin"]
define "Metformin Observation":
  "Medication/drug Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Metformin"
/* End of Metformin */

/*
@dataElement: HIV.D.DE910 - Astemizole
@activity: HIV.D21 Determine regimen and treatment options
@description: Astemizole currently being taken by, or considered for, client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Astemizole":
  exists "Astemizole Condition"
    or exists "Astemizole Observation"
define "Astemizole Condition":
  [Condition: Concepts."Astemizole"]
define "Astemizole Observation":
  "Medication/drug Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Astemizole"
/* End of Astemizole */

/*
@dataElement: HIV.D.DE911 - Terfenadine
@activity: HIV.D21 Determine regimen and treatment options
@description: Terfenadine currently being taken by, or considered for, client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Terfenadine":
  exists "Terfenadine Condition"
    or exists "Terfenadine Observation"
define "Terfenadine Condition":
  [Condition: Concepts."Terfenadine"]
define "Terfenadine Observation":
  "Medication/drug Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Terfenadine"
/* End of Terfenadine */

/*
@dataElement: HIV.D.DE912 - TDF
@activity: HIV.D21 Determine regimen and treatment options
@description: TDF currently being taken by, or considered for, client
*/

define "TDF D.DE912":
  [MedicationStatement] MS
    where MS.medication ~ Concepts."TDF - HIV.D.DE912"

/* End of TDF D.DE912 */

/*
@dataElement: HIV.D.DE913 - Simeprevir
@activity: HIV.D21 Determine regimen and treatment options
@description: Simeprevir currently being taken by, or considered for, client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Simeprevir":
  exists "Simeprevir Condition"
    or exists "Simeprevir Observation"
define "Simeprevir Condition":
  [Condition: Concepts."Simeprevir"]
define "Simeprevir Observation":
  "Medication/drug Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Simeprevir"
/* End of Simeprevir */

/*
@dataElement: HIV.D.DE914 - Ombitasvir + paritaprevir/ritonavir + dasabuvir
@activity: HIV.D21 Determine regimen and treatment options
@description: Ombitasvir + paritaprevir/ritonavir + dasabuvir currently being taken by, or considered for, client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Ombitasvir + paritaprevir/ritonavir + dasabuvir":
  exists "Ombitasvir + paritaprevir/ritonavir + dasabuvir Condition"
    or exists "Ombitasvir + paritaprevir/ritonavir + dasabuvir Observation"
define "Ombitasvir + paritaprevir/ritonavir + dasabuvir Condition":
  [Condition: Concepts."Ombitasvir + paritaprevir/ritonavir + dasabuvir"]
define "Ombitasvir + paritaprevir/ritonavir + dasabuvir Observation":
  "Medication/drug Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Ombitasvir + paritaprevir/ritonavir + dasabuvir"
/* End of Ombitasvir + paritaprevir/ritonavir + dasabuvir */

/*
@dataElement: HIV.D.DE915 - Methadone
@activity: HIV.D21 Determine regimen and treatment options
@description: Methadone currently being taken by, or considered for, client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Methadone D.DE915":
  exists "Methadone D.DE915 Condition"
    or exists "Methadone D.DE915 Observation"
define "Methadone D.DE915 Condition":
  [Condition: Concepts."Methadone - HIV.D.DE915"]
define "Methadone D.DE915 Observation":
  "Medication/drug Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Methadone - HIV.D.DE915"
/* End of Methadone D.DE915 */

/*
@dataElement: HIV.D.DE916 - Buprenorphine
@activity: HIV.D21 Determine regimen and treatment options
@description: Buprenorphine currently being taken by, or considered for, client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Buprenorphine D.DE916":
  exists "Buprenorphine D.DE916 Condition"
    or exists "Buprenorphine D.DE916 Observation"
define "Buprenorphine D.DE916 Condition":
  [Condition: Concepts."Buprenorphine - HIV.D.DE916"]
define "Buprenorphine D.DE916 Observation":
  "Medication/drug Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Buprenorphine - HIV.D.DE916"
/* End of Buprenorphine D.DE916 */

/*
@dataElement: HIV.D.DE917 - Dofetilide
@activity: HIV.D21 Determine regimen and treatment options
@description: Dofetilide currently being taken by, or considered for, client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Dofetilide":
  exists "Dofetilide Condition"
    or exists "Dofetilide Observation"
define "Dofetilide Condition":
  [Condition: Concepts."Dofetilide"]
define "Dofetilide Observation":
  "Medication/drug Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Dofetilide"
/* End of Dofetilide */

/*
@dataElement: HIV.D.DE918 - Carbamazepine
@activity: HIV.D21 Determine regimen and treatment options
@description: Carbamazepine currently being taken by, or considered for, client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Carbamazepine":
  exists "Carbamazepine Condition"
    or exists "Carbamazepine Observation"
define "Carbamazepine Condition":
  [Condition: Concepts."Carbamazepine"]
define "Carbamazepine Observation":
  "Medication/drug Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Carbamazepine"
/* End of Carbamazepine */

/*
@dataElement: HIV.D.DE919 - Phenobarbital
@activity: HIV.D21 Determine regimen and treatment options
@description: Phenobarbital currently being taken by, or considered for, client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Phenobarbital":
  exists "Phenobarbital Condition"
    or exists "Phenobarbital Observation"
define "Phenobarbital Condition":
  [Condition: Concepts."Phenobarbital"]
define "Phenobarbital Observation":
  "Medication/drug Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Phenobarbital"
/* End of Phenobarbital */

/*
@dataElement: HIV.D.DE920 - Phenytoin
@activity: HIV.D21 Determine regimen and treatment options
@description: Phenytoin currently being taken by, or considered for, client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Phenytoin":
  exists "Phenytoin Condition"
    or exists "Phenytoin Observation"
define "Phenytoin Condition":
  [Condition: Concepts."Phenytoin"]
define "Phenytoin Observation":
  "Medication/drug Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Phenytoin"
/* End of Phenytoin */

/*
@dataElement: HIV.D.DE921 - Polyvalent cation products containing Mg, Al, Fe, Ca and Zn
@activity: HIV.D21 Determine regimen and treatment options
@description: Polyvalent cation products containing Mg, Al, Fe, Ca and Zn currently being taken by, or considered for, client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Polyvalent cation products containing Mg, Al, Fe, Ca and Zn":
  exists "Polyvalent cation products containing Mg, Al, Fe, Ca and Zn Condition"
    or exists "Polyvalent cation products containing Mg, Al, Fe, Ca and Zn Observation"
define "Polyvalent cation products containing Mg, Al, Fe, Ca and Zn Condition":
  [Condition: Concepts."Polyvalent cation products containing Mg, Al, Fe, Ca and Zn"]
define "Polyvalent cation products containing Mg, Al, Fe, Ca and Zn Observation":
  "Medication/drug Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Polyvalent cation products containing Mg, Al, Fe, Ca and Zn"
/* End of Polyvalent cation products containing Mg, Al, Fe, Ca and Zn */

/*
@dataElement: HIV.D.DE922 - Amodiaquine
@activity: HIV.D21 Determine regimen and treatment options
@description: Amodiaquine currently being taken by, or considered for, client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Amodiaquine":
  exists "Amodiaquine Condition"
    or exists "Amodiaquine Observation"
define "Amodiaquine Condition":
  [Condition: Concepts."Amodiaquine"]
define "Amodiaquine Observation":
  "Medication/drug Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Amodiaquine"
/* End of Amodiaquine */

/*
@dataElement: HIV.D.DE923 - Cisapride
@activity: HIV.D21 Determine regimen and treatment options
@description: Cisapride currently being taken by, or considered for, client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Cisapride":
  exists "Cisapride Condition"
    or exists "Cisapride Observation"
define "Cisapride Condition":
  [Condition: Concepts."Cisapride"]
define "Cisapride Observation":
  "Medication/drug Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Cisapride"
/* End of Cisapride */

/*
@dataElement: HIV.D.DE924 - Ergotamine
@activity: HIV.D21 Determine regimen and treatment options
@description: Ergotamine currently being taken by, or considered for, client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Ergotamine":
  exists "Ergotamine Condition"
    or exists "Ergotamine Observation"
define "Ergotamine Condition":
  [Condition: Concepts."Ergotamine"]
define "Ergotamine Observation":
  "Medication/drug Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Ergotamine"
/* End of Ergotamine */

/*
@dataElement: HIV.D.DE925 - Dihydroergotamine
@activity: HIV.D21 Determine regimen and treatment options
@description: Dihydroergotamine currently being taken by, or considered for, client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Dihydroergotamine":
  exists "Dihydroergotamine Condition"
    or exists "Dihydroergotamine Observation"
define "Dihydroergotamine Condition":
  [Condition: Concepts."Dihydroergotamine"]
define "Dihydroergotamine Observation":
  "Medication/drug Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Dihydroergotamine"
/* End of Dihydroergotamine */

/*
@dataElement: HIV.D.DE926 - Midazolam
@activity: HIV.D21 Determine regimen and treatment options
@description: Midazolam currently being taken by, or considered for, client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Midazolam":
  exists "Midazolam Condition"
    or exists "Midazolam Observation"
define "Midazolam Condition":
  [Condition: Concepts."Midazolam"]
define "Midazolam Observation":
  "Medication/drug Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Midazolam"
/* End of Midazolam */

/*
@dataElement: HIV.D.DE927 - Triazolam
@activity: HIV.D21 Determine regimen and treatment options
@description: Triazolam currently being taken by, or considered for, client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Triazolam":
  exists "Triazolam Condition"
    or exists "Triazolam Observation"
define "Triazolam Condition":
  [Condition: Concepts."Triazolam"]
define "Triazolam Observation":
  "Medication/drug Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Triazolam"
/* End of Triazolam */

/*
@dataElement: HIV.D.DE928 - Estrogen-based hormonal contraception
@activity: HIV.D21 Determine regimen and treatment options
@description: Estrogen-based hormonal contraception currently being taken by, or considered for, client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Estrogen-based hormonal contraception":
  exists "Estrogen-based hormonal contraception Condition"
    or exists "Estrogen-based hormonal contraception Observation"
define "Estrogen-based hormonal contraception Condition":
  [Condition: Concepts."Estrogen-based hormonal contraception"]
define "Estrogen-based hormonal contraception Observation":
  "Medication/drug Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Estrogen-based hormonal contraception"
/* End of Estrogen-based hormonal contraception */

/*
@dataElement: HIV.D.DE929 - Ribavirin
@activity: HIV.D21 Determine regimen and treatment options
@description: Ribavirin currently being taken by, or considered for, client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Ribavirin":
  exists "Ribavirin Condition"
    or exists "Ribavirin Observation"
define "Ribavirin Condition":
  [Condition: Concepts."Ribavirin"]
define "Ribavirin Observation":
  "Medication/drug Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Ribavirin"
/* End of Ribavirin */

/*
@dataElement: HIV.D.DE930 - Peginterferon alfa-2a
@activity: HIV.D21 Determine regimen and treatment options
@description: Peginterferon alfa-2a currently being taken by, or considered for, client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Peginterferon alfa-2a":
  exists "Peginterferon alfa-2a Condition"
    or exists "Peginterferon alfa-2a Observation"
define "Peginterferon alfa-2a Condition":
  [Condition: Concepts."Peginterferon alfa-2a"]
define "Peginterferon alfa-2a Observation":
  "Medication/drug Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Peginterferon alfa-2a"
/* End of Peginterferon alfa-2a */

/*
@dataElement: HIV.D.DE931 - Other
@activity: HIV.D21 Determine regimen and treatment options
@description: Other medication currently being taken by, or considered for, client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Other D.DE931":
  exists "Other D.DE931 Condition"
    or exists "Other D.DE931 Observation"
define "Other D.DE931 Condition":
  [Condition: Concepts."Other - HIV.D.DE931"]
define "Other D.DE931 Observation":
  "Medication/drug Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Other - HIV.D.DE931"
/* End of Other D.DE931 */

/*
@dataElement: HIV.D.DE933 - Medication change recommended
@activity: HIV.D21 Determine regimen and treatment options
@description: A medication change is recommended for the client based upon current or considered medications
*/
// TODO: Replace placeholder with relevant CQL logic
define "Medication change recommended":
  exists "Medication change recommended Observation"
define "Medication change recommended Observation":
  [Observation: Concepts."Medication change recommended"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value is true
/* End of Medication change recommended */

/*
@dataElement: HIV.D.DE934 - WHO HIV clinical stage condition or symptom
@activity: HIV.D15 Determine clinical stage of HIV
@description: New or recurrent clinical events used to categorize HIV disease severity based at baseline and follow up
*/
// TODO: Replace placeholder with relevant CQL logic
define "WHO HIV clinical stage condition or symptom D.DE934":
  exists "WHO HIV clinical stage condition or symptom D.DE934 Observation"
define "WHO HIV clinical stage condition or symptom D.DE934 Observation":
  [Observation: Concepts."WHO HIV clinical stage condition or symptom - HIV.D.DE934"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of WHO HIV clinical stage condition or symptom D.DE934 */

/*
@dataElement: HIV.D.DE935 - Pulmonary TB
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include pulmonary TB
*/
// TODO: Replace placeholder with relevant CQL logic
define "Pulmonary TB D.DE935":
  exists "Pulmonary TB D.DE935 Condition"
    or exists "Pulmonary TB D.DE935 Observation"
define "Pulmonary TB D.DE935 Condition":
  [Condition: Concepts."Pulmonary TB - HIV.D.DE935"]
define "Pulmonary TB D.DE935 Observation":
  "WHO HIV clinical stage condition or symptom D.DE934 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Pulmonary TB - HIV.D.DE935"
/* End of Pulmonary TB D.DE935 */

/*
@dataElement: HIV.D.DE936 - Lymph node TB
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include lymph node TB
*/
// TODO: Replace placeholder with relevant CQL logic
define "Lymph node TB D.DE936":
  exists "Lymph node TB D.DE936 Condition"
    or exists "Lymph node TB D.DE936 Observation"
define "Lymph node TB D.DE936 Condition":
  [Condition: Concepts."Lymph node TB - HIV.D.DE936"]
define "Lymph node TB D.DE936 Observation":
  "WHO HIV clinical stage condition or symptom D.DE934 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Lymph node TB - HIV.D.DE936"
/* End of Lymph node TB D.DE936 */

/*
@dataElement: HIV.D.DE937 - Extrapulmonary TB
@activity: HIV.D15 Determine clinical stage of HIV
@description: Client's symptoms include extrapulmonary tuberculosis (TB)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Extrapulmonary TB D.DE937":
  exists "Extrapulmonary TB D.DE937 Condition"
    or exists "Extrapulmonary TB D.DE937 Observation"
define "Extrapulmonary TB D.DE937 Condition":
  [Condition: Concepts."Extrapulmonary TB - HIV.D.DE937"]
define "Extrapulmonary TB D.DE937 Observation":
  "WHO HIV clinical stage condition or symptom D.DE934 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Extrapulmonary TB - HIV.D.DE937"
/* End of Extrapulmonary TB D.DE937 */

/*
@dataElement: HIV.D.DE939 - TB diagnosis result
@activity: HIV.D8 Capture or update client history
@description: Final result of the TB investigation (bacteriological and/or clinical)
*/

define "TB diagnosis result":
  [Observation: Concepts."TB diagnosis result"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of TB diagnosis result */

/*
@dataElement: HIV.D.DE940 - Diagnosed TB
@activity: HIV.D8 Capture or update client history
@description: Client is diagnosed with TB disease
*/

define "Diagnosed TB":
  "TB diagnosis result" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Diagnosed TB"
/* End of Diagnosed TB */

/*
@dataElement: HIV.D.DE941 - TB excluded
@activity: HIV.D8 Capture or update client history
@description: Client is not diagnosed with TB
*/

define "TB excluded":
  "TB diagnosis result" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."TB excluded"
/* End of TB excluded */

/*
@dataElement: HIV.D.DE945 - Presumptive TB
@activity: HIV.D8 Capture or update client history
@description: Client has signs or symptoms of tuberculosis (TB) without laboratory confirmation
*/

define "Presumptive TB D.DE945":
  "TB diagnosis result" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Presumptive TB - HIV.D.DE945"
/* End of Presumptive TB D.DE945 */

/*
@dataElement: HIV.D.DE952 - Date of TB diagnosis
@activity: HIV.D8 Capture or update client history
@description: The date when the diagnosis was established
*/

define "Date of TB diagnosis":
  [Observation: Concepts."Diagnosed TB"] C
  return C.effective.toInterval()
/* End of Date of TB diagnosis */

/*
@dataElement: HIV.D.DE954 - TB preventive treatment TPT start date
@activity: HIV.D8 Capture or update client history
@description: The date on which the client began taking TPT
*/
// TODO: Replace placeholder with relevant CQL logic
define "TB preventive treatment TPT start date":
  "TPT regimen" MS
  return start of MS.effective.toInterval()
  
/* End of TB preventive treatment TPT start date */

/*
@dataElement: HIV.D.DE956 - TB screening algorithm
@activity: HIV.D4 Screen for TB
@description: Screening algorithm selected for screening activities
*/
// TODO: Replace placeholder with relevant CQL logic
define "TB screening algorithm":
  exists "TB screening algorithm Observation"
define "TB screening algorithm Observation":
  [Observation: Concepts."TB screening algorithm"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of TB screening algorithm */

/*
@dataElement: HIV.D.DE957 - Screening with cough
@activity: HIV.D4 Screen for TB
@description: Client screened for TB based on cough symptom
*/
// TODO: Replace placeholder with relevant CQL logic
define "Screening with cough":
  exists "Screening with cough Condition"
    or exists "Screening with cough Observation"
define "Screening with cough Condition":
  [Condition: Concepts."Screening with cough"]
define "Screening with cough Observation":
  "TB screening algorithm Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Screening with cough"
/* End of Screening with cough */

/*
@dataElement: HIV.D.DE958 - Screening with any TB symptom
@activity: HIV.D4 Screen for TB
@description: Client screened for TB based on any TB symptom
*/
// TODO: Replace placeholder with relevant CQL logic
define "Screening with any TB symptom":
  exists "Screening with any TB symptom Condition"
    or exists "Screening with any TB symptom Observation"
define "Screening with any TB symptom Condition":
  [Condition: Concepts."Screening with any TB symptom"]
define "Screening with any TB symptom Observation":
  "TB screening algorithm Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Screening with any TB symptom"
/* End of Screening with any TB symptom */

/*
@dataElement: HIV.D.DE959 - W4SS single screening algorithm
@activity: HIV.D4 Screen for TB
@description: Client screened for TB based on the WHO-recommended four-symptom screen
*/
// TODO: Replace placeholder with relevant CQL logic
define "W4SS single screening algorithm":
  exists "W4SS single screening algorithm Condition"
    or exists "W4SS single screening algorithm Observation"
define "W4SS single screening algorithm Condition":
  [Condition: Concepts."W4SS single screening algorithm"]
define "W4SS single screening algorithm Observation":
  "TB screening algorithm Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."W4SS single screening algorithm"
/* End of W4SS single screening algorithm */

/*
@dataElement: HIV.D.DE960 - CRP single screening algorithm
@activity: HIV.D4 Screen for TB
@description: Client screened for TB based on C-reactive protein (CRP) testing
*/
// TODO: Replace placeholder with relevant CQL logic
define "CRP single screening algorithm":
  exists "CRP single screening algorithm Condition"
    or exists "CRP single screening algorithm Observation"
define "CRP single screening algorithm Condition":
  [Condition: Concepts."CRP single screening algorithm"]
define "CRP single screening algorithm Observation":
  "TB screening algorithm Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."CRP single screening algorithm"
/* End of CRP single screening algorithm */

/*
@dataElement: HIV.D.DE961 - CXR single screening algorithm
@activity: HIV.D4 Screen for TB
@description: Client screened for TB with a chest radiography (CXR)
*/
// TODO: Replace placeholder with relevant CQL logic
define "CXR single screening algorithm":
  exists "CXR single screening algorithm Condition"
    or exists "CXR single screening algorithm Observation"
define "CXR single screening algorithm Condition":
  [Condition: Concepts."CXR single screening algorithm"]
define "CXR single screening algorithm Observation":
  "TB screening algorithm Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."CXR single screening algorithm"
/* End of CXR single screening algorithm */

/*
@dataElement: HIV.D.DE962 - Parallel screening algorithm with W4SS and CRP
@activity: HIV.D4 Screen for TB
@description: Client screened for TB using parallel screening with WHO-recommended four-symptom screen and C-reactive protein (CRP) testing
*/
// TODO: Replace placeholder with relevant CQL logic
define "Parallel screening algorithm with W4SS and CRP":
  exists "Parallel screening algorithm with W4SS and CRP Condition"
    or exists "Parallel screening algorithm with W4SS and CRP Observation"
define "Parallel screening algorithm with W4SS and CRP Condition":
  [Condition: Concepts."Parallel screening algorithm with W4SS and CRP"]
define "Parallel screening algorithm with W4SS and CRP Observation":
  "TB screening algorithm Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Parallel screening algorithm with W4SS and CRP"
/* End of Parallel screening algorithm with W4SS and CRP */

/*
@dataElement: HIV.D.DE963 - Sequential positive screening algorithm with W4SS and CRP
@activity: HIV.D4 Screen for TB
@description: Client screened for TB using sequential positive screening with WHO-recommended four-symptom screen and C-reactive protein (CRP) testing.
*/
// TODO: Replace placeholder with relevant CQL logic
define "Sequential positive screening algorithm with W4SS and CRP":
  exists "Sequential positive screening algorithm with W4SS and CRP Condition"
    or exists "Sequential positive screening algorithm with W4SS and CRP Observation"
define "Sequential positive screening algorithm with W4SS and CRP Condition":
  [Condition: Concepts."Sequential positive screening algorithm with W4SS and CRP"]
define "Sequential positive screening algorithm with W4SS and CRP Observation":
  "TB screening algorithm Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Sequential positive screening algorithm with W4SS and CRP"
/* End of Sequential positive screening algorithm with W4SS and CRP */

/*
@dataElement: HIV.D.DE964 - Sequential negative screening algorithm with W4SS and CRP
@activity: HIV.D4 Screen for TB
@description: Client screened for TB using sequential negative screening with WHO-recommended four-symptom screen and C-reactive protein (CRP) testing
*/
// TODO: Replace placeholder with relevant CQL logic
define "Sequential negative screening algorithm with W4SS and CRP":
  exists "Sequential negative screening algorithm with W4SS and CRP Condition"
    or exists "Sequential negative screening algorithm with W4SS and CRP Observation"
define "Sequential negative screening algorithm with W4SS and CRP Condition":
  [Condition: Concepts."Sequential negative screening algorithm with W4SS and CRP"]
define "Sequential negative screening algorithm with W4SS and CRP Observation":
  "TB screening algorithm Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Sequential negative screening algorithm with W4SS and CRP"
/* End of Sequential negative screening algorithm with W4SS and CRP */

/*
@dataElement: HIV.D.DE965 - Parallel screening algorithm with W4SS and CXR
@activity: HIV.D4 Screen for TB
@description: Client screened for TB using the parallel screening algorithm with W4SS and CXR
*/
// TODO: Replace placeholder with relevant CQL logic
define "Parallel screening algorithm with W4SS and CXR":
  exists "Parallel screening algorithm with W4SS and CXR Condition"
    or exists "Parallel screening algorithm with W4SS and CXR Observation"
define "Parallel screening algorithm with W4SS and CXR Condition":
  [Condition: Concepts."Parallel screening algorithm with W4SS and CXR"]
define "Parallel screening algorithm with W4SS and CXR Observation":
  "TB screening algorithm Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Parallel screening algorithm with W4SS and CXR"
/* End of Parallel screening algorithm with W4SS and CXR */

/*
@dataElement: HIV.D.DE966 - Sequential positive screening algorithm with W4SS and CXR
@activity: HIV.D4 Screen for TB
@description: Client screened for TB using sequential positive screening with WHO-recommended four-symptom screen and chest radiography
*/
// TODO: Replace placeholder with relevant CQL logic
define "Sequential positive screening algorithm with W4SS and CXR":
  exists "Sequential positive screening algorithm with W4SS and CXR Condition"
    or exists "Sequential positive screening algorithm with W4SS and CXR Observation"
define "Sequential positive screening algorithm with W4SS and CXR Condition":
  [Condition: Concepts."Sequential positive screening algorithm with W4SS and CXR"]
define "Sequential positive screening algorithm with W4SS and CXR Observation":
  "TB screening algorithm Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Sequential positive screening algorithm with W4SS and CXR"
/* End of Sequential positive screening algorithm with W4SS and CXR */

/*
@dataElement: HIV.D.DE967 - Sequential negative screening algorithm with W4SS and CXR
@activity: HIV.D4 Screen for TB
@description: Client screened for TB using sequential negative screening with WHO-recommended four-symptom screen and chest radiography
*/
// TODO: Replace placeholder with relevant CQL logic
define "Sequential negative screening algorithm with W4SS and CXR":
  exists "Sequential negative screening algorithm with W4SS and CXR Condition"
    or exists "Sequential negative screening algorithm with W4SS and CXR Observation"
define "Sequential negative screening algorithm with W4SS and CXR Condition":
  [Condition: Concepts."Sequential negative screening algorithm with W4SS and CXR"]
define "Sequential negative screening algorithm with W4SS and CXR Observation":
  "TB screening algorithm Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Sequential negative screening algorithm with W4SS and CXR"
/* End of Sequential negative screening algorithm with W4SS and CXR */

/*
@dataElement: HIV.D.DE968 - Screening with mWRD
@activity: HIV.D4 Screen for TB
@description: Client screened for TB with a molecular WHO-recommended rapid diagnostic test (mWRD), such as an Xpert MTB/RIF test to detect Mycobacterium tuberculosis (MTB)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Screening with mWRD":
  exists "Screening with mWRD Condition"
    or exists "Screening with mWRD Observation"
define "Screening with mWRD Condition":
  [Condition: Concepts."Screening with mWRD"]
define "Screening with mWRD Observation":
  "TB screening algorithm Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Screening with mWRD"
/* End of Screening with mWRD */

/*
@dataElement: HIV.D.DE969 - Clinical assessment
@activity: HIV.D4 Screen for TB
@description: Client screened for with a clinical evaluation for tuberculosis (TB) based on national guidelines. Clinical assessment may be used as an eligibility evaluation for testing with LF-LAM or for empiric TB treatment.
*/
// TODO: Replace placeholder with relevant CQL logic
define "Clinical assessment":
  exists "Clinical assessment Condition"
    or exists "Clinical assessment Observation"
define "Clinical assessment Condition":
  [Condition: Concepts."Clinical assessment"]
define "Clinical assessment Observation":
  "TB screening algorithm Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Clinical assessment"
/* End of Clinical assessment */

/*
@dataElement: HIV.D.DE970 - Other TB screening algorithm
@activity: HIV.D4 Screen for TB
@description: Client screened for tuberculosis (TB) with a different screening method not listed
*/
// TODO: Replace placeholder with relevant CQL logic
define "Other TB screening algorithm":
  exists "Other TB screening algorithm Condition"
    or exists "Other TB screening algorithm Observation"
define "Other TB screening algorithm Condition":
  [Condition: Concepts."Other TB screening algorithm"]
define "Other TB screening algorithm Observation":
  "TB screening algorithm Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Other TB screening algorithm"
/* End of Other TB screening algorithm */

/*
@dataElement: HIV.D.DE973 - Symptoms of TB
@activity: HIV.D4 Screen for TB
@description: Symptoms that may indicate TB disease in clients living with HIV, based on a clinical algorithm
*/
// TODO: Replace placeholder with relevant CQL logic
define "Symptoms of TB":
  exists "Symptoms of TB Observation"
define "Symptoms of TB Observation":
  [Observation: Concepts."Symptoms of TB"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Symptoms of TB */

/*
@dataElement: HIV.D.DE974 - Current cough
@activity: HIV.D4 Screen for TB
@description: Client has a cough regardless of duration
*/
// TODO: Replace placeholder with relevant CQL logic
define "Current cough":
  exists "Current cough Condition"
    or exists "Current cough Observation"
define "Current cough Condition":
  [Condition: Concepts."Current cough"]
define "Current cough Observation":
  "Symptoms of TB Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Current cough"
/* End of Current cough */

/*
@dataElement: HIV.D.DE975 - Prolonged cough >=2w
@activity: HIV.D4 Screen for TB
@description: Client has a prolonged cough of 2 weeks or more
*/
// TODO: Replace placeholder with relevant CQL logic
define "Prolonged cough >=2w":
  exists "Prolonged cough >=2w Condition"
    or exists "Prolonged cough >=2w Observation"
define "Prolonged cough >=2w Condition":
  [Condition: Concepts."Prolonged cough >=2w"]
define "Prolonged cough >=2w Observation":
  "Symptoms of TB Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Prolonged cough >=2w"
/* End of Prolonged cough >=2w */

/*
@dataElement: HIV.D.DE976 - Fever of 39 °C or greater
@activity: HIV.D4 Screen for TB
@description: Client has a fever with a measured temperature of 102.2 °F/39 °C or greater
*/
// TODO: Replace placeholder with relevant CQL logic
define "Fever of 39 °C or greater":
  exists "Fever of 39 °C or greater Condition"
    or exists "Fever of 39 °C or greater Observation"
define "Fever of 39 °C or greater Condition":
  [Condition: Concepts."Fever of 39 °C or greater"]
define "Fever of 39 °C or greater Observation":
  "Symptoms of TB Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Fever of 39 °C or greater"
/* End of Fever of 39 °C or greater */

/*
@dataElement: HIV.D.DE977 - Weight loss reported
@activity: HIV.D4 Screen for TB
@description: Unexplained weight loss
*/
// TODO: Replace placeholder with relevant CQL logic
define "Weight loss reported":
  exists "Weight loss reported Condition"
    or exists "Weight loss reported Observation"
define "Weight loss reported Condition":
  [Condition: Concepts."Weight loss reported"]
define "Weight loss reported Observation":
  "Symptoms of TB Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Weight loss reported"
/* End of Weight loss reported */

/*
@dataElement: HIV.D.DE978 - Night sweats
@activity: HIV.D4 Screen for TB
@description: Client reports experiencing night sweats
*/
// TODO: Replace placeholder with relevant CQL logic
define "Night sweats":
  exists "Night sweats Condition"
    or exists "Night sweats Observation"
define "Night sweats Condition":
  [Condition: Concepts."Night sweats"]
define "Night sweats Observation":
  "Symptoms of TB Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Night sweats"
/* End of Night sweats */

/*
@dataElement: HIV.D.DE979 - Poor weight gain
@activity: HIV.D4 Screen for TB
@description: Client reports poor weight gain of child or infant or growth curve flattening or weight for age <-2 Z-scores.
*/
// TODO: Replace placeholder with relevant CQL logic
define "Poor weight gain":
  exists "Poor weight gain Condition"
    or exists "Poor weight gain Observation"
define "Poor weight gain Condition":
  [Condition: Concepts."Poor weight gain"]
define "Poor weight gain Observation":
  "Symptoms of TB Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Poor weight gain"
/* End of Poor weight gain */

/*
@dataElement: HIV.D.DE980 - Reduced playfulness
@activity: HIV.D4 Screen for TB
@description: Client reports reduced playfulness of child
*/
// TODO: Replace placeholder with relevant CQL logic
define "Reduced playfulness":
  exists "Reduced playfulness Condition"
    or exists "Reduced playfulness Observation"
define "Reduced playfulness Condition":
  [Condition: Concepts."Reduced playfulness"]
define "Reduced playfulness Observation":
  "Symptoms of TB Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Reduced playfulness"
/* End of Reduced playfulness */

/*
@dataElement: HIV.D.DE981 - Chest pain
@activity: HIV.D4 Screen for TB
@description: Client reports chest pain
*/
// TODO: Replace placeholder with relevant CQL logic
define "Chest pain":
  exists "Chest pain Condition"
    or exists "Chest pain Observation"
define "Chest pain Condition":
  [Condition: Concepts."Chest pain"]
define "Chest pain Observation":
  "Symptoms of TB Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Chest pain"
/* End of Chest pain */

/*
@dataElement: HIV.D.DE982 - Haemoptysis
@activity: HIV.D4 Screen for TB
@description: Client reports experiencing haemoptysis
*/
// TODO: Replace placeholder with relevant CQL logic
define "Haemoptysis":
  exists "Haemoptysis Condition"
    or exists "Haemoptysis Observation"
define "Haemoptysis Condition":
  [Condition: Concepts."Haemoptysis"]
define "Haemoptysis Observation":
  "Symptoms of TB Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Haemoptysis"
/* End of Haemoptysis */

/*
@dataElement: HIV.D.DE983 - Lethargy
@activity: HIV.D4 Screen for TB
@description: Client reports lethargy
*/
// TODO: Replace placeholder with relevant CQL logic
define "Lethargy D.DE983":
  exists "Lethargy D.DE983 Condition"
    or exists "Lethargy D.DE983 Observation"
define "Lethargy D.DE983 Condition":
  [Condition: Concepts."Lethargy - HIV.D.DE983"]
define "Lethargy D.DE983 Observation":
  "Symptoms of TB Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Lethargy - HIV.D.DE983"
/* End of Lethargy D.DE983 */

/*
@dataElement: HIV.D.DE984 - None
@activity: HIV.D4 Screen for TB
@description: No symptoms of TB identified
*/
// TODO: Replace placeholder with relevant CQL logic
define "None":
  exists "None Condition"
    or exists "None Observation"
define "None Condition":
  [Condition: Concepts."None"]
define "None Observation":
  "Symptoms of TB Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."None"
/* End of None */

/*
@dataElement: HIV.D.DE985 - History of contact with a person with TB
@activity: HIV.D4 Screen for TB
@description: Client had a history of a contact with a person with TB
*/
// TODO: Replace placeholder with relevant CQL logic
define "History of contact with a person with TB":
  exists "History of contact with a person with TB Observation"
define "History of contact with a person with TB Observation":
  [Observation: Concepts."History of contact with a person with TB"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value is true
/* End of History of contact with a person with TB */

/*
@dataElement: HIV.D.DE986 - TB screening result
@activity: HIV.D4 Screen for TB
@description: Record the result of the tuberculosis (TB) screening
*/

define "TB screening result":
  [Observation: Concepts."TB screening result"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of TB screening result */

/*
@dataElement: HIV.D.DE987 - Screen positive for TB
@activity: HIV.D4 Screen for TB
@description: Screening result was positive for tuberculosis (TB)
*/

define "Screen positive for TB":
  "TB screening result" O
  where O.value ~ Concepts."Screen positive for TB"
/* End of Screen positive for TB */

/*
@dataElement: HIV.D.DE988 - Screen negative for TB
@activity: HIV.D4 Screen for TB
@description: Screening result was negative for tuberculosis (TB)
*/

define "Screen negative for TB":
  "TB screening result" O
  where O.value ~ Concepts."Screen negative for TB"
/* End of Screen negative for TB */

/*
@dataElement: HIV.D.DE989 - Inconclusive
@activity: HIV.D4 Screen for TB
@description: Screening result was inconclusive for tuberculosis (TB)
*/

define "Inconclusive D.DE989":
  "TB screening result" O
  where O.value ~ Concepts."Inconclusive - HIV.D.DE989"
/* End of Inconclusive D.DE989 */

/*
@dataElement: HIV.D.DE990 - TB screening date
@activity: HIV.D4 Screen for TB
@description: Date the TB screening was conducted
*/

define "TB screening date":
  [Procedure] P
  where P.status = 'completed'
  and P.category ~ Concepts."TB diagnostic test category"
/* End of TB screening date */

/*
@dataElement: HIV.D.DE992 - TB diagnostic test category
@activity: HIV.D4 Screen for TB
@description: The type of diagnostic test performed to detect tuberculosis (TB) disease
*/

define "TB diagnostic test category":
  [Procedure] P
  where P.status = 'completed'
  and P.category ~ Concepts."TB diagnostic test category"
/* End of TB diagnostic test category */

/*
@dataElement: HIV.D.DE993 - LF-LAM
@activity: HIV.D4 Screen for TB
@description: Client tested for tuberculosis with a lateral flow urine lipoarabinomannan assay
*/

define "LF-LAM":
  "TB diagnostic test category" P
  where P.code ~ Concepts."LF-LAM"
/* End of LF-LAM */

/*
@dataElement: HIV.D.DE994 - mWRD test for TB
@activity: HIV.D4 Screen for TB
@description: Client tested with a WHO-recommended molecular diagnostic test to detect Mycobacterium tuberculosis (MTB)
*/

define "mWRD test for TB":
  "TB diagnostic test category" P
  where P.code ~ Concepts."mWRD test for TB"
/* End of mWRD test for TB */

/*
@dataElement: HIV.D.DE995 - Microscopy - Sputum acid-fast bacilli AFB
@activity: HIV.D4 Screen for TB
@description: Client tested for tuberculosis with a sputum acid-fast bacilli (AFB)
*/

define "Microscopy - Sputum acid-fast bacilli AFB":
  "TB diagnostic test category" P
  where P.code ~ Concepts."Microscopy - Sputum acid-fast bacilli AFB"
/* End of Microscopy - Sputum acid-fast bacilli AFB */

/*
@dataElement: HIV.D.DE996 - TB Culture
@activity: HIV.D4 Screen for TB
@description: Client tested for tuberculosis (TB) with a culture
*/

define "TB Culture":
  "TB diagnostic test category" P
  where P.code ~ Concepts."TB Culture"
/* End of TB Culture */

/*
@dataElement: HIV.D.DE997 - TB diagnostic test date
@activity: HIV.D4 Screen for TB
@description: The date when TB diagnostic test was performed
*/

define "TB diagnostic test date":
  "TB diagnostic test category" P
     return (start of P.performed.toInterval())
/* End of TB diagnostic test date */

/*
@dataElement: HIV.D.DE1001 - TB treatment start date
@activity: HIV.D8 Capture or update client history
@description: The date on which the client start or restarted tuberculosis (TB) treatment
*/

define "TB treatment start date":
  [MedicationStatement] MS
    where exists(MS.reasonCode C where C ~ ConceptsCustom."tb treatment")
    return (start of MS.effective.toInterval())
/* End of TB treatment start date */

/*
@dataElement: HIV.D.DE1017 - Eligible for TB preventive treatment
@activity: HIV.D14 Prevent, screen, and manage comorbidities and coinfections
@description: Client is eligible for tuberculosis preventive treatment (TPT)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Eligible for TB preventive treatment":
  exists "Eligible for TB preventive treatment Observation"
define "Eligible for TB preventive treatment Observation":
  [Observation: Concepts."Eligible for TB preventive treatment"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value is true
/* End of Eligible for TB preventive treatment */

/*
@dataElement: HIV.D.DE1023 - TB prevention services accepted
@activity: HIV.D21 Determine regimen and treatment options
@description: Indicates if the client accepts to be evaluated for TB infection and to take the treatment in case he/she is eligible
*/
// TODO: Replace placeholder with relevant CQL logic
define "TB prevention services accepted":
  exists "TB prevention services accepted Observation"
define "TB prevention services accepted Observation":
  [Observation: Concepts."TB prevention services accepted"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value is true
/* End of TB prevention services accepted */

/*
@dataElement: HIV.D.DE1026 - C reactive protein test result
@activity: HIV.D4 Screen for TB
@description: Test result of the client's C reactive protein test result in mg/L
*/
// TODO: Replace placeholder with relevant CQL logic
define "C reactive protein test result":
  [Observation: Concepts."C reactive protein test result"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "C reactive protein test result Value":
  "C reactive protein test result" O
  return O.value as Quantity
/* End of C reactive protein test result */

/*
@dataElement: HIV.D.DE1028 - TPT regimen type
@activity: HIV.D4 Screen for TB
@description: Type of TPT regimen the client is currently on
*/
define "TPT regimen":
  [MedicationStatement: Concepts."TPT regimen type Choices"] MS
    where MS.status in { 'active', 'completed' }

define "TPT regimen type":
  "TPT regimen" MS
  return Common.ExtractMedicationCode(MS.medication)
/* End of TPT regimen type */

/*
@dataElement: HIV.D.DE1034 - TB preventive treatment TPT status
@activity: HIV.D4 Screen for TB
@description: Indicates the current status of TB preventive treatment (TPT)
*/
// TODO: Replace placeholder with relevant CQL logic
define "TB preventive treatment TPT status":
  exists "TB preventive treatment TPT status Observation"
define "TB preventive treatment TPT status Observation":
  [Observation: Concepts."TB preventive treatment TPT status"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of TB preventive treatment TPT status */

/*
@dataElement: HIV.D.DE1035 - Not started
@activity: HIV.D4 Screen for TB
@description: The client did not start the TB preventive treatment (TPT)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Not started":
  exists "Not started Condition"
    or exists "Not started Observation"
define "Not started Condition":
  [Condition: Concepts."Not started"]
define "Not started Observation":
  "TB preventive treatment TPT status Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Not started"
/* End of Not started */

/*
@dataElement: HIV.D.DE1036 - On TPT
@activity: HIV.D4 Screen for TB
@description: The client started the TB preventive treatment (TPT) and is currently taking the medication, without treatment interruptions
*/
// TODO: Replace placeholder with relevant CQL logic
define "On TPT":
  exists "On TPT Condition"
    or exists "On TPT Observation"
define "On TPT Condition":
  [Condition: Concepts."On TPT"]
define "On TPT Observation":
  "TB preventive treatment TPT status Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."On TPT"
/* End of On TPT */

/*
@dataElement: HIV.D.DE1037 - On TPT with interruptions
@activity: HIV.D4 Screen for TB
@description: The client started the TB preventive treatment (TPT) and is currently taking the medication, with treatment interruptions
*/
// TODO: Replace placeholder with relevant CQL logic
define "On TPT with interruptions":
  exists "On TPT with interruptions Condition"
    or exists "On TPT with interruptions Observation"
define "On TPT with interruptions Condition":
  [Condition: Concepts."On TPT with interruptions"]
define "On TPT with interruptions Observation":
  "TB preventive treatment TPT status Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."On TPT with interruptions"
/* End of On TPT with interruptions */

/*
@dataElement: HIV.D.DE1038 - On hold
@activity: HIV.D4 Screen for TB
@description: The health care worker has temporarily stopped the TB preventive treatment (TPT), but TPT is expected to continue again later. May also be called 'suspended'.
*/
// TODO: Replace placeholder with relevant CQL logic
define "On hold":
  exists "On hold Condition"
    or exists "On hold Observation"
define "On hold Condition":
  [Condition: Concepts."On hold"]
define "On hold Observation":
  "TB preventive treatment TPT status Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."On hold"
/* End of On hold */

/*
@dataElement: HIV.D.DE1039 - Completed
@activity: HIV.D4 Screen for TB
@description: TB preventive treatment (TPT) was completed
*/
// TODO: Replace placeholder with relevant CQL logic
define "Completed":
  exists "Completed Condition"
    or exists "Completed Observation"
define "Completed Condition":
  [Condition: Concepts."Completed"]
define "Completed Observation":
  "TB preventive treatment TPT status Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Completed"
/* End of Completed */

/*
@dataElement: HIV.E.DE41 - Timing of ART initiation
@activity: HIV.E1 Capture or update mother's history
@description: When the pregnant woman or mother initiated ART, for women living with HIV.
*/
// TODO: Replace placeholder with relevant CQL logic
define "Timing of ART initiation":
  exists "Timing of ART initiation Observation"
define "Timing of ART initiation Observation":
  [Observation: Concepts."Timing of ART initiation"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Timing of ART initiation */

/*
@dataElement: HIV.E.DE42 - Already on ART at first antenatal care visit
@activity: HIV.E1 Capture or update mother's history
@description: The pregnant woman was already on antiretroviral therapy (ART) at first antenatal care visit
*/

define "Already on ART at first antenatal care visit":
  "Timing of ART initiation Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Already on ART at first antenatal care visit"
/* End of Already on ART at first antenatal care visit */

/*
@dataElement: HIV.E.DE43 - Newly on ART during pregnancy
@activity: HIV.E1 Capture or update mother's history
@description: The pregnant woman started ART during her pregnancy
*/

define "Newly on ART during pregnancy":
  "Timing of ART initiation Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Newly on ART during pregnancy"
/* End of Newly on ART during pregnancy */

/*
@dataElement: HIV.E.DE44 - Newly on ART during labour and delivery
@activity: HIV.E1 Capture or update mother's history
@description: The woman started ART during labour and delivery
*/

define "Newly on ART during labour and delivery":
  "Timing of ART initiation Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Newly on ART during labour and delivery"
/* End of Newly on ART during labour and delivery */

/*
@dataElement: HIV.E.DE46 - Delivery date
@activity: HIV.E1 Capture or update mother's history
@description: Date on which the woman delivered
*/
define "Live Birth Delivery":
  [Observation: Concepts."Live birth"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Delivery date":
  "Live Birth Delivery" O
  return start of O.effective.toInterval()
/* End of Delivery date */

/*
@dataElement: HIV.E.DE67 - Place of delivery
@activity: HIV.E1 Capture or update mother's history
@description: The type of place where the woman delivered
*/

define "Place of delivery":
  [Observation: Concepts."Place of delivery"] O
    where O.status in { 'final', 'amended', 'corrected' }
    and O.value is not null

/* End of Place of delivery */

/*
@dataElement: HIV.E.DE68 - Health facility
@activity: HIV.E1 Capture or update mother's history
@description: The woman delivered at a health facility
*/

define "Health facility":
  "Place of delivery" O
  with [Location] L
      such that O.value is FHIR.Reference and O.subject.reference = L.id
      and L.physicalType ~ Concepts."Health facility"
      
/* End of Health facility */

/*
@dataElement: HIV.E.DE69 - Home
@activity: HIV.E1 Capture or update mother's history
@description: The woman delivered at home
*/

define "Home":
  "Place of delivery" O
  with [Location] L
      such that O.subject.references(L) 
      and L.physicalType ~ Concepts."Home"
      
/* End of Home */

/*
@dataElement: HIV.E.DE70 - Other
@activity: HIV.E1 Capture or update mother's history
@description: The woman delivered at another location that is not at home or at a health facility
*/

define "Other E.DE70":
  "Place of delivery" O
  with [Location] L
      such that O.subject.references(L) 
      and L.physicalType ~ Concepts."Other - HIV.E.DE70"
/* End of Other E.DE70 */

/*
@dataElement: HIV.E.DE85 - ANC contact date
@activity: HIV.E1 Capture or update mother's history
@description: The date and time of the client's ANC contact (in the ANC DAK this is called 'Contact date')
*/

define "Antenatal care contact":
  [Encounter] E
    where E.type.coding.code contains ConceptsCustom."Antenatal care contact".code

define "ANC contact date E.DE85":
  "Antenatal care contact" E
  return E.period.toInterval()
/* End of ANC contact date E.DE85 */

/*
@dataElement: HIV.E.DE87 - Infant date of birth
@activity: HIV.E1 Capture or update mother's history
@description: The infant's date of birth (DOB) if known
*/
// TODO: Replace placeholder with relevant CQL logic
define "Infant date of birth":
  [Observation: Concepts."Infant date of birth"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Infant date of birth Value":
  "Infant date of birth" O
  return O.value as dateTime
/* End of Infant date of birth */

/*
@dataElement: HIV.E.DE90 - Age of infant
@activity: HIV.E1 Capture or update mother's history
@description: Infant age calculated using date of birth
*/
define "Age of infant in days":
  "Infant date of birth" O
    return CalculateAgeInDays(O.value)

define "Age of infant in hours":
  "Infant date of birth" O
    return CalculateAgeInHours(O.value)

define "Age of infant in weeks":
  "Infant date of birth" O
    return CalculateAgeInWeeks(O.value)

define "Age of infant in years":
  "Infant date of birth" O
    return CalculateAgeInYears(O.value)
    
/* End of Age of infant */

/*
@dataElement: HIV.E.DE112 - HIV-exposed infant or child
@activity: HIV.F6 Check whether infant/child had HIV exposure
@description: Whether the infant or child was determined to have had HIV exposure
*/
define "HIV-exposed infant or child E.DE112":

  [Observation: Concepts."HIV-exposed infant or child - HIV.E.DE112"] O
    where O.status in { 'final', 'amended', 'corrected' }

/* End of HIV-exposed infant or child E.DE112 */

/*
@dataElement: HIV.E.DE113 - Key population member
@activity: HIV.E1 Capture or update mother's history
@description: Mother is a member of a key population which has an increased risk of HIV
*/
define "RelatedPersonMother":
  [RelatedPerson] R
    where ConceptsCustom."Mother" in R.relationship.coding

define "Mother": singleton from "RelatedPersonMother"

define "Is Key population member E.DE113":
  exists "Key population member E.DE113 Observation"

define "Key population member E.DE113 Observation":
  [Observation: Concepts."Key population member - HIV.E.DE113"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value is true
/* End of Key population member E.DE113 */

/*
@dataElement: HIV.E.DE114 - Key population member type
@activity: HIV.E1 Capture or update mother's history
@description: The type of key population that the infant's mother is included in
*/
// TODO: Replace placeholder with relevant CQL logic
define "Key population member type E.DE114":
  exists "Key population member type E.DE114 Observation"
define "Key population member type E.DE114 Observation":
  [Observation: Concepts."Key population member type - HIV.E.DE114"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Key population member type E.DE114 */

/*
@dataElement: HIV.E.DE115 - Sex worker
@activity: HIV.E1 Capture or update mother's history
@description: Infant's mother is a sex worker
*/

define "Sex worker E.DE115":
  [Observation: Concepts."Key population member - HIV.E.DE113"] O
    where O.status in { 'final', 'amended', 'corrected' }
    and exists(O.category OC where OC ~ ConceptsCustom."social-history")
    and O.value ~ Concepts."Sex worker - HIV.E.DE115"
/* End of Sex worker E.DE115 */

/*
@dataElement: HIV.E.DE116 - People who inject drugs
@activity: HIV.E1 Capture or update mother's history
@description: Infant's mother is a person who injects drugs
*/

define "People who inject drugs E.DE116":
  [Observation: Concepts."Key population member - HIV.E.DE113"] O
    where O.status in { 'final', 'amended', 'corrected' }
    and exists(O.category OC where OC ~ ConceptsCustom."social-history")
    and O.value ~ Concepts."People who inject drugs - HIV.E.DE116"
/* End of People who inject drugs E.DE116 */

/*
@dataElement: HIV.E.DE117 - Trans and gender-diverse people
@activity: HIV.E1 Capture or update mother's history
@description: Infant's mother identifies as trans and gender-diverse
*/

define "Trans and gender-diverse people E.DE117":
  [Observation: Concepts."Key population member - HIV.E.DE113"] O
    where O.status in { 'final', 'amended', 'corrected' }
    and exists(O.category OC where OC ~ ConceptsCustom."social-history")
    and O.value ~ Concepts."Trans and gender-diverse people - HIV.E.DE117"
/* End of Trans and gender-diverse people E.DE117 */

/*
@dataElement: HIV.E.DE118 - People living in prisons and other closed setting
@activity: HIV.E1 Capture or update mother's history
@description: Infant's mother is in a prison or closed setting
*/
define "People living in prisons and other closed setting":
  [Observation: Concepts."Key population member - HIV.E.DE113"] O
    where O.status in { 'final', 'amended', 'corrected' }
    and exists(O.category OC where OC ~ ConceptsCustom."social-history")
    and O.value ~ Concepts."People living in prisons and other closed setting"
/* End of People living in prisons and other closed setting */

/*
@dataElement: HIV.E.DE155 - Signs of substantial risk of HIV infection
@activity: HIV.E1 Capture or update mother's history
@description: Signs the client is at a substantial risk of HIV infection
*/
// TODO: Replace placeholder with relevant CQL logic
define "Signs of substantial risk of HIV infection E.DE155":
  exists "Signs of substantial risk of HIV infection E.DE155 Observation"
define "Signs of substantial risk of HIV infection E.DE155 Observation":
  [Observation: Concepts."Signs of substantial risk of HIV infection - HIV.E.DE155"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Signs of substantial risk of HIV infection E.DE155 */

/*
@dataElement: HIV.E.DE156 - No condom use during sex with more than one partner in the past 6 months
@activity: HIV.E1 Capture or update mother's history
@description: Recent vaginal or anal sexual intercourse without a condom with more than one partner
*/
// TODO: Replace placeholder with relevant CQL logic
define "No condom use during sex with more than one partner in the past 6 months E.DE156":
  exists "No condom use during sex with more than one partner in the past 6 months E.DE156 Condition"
    or exists "No condom use during sex with more than one partner in the past 6 months E.DE156 Observation"
define "No condom use during sex with more than one partner in the past 6 months E.DE156 Condition":
  [Condition: Concepts."No condom use during sex with more than one partner in the past 6 months - HIV.E.DE156"]
define "No condom use during sex with more than one partner in the past 6 months E.DE156 Observation":
  "Signs of substantial risk of HIV infection E.DE155 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."No condom use during sex with more than one partner in the past 6 months - HIV.E.DE156"
/* End of No condom use during sex with more than one partner in the past 6 months E.DE156 */

/*
@dataElement: HIV.E.DE157 - STI in the past 6 months
@activity: HIV.E1 Capture or update mother's history
@description: A recent history (in the last 6 months) of a sexually transmitted infection (STI) by laboratory testing or self-report of syndromic STI treatment
*/
// TODO: Replace placeholder with relevant CQL logic
define "STI in the past 6 months E.DE157":
  exists "STI in the past 6 months E.DE157 Condition"
    or exists "STI in the past 6 months E.DE157 Observation"
define "STI in the past 6 months E.DE157 Condition":
  [Condition: Concepts."STI in the past 6 months - HIV.E.DE157"]
define "STI in the past 6 months E.DE157 Observation":
  "Signs of substantial risk of HIV infection E.DE155 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."STI in the past 6 months - HIV.E.DE157"
/* End of STI in the past 6 months E.DE157 */

/*
@dataElement: HIV.E.DE158 - A sexual partner in the past 6 months had one or more HIV risk factors
@activity: HIV.E1 Capture or update mother's history
@description: A recent sex partner of the client had HIV risk factors
*/
// TODO: Replace placeholder with relevant CQL logic
define "A sexual partner in the past 6 months had one or more HIV risk factors E.DE158":
  exists "A sexual partner in the past 6 months had one or more HIV risk factors E.DE158 Condition"
    or exists "A sexual partner in the past 6 months had one or more HIV risk factors E.DE158 Observation"
define "A sexual partner in the past 6 months had one or more HIV risk factors E.DE158 Condition":
  [Condition: Concepts."A sexual partner in the past 6 months had one or more HIV risk factors - HIV.E.DE158"]
define "A sexual partner in the past 6 months had one or more HIV risk factors E.DE158 Observation":
  "Signs of substantial risk of HIV infection E.DE155 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."A sexual partner in the past 6 months had one or more HIV risk factors - HIV.E.DE158"
/* End of A sexual partner in the past 6 months had one or more HIV risk factors E.DE158 */

/*
@dataElement: HIV.E.DE159 - PrEP requested by client
@activity: HIV.E1 Capture or update mother's history
@description: Client is requesting PrEP, reflecting a decision-making process has already taken place and suggesting of substantial risk of HIV
*/
// TODO: Replace placeholder with relevant CQL logic
define "PrEP requested by client E.DE159":
  exists "PrEP requested by client E.DE159 Condition"
    or exists "PrEP requested by client E.DE159 Observation"
define "PrEP requested by client E.DE159 Condition":
  [Condition: Concepts."PrEP requested by client - HIV.E.DE159"]
define "PrEP requested by client E.DE159 Observation":
  "Signs of substantial risk of HIV infection E.DE155 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."PrEP requested by client - HIV.E.DE159"
/* End of PrEP requested by client E.DE159 */

/*
@dataElement: HIV.E.DE160 - Serodiscordant partner
@activity: HIV.E1 Capture or update mother's history
@description: Mother's HIV status is different from a current partner's HIV status
*/
// TODO: Replace placeholder with relevant CQL logic
define "Serodiscordant partner E.DE160":
  exists "Serodiscordant partner E.DE160 Observation"
define "Serodiscordant partner E.DE160 Observation":
  [Observation: Concepts."Serodiscordant partner - HIV.E.DE160"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value is true
/* End of Serodiscordant partner E.DE160 */

/*
@dataElement: HIV.E.DE168 - HIV test type
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: Type of HIV test
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV test type E.DE168":
  exists "HIV test type E.DE168 Observation"
define "HIV test type E.DE168 Observation":
  [Observation: Concepts."HIV test type - HIV.E.DE168"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of HIV test type E.DE168 */

/*
@dataElement: HIV.E.DE169 - Rapid diagnostic test for HIV
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: Antibody test for HIV performed with a rapid diagnostic (RDT)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Rapid diagnostic test for HIV E.DE169":
  exists "Rapid diagnostic test for HIV E.DE169 Condition"
    or exists "Rapid diagnostic test for HIV E.DE169 Observation"
define "Rapid diagnostic test for HIV E.DE169 Condition":
  [Condition: Concepts."Rapid diagnostic test for HIV - HIV.E.DE169"]
define "Rapid diagnostic test for HIV E.DE169 Observation":
  "HIV test type E.DE168 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Rapid diagnostic test for HIV - HIV.E.DE169"
/* End of Rapid diagnostic test for HIV E.DE169 */

/*
@dataElement: HIV.E.DE170 - Enzyme immunoassay for HIV
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: Antibody test for HIV performed with an enzyme immunoassay (EIA)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Enzyme immunoassay for HIV E.DE170":
  exists "Enzyme immunoassay for HIV E.DE170 Condition"
    or exists "Enzyme immunoassay for HIV E.DE170 Observation"
define "Enzyme immunoassay for HIV E.DE170 Condition":
  [Condition: Concepts."Enzyme immunoassay for HIV - HIV.E.DE170"]
define "Enzyme immunoassay for HIV E.DE170 Observation":
  "HIV test type E.DE168 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Enzyme immunoassay for HIV - HIV.E.DE170"
/* End of Enzyme immunoassay for HIV E.DE170 */

/*
@dataElement: HIV.E.DE171 - Nucleic acid test for HIV
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: Virological test, which includes testing for early infant diagnosis
*/
// TODO: Replace placeholder with relevant CQL logic
define "Nucleic acid test for HIV E.DE171":
  exists "Nucleic acid test for HIV E.DE171 Condition"
    or exists "Nucleic acid test for HIV E.DE171 Observation"
define "Nucleic acid test for HIV E.DE171 Condition":
  [Condition: Concepts."Nucleic acid test for HIV - HIV.E.DE171"]
define "Nucleic acid test for HIV E.DE171 Observation":
  "HIV test type E.DE168 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Nucleic acid test for HIV - HIV.E.DE171"
/* End of Nucleic acid test for HIV E.DE171 */

/*
@dataElement: HIV.E.DE172 - Dual HIV/syphilis rapid diagnostic test
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: Antibody test for HIV and syphilis performed with a rapid diagnostic
*/
// TODO: Replace placeholder with relevant CQL logic
define "Dual HIV/syphilis rapid diagnostic test E.DE172":
  exists "Dual HIV/syphilis rapid diagnostic test E.DE172 Condition"
    or exists "Dual HIV/syphilis rapid diagnostic test E.DE172 Observation"
define "Dual HIV/syphilis rapid diagnostic test E.DE172 Condition":
  [Condition: Concepts."Dual HIV/syphilis rapid diagnostic test - HIV.E.DE172"]
define "Dual HIV/syphilis rapid diagnostic test E.DE172 Observation":
  "HIV test type E.DE168 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Dual HIV/syphilis rapid diagnostic test - HIV.E.DE172"
/* End of Dual HIV/syphilis rapid diagnostic test E.DE172 */

/*
@dataElement: HIV.E.DE173 - Maternal and child health service visit
@activity: HIV.E1 Capture or update mother's history
@description: Maternal and child health service visit attended by an HIV-exposed infant
*/

define "Maternal and child health service visit":
    [Encounter] E
    where E.type.coding.code contains Concepts."Maternal and child health service visit".code

/* End of Maternal and child health service visit */

/*
@dataElement: HIV.E.DE174 - 12-month visit
@activity: HIV.E1 Capture or update mother's history
@description: HIV-exposed infant attending MCH services for a 12-month visit
*/

define "12-month visit":
  "Maternal and child health service visit" E
    where E.type.coding.code contains Concepts."12-month visit".code
/* End of 12-month visit */

/*
@dataElement: HIV.E.DE175 - 24-month visit
@activity: HIV.E1 Capture or update mother's history
@description: HIV-exposed infants attending MCH services for a 24-month visit
*/

define "24-month visit":
  "Maternal and child health service visit" E
    where E.type.coding.code contains Concepts."24-month visit".code
/* End of 24-month visit */

/*
@dataElement: HIV.E.DE176 - First visit after the end of breastfeeding
@activity: HIV.E1 Capture or update mother's history
@description: HIV-exposed infant attending MCH services for a first visit after the end of breastfeeding
*/

define "First visit after the end of breastfeeding":
    "Maternal and child health service visit" E
    where E.type.coding.code contains Concepts."First visit after the end of breastfeeding".code
/* End of First visit after the end of breastfeeding */

/*
@dataElement: HIV.E.DE179 - Registered in birth cohort
@activity: HIV.F3 Capture or update infant's/child's history
@description: Whether the infant has been registered in a birth cohort
*/

define "Registered in birth cohort":
  [Observation: Concepts."Registered in birth cohort"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value is true

/* End of Registered in birth cohort */

/*
@dataElement: HIV.E.DE180 - EID sample number
@activity: HIV.F8 Test infant/child for HIV using testing algorithm
@description: Early infant diagnosis (EID) sample number
*/
// TODO: Replace placeholder with relevant CQL logic
define "EID sample number":
  exists "EID sample number Observation"
define "EID sample number Observation":
  [Observation: Concepts."EID sample number"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of EID sample number */

/*
@dataElement: HIV.E.DE181 - EID sample 1
@activity: HIV.F8 Test infant/child for HIV using testing algorithm
@description: First sample used to test an infant for HIV
*/
// TODO: Replace placeholder with relevant CQL logic
define "EID sample 1":
  exists "EID sample 1 Condition"
    or exists "EID sample 1 Observation"
define "EID sample 1 Condition":
  [Condition: Concepts."EID sample 1"]
define "EID sample 1 Observation":
  "EID sample number Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."EID sample 1"
/* End of EID sample 1 */

/*
@dataElement: HIV.E.DE182 - EID sample 2
@activity: HIV.F8 Test infant/child for HIV using testing algorithm
@description: Second sample used to test an infant for HIV
*/
// TODO: Replace placeholder with relevant CQL logic
define "EID sample 2":
  exists "EID sample 2 Condition"
    or exists "EID sample 2 Observation"
define "EID sample 2 Condition":
  [Condition: Concepts."EID sample 2"]
define "EID sample 2 Observation":
  "EID sample number Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."EID sample 2"
/* End of EID sample 2 */

/*
@dataElement: HIV.E.DE183 - EID test number
@activity: HIV.F8 Test infant/child for HIV using testing algorithm
@description: Early infant diagnosis (EID) HIV test number using the same sample
*/
// TODO: Replace placeholder with relevant CQL logic
define "EID test number":
  exists "EID test number Observation"
define "EID test number Observation":
  [Observation: Concepts."EID test number"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of EID test number */

/*
@dataElement: HIV.E.DE184 - EID test number 1
@activity: HIV.F8 Test infant/child for HIV using testing algorithm
@description: First test on a sample to test an infant for HIV
*/
// TODO: Replace placeholder with relevant CQL logic
define "EID test number 1":
  exists "EID test number 1 Condition"
    or exists "EID test number 1 Observation"
define "EID test number 1 Condition":
  [Condition: Concepts."EID test number 1"]
define "EID test number 1 Observation":
  "EID test number Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."EID test number 1"
/* End of EID test number 1 */

/*
@dataElement: HIV.E.DE185 - EID test number 2
@activity: HIV.F8 Test infant/child for HIV using testing algorithm
@description: Second test on a sample to test an infant for HIV
*/
// TODO: Replace placeholder with relevant CQL logic
define "EID test number 2":
  exists "EID test number 2 Condition"
    or exists "EID test number 2 Observation"
define "EID test number 2 Condition":
  [Condition: Concepts."EID test number 2"]
define "EID test number 2 Observation":
  "EID test number Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."EID test number 2"
/* End of EID test number 2 */

/*
@dataElement: HIV.E.DE186 - EID test number 1 test result
@activity: HIV.F8 Test infant/child for HIV using testing algorithm
@description: Early infant diagnosis test number 1 test result
*/

define "EID test number 1 test result":
  [Observation: Concepts."EID test number 1 test result"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of EID test number 1 test result */

/*
@dataElement: HIV.E.DE187 - Positive
@activity: HIV.F8 Test infant/child for HIV using testing algorithm
@description: Positive HIV test result from the nucleic acid test
*/

define "Positive E.DE187":
  "EID test number 1 test result" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Positive - HIV.E.DE187"
/* End of Positive E.DE187 */

/*
@dataElement: HIV.E.DE188 - Negative
@activity: HIV.F8 Test infant/child for HIV using testing algorithm
@description: Negative HIV test result from the nucleic acid test
*/

define "Negative E.DE188":
  "EID test number 1 test result" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Negative - HIV.E.DE188"
/* End of Negative E.DE188 */

/*
@dataElement: HIV.E.DE189 - Indeterminate
@activity: HIV.F8 Test infant/child for HIV using testing algorithm
@description: Indeterminate HIV test result from the nucleic acid test
*/

define "Indeterminate E.DE189":
  "EID test number 1 test result" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Indeterminate - HIV.E.DE189"
/* End of Indeterminate E.DE189 */

/*
@dataElement: HIV.E.DE190 - EID test number 2 test result
@activity: HIV.F8 Test infant/child for HIV using testing algorithm
@description: Early infant diagnosis test number 2 test result
*/
// TODO: Replace placeholder with relevant CQL logic
define "EID test number 2 test result":
  exists "EID test number 2 test result Observation"
define "EID test number 2 test result Observation":
  [Observation: Concepts."EID test number 2 test result"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of EID test number 2 test result */

/*
@dataElement: HIV.E.DE191 - Positive
@activity: HIV.F8 Test infant/child for HIV using testing algorithm
@description: Positive HIV test result from the nucleic acid test
*/
// TODO: Replace placeholder with relevant CQL logic
define "Positive E.DE191":
  exists "Positive E.DE191 Condition"
    or exists "Positive E.DE191 Observation"
define "Positive E.DE191 Condition":
  [Condition: Concepts."Positive - HIV.E.DE191"]
define "Positive E.DE191 Observation":
  "EID test number 2 test result Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Positive - HIV.E.DE191"
/* End of Positive E.DE191 */

/*
@dataElement: HIV.E.DE192 - Negative
@activity: HIV.F8 Test infant/child for HIV using testing algorithm
@description: Negative HIV test result from the nucleic acid test
*/
// TODO: Replace placeholder with relevant CQL logic
define "Negative E.DE192":
  exists "Negative E.DE192 Condition"
    or exists "Negative E.DE192 Observation"
define "Negative E.DE192 Condition":
  [Condition: Concepts."Negative - HIV.E.DE192"]
define "Negative E.DE192 Observation":
  "EID test number 2 test result Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Negative - HIV.E.DE192"
/* End of Negative E.DE192 */

/*
@dataElement: HIV.E.DE193 - Indeterminate
@activity: HIV.F8 Test infant/child for HIV using testing algorithm
@description: Indeterminate HIV test result from the nucleic acid test
*/
// TODO: Replace placeholder with relevant CQL logic
define "Indeterminate E.DE193":
  exists "Indeterminate E.DE193 Condition"
    or exists "Indeterminate E.DE193 Observation"
define "Indeterminate E.DE193 Condition":
  [Condition: Concepts."Indeterminate - HIV.E.DE193"]
define "Indeterminate E.DE193 Observation":
  "EID test number 2 test result Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Indeterminate - HIV.E.DE193"
/* End of Indeterminate E.DE193 */

/*
@dataElement: HIV.E.DE194 - Assay number in testing strategy
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: The number of the assay (test kit) in the HIV testing strategy
*/
// TODO: Replace placeholder with relevant CQL logic
define "Assay number in testing strategy E.DE194":
  exists "Assay number in testing strategy E.DE194 Observation"
define "Assay number in testing strategy E.DE194 Observation":
  [Observation: Concepts."Assay number in testing strategy - HIV.E.DE194"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Assay number in testing strategy E.DE194 */

/*
@dataElement: HIV.E.DE195 - Assay 0
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: A community outreach test-for-triage or self-test which is not included in the HIV testing strategy
*/
// TODO: Replace placeholder with relevant CQL logic
define "Assay 0 E.DE195":
  exists "Assay 0 E.DE195 Condition"
    or exists "Assay 0 E.DE195 Observation"
define "Assay 0 E.DE195 Condition":
  [Condition: Concepts."Assay 0 - HIV.E.DE195"]
define "Assay 0 E.DE195 Observation":
  "Assay number in testing strategy E.DE194 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Assay 0 - HIV.E.DE195"
/* End of Assay 0 E.DE195 */

/*
@dataElement: HIV.E.DE196 - Assay 1
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: The first test in the HIV testing strategy
*/
// TODO: Replace placeholder with relevant CQL logic
define "Assay 1 E.DE196":
  exists "Assay 1 E.DE196 Condition"
    or exists "Assay 1 E.DE196 Observation"
define "Assay 1 E.DE196 Condition":
  [Condition: Concepts."Assay 1 - HIV.E.DE196"]
define "Assay 1 E.DE196 Observation":
  "Assay number in testing strategy E.DE194 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Assay 1 - HIV.E.DE196"
/* End of Assay 1 E.DE196 */

/*
@dataElement: HIV.E.DE197 - Assay 2
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: The second test in the HIV testing strategy
*/
// TODO: Replace placeholder with relevant CQL logic
define "Assay 2 E.DE197":
  exists "Assay 2 E.DE197 Condition"
    or exists "Assay 2 E.DE197 Observation"
define "Assay 2 E.DE197 Condition":
  [Condition: Concepts."Assay 2 - HIV.E.DE197"]
define "Assay 2 E.DE197 Observation":
  "Assay number in testing strategy E.DE194 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Assay 2 - HIV.E.DE197"
/* End of Assay 2 E.DE197 */

/*
@dataElement: HIV.E.DE198 - Assay 3
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: The third test in the HIV testing strategy
*/
// TODO: Replace placeholder with relevant CQL logic
define "Assay 3 E.DE198":
  exists "Assay 3 E.DE198 Condition"
    or exists "Assay 3 E.DE198 Observation"
define "Assay 3 E.DE198 Condition":
  [Condition: Concepts."Assay 3 - HIV.E.DE198"]
define "Assay 3 E.DE198 Observation":
  "Assay number in testing strategy E.DE194 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Assay 3 - HIV.E.DE198"
/* End of Assay 3 E.DE198 */

/*
@dataElement: HIV.E.DE199 - Assay 1 repeated
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: The first test in the HIV testing strategy
*/
// TODO: Replace placeholder with relevant CQL logic
define "Assay 1 repeated E.DE199":
  exists "Assay 1 repeated E.DE199 Condition"
    or exists "Assay 1 repeated E.DE199 Observation"
define "Assay 1 repeated E.DE199 Condition":
  [Condition: Concepts."Assay 1 repeated - HIV.E.DE199"]
define "Assay 1 repeated E.DE199 Observation":
  "Assay number in testing strategy E.DE194 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Assay 1 repeated - HIV.E.DE199"
/* End of Assay 1 repeated E.DE199 */

/*
@dataElement: HIV.E.DE200 - Test result of HIV assay 1
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: The result of the first HIV assay in the testing strategy
*/
// TODO: Replace placeholder with relevant CQL logic
define "Test result of HIV assay 1 E.DE200":
  exists "Test result of HIV assay 1 E.DE200 Observation"
define "Test result of HIV assay 1 E.DE200 Observation":
  [Observation: Concepts."Test result of HIV assay 1 - HIV.E.DE200"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Test result of HIV assay 1 E.DE200 */

/*
@dataElement: HIV.E.DE201 - Reactive
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: The result of the HIV assay in the testing strategy was reactive
*/
// TODO: Replace placeholder with relevant CQL logic
define "Reactive E.DE201":
  exists "Reactive E.DE201 Condition"
    or exists "Reactive E.DE201 Observation"
define "Reactive E.DE201 Condition":
  [Condition: Concepts."Reactive - HIV.E.DE201"]
define "Reactive E.DE201 Observation":
  "Test result of HIV assay 1 E.DE200 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Reactive - HIV.E.DE201"
/* End of Reactive E.DE201 */

/*
@dataElement: HIV.E.DE202 - Non-reactive
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: The result of the HIV assay in the testing strategy was non-reactive
*/
// TODO: Replace placeholder with relevant CQL logic
define "Non-reactive E.DE202":
  exists "Non-reactive E.DE202 Condition"
    or exists "Non-reactive E.DE202 Observation"
define "Non-reactive E.DE202 Condition":
  [Condition: Concepts."Non-reactive - HIV.E.DE202"]
define "Non-reactive E.DE202 Observation":
  "Test result of HIV assay 1 E.DE200 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Non-reactive - HIV.E.DE202"
/* End of Non-reactive E.DE202 */

/*
@dataElement: HIV.E.DE203 - Invalid
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: The result of the HIV assay in the testing strategy was invalid
*/
// TODO: Replace placeholder with relevant CQL logic
define "Invalid E.DE203":
  exists "Invalid E.DE203 Condition"
    or exists "Invalid E.DE203 Observation"
define "Invalid E.DE203 Condition":
  [Condition: Concepts."Invalid - HIV.E.DE203"]
define "Invalid E.DE203 Observation":
  "Test result of HIV assay 1 E.DE200 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Invalid - HIV.E.DE203"
/* End of Invalid E.DE203 */

/*
@dataElement: HIV.E.DE204 - Test result of HIV assay 2
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: The result of the second HIV assay in the testing strategy
*/
// TODO: Replace placeholder with relevant CQL logic
define "Test result of HIV assay 2 E.DE204":
  exists "Test result of HIV assay 2 E.DE204 Observation"
define "Test result of HIV assay 2 E.DE204 Observation":
  [Observation: Concepts."Test result of HIV assay 2 - HIV.E.DE204"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Test result of HIV assay 2 E.DE204 */

/*
@dataElement: HIV.E.DE205 - Reactive
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: The result of the HIV assay in the testing strategy was reactive
*/
// TODO: Replace placeholder with relevant CQL logic
define "Reactive E.DE205":
  exists "Reactive E.DE205 Condition"
    or exists "Reactive E.DE205 Observation"
define "Reactive E.DE205 Condition":
  [Condition: Concepts."Reactive - HIV.E.DE205"]
define "Reactive E.DE205 Observation":
  "Test result of HIV assay 2 E.DE204 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Reactive - HIV.E.DE205"
/* End of Reactive E.DE205 */

/*
@dataElement: HIV.E.DE206 - Non-reactive
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: The result of the HIV assay in the testing strategy was non-reactive
*/
// TODO: Replace placeholder with relevant CQL logic
define "Non-reactive E.DE206":
  exists "Non-reactive E.DE206 Condition"
    or exists "Non-reactive E.DE206 Observation"
define "Non-reactive E.DE206 Condition":
  [Condition: Concepts."Non-reactive - HIV.E.DE206"]
define "Non-reactive E.DE206 Observation":
  "Test result of HIV assay 2 E.DE204 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Non-reactive - HIV.E.DE206"
/* End of Non-reactive E.DE206 */

/*
@dataElement: HIV.E.DE207 - Invalid
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: The result of the HIV assay in the testing strategy was invalid
*/
// TODO: Replace placeholder with relevant CQL logic
define "Invalid E.DE207":
  exists "Invalid E.DE207 Condition"
    or exists "Invalid E.DE207 Observation"
define "Invalid E.DE207 Condition":
  [Condition: Concepts."Invalid - HIV.E.DE207"]
define "Invalid E.DE207 Observation":
  "Test result of HIV assay 2 E.DE204 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Invalid - HIV.E.DE207"
/* End of Invalid E.DE207 */

/*
@dataElement: HIV.E.DE208 - Test result of HIV assay 3
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: The result of the third HIV assay in the testing strategy
*/
// TODO: Replace placeholder with relevant CQL logic
define "Test result of HIV assay 3 E.DE208":
  exists "Test result of HIV assay 3 E.DE208 Observation"
define "Test result of HIV assay 3 E.DE208 Observation":
  [Observation: Concepts."Test result of HIV assay 3 - HIV.E.DE208"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Test result of HIV assay 3 E.DE208 */

/*
@dataElement: HIV.E.DE209 - Reactive
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: The result of the HIV assay in the testing strategy was reactive
*/
// TODO: Replace placeholder with relevant CQL logic
define "Reactive E.DE209":
  exists "Reactive E.DE209 Condition"
    or exists "Reactive E.DE209 Observation"
define "Reactive E.DE209 Condition":
  [Condition: Concepts."Reactive - HIV.E.DE209"]
define "Reactive E.DE209 Observation":
  "Test result of HIV assay 3 E.DE208 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Reactive - HIV.E.DE209"
/* End of Reactive E.DE209 */

/*
@dataElement: HIV.E.DE210 - Non-reactive
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: The result of the HIV assay in the testing strategy was non-reactive
*/
// TODO: Replace placeholder with relevant CQL logic
define "Non-reactive E.DE210":
  exists "Non-reactive E.DE210 Condition"
    or exists "Non-reactive E.DE210 Observation"
define "Non-reactive E.DE210 Condition":
  [Condition: Concepts."Non-reactive - HIV.E.DE210"]
define "Non-reactive E.DE210 Observation":
  "Test result of HIV assay 3 E.DE208 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Non-reactive - HIV.E.DE210"
/* End of Non-reactive E.DE210 */

/*
@dataElement: HIV.E.DE211 - Invalid
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: The result of the HIV assay in the testing strategy was invalid
*/
// TODO: Replace placeholder with relevant CQL logic
define "Invalid E.DE211":
  exists "Invalid E.DE211 Condition"
    or exists "Invalid E.DE211 Observation"
define "Invalid E.DE211 Condition":
  [Condition: Concepts."Invalid - HIV.E.DE211"]
define "Invalid E.DE211 Observation":
  "Test result of HIV assay 3 E.DE208 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Invalid - HIV.E.DE211"
/* End of Invalid E.DE211 */

/*
@dataElement: HIV.E.DE212 - Test result of HIV assay 1 repeated
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: The result of the repeated first HIV assay in the testing strategy
*/
// TODO: Replace placeholder with relevant CQL logic
define "Test result of HIV assay 1 repeated E.DE212":
  exists "Test result of HIV assay 1 repeated E.DE212 Observation"
define "Test result of HIV assay 1 repeated E.DE212 Observation":
  [Observation: Concepts."Test result of HIV assay 1 repeated - HIV.E.DE212"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Test result of HIV assay 1 repeated E.DE212 */

/*
@dataElement: HIV.E.DE213 - Reactive
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: The result of the HIV assay in the testing strategy was reactive
*/
// TODO: Replace placeholder with relevant CQL logic
define "Reactive E.DE213":
  exists "Reactive E.DE213 Condition"
    or exists "Reactive E.DE213 Observation"
define "Reactive E.DE213 Condition":
  [Condition: Concepts."Reactive - HIV.E.DE213"]
define "Reactive E.DE213 Observation":
  "Test result of HIV assay 1 repeated E.DE212 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Reactive - HIV.E.DE213"
/* End of Reactive E.DE213 */

/*
@dataElement: HIV.E.DE214 - Non-reactive
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: The result of the HIV assay in the testing strategy was non-reactive
*/
// TODO: Replace placeholder with relevant CQL logic
define "Non-reactive E.DE214":
  exists "Non-reactive E.DE214 Condition"
    or exists "Non-reactive E.DE214 Observation"
define "Non-reactive E.DE214 Condition":
  [Condition: Concepts."Non-reactive - HIV.E.DE214"]
define "Non-reactive E.DE214 Observation":
  "Test result of HIV assay 1 repeated E.DE212 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Non-reactive - HIV.E.DE214"
/* End of Non-reactive E.DE214 */

/*
@dataElement: HIV.E.DE215 - Invalid
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: The result of the HIV assay in the testing strategy was invalid
*/
// TODO: Replace placeholder with relevant CQL logic
define "Invalid E.DE215":
  exists "Invalid E.DE215 Condition"
    or exists "Invalid E.DE215 Observation"
define "Invalid E.DE215 Condition":
  [Condition: Concepts."Invalid - HIV.E.DE215"]
define "Invalid E.DE215 Observation":
  "Test result of HIV assay 1 repeated E.DE212 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Invalid - HIV.E.DE215"
/* End of Invalid E.DE215 */

/*
@dataElement: HIV.E.DE216 - Test result of syphilis assay 1
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: The result of the first syphilis assay in the testing strategy
*/
// TODO: Replace placeholder with relevant CQL logic
define "Test result of syphilis assay 1":
  exists "Test result of syphilis assay 1 Observation"
define "Test result of syphilis assay 1 Observation":
  [Observation: Concepts."Test result of syphilis assay 1"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Test result of syphilis assay 1 */

/*
@dataElement: HIV.E.DE217 - Reactive
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: The result of the first syphilis assay in the testing strategy was reactive
*/
// TODO: Replace placeholder with relevant CQL logic
define "Reactive E.DE217":
  exists "Reactive E.DE217 Condition"
    or exists "Reactive E.DE217 Observation"
define "Reactive E.DE217 Condition":
  [Condition: Concepts."Reactive - HIV.E.DE217"]
define "Reactive E.DE217 Observation":
  "Test result of syphilis assay 1 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Reactive - HIV.E.DE217"
/* End of Reactive E.DE217 */

/*
@dataElement: HIV.E.DE218 - Non-reactive
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: The result of the first syphilis assay in the testing strategy was non-reactive
*/
// TODO: Replace placeholder with relevant CQL logic
define "Non-reactive E.DE218":
  exists "Non-reactive E.DE218 Condition"
    or exists "Non-reactive E.DE218 Observation"
define "Non-reactive E.DE218 Condition":
  [Condition: Concepts."Non-reactive - HIV.E.DE218"]
define "Non-reactive E.DE218 Observation":
  "Test result of syphilis assay 1 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Non-reactive - HIV.E.DE218"
/* End of Non-reactive E.DE218 */

/*
@dataElement: HIV.E.DE219 - Invalid
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: The result of the HIV assay in the testing strategy was invalid
*/
// TODO: Replace placeholder with relevant CQL logic
define "Invalid E.DE219":
  exists "Invalid E.DE219 Condition"
    or exists "Invalid E.DE219 Observation"
define "Invalid E.DE219 Condition":
  [Condition: Concepts."Invalid - HIV.E.DE219"]
define "Invalid E.DE219 Observation":
  "Test result of syphilis assay 1 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Invalid - HIV.E.DE219"
/* End of Invalid E.DE219 */

/*
@dataElement: HIV.E.DE220 - Test result of syphilis assay 1 repeated
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: The result of the first syphilis assay repeated in the testing strategy
*/
// TODO: Replace placeholder with relevant CQL logic
define "Test result of syphilis assay 1 repeated":
  exists "Test result of syphilis assay 1 repeated Observation"
define "Test result of syphilis assay 1 repeated Observation":
  [Observation: Concepts."Test result of syphilis assay 1 repeated"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Test result of syphilis assay 1 repeated */

/*
@dataElement: HIV.E.DE221 - Reactive
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: The result of the first syphilis assay repeated in the testing strategy was reactive
*/
// TODO: Replace placeholder with relevant CQL logic
define "Reactive E.DE221":
  exists "Reactive E.DE221 Condition"
    or exists "Reactive E.DE221 Observation"
define "Reactive E.DE221 Condition":
  [Condition: Concepts."Reactive - HIV.E.DE221"]
define "Reactive E.DE221 Observation":
  "Test result of syphilis assay 1 repeated Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Reactive - HIV.E.DE221"
/* End of Reactive E.DE221 */

/*
@dataElement: HIV.E.DE222 - Non-reactive
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: The result of the first syphilis assay repeated in the testing strategy was non-reactive
*/
// TODO: Replace placeholder with relevant CQL logic
define "Non-reactive E.DE222":
  exists "Non-reactive E.DE222 Condition"
    or exists "Non-reactive E.DE222 Observation"
define "Non-reactive E.DE222 Condition":
  [Condition: Concepts."Non-reactive - HIV.E.DE222"]
define "Non-reactive E.DE222 Observation":
  "Test result of syphilis assay 1 repeated Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Non-reactive - HIV.E.DE222"
/* End of Non-reactive E.DE222 */

/*
@dataElement: HIV.E.DE223 - Invalid
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: The result of the first syphilis assay repeated in the testing strategy was invalid
*/
// TODO: Replace placeholder with relevant CQL logic
define "Invalid E.DE223":
  exists "Invalid E.DE223 Condition"
    or exists "Invalid E.DE223 Observation"
define "Invalid E.DE223 Condition":
  [Condition: Concepts."Invalid - HIV.E.DE223"]
define "Invalid E.DE223 Observation":
  "Test result of syphilis assay 1 repeated Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Invalid - HIV.E.DE223"
/* End of Invalid E.DE223 */

/*
@dataElement: HIV.E.DE224 - HIV test date
@activity: HIV.F8 Test infant/child for HIV using testing algorithm
@description: Date of the HIV test
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV test date E.DE224":
  [Observation: Concepts."HIV test date - HIV.E.DE224"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "HIV test date E.DE224 Value":
  "HIV test date E.DE224" O
  return O.value as dateTime
/* End of HIV test date E.DE224 */

/*
@dataElement: HIV.E.DE225 - Infant HIV status
@activity: HIV.F8 Test infant/child for HIV using testing algorithm
@description: HIV status reported after applying the HIV testing algorithm. No single HIV test can provide an HIV-positive diagnosis.
*/
// TODO: Replace placeholder with relevant CQL logic
define "Infant HIV status":
  exists "Infant HIV status Observation"
define "Infant HIV status Observation":
  [Observation: Concepts."Infant HIV status"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Infant HIV status */

/*
@dataElement: HIV.E.DE226 - HIV-positive
@activity: HIV.F8 Test infant/child for HIV using testing algorithm
@description: Infant is HIV-positive
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV-positive E.DE226":
  exists "HIV-positive E.DE226 Condition"
    or exists "HIV-positive E.DE226 Observation"
define "HIV-positive E.DE226 Condition":
  [Condition: Concepts."HIV-positive - HIV.E.DE226"]
define "HIV-positive E.DE226 Observation":
  "Infant HIV status Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."HIV-positive - HIV.E.DE226"
/* End of HIV-positive E.DE226 */

/*
@dataElement: HIV.E.DE227 - HIV-negative
@activity: HIV.F8 Test infant/child for HIV using testing algorithm
@description: Infant is HIV-negative
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV-negative E.DE227":
  exists "HIV-negative E.DE227 Condition"
    or exists "HIV-negative E.DE227 Observation"
define "HIV-negative E.DE227 Condition":
  [Condition: Concepts."HIV-negative - HIV.E.DE227"]
define "HIV-negative E.DE227 Observation":
  "Infant HIV status Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."HIV-negative - HIV.E.DE227"
/* End of HIV-negative E.DE227 */

/*
@dataElement: HIV.E.DE228 - Unknown
@activity: HIV.F8 Test infant/child for HIV using testing algorithm
@description: Infant has unknown HIV status
*/
// TODO: Replace placeholder with relevant CQL logic
define "Unknown E.DE228":
  exists "Unknown E.DE228 Condition"
    or exists "Unknown E.DE228 Observation"
define "Unknown E.DE228 Condition":
  [Condition: Concepts."Unknown - HIV.E.DE228"]
define "Unknown E.DE228 Observation":
  "Infant HIV status Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Unknown - HIV.E.DE228"
/* End of Unknown E.DE228 */

/*
@dataElement: HIV.E.DE229 - Infant ART start date
@activity: HIV.F16 Immediately start infant on ART
@description: The date on which the infant was started or restarted on antiretroviral therapy (ART)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Infant ART start date":
  [Observation: Concepts."Infant ART start date"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Infant ART start date Value":
  "Infant ART start date" O
  return O.value as dateTime
/* End of Infant ART start date */

/*
@dataElement: HIV.E.DE230 - Final diagnosis of HIV-exposed infant
@activity: HIV.F20 Record infant's/child's final HIV diagnosis
@description: HIV-exposed infant final status at 18 months or 3 months after cessation of breastfeeding (whichever is later).
*/

define "Final diagnosis of HIV-exposed infant E.DE230":
  First("Final diagnosis of HIV-exposed infant E.DE230 Observation".value) as FHIR.CodeableConcept

define "Final diagnosis of HIV-exposed infant E.DE230 Observation":
  [Observation: Concepts."Final diagnosis of HIV-exposed infant - HIV.E.DE230"] O
    where O.status in { 'final', 'amended', 'corrected' }


/* End of HIV-negative E.DE227 */
/* End of Final diagnosis of HIV-exposed infant E.DE230 */

/*
@dataElement: HIV.E.DE231 - HIV-positive
@activity: HIV.F20 Record infant's/child's final HIV diagnosis
@description: The infant is HIV-positive
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV-positive E.DE231":
  exists "HIV-positive E.DE231 Condition"
    or exists "HIV-positive E.DE231 Observation"
define "HIV-positive E.DE231 Condition":
  [Condition: Concepts."HIV-positive - HIV.E.DE231"]
define "HIV-positive E.DE231 Observation":
  "Final diagnosis of HIV-exposed infant E.DE230 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."HIV-positive - HIV.E.DE231"
/* End of HIV-positive E.DE231 */

/*
@dataElement: HIV.E.DE232 - HIV-negative and no longer breastfeeding
@activity: HIV.F20 Record infant's/child's final HIV diagnosis
@description: The infant is HIV-negative and the mother has quit breastfeeding
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV-negative and no longer breastfeeding":
  exists "HIV-negative and no longer breastfeeding Condition"
    or exists "HIV-negative and no longer breastfeeding Observation"
define "HIV-negative and no longer breastfeeding Condition":
  [Condition: Concepts."HIV-negative and no longer breastfeeding"]
define "HIV-negative and no longer breastfeeding Observation":
  "Final diagnosis of HIV-exposed infant E.DE230 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."HIV-negative and no longer breastfeeding"
/* End of HIV-negative and no longer breastfeeding */

/*
@dataElement: HIV.E.DE233 - HIV status unknown
@activity: HIV.F20 Record infant's/child's final HIV diagnosis
@description: The final HIV status of the child is unknown because the infant died, was lost to follow-up or transferred out without ever having an HIV-positive diagnosis or is active in care but was not tested at 18 months
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV status unknown":
  exists "HIV status unknown Condition"
    or exists "HIV status unknown Observation"
define "HIV status unknown Condition":
  [Condition: Concepts."HIV status unknown"]
define "HIV status unknown Observation":
  "Final diagnosis of HIV-exposed infant E.DE230 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."HIV status unknown"
/* End of HIV status unknown */

/*
@dataElement: HIV.G.DE1 - CD4 count
@activity: HIV.D20 Diagnostics
@description: CD4 cell count in cells/mm^3
*/
// TODO: Replace placeholder with relevant CQL logic
define "CD4 count G.DE1":
  [Observation: Concepts."CD4 count - HIV.G.DE1"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "CD4 count G.DE1 Value":
  "CD4 count G.DE1" O
  return O.value as Quantity
/* End of CD4 count G.DE1 */

/*
@dataElement: HIV.G.DE3 - Baseline CD4 count
@activity: HIV.D20 Diagnostics
@description: CD4 count performed at HIV diagnosis
*/
// TODO: Replace placeholder with relevant CQL logic
define "Baseline CD4 count G.DE3":
  [Observation: Concepts."Baseline CD4 count - HIV.G.DE3"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Baseline CD4 count G.DE3 Value":
  "Baseline CD4 count G.DE3" O
  return O.value as Quantity
/* End of Baseline CD4 count G.DE3 */

/*
@dataElement: HIV.G.DE8 - Date of viral load sample collection
@activity: HIV.D20 Diagnostics
@description: Date and time when the sample was collected to test the client's HIV viral load
*/
// TODO: Replace placeholder with relevant CQL logic
define "Date of viral load sample collection G.DE8":
  [Observation: Concepts."Date of viral load sample collection - HIV.G.DE8"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Date of viral load sample collection G.DE8 Value":
  "Date of viral load sample collection G.DE8" O
  return O.value as dateTime
/* End of Date of viral load sample collection G.DE8 */

/*
@dataElement: HIV.G.DE12 - Viral load test result
@activity: HIV.D20 Diagnostics
@description: Result from the viral load test in number of copies/mL
*/
// TODO: Replace placeholder with relevant CQL logic
define "Viral load test result G.DE12":
  [Observation: Concepts."Viral load test result - HIV.G.DE12"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Viral load test result G.DE12 Value":
  "Viral load test result G.DE12" O
  return O.value as Quantity
/* End of Viral load test result G.DE12 */

/*
@dataElement: HIV.G.DE17 - HBsAg test date
@activity: HIV.D20 Diagnostics
@description: Date client was tested for hepatitis B virus (HBV)
*/
// TODO: Replace placeholder with relevant CQL logic
define "HBsAg test date G.DE17":
  [Observation: Concepts."HBsAg test date - HIV.G.DE17"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "HBsAg test date G.DE17 Value":
  "HBsAg test date G.DE17" O
  return O.value as dateTime
/* End of HBsAg test date G.DE17 */

/*
@dataElement: HIV.G.DE18 - HBsAg test result
@activity: HIV.D20 Diagnostics
@description: Hepatitis B virus test result (HBsAg)
*/
// TODO: Replace placeholder with relevant CQL logic
define "HBsAg test result G.DE18":
  exists "HBsAg test result G.DE18 Observation"
define "HBsAg test result G.DE18 Observation":
  [Observation: Concepts."HBsAg test result - HIV.G.DE18"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of HBsAg test result G.DE18 */

/*
@dataElement: HIV.G.DE19 - Positive
@activity: HIV.D20 Diagnostics
@description: HBsAg test result was positive
*/
// TODO: Replace placeholder with relevant CQL logic
define "Positive G.DE19":
  exists "Positive G.DE19 Condition"
    or exists "Positive G.DE19 Observation"
define "Positive G.DE19 Condition":
  [Condition: Concepts."Positive - HIV.G.DE19"]
define "Positive G.DE19 Observation":
  "HBsAg test result G.DE18 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Positive - HIV.G.DE19"
/* End of Positive G.DE19 */

/*
@dataElement: HIV.G.DE20 - Negative
@activity: HIV.D20 Diagnostics
@description: HBsAg test result was negative
*/
// TODO: Replace placeholder with relevant CQL logic
define "Negative G.DE20":
  exists "Negative G.DE20 Condition"
    or exists "Negative G.DE20 Observation"
define "Negative G.DE20 Condition":
  [Condition: Concepts."Negative - HIV.G.DE20"]
define "Negative G.DE20 Observation":
  "HBsAg test result G.DE18 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Negative - HIV.G.DE20"
/* End of Negative G.DE20 */

/*
@dataElement: HIV.G.DE21 - Indeterminate
@activity: HIV.D20 Diagnostics
@description: HBsAg test result was indeterminate
*/
// TODO: Replace placeholder with relevant CQL logic
define "Indeterminate G.DE21":
  exists "Indeterminate G.DE21 Condition"
    or exists "Indeterminate G.DE21 Observation"
define "Indeterminate G.DE21 Condition":
  [Condition: Concepts."Indeterminate - HIV.G.DE21"]
define "Indeterminate G.DE21 Observation":
  "HBsAg test result G.DE18 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Indeterminate - HIV.G.DE21"
/* End of Indeterminate G.DE21 */

/*
@dataElement: HIV.G.DE42 - HCV test date
@activity: HIV.D20 Diagnostics
@description: Date client was tested for hepatitis C virus (HCV antibody, HCV RNA or HCV core antigen)
*/
// TODO: Replace placeholder with relevant CQL logic
define "HCV test date G.DE42":
  [Observation: Concepts."HCV test date - HIV.G.DE42"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "HCV test date G.DE42 Value":
  "HCV test date G.DE42" O
  return O.value as dateTime
/* End of HCV test date G.DE42 */

/*
@dataElement: HIV.G.DE43 - HCV test result
@activity: HIV.D20 Diagnostics
@description: Hepatitis C virus test result (HCV antibody, HCV RNA or HCV core antigen)
*/
// TODO: Replace placeholder with relevant CQL logic
define "HCV test result G.DE43":
  exists "HCV test result G.DE43 Observation"
define "HCV test result G.DE43 Observation":
  [Observation: Concepts."HCV test result - HIV.G.DE43"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of HCV test result G.DE43 */

/*
@dataElement: HIV.G.DE44 - Positive
@activity: HIV.D20 Diagnostics
@description: HCV test result was positive
*/
// TODO: Replace placeholder with relevant CQL logic
define "Positive G.DE44":
  exists "Positive G.DE44 Condition"
    or exists "Positive G.DE44 Observation"
define "Positive G.DE44 Condition":
  [Condition: Concepts."Positive - HIV.G.DE44"]
define "Positive G.DE44 Observation":
  "HCV test result G.DE43 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Positive - HIV.G.DE44"
/* End of Positive G.DE44 */

/*
@dataElement: HIV.G.DE45 - Negative
@activity: HIV.D20 Diagnostics
@description: HCV test result was negative
*/
// TODO: Replace placeholder with relevant CQL logic
define "Negative G.DE45":
  exists "Negative G.DE45 Condition"
    or exists "Negative G.DE45 Observation"
define "Negative G.DE45 Condition":
  [Condition: Concepts."Negative - HIV.G.DE45"]
define "Negative G.DE45 Observation":
  "HCV test result G.DE43 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Negative - HIV.G.DE45"
/* End of Negative G.DE45 */

/*
@dataElement: HIV.G.DE46 - Indeterminate
@activity: HIV.D20 Diagnostics
@description: HCV test result was indeterminate
*/
// TODO: Replace placeholder with relevant CQL logic
define "Indeterminate G.DE46":
  exists "Indeterminate G.DE46 Condition"
    or exists "Indeterminate G.DE46 Observation"
define "Indeterminate G.DE46 Condition":
  [Condition: Concepts."Indeterminate - HIV.G.DE46"]
define "Indeterminate G.DE46 Observation":
  "HCV test result G.DE43 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Indeterminate - HIV.G.DE46"
/* End of Indeterminate G.DE46 */

/*
@dataElement: HIV.G.DE47 - HCV viral load test date
@activity: HIV.D20 Diagnostics
@description: Hepatitis C viral load test date
*/
// TODO: Replace placeholder with relevant CQL logic
define "HCV viral load test date G.DE47":
  [Observation: Concepts."HCV viral load test date - HIV.G.DE47"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "HCV viral load test date G.DE47 Value":
  "HCV viral load test date G.DE47" O
  return O.value as dateTime
/* End of HCV viral load test date G.DE47 */

/*
@dataElement: HIV.G.DE48 - HCV viral load test result
@activity: HIV.D20 Diagnostics
@description: Hepatitis C viral load test result (qualitative)
*/
// TODO: Replace placeholder with relevant CQL logic
define "HCV viral load test result G.DE48":
  exists "HCV viral load test result G.DE48 Observation"
define "HCV viral load test result G.DE48 Observation":
  [Observation: Concepts."HCV viral load test result - HIV.G.DE48"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of HCV viral load test result G.DE48 */

/*
@dataElement: HIV.G.DE49 - Detected
@activity: HIV.D20 Diagnostics
@description: HCV was detected
*/
// TODO: Replace placeholder with relevant CQL logic
define "Detected G.DE49":
  exists "Detected G.DE49 Condition"
    or exists "Detected G.DE49 Observation"
define "Detected G.DE49 Condition":
  [Condition: Concepts."Detected - HIV.G.DE49"]
define "Detected G.DE49 Observation":
  "HCV viral load test result G.DE48 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Detected - HIV.G.DE49"
/* End of Detected G.DE49 */

/*
@dataElement: HIV.G.DE50 - Not detected
@activity: HIV.D20 Diagnostics
@description: HCV was not detected
*/
// TODO: Replace placeholder with relevant CQL logic
define "Not detected G.DE50":
  exists "Not detected G.DE50 Condition"
    or exists "Not detected G.DE50 Observation"
define "Not detected G.DE50 Condition":
  [Condition: Concepts."Not detected - HIV.G.DE50"]
define "Not detected G.DE50 Observation":
  "HCV viral load test result G.DE48 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Not detected - HIV.G.DE50"
/* End of Not detected G.DE50 */

/*
@dataElement: HIV.G.DE69 - Syphilis test date
@activity: HIV.D20 Diagnostics
@description: Date of syphilis test
*/
// TODO: Replace placeholder with relevant CQL logic
define "Syphilis test date G.DE69":
  [Observation: Concepts."Syphilis test date - HIV.G.DE69"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Syphilis test date G.DE69 Value":
  "Syphilis test date G.DE69" O
  return O.value as dateTime
/* End of Syphilis test date G.DE69 */

/*
@dataElement: HIV.G.DE70 - Syphilis test result
@activity: HIV.D20 Diagnostics
@description: Result from syphilis test
*/
// TODO: Replace placeholder with relevant CQL logic
define "Syphilis test result G.DE70":
  exists "Syphilis test result G.DE70 Observation"
define "Syphilis test result G.DE70 Observation":
  [Observation: Concepts."Syphilis test result - HIV.G.DE70"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Syphilis test result G.DE70 */

/*
@dataElement: HIV.G.DE71 - Positive
@activity: HIV.D20 Diagnostics
@description: Test result is positive for syphilis
*/
// TODO: Replace placeholder with relevant CQL logic
define "Positive G.DE71":
  exists "Positive G.DE71 Condition"
    or exists "Positive G.DE71 Observation"
define "Positive G.DE71 Condition":
  [Condition: Concepts."Positive - HIV.G.DE71"]
define "Positive G.DE71 Observation":
  "Syphilis test result G.DE70 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Positive - HIV.G.DE71"
/* End of Positive G.DE71 */

/*
@dataElement: HIV.G.DE72 - Negative
@activity: HIV.D20 Diagnostics
@description: Test result is negative for syphilis
*/
// TODO: Replace placeholder with relevant CQL logic
define "Negative G.DE72":
  exists "Negative G.DE72 Condition"
    or exists "Negative G.DE72 Observation"
define "Negative G.DE72 Condition":
  [Condition: Concepts."Negative - HIV.G.DE72"]
define "Negative G.DE72 Observation":
  "Syphilis test result G.DE70 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Negative - HIV.G.DE72"
/* End of Negative G.DE72 */

/*
@dataElement: HIV.G.DE73 - Inconclusive
@activity: HIV.D20 Diagnostics
@description: Test result is inconclusive
*/
// TODO: Replace placeholder with relevant CQL logic
define "Inconclusive G.DE73":
  exists "Inconclusive G.DE73 Condition"
    or exists "Inconclusive G.DE73 Observation"
define "Inconclusive G.DE73 Condition":
  [Condition: Concepts."Inconclusive - HIV.G.DE73"]
define "Inconclusive G.DE73 Observation":
  "Syphilis test result G.DE70 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Inconclusive - HIV.G.DE73"
/* End of Inconclusive G.DE73 */

/*
@dataElement: HIV.H.DE34 - HIV status of partner or contact
@activity: HIV.B6 Capture or update client history
@description: HIV status of the partner or contact given by the index case
*/
define "HIV status of partner or contact":
  [Observation: Concepts."HIV status of partner or contact"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of HIV status of partner or contact */

/*
@dataElement: HIV.H.DE35 - Already knew positive
@activity: HIV.B6 Capture or update client history
@description: The partner or contact of the index case already knew they are HIV-positive
*/

define "Already knew positive":
  [Observation: Concepts."HIV status of partner or contact"] O 
    where O.status in { 'final', 'amended', 'corrected' }
    and exists(O.category OC where OC ~ ConceptsCustom."social-history")
    and O.code ~ Concepts."Already knew positive"
/* End of Already knew positive */

/*
@dataElement: HIV.H.DE36 - Newly diagnosed
@activity: HIV.B6 Capture or update client history
@description: The partner or contact of the index case is newly diagnosed as HIV-positive
*/

define "Newly diagnosed":
  [Observation: Concepts."HIV status of partner or contact"] O 
    where O.status in { 'final', 'amended', 'corrected' }
    and exists(O.category OC where OC ~ ConceptsCustom."social-history")
    and O.code ~ Concepts."Newly diagnosed"
/* End of Newly diagnosed */

/*
@dataElement: HIV.H.DE37 - Negative
@activity: HIV.B6 Capture or update client history
@description: The partner or contact of the index case is newly diagnosed is HIV-negative
*/

define "Negative H.DE37":
  [Observation: Concepts."HIV status of partner or contact"] O 
    where O.status in { 'final', 'amended', 'corrected' }
    and exists(O.category OC where OC ~ ConceptsCustom."social-history")
    and O.code ~ Concepts."Negative - HIV.H.DE37"
/* End of Negative H.DE37 */

/*
@dataElement: HIV.H.DE41 - HIV treatment outcome
@activity: HIV.H3 Record outreach and result
@description: The outcome for the client which is used for reporting retention/attrition.
*/

define "HIV treatment outcome":
  [Observation: Concepts."HIV treatment outcome"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of HIV treatment outcome */

/*
@dataElement: HIV.H.DE42 - Lost to follow-up
@activity: HIV.H3 Record outreach and result
@description: Twenty-eight days or more since last missed appointment 
*/
   
/* End of Lost to follow-up */

/*
@dataElement: HIV.H.DE43 - Transferred out
@activity: HIV.H3 Record outreach and result
@description: The client transferred to another facility
*/
define "Has transferred out":
  exists "Transferred out"

define "Transferred out":
  flatten{"Transferred out status","Transferred out statusHistory".statusHistory.period}

define "Transferred out status":
    [EpisodeOfCare] EOC
    where exists(EOC.type T where T ~ Concepts."On ART - HIV.H.DE47")
      and EOC.status = 'finished'
    return EOC.period

define "Transferred out statusHistory":
    [EpisodeOfCare] EOC
    where exists(EOC.type T where T ~ Concepts."On ART - HIV.H.DE47") 
    and (exists (
      EOC.statusHistory H
      where H.status = 'finished'
      and H.period is not null))
      


/* End of Transferred out */

/*
@dataElement: HIV.H.DE44 - Death documented
@activity: HIV.H3 Record outreach and result
@description: People living with HIV previously on ART who are confirmed to have died from any cause
*/
define "Death documented":
  case 
    when Patient.deceased is FHIR.boolean and Patient.deceased ~ true then Patient.meta.lastUpdated.value
    when Patient.deceased is FHIR.dateTime then Patient.deceased as FHIR.dateTime
    else null
  end

define "Has death documented":
  "Death documented" is not null
/* End of Death documented */

/*
@dataElement: HIV.H.DE45 - Refused stopped treatment
@activity: HIV.H3 Record outreach and result
@description: Client was contacted and confirmed to have stopped ART (reasons may include stigma and discrimination, faith healing, etc.)
*/

define "Refused stopped treatment":
  [MedicationStatement] MS
    where MS.status in {'stopped'}
    and exists(MS.reasonCode C where C ~ Concepts."On ART - HIV.H.DE47")
    and exists(MS.statusReason R where R ~ Concepts."Refused stopped treatment")
    sort by start of effective.toInterval()
/* End of Refused stopped treatment */

/*
@dataElement: HIV.H.DE47 - On ART
@activity: HIV.H3 Record outreach and result
@description: Client is currently taking ART 
*/

define "On ART H.DE47":
    [MedicationStatement] MS
    where exists(MS.reasonCode C where C ~ Concepts."On ART - HIV.H.DE47")
    sort by start of effective.toInterval()
/* End of On ART H.DE47 */

/*
@dataElement: HIV.H.DE73 - Date ART stopped
@activity: HIV.H3 Record outreach and result
@description: Date on which client stopped ART
*/
// TODO: Replace placeholder with relevant CQL logic
define "Date ART stopped H.DE73":
  [Observation: Concepts."Date ART stopped - HIV.H.DE73"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Date ART stopped H.DE73 Value":
  "Date ART stopped H.DE73" O
  return O.value as dateTime
/* End of Date ART stopped H.DE73 */

/*
@dataElement: HIV.H.DE74 - Reason ART stopped
@activity: HIV.H3 Record outreach and result
@description: Reason why client intentionally stopped ART
*/
// TODO: Replace placeholder with relevant CQL logic
define "Reason ART stopped H.DE74":
  exists "Reason ART stopped H.DE74 Observation"
define "Reason ART stopped H.DE74 Observation":
  [Observation: Concepts."Reason ART stopped - HIV.H.DE74"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Reason ART stopped H.DE74 */

/*
@dataElement: HIV.H.DE75 - Toxicity/side effects
@activity: HIV.H3 Record outreach and result
@description: Client stopped ART because of toxicity/side effects
*/

define "Toxicity/side effects H.DE75":
  [MedicationStatement] MS
    where MS.status in {'stopped'}
    and exists(MS.reasonCode C where C ~ Concepts."On ART - HIV.H.DE47")
    and exists(MS.statusReason R where R ~ Concepts."Toxicity/side effects - HIV.H.DE75")
    sort by start of effective.toInterval()
/* End of Toxicity/side effects H.DE75 */

/*
@dataElement: HIV.H.DE76 - Severe illness, hospitalization
@activity: HIV.H3 Record outreach and result
@description: Client stopped ART because of severe illness, hospitalization
*/
// TODO: Replace placeholder with relevant CQL logic
define "Severe illness, hospitalization H.DE76":
  exists "Severe illness, hospitalization H.DE76 Condition"
    or exists "Severe illness, hospitalization H.DE76 Observation"
define "Severe illness, hospitalization H.DE76 Condition":
  [Condition: Concepts."Severe illness, hospitalization - HIV.H.DE76"]
define "Severe illness, hospitalization H.DE76 Observation":
  "Reason ART stopped H.DE74 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Severe illness, hospitalization - HIV.H.DE76"
/* End of Severe illness, hospitalization H.DE76 */


/*
@dataElement: HIV.H.DE79 - Excluded HIV infection in infant
@activity: HIV.H3 Record outreach and result
@description: Client stopped ART because the infant was determined to not have HIV
*/
// TODO: Replace placeholder with relevant CQL logic
define "Excluded HIV infection in infant H.DE79":
  exists "Excluded HIV infection in infant H.DE79 Condition"
    or exists "Excluded HIV infection in infant H.DE79 Observation"
define "Excluded HIV infection in infant H.DE79 Condition":
  [Condition: Concepts."Excluded HIV infection in infant - HIV.H.DE79"]
define "Excluded HIV infection in infant H.DE79 Observation":
  "Reason ART stopped H.DE74 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Excluded HIV infection in infant - HIV.H.DE79"
/* End of Excluded HIV infection in infant H.DE79 */

/*
@dataElement: HIV.H.DE80 - Other reason for stopping ART
@activity: HIV.H3 Record outreach and result
@description: Client stopped ART for other reason
*/
// TODO: Replace placeholder with relevant CQL logic
define "Other reason for stopping ART H.DE80":
  exists "Other reason for stopping ART H.DE80 Condition"
    or exists "Other reason for stopping ART H.DE80 Observation"
define "Other reason for stopping ART H.DE80 Condition":
  [Condition: Concepts."Other reason for stopping ART - HIV.H.DE80"]
define "Other reason for stopping ART H.DE80 Observation":
  "Reason ART stopped H.DE74 Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Other reason for stopping ART - HIV.H.DE80"
/* End of Other reason for stopping ART H.DE80 */

/*
@dataElement: HIV.PRV.DE1 - At elevated risk for HIV acquisition
@activity: HIV.B6 Capture or update client history
@description: Client is at elevated risk for HIV acquisition, defined according to country/programme context
*/

define "At elevated risk for HIV acquisition PRV.DE1":
  [Observation] O
    where O.status in { 'final', 'amended', 'corrected' }
    and exists(O.category OC where OC ~ ConceptsCustom."social-history")
    and O.code ~ Concepts."At elevated risk for HIV acquisition - HIV.PRV.DE1"
/* End of At elevated risk for HIV acquisition PRV.DE1 */

/*
@dataElement: HIV.PRV.DE2 - HIV prevention intervention
@activity: HIV.B6 Capture or update client history
@description: HIV prevention intervention that client accessed
*/

define "HIV prevention intervention":
  exists ("PrEP service") or exists("OAMT") or "NSP" or exists("STI services") or exists("VMMC") or exists("Other PRV.DE8")
/* End of HIV prevention intervention */

/*
@dataElement: HIV.PRV.DE3 - PrEP service
@activity: HIV.B6 Capture or update client history
@description: Client accessed PrEP services
*/

define "PrEP service":
  [MedicationStatement] MS
    where exists(MS.reasonCode C where C ~ Concepts."PrEP for HIV prevention")
    sort by start of effective.toInterval()

 define "PrEP service date":
  [MedicationStatement] MS
    where exists(MS.reasonCode C where C ~ Concepts."PrEP for HIV prevention")
    return start of MS.effective.toInterval()   
/* End of PrEP service */

/*
@dataElement: HIV.PRV.DE4 - OAMT
@activity: HIV.B6 Capture or update client history
@description: Client accessed opioid agonist maintenance treatment (OAMT) services
*/

define "OAMT":
  flatten{"OAMT status","OAMT statusHistory".statusHistory.period}

define "OAMT status":
    [EpisodeOfCare] EOC
    where exists(EOC.type T where T ~ Concepts."OAMT")
    return EOC.period

define "OAMT statusHistory":
    [EpisodeOfCare] EOC
    where exists(EOC.type T where T ~ Concepts."OAMT") 
    and (exists (
      EOC.statusHistory H
      where H.period is not null))

define "OAMT status date":
  [EpisodeOfCare] EOC
    where exists(EOC.type T where T ~ Concepts."OAMT")
    return start of EOC.period

define "OAMT statusHistory date":
    [EpisodeOfCare] EOC
    where exists(EOC.type T where T ~ Concepts."OAMT") 
    and (exists (
      EOC.statusHistory H
      where H.period is not null))
    //return start of "OAMT statusHistory".statusHistory.period
    //need to ask brynn

/* End of OAMT */

/*
@dataElement: HIV.PRV.DE5 - NSP
@activity: HIV.B6 Capture or update client history
@description: Client accessed needle-syringe programme (NSP) services
*/

define "NSP":
  false
  // TODO: fix device use statement 
  // [DeviceUseStatement] DUS
  // with [Device: ConceptsCustom."needle-syringe"] D
  //     such that DUS.reasonReference.references(D) 
  //       and D.status in { 'active' }
  // where DUS.status = 'completed'

  // define "NSP date":
  // [DeviceUseStatement] DUS
  // with [Device: ConceptsCustom."needle-syringe"] D
  //     such that DUS.reasonReference.references(D) 
  //       and D.status in { 'active' }
  // where DUS.status = 'completed'
  // return start of DUS.timing.toInterval()
/* End of NSP */

/*
@dataElement: HIV.PRV.DE6 - STI services
@activity: HIV.B6 Capture or update client history
@description: Client accessed sexually transmitted infection (STI) services
*/

define "STI services":
  [Procedure] P
  where P.status = 'completed'
  and P.code ~ Concepts."STI testing and treatment services"

define "STI services date":
  [Procedure] P
  where P.status = 'completed'
  and P.code ~ Concepts."STI testing and treatment services"
  return start of P.performed.toInterval()
/* End of STI services */

/*
@dataElement: HIV.PRV.DE7 - VMMC
@activity: HIV.B6 Capture or update client history
@description: Client accessed voluntary medical male circumcision (VMMC) services
*/
// define "VMMC_done":
// [Procedure] P
//   where P.status = 'completed'
//   and P.code ~ Concepts."Voluntary medical male circumcision VMMC"


define "VMMC":
  [Procedure] P
  where P.status = 'completed'
  and P.code ~ Concepts."VMMC procedure"

define "VMMC date":
  "VMMC" P
  return start of P.performed.toInterval()
/* End of VMMC */

/*
@dataElement: HIV.PRV.DE8 - Other
@activity: HIV.B6 Capture or update client history
@description: Client accessed other HIV prevention services
*/

define "Other PRV.DE8":
  [Observation] O
    where O.status in {'final', 'amended'}
    and O.code ~ Concepts."HIV prevention intervention"
    and O.value ~ Concepts."Other - HIV.PRV.DE8"
    sort by start of effective.toInterval()

define "Other PRV.DE8 date":
  [Observation] O
    where O.status in {'final', 'amended'}
    and O.code ~ Concepts."HIV prevention intervention"
    and O.value ~ Concepts."Other - HIV.PRV.DE8"
  return start of O.effective.toInterval()
  
/* End of Other PRV.DE8 */

/*
@dataElement: HIV.PRV.DE10 - Date accessed HIV prevention intervention
@activity: HIV.B6 Capture or update client history
@description: Date the client accessed HIV prevention intervention
*/
// TODO: NSP date requires fix to DeviceUseStatement support
define "Date accessed HIV prevention intervention": 
  flatten{"PrEP service date", /*"NSP date",*/ "STI services date", "VMMC date", "Other PRV.DE8 date","OAMT status date"}
  
  //, "OAMT","NSP".timing,"STI services".performed,"VMMC".performed,"Other PRV.DE8".effective}
/* End of Date accessed HIV prevention intervention */

/*
@dataElement: HIV.PRV.DE11 - HIV status of contact
@activity: HIV.B6 Capture or update client history
@description: The HIV status of the client's contact
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV status of contact":
  exists "HIV status of contact Observation"
define "HIV status of contact Observation":
  [Observation: Concepts."HIV status of contact"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of HIV status of contact */

/*
@dataElement: HIV.PRV.DE12 - HIV-positive
@activity: HIV.B6 Capture or update client history
@description: Client's contact is HIV-positive
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV-positive PRV.DE12":
  exists "HIV-positive PRV.DE12 Condition"
    or exists "HIV-positive PRV.DE12 Observation"
define "HIV-positive PRV.DE12 Condition":
  [Condition: Concepts."HIV-positive - HIV.PRV.DE12"]
define "HIV-positive PRV.DE12 Observation":
  "HIV status of contact Observation" O
      where O.value ~ Concepts."HIV-positive - HIV.PRV.DE12"
/* End of HIV-positive PRV.DE12 */

/*
@dataElement: HIV.PRV.DE13 - HIV-negative
@activity: HIV.B6 Capture or update client history
@description: Client's contact is HIV-negative
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV-negative PRV.DE13":
  exists "HIV-negative PRV.DE13 Condition"
    or exists "HIV-negative PRV.DE13 Observation"
define "HIV-negative PRV.DE13 Condition":
  [Condition: Concepts."HIV-negative - HIV.PRV.DE13"]
define "HIV-negative PRV.DE13 Observation":
  "HIV status of contact Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."HIV-negative - HIV.PRV.DE13"
/* End of HIV-negative PRV.DE13 */

/*
@dataElement: HIV.PRV.DE14 - Unknown
@activity: HIV.B6 Capture or update client history
@description: Client does not know contact's HIV status
*/
// TODO: Replace placeholder with relevant CQL logic
define "Unknown PRV.DE14":
  exists "Unknown PRV.DE14 Condition"
    or exists "Unknown PRV.DE14 Observation"

define "Unknown PRV.DE14 Condition":
  [Condition: Concepts."Unknown - HIV.PRV.DE14"]

define "Unknown PRV.DE14 Observation":
  "HIV status of contact Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Unknown - HIV.PRV.DE14"
/* End of Unknown PRV.DE14 */

/*
@dataElement: HIV.PRV.DE15 - Date injecting equipment provided
@activity: HIV.B21 Offer prevention options
@description: Date client was provided with injecting equipment
*/

define "Date injecting equipment provided":
  null
  // [DeviceUseStatement] DUS
  // with [Device] D
  //   such that DUS.device.references(D)
  //   and D.type ~ ConceptsCustom."needle-syringe"
  // where DUS.status = 'completed'


/* End of Date injecting equipment provided */

/*
@dataElement: HIV.PRV.DE17 - Date OAMT initiated
@activity: HIV.B21 Offer prevention options
@description: Date client initiated opioid agonist maintenance treatment (OAMT)
*/
define "Date OAMT initiated":
  true
/* End of Date OAMT initiated */

/*
@dataElement: HIV.PRV.DE20 - Currently on OAMT
@activity: HIV.B6 Capture or update client history
@description: Client is currently on opioid agonist maintenance treatment (OAMT) at reporting date, defined according to country/program to account for medication dispensed and LTFU criterion
*/
// TODO: Replace placeholder with relevant CQL logic
define "Currently on OAMT":
  [MedicationStatement] MS
    where exists(MS.reasonCode C where C ~ Concepts."OAMT")
    
/* End of Currently on OAMT */

/*
@dataElement: HIV.PRV.DE21 - Retained on OAMT
@activity: HIV.B6 Capture or update client history
@description: Client is retained on opioid agonist maintenance treatment (OAMT) at reporting date, defined according to country/program to account for medication dispensed and LTFU criterion
*/
// TODO: Replace placeholder with relevant CQL logic
define "Retained on OAMT":
  exists "Retained on OAMT Observation"
define "Retained on OAMT Observation":
  [Observation: Concepts."Retained on OAMT"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value is true
/* End of Retained on OAMT */


/*
@dataElement: HIV.PRV.DE22 - Client being inducted on OAMT
@activity: HIV.B6 Capture or update client history
@description: Client is retained on opioid agonist maintenance treatment (OAMT) at reporting date, defined according to country/program to account for medication dispensed and LTFU criterion
*/

define "Client being inducted on OAMT":
  [Observation: Concepts."Client being inducted on OAMT"]

/*
@dataElement: HIV.PRV.DE23 - Client on reducing doses of OAMT
@activity: HIV.B6 Capture or update client history
@description: Client is retained on opioid agonist maintenance treatment (OAMT) at reporting date, defined according to country/program to account for medication dispensed and LTFU criterion
*/

define "Client on reducing doses of OAMT":
  [Observation: Concepts."Client on reducing doses of OAMT"]


/*
@dataElement: HIV.PRV.DE25 - Date of loss to follow-up or OAMT stopped
@activity: HIV.B6 Capture or update client history
@description: Date of loss to follow-up or opioid agonist maintenance treatment (OAMT) stopped
*/
// TODO: Replace placeholder with relevant CQL logic
define "Date of loss to follow-up or OAMT stopped":
  [Observation: Concepts."Date of loss to follow-up or OAMT stopped"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Date of loss to follow-up or OAMT stopped Value":
  "Date of loss to follow-up or OAMT stopped" O
  return O.value as dateTime
/* End of Date of loss to follow-up or OAMT stopped */

/*
@dataElement: HIV.PRV.DE27 - Date medications prescribed
@activity: HIV.C23 Prescribe or administer PrEP or PEP
@description: Date the client was prescribed medications
*/
// TODO: Replace placeholder with relevant CQL logic
define "Date medications prescribed PRV.DE27":
  [Observation: Concepts."Date medications prescribed - HIV.PRV.DE27"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Date medications prescribed PRV.DE27 Value":
  "Date medications prescribed PRV.DE27" O
  return O.value as dateTime
/* End of Date medications prescribed PRV.DE27 */

/*
@dataElement: HIV.PRV.DE28 - Number of days prescribed
@activity: HIV.C23 Prescribe or administer PrEP or PEP
@description: Days of medication client has been prescribed
*/
// TODO: Replace placeholder with relevant CQL logic
define "Number of days prescribed PRV.DE28":
  [Observation: Concepts."Number of days prescribed - HIV.PRV.DE28"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Number of days prescribed PRV.DE28 Value":
  "Number of days prescribed PRV.DE28" O
  return O.value as integer
/* End of Number of days prescribed PRV.DE28 */

/*
@dataElement: HIV.SRV.DE1 - HIV test date
@activity: HIV.F8 Test infant/child for HIV using testing algorithm
@description: Date of the HIV test
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV test date SRV.DE1":
  [Observation: Concepts."HIV test date - HIV.SRV.DE1"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "HIV test date SRV.DE1 Value":
  "HIV test date SRV.DE1" O
  return O.value as dateTime
/* End of HIV test date SRV.DE1 */

/*
@dataElement: HIV.SRV.DE2 - HIV test result
@activity: HIV.B7 Test for HIV using testing algorithm
@description: The result from HIV testing after applying the testing algorithm
*/
define "HIV test result SRV.DE2":
  [Observation: Concepts."HIV test result - HIV.SRV.DE2"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of HIV test result SRV.DE2 */

/*
@dataElement: HIV.SRV.DE3 - Baseline CD4 count
@activity: HIV.D20 Diagnostics
@description: CD4 count performed at HIV diagnosis
*/

define "Baseline CD4 count SRV.DE3":
  [Observation: Concepts."Baseline CD4 count - HIV.SRV.DE3"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Baseline CD4 count SRV.DE3 Value":
  "Baseline CD4 count SRV.DE3" O
  return O.value as integer
/* End of Baseline CD4 count SRV.DE3 */

/*
@dataElement: HIV.SRV.DE4 - Date of baseline CD4 count test
@activity: HIV.D20 Diagnostics
@description: Date and time when baseline CD4 count test was conducted
*/

define "Date of baseline CD4 count test SRV.DE4":
  "Baseline CD4 count SRV.DE3" O
  return O.effective.toInterval()
/* End of Date of baseline CD4 count test SRV.DE4 */

/*
@dataElement: HIV.SRV.DE5 - HIV clinical stage
@activity: HIV.D8 Capture or update client history
@description: WHO clinical stage of client based on signs and symptoms. WHO clinical staging is a way to categorize HIV disease severity based on new or recurrent clinical events. There are 4 WHO clinical stages that range from mild symptoms (WHO clinical stage 1) to severe symptoms (WHO clinical stage 4).
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV clinical stage SRV.DE5":
  exists "HIV clinical stage SRV.DE5 Observation"
define "HIV clinical stage SRV.DE5 Observation":
  [Observation: Concepts."HIV clinical stage - HIV.SRV.DE5"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of HIV clinical stage SRV.DE5 */

/*
@dataElement: HIV.SRV.DE6 - ART start date
@activity: HIV.B8 Provide post-test counselling
@description: The date on which the client started or restarted antiretroviral therapy (ART)
*/
// TODO: Replace placeholder with relevant CQL logic
define "ART start date SRV.DE6":
  [Observation: Concepts."ART start date - HIV.SRV.DE6"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "ART start date SRV.DE6 Value":
  "ART start date SRV.DE6" O
  return O.value as dateTime
/* End of ART start date SRV.DE6 */

/*
@dataElement: HIV.SRV.DE7 - Currently pregnant
@activity: HIV.B6 Capture or update client history
@description: Client is currently pregnant
*/

define "Currently pregnant SRV.DE7":
  exists "Currently pregnant SRV.DE7 Condition"
define "Currently pregnant SRV.DE7 Condition":
  [Condition: Concepts."Currently pregnant - HIV.SRV.DE7"]
/* End of Currently pregnant SRV.DE7 */

/*
@dataElement: HIV.SRV.DE8 - CD4 count
@activity: HIV.D20 Diagnostics
@description: CD4 cell count in cells/mm^3
*/
// TODO: Replace placeholder with relevant CQL logic
define "CD4 count SRV.DE8":
  [Observation: Concepts."CD4 count - HIV.SRV.DE8"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "CD4 count SRV.DE8 Value":
  "CD4 count SRV.DE8" O
  return O.value as integer
/* End of CD4 count SRV.DE8 */

/*
@dataElement: HIV.SRV.DE12 - Date of viral load sample collection
@activity: HIV.D10 Counsel returning client
@description: Date and time when the sample was collected to test the client's HIV viral load
*/
// TODO: Replace placeholder with relevant CQL logic
define "Date of viral load sample collection SRV.DE12":
  [Observation: Concepts."Date of viral load sample collection - HIV.SRV.DE12"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Date of viral load sample collection SRV.DE12 Value":
  "Date of viral load sample collection SRV.DE12" O
  return O.value as dateTime
/* End of Date of viral load sample collection SRV.DE12 */

/*
@dataElement: HIV.SRV.DE13 - Viral load test result
@activity: HIV.D20 Diagnostics
@description: Result from the viral load test in number of copies/mL
*/
// TODO: Replace placeholder with relevant CQL logic
define "Viral load test result SRV.DE13":
  [Observation: Concepts."Viral load test result - HIV.SRV.DE13"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Viral load test result SRV.DE13 Value":
  "Viral load test result SRV.DE13" O
  return O.value as integer
/* End of Viral load test result SRV.DE13 */

/*
@dataElement: HIV.SRV.DE15 - Visit date
@activity: HIV.A2 Gather client details
@description: The date and time of the client's visit
*/

define "Visit date SRV.DE15":
  [Encounter] E
  return E.period
/* End of Visit date SRV.DE15 */

/*
@dataElement: HIV.SRV.DE18 - ANC contact date
@activity: HIV.E1 Capture or update mother's history
@description: The date and time of the client's ANC contact (in the ANC DAK this is called 'Contact date')
*/
// TODO: Replace placeholder with relevant CQL logic
define "ANC contact date SRV.DE18":
  [Observation: Concepts."ANC contact date - HIV.SRV.DE18"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "ANC contact date SRV.DE18 Value":
  "ANC contact date SRV.DE18" O
  return O.value as dateTime
/* End of ANC contact date SRV.DE18 */

/*
@dataElement: HIV.SRV.DE20 - HIV-exposed infant or child
@activity: HIV.F6 Check whether infant/child had HIV exposure
@description: Whether the infant or child was determined to have had HIV exposure
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV-exposed infant or child SRV.DE20":
  exists "HIV-exposed infant or child SRV.DE20 Observation"
define "HIV-exposed infant or child SRV.DE20 Observation":
  [Observation: Concepts."HIV-exposed infant or child - HIV.SRV.DE20"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value is true
/* End of HIV-exposed infant or child SRV.DE20 */

/*
@dataElement: HIV.SRV.DE21 - Test result of HIV assay 1
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: The result of the first HIV assay in the testing strategy
*/
// TODO: Replace placeholder with relevant CQL logic
define "Test result of HIV assay 1 SRV.DE21":
  exists "Test result of HIV assay 1 SRV.DE21 Observation"
define "Test result of HIV assay 1 SRV.DE21 Observation":
  [Observation: Concepts."Test result of HIV assay 1 - HIV.SRV.DE21"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Test result of HIV assay 1 SRV.DE21 */

/*
@dataElement: HIV.SRV.DE22 - Final diagnosis of HIV-exposed infant
@activity: HIV.F20 Record infant's/child's final HIV diagnosis
@description: HIV-exposed infant final status at 18 months or 3 months after cessation of breastfeeding (whichever is later).
*/
// TODO: Replace placeholder with relevant CQL logic
define "Final diagnosis of HIV-exposed infant SRV.DE22":
  exists "Final diagnosis of HIV-exposed infant SRV.DE22 Observation"
define "Final diagnosis of HIV-exposed infant SRV.DE22 Observation":
  [Observation: Concepts."Final diagnosis of HIV-exposed infant - HIV.SRV.DE22"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Final diagnosis of HIV-exposed infant SRV.DE22 */

/*
@dataElement: HIV.Config.DE6 - Malaria-endemic setting
@activity: HIV.Configuration
@description: Whether the setting is a malaria-endemic setting
*/
// TODO: Replace placeholder with relevant CQL logic
define "Malaria-endemic setting":
  exists "Malaria-endemic setting Observation"
define "Malaria-endemic setting Observation":
  [Observation: Concepts."Malaria-endemic setting"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value is true
/* End of Malaria-endemic setting */

/*
@dataElement: HIV.Config.DE12 - HIV burden of the setting
@activity: HIV.Configuration
@description: HIV burden of the setting (high or low) based on the national HIV prevalence or where the HIV prevalence and/or incidence in a geographical setting is higher than national prevalence and, therefore, needs priority in the HIV response
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV burden of the setting":
  exists "HIV burden of the setting Observation"
define "HIV burden of the setting Observation":
  [Observation: Concepts."HIV burden of the setting"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of HIV burden of the setting */

/*
@dataElement: HIV.Config.DE13 - High HIV burden setting
@activity: HIV.Configuration
@description: Settings with >5% national HIV prevalence and subpopulations and geographic settings where HIV prevalence and/or incidence is higher than nationally.
*/
// TODO: Replace placeholder with relevant CQL logic
define "High HIV burden setting":
  exists "High HIV burden setting Condition"
    or exists "High HIV burden setting Observation"
define "High HIV burden setting Condition":
  [Condition: Concepts."High HIV burden setting"]
define "High HIV burden setting Observation":
  "HIV burden of the setting Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."High HIV burden setting"
/* End of High HIV burden setting */

/*
@dataElement: HIV.Config.DE14 - Low HIV burden setting
@activity: HIV.Configuration
@description: Settings with <5% HIV national prevalence but where certain populations (primarily key populations and their partners) and geographic settings may have higher HIV prevalence and/or incidence than nationally and, therefore, need priority in the HIV response
*/
// TODO: Replace placeholder with relevant CQL logic
define "Low HIV burden setting":
  exists "Low HIV burden setting Condition"
    or exists "Low HIV burden setting Observation"
define "Low HIV burden setting Condition":
  [Condition: Concepts."Low HIV burden setting"]
define "Low HIV burden setting Observation":
  "HIV burden of the setting Observation" O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value ~ Concepts."Low HIV burden setting"
/* End of Low HIV burden setting */

/*
@dataElement: HIV.Config.DE15 - HPV DNA testing operational at the health facility
@activity: HIV.Configuration
@description: Is HPV DNA testing operational at the health facility for cervical cancer screening?
*/
// TODO: Replace placeholder with relevant CQL logic
define "HPV DNA testing operational at the health facility":
  exists "HPV DNA testing operational at the health facility Observation"
define "HPV DNA testing operational at the health facility Observation":
  [Observation: Concepts."HPV DNA testing operational at the health facility"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.value is true
/* End of HPV DNA testing operational at the health facility */

/*
@dataElement: HIV.Config.DE19 - Other priority populations
@activity: HIV.Configuration
@description: Other populations of priority of HIV prevention and care in local context (provided during adaptation)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Other priority populations":
  exists "Other priority populations Observation"
define "Other priority populations Observation":
  [Observation: Concepts."Other priority populations"] O
    where O.status in { 'final', 'amended', 'corrected' }
/* End of Other priority populations */

/*
@dataElement: HIV.Config.DE20 - Reporting period end date
@activity: HIV.Configuration
@description: End date of the reporting period
*/
// TODO: Replace placeholder with relevant CQL logic
define "Reporting period end date":
  [Observation: Concepts."Reporting period end date"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Reporting period end date Value":
  "Reporting period end date" O
  return O.value as dateTime
/* End of Reporting period end date */

/*
@dataElement: HIV.Config.DE21 - Reporting period start date
@activity: HIV.Configuration
@description: Start date of the reporting period
*/
// TODO: Replace placeholder with relevant CQL logic
define "Reporting period start date":
  [Observation: Concepts."Reporting period start date"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Reporting period start date Value":
  "Reporting period start date" O
  return O.value as dateTime
/* End of Reporting period start date */

/*
@dataElement: HIV.Config.DE22 - Reporting date
@activity: HIV.Configuration
@description: Reporting date, for surveys performed on a specific date
*/
// TODO: Replace placeholder with relevant CQL logic
define "Reporting date":
  [Observation: Concepts."Reporting date"] O
    where O.status in { 'final', 'amended', 'corrected' }
define "Reporting date Value":
  "Reporting date" O
  return O.value as dateTime
/* End of Reporting date */


/*
 * Custom elements and logic for use DT and IND CQL Libraries
 */

