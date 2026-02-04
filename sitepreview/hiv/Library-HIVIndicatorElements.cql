library HIVIndicatorElements

using FHIR version '4.0.1'

//include fhir.cqf.common.FHIRCommon called FC
include FHIRHelpers version '4.0.1'

include WHOConcepts
include WHOCommon called WC
include WHOElements called WE

include HIVConcepts version '0.0.2' called Concepts
include HIVConceptsCustom version '0.0.1' called ConceptsCustom
include HIVElements called Elements
include HIVCommon called Common
include HIVConfig called Config

parameter "Measurement Period" Interval<Date> default Interval[@2024-01-01, @2024-12-30]

context Patient

/**
 * HIV Elements
 */

/* General Data Elements */

// From Common

define "Community_testing":
  exists([Observation] O
    with [Encounter] E
      such that O.encounter.references(E) and exists(E.location.physicalType PT where PT ~  Concepts."Community-level testing") 
  where (O.status in { 'final', 'amended' }
  and O.code ~ Concepts."Rapid diagnostic test for HIV - HIV.B.DE82"
  and O.issued after start of "Measurement Period"
  and O.issued before end of "Measurement Period"))
  

/*@triggeredBy Encounter with location = facility level testing*/
define "Facility_testing":
  exists([Observation] O
    with [Encounter] E
      such that O.encounter.references(E) and exists(E.location.physicalType PT where PT ~  Concepts."Facility-level testing")
  where (O.status in { 'final', 'amended' }
  and O.code ~ Concepts."Rapid diagnostic test for HIV - HIV.B.DE82"
  and O.issued after start of "Measurement Period"
  and O.issued before end of "Measurement Period")
  )

//lifted this from ANC DAK
define "ANC_case":
exists(
    [EpisodeOfCare] EOC
    where exists(EOC.type T where T ~ Concepts."Already on ART at first antenatal care visit")
    and (exists (
      EOC.statusHistory H
      where H.period overlaps "Measurement Period"
    ) 
    or (
      EOC.period overlaps "Measurement Period"
    )
    )
    )
  
define "methadone_prescribed at date":
[MedicationRequest] MR
  where MR.status = 'completed'
    and MR.intent = 'order'
    and MR.medication ~ ConceptsCustom."methadone"
    //and "GetMedicationDailyDose"(MR.dosageInstruction, "DosesPerDay"(singleton from MR.dosageInstruction.timing.repeat.frequencyMax)) >= 60 'mg/d'
    and MR.MedicationRequestPeriod() starts before start of "Measurement Period"
    and MR.MedicationRequestPeriod() ends after end of "Measurement Period"

define "methadone_prescribed >= 60mg":
  "methadone_prescribed at date" MR
    where exists(MR.dosageInstruction d 
      where exists d.doseAndRate dr
       where dr.dose.value >= 60)

define "buprenorphine_prescribed at date":
[MedicationRequest] MR
  where MR.status = 'completed'
    and MR.intent = 'order'
    and MR.medication ~ ConceptsCustom."buprenorphine"
    //and "GetMedicationDailyDose"(MR.dosageInstruction, "DosesPerDay"(singleton from MR.dosageInstruction.timing.repeat.frequencyMax)) >= 60 'mg/d'
    and MR.MedicationRequestPeriod() starts before start of "Measurement Period"
    and MR.MedicationRequestPeriod() ends after end of "Measurement Period"

define "buprenorphine_prescribed >= 8mg":
  "buprenorphine_prescribed at date" MR
    where exists(MR.dosageInstruction d 
      where exists d.doseAndRate dr
       where dr.dose.value >= 60)

define "OAMT_initiated":
exists(
    [EpisodeOfCare] EOC
    where exists(EOC.type T where T ~ Concepts."OAMT")
    and (exists (
      EOC.statusHistory H
      where H.period starts after start of "Measurement Period"
      and H.period starts before end of "Measurement Period"
    ) 
    or (
      EOC.period starts after start of "Measurement Period"
      and EOC.period starts before end of "Measurement Period"
    )
    )
    )

define "OAMT_retained":
exists(
    [EpisodeOfCare] EOC
    where exists(EOC.type T where T ~ Concepts."OAMT")
    and (exists (
      EOC.statusHistory H
      where H.period starts after start of "Measurement Period"
      and H.period starts before end of "Measurement Period"
      and H.period ends after (end of "Measurement Period" + 6 months)
    ) 
    or (
      EOC.period starts after start of "Measurement Period"
      and EOC.period starts before end of "Measurement Period"
      and (EOC.period ends after (end of "Measurement Period" + 6 months)
      or end of EOC.period is null)
    )
    )
    )

define "PEP Prescribed before start of Measurement Period and Completed":
  [MedicationStatement] MS
    with [MedicationRequest] MR
      such that MS.basedOn.references(MR) and MR.status = 'completed'
        and MR.intent = 'order'
        and MR.medication ~ Concepts."PEP for HIV prevention"
        and MR.authoredOn before end of "Measurement Period"
  where (MS.status = 'completed'
  and exists(MS.reasonCode C where C ~ Concepts."PrEP for HIV prevention")
  )

define "PEP Prescribed during Measurement Period and Completed":
  [MedicationStatement] MS
    with [MedicationRequest] MR
      such that MS.basedOn.references(MR) and MR.status = 'completed'
        and MR.intent = 'order'
        and MR.medication ~ Concepts."PEP for HIV prevention"
        and MR.authoredOn after start of "Measurement Period"
        and MR.authoredOn before end of "Measurement Period"
  where (MS.status = 'completed'
  and exists(MS.reasonCode C where C ~ Concepts."PrEP for HIV prevention")
  )

define "HIV Test Positive After PEP Prescribed during Measurement Period":
  [Observation: Concepts."HIV test result - HIV.B.DE111"] O
    with [MedicationRequest] MR
      such that O.basedOn.references(MR) and MR.status = 'completed'
        and MR.intent = 'order'
        and MR.medication ~ Concepts."PEP for HIV prevention"
        and MR.authoredOn after start of "Measurement Period"
        and MR.authoredOn before end of "Measurement Period"
        and O.issued before (MR.authoredOn + 3 months)
  where ( O.status in {'final', 'amended'}
    and O.value ~ Concepts."HIV-positive - HIV.B.DE112"
  )


define "Patient Deceased during Measurement Period":
  case 
    when Patient.deceased is FHIR.boolean and Patient.deceased ~ true then Patient.meta.lastUpdated before end of  "Measurement Period" and  Patient.meta.lastUpdated after start of "Measurement Period"
    when Patient.deceased is FHIR.dateTime then Patient.deceased as FHIR.dateTime before end of  "Measurement Period" and Patient.deceased as FHIR.dateTime after start of "Measurement Period"
    else false
  end


// HIV Testing
define "Elevated Viral load test during Measurement Period":
  "Viral load test result D.DE387" VL
    with Elements."viral load sample collection" P 
    such that VL.partOf.references(P) and P.performed.toInterval() during "Measurement Period"
    where VL.value > 1000 
    sort by start of effective.toInterval()


define "Negative Tests within Measurement Period":
  Elements."HIV-negative test result" O
    // with Elements."At elevated risk for HIV acquisition B.DE225" HIV
    // such that O.hasMember.references(HIV)
    where O.effective.toInterval() starts during "Measurement Period"
    sort by start of effective.toInterval()

define "First Negative Test within Measurement Period":
  (First("Negative Tests within Measurement Period"))

define "Negative Tests after First Negative Test":
  Elements."HIV-negative test result" O
    // with Elements."At elevated risk for HIV acquisition B.DE225" HIV
    //   such that O.hasMember.references(HIV)
    where  O.effective.toInterval() starts after start of "First Negative Test within Measurement Period".effective.toInterval()
      and O.effective.toInterval() starts before (start of "First Negative Test within Measurement Period".effective.toInterval() + Config."Testing Interval")
    sort by start of effective.toInterval()

define "Lost to Follow Up during the measurement period":
  exists(Elements."On ART H.DE47" H
   where H.effective starts before end of "Measurement Period"
    and H.effective ends after start of "Measurement Period"
	  and not (H.effective ends after (end of "Measurement Period" - Config."LTFU Days"))
   )

// HIV Status

// ART Status

define "ART Medication Statement":
  Elements."ART Medication Statement" MS
  where MS.effective.toInterval() during "Measurement Period"
  sort by start of effective.toInterval()

define "On ART":
  exists "ART Medication Statement"

define "ART Start Date":
  "ART Medication Statement" MS
  return start of MS.effective.toInterval()

define "ART Duration in Months":
  "ART Medication Statement" MS
  return duration in months of MS.effective.toInterval()

define "By ART initiation":
  case
    when Sum("ART Duration in Months") < 12 then '<12 months on ART'
    when Sum("ART Duration in Months") >= 12 then '12+ months on ART'
    else 'Unknown'
  end

// Geographic Region
define "By Geographic Region Stratifier":
    First(Patient.address A where A.use in { 'home' }).state

/*
 * Other Stratifiers
 */
define hiv_exposure_type:
  List<String>{
    if Elements.Exposure_Occupational then 'Occupational' else null,
    if Elements.Exposure_Non_Occupational_violent then 'Non-occupational violent' else null,
    if Elements.Exposure_Non_Occupational_consensual_sex then 'Non-occupational consensual sex' else null
  }

define setting:
  case
    when Community_testing then Concepts."Community-level testing"
    when Facility_testing then Concepts."Facility-level testing"
    else null
  end

define anc:
  case
    when "ANC contact date E.DE85" then ConceptsCustom."Antenatal care contact" 
    else null
  end

define tb:
  case 
      when "Diagnosed TB"  then Concepts."Diagnosed TB"
      when "Presumptive TB D.DE945" then Concepts."Presumptive TB - HIV.D.DE945"
      when "TB excluded" then Concepts."TB excluded"
      else null
  end


define prep_product:
  List<String>{
    if "TDF + FTC C.DE18" or "TDF C.DE19" or "TDF + 3TC C.DE20" or "Other TDF-based regimen" then 'PREP Product Oral' else null,
    if "Dapivirine vaginal ring DVR C.DE22" then 'PREP Product long-acting device' else null,
    if "CAB-LA C.DE23" then 'PREP Product long-acting injectable' else null
  }

define prep_experience:
  List<String>{
    if "First-time user C.DE25" then 'PREP first time' else null,
    if "Continuing user" then 'PREP Continuing user' else null,
    if "Restarting following a period of not taking PrEP" then 'PREP Restarting' else null
  }

define prep_dosing:
  List<String>{
    if "Daily oral PrEP" then 'Daily oral PrEP' else null,
    if "Event-driven PrEP 2+1+1" then 'Event driven PrEP' else null,
    if "Other PrEP dosing type" then 'Other PrEP dosing type' else null
  }

define "Treatment outcome category":
  List<String>{
    if "Is lost to follow-up" then 'LTFU' else null,
    if "Has transferred out" then 'Transfer Out' else null,
    if "Has death documented" then 'Death' else null,
    if "Refused stopped treatment" then 'Stopped' else null,
    if "On ART H.DE47" then 'On ART' else null
  }

define "HIV status of partner or contact":
  case 
      when "Already knew positive" then Concepts."Already knew positive"
      when "Newly diagnosed" then Concepts."Newly diagnosed"
      when "Negative H.DE37" then Concepts."Negative - HIV.H.DE37"
      else null
  end




// Auto-generated Elements from DAK Data Dictionary
//   Entries based on DAK Data Dictionary for Data Elements marked as used
//   in at least one Decision Support Table or Aggregate Indicator

/*
@dataElement: HIV.A.DE3 - Visit date
@activity: HIV.A2 Gather client details
@description: The date and time of the client's visit
*/
define "HTS Visit":
  Elements."HTS Visit" E
    where E.period.toInterval() during "Measurement Period"

define "Visit date":
  "HTS Visit" E
  return E.period.start

/* End of Visit date A.DE3 */

/*
@dataElement: HIV.A.DE17 - Age
@activity: HIV.A6.1 Review sociodemographic data with client | HIV.A5 Create new client record
@description: Calculated age (number of years) of the client based on date of birth
*/
define "Age In Years":
  AgeInYearsAt(start of "Measurement Period")

define "Age In Months":
  AgeInMonthsAt(start of "Measurement Period")

define "Age In Days":
  AgeInDaysAt(start of "Measurement Period")



/*
 * By Age Stratifiers
 * (0–4, 5–9, 10–14, 15–19, 20–24, 25–29, 30–34, 35–39, 40–44, 45–49, 50+ years)
 * 
 */
define "By Age Stratifier":
  case 
      when "Age In Years" <= 4 then '0-4'
      when "Age In Years" <= 9 then '5-9'
      when "Age In Years" <= 14 then '10–14'
      when "Age In Years" <= 19 then '15–19'
      when "Age In Years" <= 24 then '20–24'
      when "Age In Years" <= 29 then '25–29'
      when "Age In Years" <= 34 then '30–34'
      when "Age In Years" <= 39 then '35–39'
      when "Age In Years" <= 44 then '40–44'
      when "Age In Years" <= 49 then '45–49'
      when "Age In Years" >= 50 then '50+'
      else null
  end
  
  /*
 * By Age Stratifiers
 * Age (0–4, 5–9, 10–14, 15–19, 20–24, 25–49, 50+ years)
 * 
 */
define "By Age Stratifier 2":
  case 
      when "Age In Years" <= 4 then '0-4'
      when "Age In Years" <= 9 then '5-9'
      when "Age In Years" <= 14 then '10–14'
      when "Age In Years" <= 19 then '15–19'
      when "Age In Years" <= 24 then '20–24'
      when "Age In Years" <= 49 then '25–49'
      when "Age In Years" >= 50 then '50+'
      else null
  end

define "By Age Stratifier 3":
  case 
      when "Age In Years" >= 15 and "Age In Years"<= 19 then '15-19'
      when "Age In Years" <= 24 then '20-24'
      when "Age In Years" <= 49 then '25–49'
      when "Age In Years" >= 50 then '50+'
      else null
  end

/* End of Age */

define "By Age Stratifier 4":
  case 
      when "Age In Years" < 25 then '<25'
      when "Age In Years" >= 25 then '25+'
      else null
  end

define "By Age Stratifier 5":
  case 
      when "Age In Years" < 15 then '<15'
      when "Age In Years" >= 15 and "Age In Years"<= 19 then '15-19'
      when "Age In Years" <= 24 then '20-24'
      when "Age In Years" <= 49 then '25–49'
      when "Age In Years" >= 50 then '50+'
      else null
  end

//(<0–4, 5–9, 10–14, 15-19, >19 years)
define "By Age Stratifier 6":
  case 
      when "Age In Years" < 5  then '<0–4'
      when "Age In Years"<= 9 then '5–9'
      when "Age In Years" <= 14 then '10–14'
      when "Age In Years" <= 19 then '15-19'
      when "Age In Years" >= 20 then '>19'
      else null
  end

  //<2 months, 2-12 months
define "By Age Stratifier 7":
  case 
      when "Age In Months" < 2  then '<2 months'
      when "Age In Months"<= 12 then '2-12 months'
      else null
  end

//(0–4, 5–14, 15–24, 25+ years) 
define "By Age Stratifier 8":
  case 
      when "Age In Years" <= 4 then '0-4'
      when "Age In Years" <= 14 then '5-14'
      when "Age In Years" <= 24 then '15-24'
      when "Age In Years" >= 25 then '25+'
      else null
  end

define "By Age Stratifier 9":
  case 
      when "Age In Years" >= 15 and "Age In Years"<= 19 then '15-19'
      when "Age In Years" <= 24 then '20-24'
      when "Age In Years" <= 29 then '25–29'
      when "Age In Years" <= 49 then '30–49'
      when "Age In Years" >= 50 then '50+'
      else null
  end

//(<15, 15–19, 20–24, 25+ years) 
define "By Age Stratifier 10":
  case 
      when "Age In Years" < 15 then '<15'
      when "Age In Years" >= 15 and "Age In Years"<= 19 then '15-19'
      when "Age In Years" <= 24 then '20-24'
      when "Age In Years" >= 25 then '25+'
      else null
  end

//(<15, 15–19, 20–24, 25–29, 30–34, 35–39, 40–49, 50+ years) 
define "By Age Stratifier 11":
  case 
      when "Age In Years" < 15 then '<15'
      when "Age In Years"<= 19 then '15-19'
      when "Age In Years" <= 24 then '20-24'
      when "Age In Years" <= 29 then '25-29'
      when "Age In Years" <= 34 then '30–34'
      when "Age In Years" <= 39 then '35–39'
      when "Age In Years" <= 49 then '40–49'
      when "Age In Years" >= 50 then '50+'
      else null
  end

/*
@dataElement: HIV.A.DE18 - Gender
@activity: HIV.A6.1 Review sociodemographic data with client | HIV.A5 Create new client record
@description: Gender of the client
*/

/*
 * By Administrative Gender of Patient Stratifier
 * Need to expand codes
 */

define "By Administrative Gender Stratifier":
  case 
      when Patient.gender = 'male' then Concepts."Male"
      when Patient.gender = 'female' then Concepts."Female"
      when Patient.gender = 'transgender female' then Concepts."Transgender female"
      when Patient.gender = 'transgender male' then Concepts."Transgender male"
      else Concepts."Other - HIV.A.DE23"
  end

/*
@dataElement: HIV.B.DE5 - Referred through partner services
@activity: HIV.B1 Determine reason for visit
@description: Client reported coming to the facility after receiving a provider-assisted referral or patient referral from a contact or partner
*/
// TODO: Replace placeholder with relevant CQL logic
define "Referred through partner services":
  exists "Referred through partner services Observation"
define "Referred through partner services Observation":
  Elements."Referred through partner services Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Referred through partner services */

/*
@dataElement: HIV.B.DE6 - Partner or contact of an index case
@activity: HIV.B1 Determine reason for visit
@description: The client is a contact or partner of a person diagnosed with HIV (an index case)
*/

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
  Elements."Partner or contact of an HIV testing client non-index case Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Partner or contact of an HIV testing client non-index case Observation":
  Elements."Partner or contact of an HIV testing client non-index case Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Type of contact or partner for partner services Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Biological child Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Biological child Observation":
  Elements."Biological child Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Drug-injecting partner B.DE10 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Drug-injecting partner B.DE10 Observation":
  Elements."Drug-injecting partner B.DE10 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Sexual partner B.DE11 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Sexual partner B.DE11 Observation":
  Elements."Sexual partner B.DE11 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Social contact B.DE12 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Social contact B.DE12 Observation":
  Elements."Social contact B.DE12 Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Social contact B.DE12 */

/*
@dataElement: HIV.B.DE15 - Testing entry point
@activity: HIV.B1 Determine reason for visit
@description: Whether testing is happening in the community or at a facility
*/
// TODO: Replace placeholder with relevant CQL logic
define "Testing entry point":
  exists "Testing entry point Observation"
define "Testing entry point Observation":
  Elements."Testing entry point Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Community-level testing Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Community-level testing Observation":
  Elements."Community-level testing Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Facility-level testing Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Facility-level testing Observation":
  Elements."Facility-level testing Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Facility-level testing */

/*
@dataElement: HIV.B.DE29 - Currently pregnant
@activity: HIV.B6 Capture or update client history
@description: Client is currently pregnant
*/

define "Currently pregnant B.DE29":
  Elements."Currently pregnant B.DE29" C
    where C.prevalenceInterval() during "Measurement Period"


define "pregnancy stratifier":
  case
    when exists("Currently pregnant B.DE29") then Concepts."Currently pregnant - HIV.B.DE29"
    when exists("Breastfeeding B.DE32") then Concepts."Breastfeeding - HIV.B.DE32"
    else null
  end
  
/* End of Currently pregnant B.DE29 */

/*
@dataElement: HIV.B.DE32 - Breastfeeding
@activity: HIV.B6 Capture or update client history
@description: Infant is being breastfed by mother
*/

define "Breastfeeding B.DE32":
  Elements."Breastfeeding B.DE32" O
    where O.effective.toInterval() during "Measurement Period"

define "Not Breastfeeding B.DE32":
  Elements."Breastfeeding B.DE32" O
    where O.effective.toInterval() during "Measurement Period"

  
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
  Elements."Partner HIV status reported Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."HIV-positive B.DE34 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "HIV-positive B.DE34 Observation":
  Elements."HIV-positive B.DE34 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."HIV-negative B.DE35 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "HIV-negative B.DE35 Observation":
  Elements."HIV-negative B.DE35 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Unknown B.DE36 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Unknown B.DE36 Observation":
  Elements."Unknown B.DE36 Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Unknown B.DE36 */

/*
@dataElement: HIV.B.DE50 - Key population member type
@activity: HIV.B6 Capture or update client history
@description: The type of key population that the client is included in
*/
define "Is Key population member":
  exists "Key population member type Observation"

define "Key population member type Observation":
  Elements."Key population member type Observation" O
    where O.effective.toInterval() before end of "Measurement Period"
    or O.issued before end of "Measurement Period"

// Stratifier
define patientGroups:
  "Key population member type Observation" O
  return Combine(O.code.coding.code, ':')
/* End of Key population member type B.DE50 */

/*
@dataElement: HIV.B.DE51 - Sex worker
@activity: HIV.B6 Capture or update client history
@description: Client is a sex worker
*/
define "Sex worker":
  exists("Key population member type Observation" O
    where O.value ~ Concepts."Sex worker - HIV.B.DE51"
    and O.effective.toInterval() during "Measurement Period")
/* End of Sex worker B.DE51 */

/*
@dataElement: HIV.B.DE52 - Men who have sex with men
@activity: HIV.B6 Capture or update client history
@description: Client is a man who has sex with men
*/
define "Men who have sex with men":
  exists("Key population member type Observation" O
    where O.value ~ Concepts."Men who have sex with men"
    and O.effective.toInterval() during "Measurement Period")
/* End of Men who have sex with men */

/*
@dataElement: HIV.B.DE53 - Trans and gender-diverse people
@activity: HIV.B6 Capture or update client history
@description: Client identifies as trans and gender-diverse
*/
define "Trans and gender-diverse people":
  exists("Key population member type Observation" O
    where O.value ~ Concepts."Trans and gender-diverse people - HIV.B.DE53"
    and O.effective.toInterval() during "Measurement Period")
/* End of Trans and gender-diverse people B.DE53 */

/*
@dataElement: HIV.B.DE54 - People who inject drugs
@activity: HIV.B6 Capture or update client history
@description: Client is a person who injects drugs
*/
define "People who inject drugs":
  exists("Key population member type Observation" O
    where O.value ~ Concepts."People who inject drugs - HIV.B.DE54"
    and O.effective.toInterval() during "Measurement Period")

/* End of People who inject drugs B.DE54 */

/*
@dataElement: HIV.B.DE55 - People living in prisons and other closed settings
@activity: HIV.B6 Capture or update client history
@description: Client lives in a prison or another closed setting
*/
define "People living in prisons and other closed settings":
  exists("Key population member type Observation" O
    where O.value ~ Concepts."People living in prisons and other closed settings"
    and O.effective.toInterval() during "Measurement Period")
/* End of People living in prisons and other closed settings */

/*
@dataElement: HIV.B.DE60 - Date HIV test results returned
@activity: HIV.B6 Capture or update client history
@description: Date HIV test result returned to client
*/
define "HIV test results returned in measurement period":
  Elements."HIV test" O
   where O.issued during "Measurement Period"

define "Has HIV test results returned in measurement period":
  exists("HIV test results returned in measurement period")
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
  Elements."HIV exposure type Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Occupational Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Occupational Observation":
  Elements."Occupational Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Non-occupational violent Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Non-occupational violent Observation":
  Elements."Non-occupational violent Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Non-occupational consensual sex Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Non-occupational consensual sex Observation":
  Elements."Non-occupational consensual sex Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Non-occupational consensual sex */

/*
@dataElement: HIV.B.DE65 - Date informed of HIV-positive diagnosis
@activity: HIV.B6 Capture or update client history
@description: The date on which the client was diagnosed with HIV
*/
// TODO: Replace placeholder with relevant CQL logic
define "Date informed of HIV-positive diagnosis":
  Elements."Date informed of HIV-positive diagnosis" O
    where O.effective.toInterval() during "Measurement Period"
define "Date informed of HIV-positive diagnosis Value":
  "Date informed of HIV-positive diagnosis" O
  return O.value as dateTime
/* End of Date informed of HIV-positive diagnosis */

/*
@dataElement: HIV.B.DE71 - HIV diagnosis date
@activity: HIV.B8 Provide post-test counselling
@description: Date diagnosis was returned to client
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV diagnosis date":
  Elements."HIV diagnosis date" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."ART start date B.DE72" O
    where O.effective.toInterval() during "Measurement Period"
define "ART start date B.DE72 Value":
  "ART start date B.DE72" O
  return O.value as dateTime
/* End of ART start date B.DE72 */

/*
@dataElement: HIV.B.DE81 - HIV test type
@activity: HIV.B7 Test for HIV using testing algorithm
@description: Type of HIV test
*/
define "HIV test type B.DE81":
  Elements."HIV test type B.DE81" O
    where O.effective.toInterval() during "Measurement Period"
define "HIV test type B.DE81 Value":
  "HIV test type B.DE81" O
  return O.value as CodeableConcept
/* End of HIV test type B.DE81 */

/*
@dataElement: HIV.B.DE110 - HIV test date
@activity: HIV.B7 Test for HIV using testing algorithm
@description: Date of the HIV test
*/
define "Non-Self HIV test with date and results returned in measurement period":
  Elements."Non-Self HIV test" O
  where start of O.effective.toInterval() during "Measurement Period"
    and O.issued during "Measurement Period"

/* End of HIV test date B.DE110 */


/*
@dataElement: HIV.B.DE112 - HIV-positive
@activity: HIV.B7 Test for HIV using testing algorithm
@description: Test result is HIV-positive
*/

define "HIV-positive test result":
  exists (Elements."HIV-positive test result" O
  where O.effective.toInterval() during "Measurement Period")

define "Non-Self HIV test date and results returned within measurement period for HIV-positive result":
  "Non-Self HIV test with date and results returned in measurement period" O
    where O.value ~ Concepts."HIV-positive - HIV.B.DE112"
/* End of HIV-positive B.DE112 */

/* HIV-negative test */
define "Negative HIV test within measurement period":
  Elements."HIV test" O
  where O.effective.toInterval() during "Measurement Period"
    and O.value ~ Concepts."HIV-negative - HIV.B.DE113"


/*
@dataElement: HIV.B.DE113 - HIV-negative
@activity: HIV.B7 Test for HIV using testing algorithm
@description: Test result is HIV-negative
*/
define "HIV-negative test result":
  exists (Elements."HIV-negative test result" O
  where O.effective.toInterval() during "Measurement Period")


/* End of HIV-negative B.DE113 */

/*
@dataElement: HIV.B.DE115 - HIV status
@activity: HIV.B7 Test for HIV using testing algorithm
@description: HIV status reported after applying the national HIV testing algorithm. No single HIV test can provide an HIV-positive diagnosis.
*/


define "HIV Status Stratifier":
  case 
      when "Has HIV-positive Status" then Concepts."HIV-positive - HIV.B.DE116"
      when not exists("HIV Status Positive Condition") and exists("HIV Status Negative Observation") then  Concepts."HIV-negative - HIV.B.DE117"
      else Concepts."Unknown - HIV.B.DE118"
  end

define "HIV Status Stratifier infant":
  case 
      when "Has HIV-positive Status" then Concepts."HIV-positive - HIV.B.DE116"
      when not exists("HIV Status Positive Condition") and exists("HIV Status Negative Observation") then  Concepts."HIV-negative - HIV.B.DE117"
      when exists("Not Breastfeeding B.DE32") then ConceptsCustom."No longer breastfeeding"
      else null
  end

//HIV status at first test during current pregnancy (known positive, tested HIV-negative, tested HIV-positive, not tested) 
  define "HIV Status pregnancy Stratifier":
  case 
      when "Has HIV-positive Status before pregnancy" then 'Known Positive'
      when "Has HIV-positive Status during pregnancy" then 'Tested Positive'
      when not "Has HIV-positive Status before pregnancy" and not "Has HIV-positive Status during pregnancy" and exists("HIV Status Negative Observation") then  'Tested Negative'
      else 'Not tested'
  end


/* End of HIV status */

/*
@dataElement: HIV.B.DE116 - HIV-positive
@activity: HIV.B7 Test for HIV using testing algorithm
@description: Client is HIV-positive
*/
define "Has HIV-positive Status at last measurment period":
  exists "HIV Status positive at last measurement period Condition"
  or exists "HIV Status positive at last measurement period Observation"
  
define "HIV Status positive at last measurement period Condition":
  Elements."HIV Status Positive Condition" C
  where C.onset.toInterval() starts before (start of "Measurement Period" - duration in days of "Measurement Period")

define "HIV Status positive at last measurement period Observation":
  Elements."HIV Status Positive Observation" O
  where O.effective.toInterval() starts before (start of "Measurement Period" - duration in days of "Measurement Period")

define "Has HIV-positive Status":
  exists "HIV Status Positive Condition"
  or exists "HIV Status Positive Observation"

define "HIV Status Positive Condition":
  Elements."HIV Status Positive Condition" C
  where C.onset before end of "Measurement Period"

define "HIV Status Positive Observation":
  Elements."HIV Status Positive Observation" O
  where O.issued before end of "Measurement Period"
  or O.effective.toInterval() starts before end of "Measurement Period"

define "Has HIV-positive Status before pregnancy":
  exists "HIV Status Positive Condition before pregnancy"
  or exists "HIV Status Positive Observation before pregnancy"

define "HIV Status Positive Condition before pregnancy":
  Elements."HIV Status Positive Condition" C
  where C.onset before end of "Measurement Period"
  and C.onset before start of First("Currently pregnant SRV.DE7 Condition").prevalenceInterval()

define "HIV Status Positive Observation before pregnancy":
  Elements."HIV Status Positive Observation" O
  where O.issued before end of "Measurement Period"
  or O.effective.toInterval() starts before end of "Measurement Period"
  and O.effective.toInterval() before start of First("Currently pregnant SRV.DE7 Condition").prevalenceInterval()

define "Has HIV-positive Status during pregnancy":
  exists "HIV Status Positive Condition during pregnancy"
  or exists "HIV Status Positive Observation during pregnancy"

define "HIV Status Positive Condition during pregnancy":
  Elements."HIV Status Positive Condition" C
  where C.onset before end of "Measurement Period"
  and C.onset during First("Currently pregnant SRV.DE7 Condition").prevalenceInterval()

define "HIV Status Positive Observation during pregnancy":
  Elements."HIV Status Positive Observation" O
  where O.issued before end of "Measurement Period"
  or O.effective.toInterval() starts before end of "Measurement Period"
  and O.effective.toInterval() during First("Currently pregnant SRV.DE7 Condition").prevalenceInterval()

/* End of HIV-positive B.DE116 */

define "HIV Status Negative Observation":
  Elements."HIV Status Negative Observation" O
  where O.issued before end of "Measurement Period"
  or O.effective.toInterval() starts before end of "Measurement Period"

define "HIV Status Negative Condition":
  Elements."HIV Status Negative Condition" C
  where C.onset before end of "Measurement Period"

/*
@dataElement: HIV.B.DE121 - Probable route of transmission
@activity: HIV.B8 Provide post-test counselling
@description: Probable route(s) of transmission of HIV to client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Probable route of transmission":
  exists "Probable route of transmission Observation"
define "Probable route of transmission Observation":
  Elements."Probable route of transmission Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Heterosexual sex Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Heterosexual sex Observation":
  Elements."Heterosexual sex Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Sex between men Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Sex between men Observation":
  Elements."Sex between men Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Unprotected intercourse during sex work Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Unprotected intercourse during sex work Observation":
  Elements."Unprotected intercourse during sex work Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Injecting drug use with unsterile equipment Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Injecting drug use with unsterile equipment Observation":
  Elements."Injecting drug use with unsterile equipment Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Nosocomial Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Nosocomial Observation":
  Elements."Nosocomial Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Vertical Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Vertical Observation":
  Elements."Vertical Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Other B.DE128 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Other B.DE128 Observation":
  Elements."Other B.DE128 Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Other B.DE128 */

/*
@dataElement: HIV.B.DE198 - VMMC procedure date
@activity: HIV.B21 Offer prevention options
@description: Date on which a voluntary medical male circumcision procedure was performed
*/

define "VMMC procedure date":
  exists(Elements."VMMC" V where V.performed.toInterval() during "Measurement Period")
/* End of VMMC procedure date */

/*
@dataElement: HIV.B.DE201 - Adverse event severity
@activity: HIV.B21 Offer prevention options
@description: Severity of the adverse event associated with voluntary medical male circumcision (VMMC) procedure
*/

define "VMMC_adverse_event":
[AdverseEvent] AE 
  with [Procedure] P
      such that AE.suspectEntity.instance.references(P) and P.status = 'completed' 
      and P.code ~  Concepts."VMMC"
      and P.performed during "Measurement Period"
      and AE.date <= (P.performed + 30 days)
      and AE.date >= (P.performed)
  where AE.actuality = 'actual'


define "VMMC_adverse_event_type":
    case 
        when exists("VMMC_adverse_event" AE where AE.event ~ Concepts."Abnormal pain") then  Concepts."Abnormal pain"
        when exists("VMMC_adverse_event" AE where AE.event ~ Concepts."Anaesthesia-related effects") then  Concepts."Anaesthesia-related effects"
        when exists("VMMC_adverse_event" AE where AE.event ~ Concepts."Damage to the penis") then  Concepts."Damage to the penis"
        when exists("VMMC_adverse_event" AE where AE.event ~ Concepts."Difficulty urinating") then  Concepts."Difficulty urinating"
        when exists("VMMC_adverse_event" AE where AE.event ~ Concepts."Excessive bleeding") then  Concepts."Excessive bleeding"
        when exists("VMMC_adverse_event" AE where AE.event ~ Concepts."Excessive skin removal") then  Concepts."Excessive skin removal"
        when exists("VMMC_adverse_event" AE where AE.event ~ Concepts."Excessive swelling") then  Concepts."Excessive swelling"
        when exists("VMMC_adverse_event" AE where AE.event ~ Concepts."Haematoma") then  Concepts."Haematoma"
        when exists("VMMC_adverse_event" AE where AE.event ~ Concepts."Infection") then  Concepts."Infection"
        when exists("VMMC_adverse_event" AE where AE.event ~ Concepts."Injury to glans") then  Concepts."Injury to glans"
        when exists("VMMC_adverse_event" AE where AE.event ~ Concepts."Scar or disfigurement") then  Concepts."Scar or disfigurement"
        when exists("VMMC_adverse_event" AE where AE.event ~ Concepts."Sharps injury to personnel") then  Concepts."Sharps injury to personnel"
        when exists("VMMC_adverse_event" AE where AE.event ~ Concepts."Wound disruption") then  Concepts."Wound disruption"
        else Concepts."Other - HIV.B.DE222"
    end

define "VMMC_adverse_event_Intraoperative":
[AdverseEvent] AE 
  with [Procedure] P
      such that AE.suspectEntity.instance.references(P) and P.status = 'completed' 
      and P.code ~  Concepts."Voluntary medical male circumcision VMMC referral"
      and P.performed after start of "Measurement Period"
      and P.performed before end of "Measurement Period"
      and AE.date = P.performed
  where AE.actuality = 'actual'

define "VMMC_adverse_event_Postoperative":
[AdverseEvent] AE 
  with [Procedure] P
      such that AE.suspectEntity.instance.references(P) and P.status = 'completed' 
      and P.code ~  Concepts."Voluntary medical male circumcision VMMC referral"
      and P.performed after start of "Measurement Period"
      and P.performed before end of "Measurement Period"
      and AE.date <= (P.performed + 30 days)
      and AE.date > (P.performed)
  where AE.actuality = 'actual'

define "VMMC_adverse_event_timing":
  case 
      when exists(VMMC_adverse_event_Intraoperative) then  Concepts."Intraoperative"
      when exists(VMMC_adverse_event_Postoperative) then  Concepts."Postoperative"
      else null
  end


define "Adverse event severity":
  exists Elements."Adverse event severity"
/* End of Adverse event severity */

/*
@dataElement: HIV.B.DE202 - Moderate
@activity: HIV.B21 Offer prevention options
@description: Severity of the adverse event associated with VMMC procedure was moderate
*/

define "Moderate":
 exists Elements."Moderate"
/* End of Moderate */

/*
@dataElement: HIV.B.DE203 - Severe
@activity: HIV.B21 Offer prevention options
@description: Severity of the adverse event associated with VMMC procedure was severe
*/

define "Severe":
  exists Elements."Severe"
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
  Elements."Timing of adverse event Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Intraoperative Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Intraoperative Observation":
  Elements."Intraoperative Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Postoperative Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Postoperative Observation":
  Elements."Postoperative Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Type of adverse VMMC event Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Abnormal pain Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Abnormal pain Observation":
  Elements."Abnormal pain Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Anaesthesia-related effects Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Anaesthesia-related effects Observation":
  Elements."Anaesthesia-related effects Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Bleeding Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Bleeding Observation":
  Elements."Bleeding Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Damage to the penis Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Damage to the penis Observation":
  Elements."Damage to the penis Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Difficulty urinating Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Difficulty urinating Observation":
  Elements."Difficulty urinating Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Excessive bleeding Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Excessive bleeding Observation":
  Elements."Excessive bleeding Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Excessive skin removal Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Excessive skin removal Observation":
  Elements."Excessive skin removal Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Excessive swelling Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Excessive swelling Observation":
  Elements."Excessive swelling Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Haematoma Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Haematoma Observation":
  Elements."Haematoma Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Infection Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Infection Observation":
  Elements."Infection Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Injury to glans Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Injury to glans Observation":
  Elements."Injury to glans Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Scar or disfigurement Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Scar or disfigurement Observation":
  Elements."Scar or disfigurement Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Sharps injury to personnel Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Sharps injury to personnel Observation":
  Elements."Sharps injury to personnel Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Wound disruption Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Wound disruption Observation":
  Elements."Wound disruption Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Other B.DE222 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Other B.DE222 Observation":
  Elements."Other B.DE222 Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Other B.DE222 */

/*
@dataElement: HIV.B.DE225 - At elevated risk for HIV acquisition
@activity: HIV.B6 Capture or update client history
@description: Client is at elevated risk for HIV acquisition
*/

define "At elevated risk for HIV acquisition B.DE225":
  exists(Elements."At elevated risk for HIV acquisition B.DE225" C
    where C.prevalenceInterval() overlaps "Measurement Period")

/* End of At elevated risk for HIV acquisition B.DE225 */

/*
@dataElement: HIV.B.DE226 - Syndrome/STI diagnosed
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Syndrome or STI for which client is diagnosed
*/

define "STI syndrome":
  List<String>{
    if exists("Urethral discharge syndrome B.DE227") then 'Urethral Discharge' else null,
    if exists("Vaginal discharge syndrome B.DE228") then 'Vaginal Discharge' else null,
    if exists("Lower Abdominal pain B.DE229") then 'Lower Abdominal Pain' else null,
    if exists("Genital ulcer disease syndrome B.DE230") then 'Genital Ulcer' else null,
    if exists("Anorectal discharge B.DE231") then 'Anorectal discharge ' else null
  }

define "Syndrome/STI diagnosed B.DE226":
  exists("Urethral discharge syndrome B.DE227") or exists("Vaginal discharge syndrome B.DE228") or exists("Lower Abdominal pain B.DE229") or exists("Genital ulcer disease syndrome B.DE230") or
  exists("Anorectal discharge B.DE231")

define "Syndrome/STI diagnosed B.DE226 Condition":
  Elements."Syndrome/STI diagnosed B.DE226 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
/* End of Syndrome/STI diagnosed B.DE226 */

/*
@dataElement: HIV.B.DE227 - Urethral discharge syndrome
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Client diagnosed with urethral discharge syndrome
*/
define "Urethral discharge syndrome B.DE227":
  Elements."Urethral discharge syndrome B.DE227" C
    where C.prevalenceInterval() overlaps "Measurement Period"
/* End of Urethral discharge syndrome B.DE227 */

/*
@dataElement: HIV.B.DE228 - Vaginal discharge syndrome
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Client diagnosed with vaginal discharge syndrome
*/
define "Vaginal discharge syndrome B.DE228":
  Elements."Vaginal discharge syndrome B.DE228" C
    where C.prevalenceInterval() overlaps "Measurement Period"
/* End of Vaginal discharge syndrome B.DE228 */

/*
@dataElement: HIV.B.DE229 - Lower Abdominal pain 
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Client diagnosed with lower abdominal pain
*/
define "Lower Abdominal pain B.DE229":
  Elements."Lower Abdominal pain B.DE229" C
    where C.prevalenceInterval() overlaps "Measurement Period"
/* End of Lower Abdominal pain B.DE229 */

/*
@dataElement: HIV.B.DE230 - Genital ulcer disease syndrome
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Client diagnosed with genital ulcer disease syndrome
*/
define "Genital ulcer disease syndrome B.DE230":
  Elements."Genital ulcer disease syndrome B.DE230" C
    where C.prevalenceInterval() overlaps "Measurement Period"
/* End of Genital ulcer disease syndrome B.DE230 */

/*
@dataElement: HIV.B.DE231 - Anorectal discharge
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Client diagnosed with anorectal discharge
*/
define "Anorectal discharge B.DE231":
  Elements."Anorectal discharge B.DE231" C
    where C.prevalenceInterval() overlaps "Measurement Period"
/* End of Anorectal discharge B.DE231 */

/*
@dataElement: HIV.B.DE232 - Sent for testing
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Specimen sent for testing
*/
define "Sent for testing B.DE232":
  Elements."Sent for testing B.DE232" C
    where C.prevalenceInterval() overlaps "Measurement Period" 
/* End of Sent for testing B.DE232 */

/*
@dataElement: HIV.B.DE233 - Other
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Other syndrome/STI diagnosed
*/
define "Other B.DE233":
  Elements."Other B.DE233" C
    where C.prevalenceInterval() overlaps "Measurement Period"
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
  Elements."Any STI syndrome diagnosed B.DE235 Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Any STI syndrome diagnosed B.DE235 */

/*
@dataElement: HIV.B.DE249 - Syphilis test date
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Date of syphilis test
*/

define "Syphilis test date B.DE249":
  exists(Elements."Syphilis test date B.DE249" P
    where P.performed.toInterval() during "Measurement Period")
/* End of Syphilis test date B.DE249 */

/*
@dataElement: HIV.B.DE250 - Syphilis test result
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Result from syphilis test
*/

define "Syphilis test result B.DE250":
  exists(Elements."Syphilis test result B.DE250" O
    where O.effective.toInterval() during "Measurement Period")
/* End of Syphilis test result B.DE250 */

/*
@dataElement: HIV.B.DE251 - Positive
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Test result is positive for syphilis
*/

define "Positive B.DE251":
  exists Elements."Positive B.DE251" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Positive B.DE251 */

/*
@dataElement: HIV.B.DE252 - Negative
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Test result is negative for syphilis
*/

define "Negative B.DE252":
  exists Elements."Negative B.DE252" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Negative B.DE252 */

/*
@dataElement: HIV.B.DE253 - Inconclusive
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Test result is inconclusive
*/

define "Inconclusive B.DE253":
  exists Elements."Inconclusive B.DE253" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Inconclusive B.DE253 */

/*
@dataElement: HIV.B.DE254 - Syphilis treatment start date
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Date of initiation of syphilis treatment
*/

define "Syphilis treatment start date B.DE254":
  exists (Elements."Syphilis treatment start date B.DE254" MS
    where MS.effective.toInterval() during "Measurement Period")

/* End of Syphilis treatment start date B.DE254 */

/*
@dataElement: HIV.B.DE255 - Gonorrhoea test date
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Date of Gonorrhoea test
*/

define "Gonorrhoea test date B.DE255":
  "Gonorrhoea test result B.DE256" O
  return O.effective
/* End of Gonorrhoea test date B.DE255 */

/*
@dataElement: HIV.B.DE256 - Gonorrhoea test result
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Result from Gonorrhoea test
*/

define "Gonorrhoea test result B.DE256":
    Elements."Gonorrhoea test result B.DE256" O
    where O.effective.toInterval() during "Measurement Period"
    
/* End of Gonorrhoea test result B.DE256 */

/*
@dataElement: HIV.B.DE257 - Positive
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Test result is positive for Neisseria gonorrhoeae
*/

define "Positive B.DE257":
  exists(Elements."Positive B.DE257" O
    where O.effective.toInterval() during "Measurement Period")
/* End of Positive B.DE257 */

/*
@dataElement: HIV.B.DE258 - Negative
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Test result is negative for Neisseria gonorrhoeae
*/

define "Negative B.DE258":
  exists Elements."Negative B.DE258" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Negative B.DE258 */

/*
@dataElement: HIV.B.DE259 - Inconclusive
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Test result is inconclusive
*/

define "Inconclusive B.DE259":
  exists Elements."Inconclusive B.DE259" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Inconclusive B.DE259 */

/*
@dataElement: HIV.B.DE260 - Gonorrhoea treatment start date
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Date of initiation of Gonorrhoea treatment
*/

define "Gonorrhoea treatment start date B.DE260":
  exists (Elements."Gonorrhoea treatment start date B.DE260" MS
    where MS.effective.toInterval() during "Measurement Period")
/* End of Gonorrhoea treatment start date B.DE260 */

/*
@dataElement: HIV.B.DE261 - Type of specimen
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Type of specimen to be collected
*/

define "Type of specimen B.DE261":
  case 
      when "Blood B.DE262"then Concepts."Blood - HIV.B.DE262"
      when "Urine B.DE263" then Concepts."Urine - HIV.B.DE263"
      when "Cervical or vaginal swab B.DE264" then Concepts."Cervical or vaginal swab - HIV.B.DE264"
      when "Urethral or penile swab B.DE265" then Concepts."Urethral or penile swab - HIV.B.DE265"
      when "Rectal swab B.DE266" then Concepts."Rectal swab - HIV.B.DE266"
      when "Other B.DE267" then Concepts."Other - HIV.B.DE267"
      else null
  end

/* End of Type of specimen B.DE261 */

/*
@dataElement: HIV.B.DE262 - Blood
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Blood specimen to be collected
*/

define "Blood B.DE262":
  exists (Elements."Blood B.DE262" O where O.effective.toInterval() during "Measurement Period")
/* End of Blood B.DE262 */

/*
@dataElement: HIV.B.DE263 - Urine
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Urine specimen to be collected
*/

define "Urine B.DE263":
  exists (Elements."Urine B.DE263" O where O.effective.toInterval() during "Measurement Period")
/* End of Urine B.DE263 */

/*
@dataElement: HIV.B.DE264 - Cervical or vaginal swab
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Cervical or vaginal swab to be collected
*/
 
define "Cervical or vaginal swab B.DE264":
  exists (Elements."Cervical or vaginal swab B.DE264" O where O.effective.toInterval() during "Measurement Period")

/* End of Cervical or vaginal swab B.DE264 */

/*
@dataElement: HIV.B.DE265 - Urethral or penile swab
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Urethral or penile swab to be collected
*/

define "Urethral or penile swab B.DE265":
  exists (Elements."Urethral or penile swab B.DE265" O where O.effective.toInterval() during "Measurement Period")

/* End of Urethral or penile swab B.DE265 */

/*
@dataElement: HIV.B.DE266 - Rectal swab
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Rectal swab to be collected
*/

define "Rectal swab B.DE266":
  exists (Elements."Rectal swab B.DE266" O where O.effective.toInterval() during "Measurement Period")

/* End of Rectal swab B.DE266 */

/*
@dataElement: HIV.B.DE267 - Other
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Other specimen type to be collected
*/

define "Other B.DE267":
  exists (Elements."Other B.DE267"O where O.effective.toInterval() during "Measurement Period")

/* End of Other B.DE267 */

/*
@dataElement: HIV.B.DE276 - Neisseria gonorrhoeae test type
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Type of diagnostic test used for Neisseria gonorrhoeae
*/

define "Neisseria gonorrhoeae test type B.DE276":
  case 
      when "NAAT B.DE277" then Concepts."NAAT - HIV.B.DE277"
      when "POC Test B.DE278" then Concepts."POC Test - HIV.B.DE278"
      when "Culture B.DE279" then Concepts."Culture - HIV.B.DE279"
      when "Microscopy B.DE280" then Concepts."Microscopy - HIV.B.DE280"
      when "Other B.DE281" then Concepts."Other - HIV.B.DE281"
      else null
  end
/* End of Neisseria gonorrhoeae test type B.DE276 */

/*
@dataElement: HIV.B.DE277 - NAAT
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Nucleic Acid Amplification Test (NAAT) used
*/

define "NAAT B.DE277":
  exists(Elements."NAAT B.DE277" O
    where O.effective.toInterval() during "Measurement Period")
/* End of NAAT B.DE277 */

/*
@dataElement: HIV.B.DE278 - POC Test
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Point-of-care (POC) test used
*/

define "POC Test B.DE278":
  exists(Elements."POC Test B.DE278" O
    where O.effective.toInterval() during "Measurement Period")
/* End of POC Test B.DE278 */

/*
@dataElement: HIV.B.DE279 - Culture
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Culture test used
*/

define "Culture B.DE279":
exists(Elements."Culture B.DE279" O
    where O.effective.toInterval() during "Measurement Period")
/* End of Culture B.DE279 */

/*
@dataElement: HIV.B.DE280 - Microscopy
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Microscopy test used
*/

define "Microscopy B.DE280":
  exists(Elements."Microscopy B.DE280" O
    where O.effective.toInterval() during "Measurement Period")
/* End of Microscopy B.DE280 */

/*
@dataElement: HIV.B.DE281 - Other
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Other type of test used
*/

define "Other B.DE281":
  exists (Elements."Other B.DE281" O
    where O.effective.toInterval() during "Measurement Period")
/* End of Other B.DE281 */

/*
@dataElement: HIV.C.DE10 - Currently on PrEP
@activity: HIV.C3 Capture or update client history
@description: The client is currently taking PrEP. Oral pre-exposure prophylaxis (PrEP) of HIV is the use of ARV drugs by people who are not infected with HIV to block the acquisition of HIV.
*/

/*@triggeredBy Encounter with location = community level testing*/

define "Currently on PrEP":
  exists (Elements."Currently on PrEP" MS
  where MS.status = 'completed' and MS.effective.toInterval() during "Measurement Period")

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
  Elements."PrEP dosing type Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of PrEP dosing type */

/*
@dataElement: HIV.C.DE12 - Daily oral PrEP
@activity: HIV.C3 Capture or update client history
@description: Pre-exposure prophylaxis (PrEP) is taken every day
*/

define "Daily oral PrEP":
  exists (Elements."Daily oral PrEP" MS
  where MS.status = 'completed' and MS.effective.toInterval() during "Measurement Period")

/* End of Daily oral PrEP */

/*
@dataElement: HIV.C.DE13 - Event-driven PrEP 2+1+1
@activity: HIV.C3 Capture or update client history
@description: Event-driven pre-exposure prophylaxis (PrEP) is taken on an even-driven basis (2+1+1)
*/

define "Event-driven PrEP 2+1+1":
  exists (Elements."Event-driven PrEP 2+1+1" MS
  where MS.status = 'completed' and MS.effective.toInterval() during "Measurement Period")
/* End of Event-driven PrEP 2+1+1 */

/*
@dataElement: HIV.C.DE14 - Other PrEP dosing type
@activity: HIV.C3 Capture or update client history
@description: Other PrEP dosing type
*/

define "Other PrEP dosing type":
  exists (Elements."Other PrEP dosing type" MS
  where MS.status = 'completed' and MS.effective.toInterval() during "Measurement Period")
/* End of Other PrEP dosing type */

/*
@dataElement: HIV.C.DE18 - TDF + FTC
@activity: HIV.C3 Capture or update client history
@description: Treated with tenofovir disoproxil fumarate (TDF) and emtricitabine (FTC) pre-exposure prophylaxis (PrEP) regimen (oral PrEP)
*/

define "TDF + FTC C.DE18":
  exists (Elements."TDF + FTC C.DE18" MS
  where MS.status = 'completed' and MS.effective.toInterval() during "Measurement Period")
/* End of TDF + FTC C.DE18 */

/*
@dataElement: HIV.C.DE19 - TDF
@activity: HIV.C3 Capture or update client history
@description: Treated with single-agent tenofovir disoproxil fumarate (TDF) pre-exposure prophylaxis (PrEP) regimen (oral PrEP)
*/

define "TDF C.DE19":
  exists (Elements."TDF C.DE19" MS
  where MS.status = 'completed' and MS.effective.toInterval() during "Measurement Period")

/* End of TDF C.DE19 */

/*
@dataElement: HIV.C.DE20 - TDF + 3TC
@activity: HIV.C3 Capture or update client history
@description: Treated with tenofovir disoproxil fumarate (TDF) and lamivudine (3TC) pre-exposure prophylaxis (PrEP) regimen (oral PrEP)
*/

define "TDF + 3TC C.DE20":
  exists (Elements."TDF + 3TC C.DE20" MS
  where MS.status = 'completed' and MS.effective.toInterval() during "Measurement Period")
/* End of TDF + 3TC C.DE20 */

/*
@dataElement: HIV.C.DE21 - Other TDF-based regimen
@activity: HIV.C3 Capture or update client history
@description: Treated with other tenofovir disoproxil fumarate (TDF)-based regimen (oral PrEP)
*/

define "Other TDF-based regimen":
  exists (Elements."Other TDF-based regimen" MS
  where MS.status = 'completed' and MS.effective.toInterval() during "Measurement Period")
/* End of Other TDF-based regimen */

/*
@dataElement: HIV.C.DE22 - Dapivirine vaginal ring DVR
@activity: HIV.C3 Capture or update client history
@description: Dapivirine vaginal ring (DVR) for HIV prevention
*/

define "Dapivirine vaginal ring DVR C.DE22":
  exists (Elements."Dapivirine vaginal ring DVR C.DE22" MS
  where MS.status = 'completed' and MS.effective.toInterval() during "Measurement Period")

/*
@dataElement: HIV.C.DE23 - CAB-LA
@activity: HIV.C3 Capture or update client history
@description: Long-acting injectable cabotegravir
*/

define "CAB-LA C.DE23":
  exists (Elements."CAB-LA C.DE23" MS
  where MS.status = 'completed' and MS.effective.toInterval() during "Measurement Period")
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
  Elements."Experience with PrEP Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Experience with PrEP */

/*
@dataElement: HIV.C.DE25 - First-time user
@activity: HIV.C3 Capture or update client history
@description: The client has never used pre-exposure prophylaxis (PrEP) before (naive)
*/

define "First-time user C.DE25":
    exists (Elements."First-time user C.DE25" MS
  where MS.status = 'completed' and MS.effective.toInterval() during "Measurement Period")
/* End of First-time user C.DE25 */

/*
@dataElement: HIV.C.DE26 - Continuing user
@activity: HIV.C3 Capture or update client history
@description: The client has used PrEP before and is continuing to use PrEP
*/

define "Continuing user":
  exists (Elements."Continuing user" MS
  where MS.status = 'completed' and MS.effective.toInterval() during "Measurement Period")
/* End of Continuing user */

/*
@dataElement: HIV.C.DE27 - Restarting following a period of not taking PrEP
@activity: HIV.C3 Capture or update client history
@description: The client is restarting PrEP following a period of not taking PrEP
*/

define "Restarting following a period of not taking PrEP":
  exists (Elements."Restarting following a period of not taking PrEP" MS
  where MS.status = 'completed' and MS.effective.toInterval() during "Measurement Period")
/* End of Restarting following a period of not taking PrEP */

/*
@dataElement: HIV.C.DE35 - Date client completes PEP course
@activity: HIV.C3 Capture or update client history
@description: Date client completes PEP course
*/

define "Date client completes PEP course":
  exists(Elements."Date client completes PEP course" MS 
  where MS.effective.toInterval() during "Measurement Period")

/* End of Date client completes PEP course */

/*
@dataElement: HIV.C.DE74 - Date medications prescribed
@activity: HIV.C23 Prescribe or administer PrEP or PEP
@description: Date the client was prescribed medications
*/
// TODO: Replace placeholder with relevant CQL logic
define "Date medications prescribed C.DE74":
  Elements."Date medications prescribed C.DE74" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Medications prescribed C.DE75 Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Medications prescribed C.DE75 */

/*
@dataElement: HIV.C.DE76 - PrEP for HIV prevention
@activity: HIV.C23 Prescribe or administer PrEP or PEP
@description: Client was prescribed pre-exposure prophylaxis (PrEP) for HIV prevention
*/
define "HIV PREP Active":
   exists(Elements."HIV PREP Active" H
   where H.effective starts before end of "Measurement Period"
    and (H.effective ends after start of "Measurement Period"
    or end of H.effective  ~  null)
   )

define "PrEP for HIV prevention":
  exists (Elements."PrEP for HIV prevention" MS
    where MS.status = 'completed' and MS.effective.toInterval() during "Measurement Period")
/* End of PrEP for HIV prevention */

/*
@dataElement: HIV.C.DE77 - PEP for HIV prevention
@activity: HIV.C23 Prescribe or administer PrEP or PEP
@description: Client was prescribed post-exposure prophylaxis (PEP) for HIV prevention
*/

define "PEP for HIV prevention":
  exists(Elements."PEP for HIV prevention" MR
    where MR.MedicationRequestPeriod() during "Measurement Period")
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
  Elements."Other C.DE78 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Other C.DE78 Observation":
  Elements."Other C.DE78 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."PrEP product prescribed Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Oral PrEP Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Oral PrEP Observation":
  Elements."Oral PrEP Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Dapivirine vaginal ring DVR C.DE82 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Dapivirine vaginal ring DVR C.DE82 Observation":
  Elements."Dapivirine vaginal ring DVR C.DE82 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."CAB-LA C.DE83 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "CAB-LA C.DE83 Observation":
  Elements."CAB-LA C.DE83 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Other C.DE84 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Other C.DE84 Observation":
  Elements."Other C.DE84 Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Other C.DE84 */

/*
@dataElement: HIV.C.DE121 - Number of days prescribed
@activity: HIV.C23 Prescribe or administer PrEP or PEP
@description: Days of medication client has been prescribed
*/
// TODO: Replace placeholder with relevant CQL logic
define "Number of days prescribed C.DE121":
  Elements."Number of days prescribed C.DE121" O
    where O.effective.toInterval() during "Measurement Period"
define "Number of days prescribed C.DE121 Value":
  "Number of days prescribed C.DE121" O
  return O.value as integer
/* End of Number of days prescribed C.DE121 */

/*
@dataElement: HIV.C.DE138 - Condom type
@activity: HIV.C10 Counsel on risk and prevention
@description: Type of condom provided to client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Condom type":
  exists "Condom type Observation"
define "Condom type Observation":
  Elements."Condom type Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Male condom Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Male condom Observation":
  Elements."Male condom Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Female condom Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Female condom Observation":
  Elements."Female condom Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Female condom */

/*
@dataElement: HIV.C.DE142 - Number of HIV self-test kits distributed
@activity: HIV.C10 Counsel on risk and prevention
@description: Number of HIV self-test kits distributed to the client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Number of HIV self-test kits distributed":
  Elements."Number of HIV self-test kits distributed" O
    where O.effective.toInterval() during "Measurement Period"
define "Number of HIV self-test kits distributed Value":
  "Number of HIV self-test kits distributed" O
  return O.value as integer
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
  Elements."HIV self-test distributed for use by Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Self Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Self Observation":
  Elements."Self Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Family member Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Family member Observation":
  Elements."Family member Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Drug-injecting partner C.DE146 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Drug-injecting partner C.DE146 Observation":
  Elements."Drug-injecting partner C.DE146 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Sexual partner C.DE147 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Sexual partner C.DE147 Observation":
  Elements."Sexual partner C.DE147 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Social contact C.DE148 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Social contact C.DE148 Observation":
  Elements."Social contact C.DE148 Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Social contact C.DE148 */

/*
@dataElement: HIV.D.DE31 - Currently pregnant
@activity: HIV.D8 Capture or update client history
@description: Client is currently pregnant
*/
// TODO: Replace placeholder with relevant CQL logic
define "Currently pregnant D.DE31":
  exists "Currently pregnant D.DE31 Observation"
define "Currently pregnant D.DE31 Observation":
  Elements."Currently pregnant D.DE31 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Breastfeeding D.DE32 Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Breastfeeding D.DE32 */

/*
@dataElement: HIV.D.DE38 - On ART
@activity: HIV.D8 Capture or update client history
@description: Client is currently taking ART
*/

define "On ART D.DE38":
  exists(Elements."On ART D.DE38" ART
   where ART.effective.toInterval() during "Measurement Period")

/* End of On ART D.DE38 */

/*
@dataElement: HIV.D.DE39 - ART start date
@activity: HIV.D8 Capture or update client history
@description: The date on which the client started or restarted ART
*/
/* End of ART start date D.DE39 */
define "ART start date within measurement period":
  Elements."ART start date D.DE39" d
    where d during "Measurement Period"
/*
@dataElement: HIV.D.DE41 - Date ART stopped
@activity: HIV.D8 Capture or update client history
@description: Date on which client stopped ART
*/
define "ART stopped during measurement period":
  Elements."Date ART stopped D.DE41" d
    where d during "Measurement Period"
/* End of Date ART stopped D.DE41 */

/*
@dataElement: HIV.D.DE43 - ART start type
@activity: HIV.D8 Capture or update client history
@description: Whether the client is ART naive or is restarting ART
*/

define "ART start type":
  exists Elements."ART start type"

/* End of ART start type */

/*
@dataElement: HIV.D.DE44 - First-time user of ART
@activity: HIV.D8 Capture or update client history
@description: Client is ART naive, having never taken ART to treat HIV before
*/

define "First-time user of ART":
  exists Elements."First-time user of ART" O
    where O.effective.toInterval() during "Measurement Period"
/* End of First-time user of ART */

/*
@dataElement: HIV.D.DE45 - Restarting ART
@activity: HIV.D8 Capture or update client history
@description: Client is restarting ART after stopping treatment for any reason
*/

define "Restarting ART":
  exists Elements."Restarting ART" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Restarting ART */

/*
@dataElement: HIV.D.DE75 - Current ART regimen
@activity: HIV.D8 Capture or update client history
@description: The current ART regimen the client is taking
*/

define "Current ART regimen":
  case 
      when exists(Elements."Preferred first-line ART regimen" MS where MS.effective.toInterval() during "Measurement Period") then Concepts."Preferred first-line ART regimen"
      when exists(Elements."Alternative first-line ART regimen" MS where MS.effective.toInterval() during "Measurement Period") then Concepts."Alternative first-line ART regimen"
      when exists(Elements."First-line ART regimen under special circumstances" MS where MS.effective.toInterval() during "Measurement Period") then Concepts."First-line ART regimen under special circumstances"
      when exists(Elements."Preferred second-line ART regimen" MS where MS.effective.toInterval() during "Measurement Period") then Concepts."Preferred second-line ART regimen"
      when exists(Elements."Alternative second-line ART regimen" MS where MS.effective.toInterval() during "Measurement Period") then Concepts."Alternative second-line ART regimen"
      else null
  end


/* End of Current ART regimen */

/*
@dataElement: HIV.D.DE161 - HBsAg test date
@activity: HIV.D12 Determine recommended screenings and tests
@description: Date client was tested for hepatitis B virus (HBV)
*/
//TODO - verify
define "HBsAg test date D.DE161":
  exists(Elements."HBsAg test date D.DE161" P
    where P.performed.toInterval() during "Measurement Period")

/* End of HBsAg test date D.DE161 */

/*
@dataElement: HIV.D.DE162 - HBsAg test result
@activity: HIV.D12 Determine recommended screenings and tests
@description: Hepatitis B virus test result (HBsAg)
*/

define "HBsAg test result D.DE162":
  exists Elements."HBsAg test result D.DE162" O
    where O.effective.toInterval() during "Measurement Period"
/* End of HBsAg test result D.DE162 */

/*
@dataElement: HIV.D.DE163 - Positive
@activity: HIV.D12 Determine recommended screenings and tests
@description: HBsAg test result was positive
*/

define "Positive D.DE163":
  exists Elements."Positive D.DE163" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Positive D.DE163 */

/*
@dataElement: HIV.D.DE164 - Negative
@activity: HIV.D12 Determine recommended screenings and tests
@description: HBsAg test result was negative
*/
// TODO: Replace placeholder with relevant CQL logic
define "Negative D.DE164":
  exists Elements."Negative D.DE164" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Negative D.DE164 */

/*
@dataElement: HIV.D.DE165 - Indeterminate
@activity: HIV.D12 Determine recommended screenings and tests
@description: HBsAg test result was indeterminate
*/

define "Indeterminate D.DE165":
  exists Elements."Indeterminate D.DE165" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Indeterminate D.DE165 */

/*
@dataElement: HIV.D.DE167 - HBV treatment TDF start date
@activity: HIV.D12 Determine recommended screenings and tests
@description: Date when client started treatment (TDF) for hepatitis B virus (HBV)
*/

define "HBV treatment TDF start date":
  exists(Elements."HBV treatment TDF start date" MS
   where MS.effective.toInterval() during "Measurement Period")

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
  Elements."HCV test result D.DE170" O
    where O.effective.toInterval() during "Measurement Period"
/* End of HCV test result D.DE170 */

/*
@dataElement: HIV.D.DE171 - Positive
@activity: HIV.D12 Determine recommended screenings and tests
@description: HCV test result was positive
*/

define "Positive D.DE171":
  Elements."Positive D.DE171" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Positive D.DE171 */

/*
@dataElement: HIV.D.DE172 - Negative
@activity: HIV.D12 Determine recommended screenings and tests
@description: HCV test result was negative
*/

define "Negative D.DE172":
  exists Elements."Negative D.DE172" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Negative D.DE172 */

/*
@dataElement: HIV.D.DE173 - Indeterminate
@activity: HIV.D12 Determine recommended screenings and tests
@description: HCV test result was indeterminate
*/

define "Indeterminate D.DE173":
  exists Elements."Indeterminate D.DE173" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Indeterminate D.DE173 */

/*
@dataElement: HIV.D.DE175 - HCV treatment start date
@activity: HIV.D12 Determine recommended screenings and tests
@description: Date when client started treatment for hepatitis C virus (HCV)
*/

define "HCV treatment start date":
  exists Elements."HCV medicine type" MS where start of MS.effective.toInterval() during "Measurement Period"

/* End of HCV treatment start date */

/*
@dataElement: HIV.D.DE176 - HCV treatment completion date
@activity: HIV.D12 Determine recommended screenings and tests
@description: Date when client completed treatment for hepatitis C virus (HCV)
*/

define "HCV treatment completion date":
  exists Elements."HCV medicine type" MS where end of MS.effective.toInterval() during "Measurement Period"
/* End of HCV treatment completion date */

/*
@dataElement: HIV.D.DE178 - HCV viral load test date
@activity: HIV.D12 Determine recommended screenings and tests
@description: Hepatitis C viral load test date
*/

define "HCV viral load test date D.DE178":
  exists Elements."HCV viral load test date D.DE178" P
  where P.performed.toInterval() during "Measurement Period"

/* End of HCV viral load test date D.DE178 */

/*
@dataElement: HIV.D.DE179 - HCV viral load test result
@activity: HIV.D12 Determine recommended screenings and tests
@description: Hepatitis C viral load test result (qualitative)
*/

define "HCV viral load test result D.DE179":
  exists Elements."HCV viral load test result D.DE179" O
  where O.effective.toInterval() during "Measurement Period"
/* End of HCV viral load test result D.DE179 */

/*
@dataElement: HIV.D.DE180 - Detected
@activity: HIV.D12 Determine recommended screenings and tests
@description: HCV was detected
*/

define "Detected D.DE180":
  exists Elements."Detected D.DE180" O
  where O.effective.toInterval() during "Measurement Period"
/* End of Detected D.DE180 */

/*
@dataElement: HIV.D.DE181 - Not detected
@activity: HIV.D12 Determine recommended screenings and tests
@description: HCV was not detected
*/

define "Not detected D.DE181":
  exists Elements."Not detected D.DE181" O
  where O.effective.toInterval() during "Measurement Period"
/* End of Not detected D.DE181 */

/*
@dataElement: HIV.D.DE182 - HCV medicine type
@activity: HIV.D12 Determine recommended screenings and tests
@description: Type of medicine client is prescribed
*/

define "HCV medicine type":
  exists Elements."HCV medicine type"

define "By HCV medicine type Stratifier":
  case 
      when "Interferon" then Concepts."Interferon"
      when "Direct acting antivirals" then Concepts."Direct acting antivirals"
      else null
  end
/* End of HCV medicine type */

/*
@dataElement: HIV.D.DE183 - Interferon
@activity: HIV.D12 Determine recommended screenings and tests
@description: Client is prescribed interferon
*/

define "Interferon":
  exists Elements."Interferon" MS where MS.effective.toInterval() during "Measurement Period"
/* End of Interferon */

/*
@dataElement: HIV.D.DE184 - Direct acting antivirals
@activity: HIV.D12 Determine recommended screenings and tests
@description: Client is prescribed direct acting antivirals
*/

define "Direct acting antivirals":
  exists Elements."Direct acting antivirals" MS where MS.effective.toInterval() during "Measurement Period"
/* End of Direct acting antivirals */

/*
@dataElement: HIV.D.DE185 - Currently on TDF-based ART
@activity: HIV.D12 Determine recommended screenings and tests
@description: Client is currently on TDF-based ART regimen
*/

define "Currently on TDF-based ART":
  exists(Elements."Currently on TDF-based ART" MS
   where MS.effective.toInterval() during "Measurement Period")
/* End of Currently on TDF-based ART */

/*
@dataElement: HIV.D.DE193 - Date viral load test results received by client
@activity: HIV.D10 Counsel returning client
@description: The date on which the client received results from viral load test
*/

define "Date viral load test results received by client D.DE193":
  Elements."Date viral load test results received by client D.DE193" O
    where O.issued.toInterval() during "Measurement Period"

/* End of Date viral load test results received by client D.DE193 */

/*
@dataElement: HIV.D.DE194 - Date of viral load sample collection
@activity: HIV.D10 Counsel returning client
@description: Date and time when the sample was collected to test the client's HIV viral load
*/

define "Date of viral load sample collection D.DE194":
  exists(Elements."Date of viral load sample collection D.DE194" P
  where P.performed.toInterval() during "Measurement Period")
/* End of Date of viral load sample collection D.DE194 */

/*
@dataElement: HIV.D.DE217 - Reason ART stopped
@activity: HIV.D10 Counsel returning client
@description: Reason client intentionally stopped ART
*/
// TODO: Replace placeholder with relevant CQL logic
define "Reason ART stopped D.DE217":
  exists "Reason ART stopped D.DE217 Observation"
define "Reason ART stopped D.DE217 Observation":
  Elements."Reason ART stopped D.DE217 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Toxicity/side effects D.DE218 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Toxicity/side effects D.DE218 Observation":
  Elements."Toxicity/side effects D.DE218 Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Toxicity/side effects D.DE218 */

/*
@dataElement: HIV.D.DE219 - Severe illness, hospitalization
@activity: HIV.D10 Counsel returning client
@description: Client stopped ART because of severe illness, hospitalization
*/
// TODO: Replace placeholder with relevant CQL logic
define "Severe illness, hospitalization D.DE219":
  exists "Severe illness, hospitalization D.DE219 Condition"
    or exists "Severe illness, hospitalization D.DE219 Observation"
define "Severe illness, hospitalization D.DE219 Condition":
  Elements."Severe illness, hospitalization D.DE219 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Severe illness, hospitalization D.DE219 Observation":
  Elements."Severe illness, hospitalization D.DE219 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Drugs out of stock Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Drugs out of stock Observation":
  Elements."Drugs out of stock Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Client lacks finances Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Client lacks finances Observation":
  Elements."Client lacks finances Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Excluded HIV infection in infant D.DE222 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Excluded HIV infection in infant D.DE222 Observation":
  Elements."Excluded HIV infection in infant D.DE222 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Other reason for stopping ART D.DE223 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Other reason for stopping ART D.DE223 Observation":
  Elements."Other reason for stopping ART D.DE223 Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Other reason for stopping ART D.DE223 */

/*
@dataElement: HIV.D.DE259 - Risk factors, comorbidities and coinfections signs and symptoms
@activity: HIV.D14 Prevent, screen, and manage comorbidities and coinfections
@description: Signs and symptoms of opportunistic infections or other comorbidities experienced by client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Risk factors, comorbidities and coinfections signs and symptoms":
  exists "Risk factors, comorbidities and coinfections signs and symptoms Observation"
define "Risk factors, comorbidities and coinfections signs and symptoms Observation":
  Elements."Risk factors, comorbidities and coinfections signs and symptoms Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Presumptive TB D.DE282 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Presumptive TB D.DE282 Observation":
  Elements."Presumptive TB D.DE282 Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Presumptive TB D.DE282 */

/*
@dataElement: HIV.D.DE367 - Baseline CD4 count
@activity: HIV.D20 Diagnostics
@description: CD4 count performed at HIV diagnosis
*/
// TODO: Replace placeholder with relevant CQL logic
define "Baseline CD4 count D.DE367":
  Elements."Baseline CD4 count D.DE367" O
    where O.effective.toInterval() during "Measurement Period"
define "Baseline CD4 count D.DE367 Value":
  "Baseline CD4 count D.DE367" O
  return O.value as integer
/* End of Baseline CD4 count D.DE367 */

/*
@dataElement: HIV.D.DE368 - Date of baseline CD4 count test
@activity: HIV.D20 Diagnostics
@description: Date and time when baseline CD4 count test was conducted
*/
// TODO: Replace placeholder with relevant CQL logic
define "Date of baseline CD4 count test D.DE368":
  Elements."Date of baseline CD4 count test D.DE368" O
    where O.effective.toInterval() during "Measurement Period"
define "Date of baseline CD4 count test D.DE368 Value":
  "Date of baseline CD4 count test D.DE368" O
  return O.value as dateTime
/* End of Date of baseline CD4 count test D.DE368 */

/*
@dataElement: HIV.D.DE387 - Viral load test result
@activity: HIV.D20 Diagnostics
@description: Result from the viral load test in number of copies/mL
*/

define "Viral load test result D.DE387":
  Elements."Viral load test result D.DE387" O
    where O.effective.toInterval() during "Measurement Period"
define "Viral load test result D.DE387 Value":
  "Viral load test result D.DE387" O
  return O.value as integer
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
  Elements."Reason for HIV viral load test Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Routine viral load test Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Routine viral load test Observation":
  Elements."Routine viral load test Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Targeted viral load monitoring Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Targeted viral load monitoring Observation":
  Elements."Targeted viral load monitoring Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Initial viral load test Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Initial viral load test Observation":
  Elements."Initial viral load test Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Follow-up viral load test after receiving enhanced adherence counselling Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Follow-up viral load test after receiving enhanced adherence counselling Observation":
  Elements."Follow-up viral load test after receiving enhanced adherence counselling Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Follow-up viral load test after receiving enhanced adherence counselling */

/*
@dataElement: HIV.D.DE417 - Date viral load test results received by client
@activity: HIV.D20 Diagnostics
@description: The date on which the client received results from a viral load test
*/
// TODO: Replace placeholder with relevant CQL logic
define "Date viral load test results received by client D.DE417":
  Elements."Date viral load test results received by client D.DE417" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Reason for ARV drug regimen substitution Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Toxicity/side effects D.DE419 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Toxicity/side effects D.DE419 Observation":
  Elements."Toxicity/side effects D.DE419 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Drug-drug interaction Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Drug-drug interaction Observation":
  Elements."Drug-drug interaction Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Pregnancy Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Pregnancy Observation":
  Elements."Pregnancy Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."New TB Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "New TB Observation":
  Elements."New TB Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."New drug available Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "New drug available Observation":
  Elements."New drug available Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Drug out of stock Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Drug out of stock Observation":
  Elements."Drug out of stock Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Other reason for regimen substitution Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Other reason for regimen substitution Observation":
  Elements."Other reason for regimen substitution Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Other reason for regimen substitution */

/*
@dataElement: HIV.D.DE457 - Medications prescribed
@activity: HIV.D23 Prescribe
@description: Name or regimen code of all other medications prescribed during the visit
*/
// TODO: Replace placeholder with relevant CQL logic
define "Medications prescribed D.DE457":
  exists "Medications prescribed D.DE457 Observation"
define "Medications prescribed D.DE457 Observation":
  Elements."Medications prescribed D.DE457 Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Medications prescribed D.DE457 */

/*
@dataElement: HIV.D.DE458 - Date medications prescribed
@activity: HIV.D23 Prescribe
@description: Date the medications were prescribed
*/
// TODO: Replace placeholder with relevant CQL logic
define "Date medications prescribed D.DE458":
  Elements."Date medications prescribed D.DE458" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Number of days medications prescribed" O
    where O.effective.toInterval() during "Measurement Period"
define "Number of days medications prescribed Value":
  "Number of days medications prescribed" O
  return O.value as integer
/* End of Number of days medications prescribed */

/*
@dataElement: HIV.D.DE466 - Type of treatment-limiting toxicity
@activity: HIV.D21 Determine regimen and treatment options
@description: Type of treatment-limiting toxicity experienced by client. Treatment-limiting toxicity is defined as a serious adverse drug reaction that results in drug discontinuation or substitution. In addition, any reaction that leads to treatment interruption or requires changing the drug or regimen because of an adverse drug reaction is also considered a serious adverse drug reaction.
*/

define "Type of treatment-limiting toxicity":
    case 
        when "Gastrointestinal" then  Concepts."Gastrointestinal"
        when "Skin issues" then  Concepts."Skin issues"
        when "Peripheral neuropathy" then  Concepts."Peripheral neuropathy"
           when "Central nervous system symptoms" then  Concepts."Central nervous system symptoms"
            when "Weight gain" then  Concepts."Weight gain"
             when "Hepatic dysfunction" then  Concepts."Hepatic dysfunction"
              when "Haematological disorders" then  Concepts."Haematological disorders"
               when "Fatigue" then  Concepts."Fatigue"
               when "Headache D.DE475" then  Concepts."Headache - HIV.D.DE475"
               when "Bone dysfunction" then  Concepts."Bone dysfunction"
               when "Metabolic symptoms" then  Concepts."Metabolic symptoms"
               when "Kidney dysfunction" then  Concepts."Kidney dysfunction"
                              when "Unexpected adverse drug reaction" then  Concepts."Unexpected adverse drug reaction"
              else null
    end
/* End of Type of treatment-limiting toxicity */

/*
@dataElement: HIV.D.DE467 - Gastrointestinal
@activity: HIV.D21 Determine regimen and treatment options
@description: Treatment-limiting toxicity due to GI issues (nausea, diarrhoea, abdominal pain, vomiting)
*/

define "Gastrointestinal":
  exists Elements."Gastrointestinal" AE where AE.date during "Measurement Period"
/* End of Gastrointestinal */

/*
@dataElement: HIV.D.DE468 - Skin issues
@activity: HIV.D21 Determine regimen and treatment options
@description: Treatment-limiting toxicity due to skin issues (rash, hypersensitivity reaction)
*/

define "Skin issues":
  exists Elements."Skin issues" AE where AE.date during "Measurement Period"
/* End of Skin issues */

/*
@dataElement: HIV.D.DE469 - Peripheral neuropathy
@activity: HIV.D21 Determine regimen and treatment options
@description: Treatment-limiting toxicity due to peripheral neuropathy (burning/numbness/ tingling)
*/

define "Peripheral neuropathy":
  exists Elements."Peripheral neuropathy" AE where AE.date during "Measurement Period"
/* End of Peripheral neuropathy */

/*
@dataElement: HIV.D.DE470 - Central nervous system symptoms
@activity: HIV.D21 Determine regimen and treatment options
@description: Treatment-limiting toxicity due to central nervous system symptoms (dizzy, anxiety, nightmare, depression, seizures)
*/

define "Central nervous system symptoms":
  exists Elements."Central nervous system symptoms" AE where AE.date during "Measurement Period"
/* End of Central nervous system symptoms */

/*
@dataElement: HIV.D.DE471 - Weight gain
@activity: HIV.D21 Determine regimen and treatment options
@description: Treatment-limiting toxicity due to weight gain
*/

define "Weight gain":
  exists Elements."Weight gain" AE where AE.date during "Measurement Period"
/* End of Weight gain */

/*
@dataElement: HIV.D.DE472 - Hepatic dysfunction
@activity: HIV.D21 Determine regimen and treatment options
@description: Treatment-limiting toxicity due to hepatic dysfunction (jaundice)
*/

define "Hepatic dysfunction":
  exists Elements."Hepatic dysfunction" AE where AE.date during "Measurement Period"
/* End of Hepatic dysfunction */

/*
@dataElement: HIV.D.DE473 - Haematological disorders
@activity: HIV.D21 Determine regimen and treatment options
@description: Treatment-limiting toxicity due to haematological (anaemia, neutropenia) disorders
*/

define "Haematological disorders":
  exists Elements."Haematological disorders" AE where AE.date during "Measurement Period"
/* End of Haematological disorders */

/*
@dataElement: HIV.D.DE474 - Fatigue
@activity: HIV.D21 Determine regimen and treatment options
@description: Treatment-limiting toxicity due to fatigue
*/

define "Fatigue":
  exists Elements."Fatigue" AE where AE.date during "Measurement Period"
/* End of Fatigue */

/*
@dataElement: HIV.D.DE475 - Headache
@activity: HIV.D21 Determine regimen and treatment options
@description: Treatment-limiting toxicity due to headache
*/
 
define "Headache D.DE475":
  exists Elements."Headache D.DE475" AE where AE.date during "Measurement Period"
/* End of Headache D.DE475 */

/*
@dataElement: HIV.D.DE476 - Bone dysfunction
@activity: HIV.D21 Determine regimen and treatment options
@description: Treatment-limiting toxicity due to bone dysfunction (fractures, osteopenia)
*/

define "Bone dysfunction":
  exists Elements."Bone dysfunction" AE where AE.date during "Measurement Period"
/* End of Bone dysfunction */

/*
@dataElement: HIV.D.DE477 - Metabolic symptoms
@activity: HIV.D21 Determine regimen and treatment options
@description: Treatment-limiting toxicity due to metabolic symptoms (body fat changes, hyperglycaemia, dyslipidaemia)
*/
 
define "Metabolic symptoms":
  exists Elements."Metabolic symptoms" AE where AE.date during "Measurement Period"
/* End of Metabolic symptoms */

/*
@dataElement: HIV.D.DE478 - Kidney dysfunction
@activity: HIV.D21 Determine regimen and treatment options
@description: Treatment-limiting toxicity due to kidney dysfunction (nephrolithiasis, renal insufficiency)
*/
 
define "Kidney dysfunction":
  exists Elements."Kidney dysfunction" AE where AE.date during "Measurement Period"
/* End of Kidney dysfunction */

/*
@dataElement: HIV.D.DE479 - Unexpected adverse drug reaction
@activity: HIV.D21 Determine regimen and treatment options
@description: Client experienced an unexpected adverse drug reaction
*/
 
define "Unexpected adverse drug reaction":
  exists Elements."Unexpected adverse drug reaction" AE where AE.date during "Measurement Period"
/* End of Unexpected adverse drug reaction */

/*
HIV.D.DE485
New regimen after switch to second-line regimen
*/

define "New regimen after switch to second-line regimen":
  Elements."New regimen after switch to second-line regimen" MS
  where start of MS.effective.toInterval() during "Measurement Period"


/*
HIV.D.DE491
New regimen after switch to third-line regimen
*/

define "New regimen after switch to third-line regimen":
  Elements."New regimen after switch to third-line regimen" MS
  where start of MS.effective.toInterval() during "Measurement Period"

/*
@dataElement: HIV.D.DE487 - Dates of substitution within second-line regimen
@activity: HIV.D21 Determine regimen and treatment options
@description: Date on which ARV drug regimen for client was changed within the second-line regimen (substitution)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Dates of substitution within second-line regimen":
  Elements."Dates of substitution within second-line regimen" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Dates of substitution within third-line regimen" O
    where O.effective.toInterval() during "Measurement Period"
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
  exists (Elements."Enhanced adherence counselling provided" C
  where C.received.toInterval() during "Measurement Period"
  )

define "Enhanced adherence counselling provided Disaggregation":
  case 
      when "Enhanced adherence counselling provided" then Concepts."Enhanced adherence counselling provided"
      else null
  end

/* End of Enhanced adherence counselling provided */

/*
@dataElement: HIV.D.DE552 - Buprenorphine
@activity: HIV.D8 Capture or update client history
@description: Opioid substitution to treat opioid dependence
*/

define "Buprenorphine D.DE552":
  Elements."Buprenorphine D.DE552" MR
        where MR.status = 'completed'
        and MR.MedicationRequestPeriod() during "Measurement Period"


/*
@dataElement: HIV.D.DE555 - Methadone
@activity: HIV.D8 Capture or update client history
@description: Opioid substitution to treat opioid dependence
*/
define "Methadone D.DE555":
  Elements."Methadone D.DE555" MR
        where MR.status = 'completed'
        and MR.MedicationRequestPeriod() during "Measurement Period"

      
/* End of Methadone D.DE555 */

/*
@dataElement: HIV.D.DE656 - Date of cervical cancer screening test
@activity: HIV.D28 Offer other services
@description: Date of cervical cancer screening test
*/

define "Date of cervical cancer screening test":
  exists Elements."Date of cervical cancer screening test" d
  where d during "Measurement Period" 
/* End of Date of cervical cancer screening test */

/*
@dataElement: HIV.D.DE657 - Lifetime screening test number
@activity: HIV.D28 Offer other services
@description: Client's lifetime number of screenings for cervical cancer
*/

define "Lifetime screening test number":
  Last(Elements."Lifetime screening test number" O
      where start of O.issued.toInterval() before end of "Measurement Period"
      sort by issued)

  
define "Lifetime screening test number Value":
  "Lifetime screening test number" O
  return O.value as FHIR.string
/* End of Lifetime screening test number */

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
  exists "Cervical cancer screening outcome Observation"

define "Cervical cancer screening outcome Observation":
  Elements."Cervical cancer screening outcome Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Cervical cancer screening outcome */

/*
@dataElement: HIV.D.DE707 - Positive for cervical precancer lesions
@activity: HIV.D28 Offer other services
@description: Screening outcome for cervical precancer lesions is positive
*/
// TODO: Replace placeholder with relevant CQL logic
define "Positive for cervical precancer lesions":
  exists "Positive for cervical precancer lesions Observation"

define "Positive for cervical precancer lesions Observation":
  Elements."Positive for cervical precancer lesions Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Positive for cervical precancer lesions */

/*
@dataElement: HIV.D.DE708 - Negative for cervical precancer lesions
@activity: HIV.D28 Offer other services
@description: Screening outcome for cervical precancer lesions is negative
*/
// TODO: Replace placeholder with relevant CQL logic
define "Negative for cervical precancer lesions":
  exists "Negative for cervical precancer lesions Observation"

define "Negative for cervical precancer lesions Observation":
  Elements."Negative for cervical precancer lesions Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Negative for cervical precancer lesions */

/*
@dataElement: HIV.D.DE709 - Cervical cancer diagnosis
@activity: HIV.D28 Offer other services
@description: Type of cervical cancer diagnosis
*/

define "Cervical cancer diagnosis":
  exists Elements."Cervical cancer diagnosis" C
   where C.prevalenceInterval() overlaps "Measurement Period"

/* End of Cervical cancer diagnosis */

/*
@dataElement: HIV.D.DE710 - Cervical precancer lesions
@activity: HIV.D28 Offer other services
@description: Client is diagnosed with cervical precancer lesions
*/

define "Cervical precancer lesions":
  exists Elements."Cervical precancer lesions" C
  where C.prevalenceInterval() overlaps "Measurement Period"
   
/* End of Cervical precancer lesions */

/*
@dataElement: HIV.D.DE711 - Invasive cervical cancer
@activity: HIV.D28 Offer other services
@description: Client is diagnosed with invasive cervical cancer disease
*/

define "Invasive cervical cancer":
  Elements."Invasive cervical cancer" C
  where C.prevalenceInterval() overlaps "Measurement Period"
  
define "Invasive cervical cancer diagnosis in the last 12 months":
  Elements."Invasive cervical cancer" C
    where C.prevalenceInterval() starts before start of "Measurement Period"
    and  C.prevalenceInterval() starts after (start of "Measurement Period" - 12 months)
  
define "Invasive cervical cancer outside the last 12 months":
  Elements."Invasive cervical cancer" C
    where C.prevalenceInterval() starts before (start of "Measurement Period" - 12 months)
    or  C.prevalenceInterval() starts after (start of "Measurement Period" - 24 months)

/* End of Invasive cervical cancer */

/*
@dataElement: HIV.D.DE712 - Cervical cancer stage at diagnosis
@activity: HIV.D28 Offer other services
@description: Cervical cancer stage at diagnosis of cervical cancer
*/

define "Cervical cancer stage at diagnosis":
  exists Elements."Cervical cancer stage at diagnosis" O
    where O.effective.toInterval() during "Measurement Period"

/* End of Cervical cancer stage at diagnosis */

/*
@dataElement: HIV.D.DE713 - Stage 0
@activity: HIV.D28 Offer other services
@description: Stage 0 cervical cancer at diagnosis of cervical cancer
*/

define "Stage 0":
  exists Elements."Stage 0" O
  where O.effective.toInterval() during "Measurement Period"
/* End of Stage 0 */

/*
@dataElement: HIV.D.DE714 - Stage I
@activity: HIV.D28 Offer other services
@description: Stage I cervical cancer at diagnosis of cervical cancer
*/

define "Stage I":
  exists Elements."Stage I" O
  where O.effective.toInterval() during "Measurement Period"
/* End of Stage I */

/*
@dataElement: HIV.D.DE715 - Stage II
@activity: HIV.D28 Offer other services
@description: Stage II cervical cancer at diagnosis of cervical cancer
*/

define "Stage II":
  exists Elements."Stage II" O
  where O.effective.toInterval() during "Measurement Period"
/* End of Stage II */

/*
@dataElement: HIV.D.DE716 - Stage III
@activity: HIV.D28 Offer other services
@description: Stage III cervical cancer at diagnosis of cervical cancer
*/

define "Stage III":
  exists Elements."Stage III" O
  where O.effective.toInterval() during "Measurement Period"
/* End of Stage III */

/*
@dataElement: HIV.D.DE717 - Stage IV
@activity: HIV.D28 Offer other services
@description: Stage IV cervical cancer at diagnosis of cervical cancer
*/
 
define "Stage IV":
  exists Elements."Stage IV" O
  where O.effective.toInterval() during "Measurement Period"
/* End of Stage IV */

define "By Cervical cancer stage at diagnosis of cervical cancer Stratifier":
  case 
      when "Stage 0" then Concepts."Stage 0"
      when "Stage I" then Concepts."Stage I"
      when "Stage II" then Concepts."Stage II"
      when "Stage III" then Concepts."Stage III"
      when "Stage IV" then Concepts."Stage IV"
      else null
  end

/*
@dataElement: HIV.D.DE718 - Date of treatment for cervical precancer lesions
@activity: HIV.D28 Offer other services
@description: Date of treatment for cervical precancer lesions
*/

define "Date of treatment for cervical precancer lesions":
  exists Elements."Date of treatment for cervical precancer lesions" P
  where P.performed during "Measurement Period" 
/* End of Date of treatment for cervical precancer lesions */

/*
@dataElement: HIV.D.DE730 - Invasive cervical cancer treatment episode
@activity: HIV.D28 Offer other services
@description: Client's lifetime number of treatments for invasive cervical cancer
*/

define "Invasive cervical cancer treatment episode":
  Last(Elements."Invasive cervical cancer treatment episode" O
      where start of O.effective.toInterval() before end of "Measurement Period"
      sort by effective)

define "Invasive cervical cancer treatment episode Value":
  "Invasive cervical cancer treatment episode" O
  return O.value as FHIR.string
/* End of Invasive cervical cancer treatment episode */

/*
@dataElement: HIV.D.DE731 - Invasive cervical cancer treatment method
@activity: HIV.D28 Offer other services
@description: Invasive cervical cancer treatment method
*/

define "Invasive cervical cancer treatment method":
  Elements."Invasive cervical cancer treatment method" P 
  where P.performed during "Measurement Period" 

/* End of Invasive cervical cancer treatment method */

/*
@dataElement: HIV.D.DE732 - Conization
@activity: HIV.D28 Offer other services
@description: Invasive cervical cancer treatment method is a conization
*/

define "Conization":
  exists Elements."Conization" P 
  where P.performed during "Measurement Period" 
/* End of Conization */

/*
@dataElement: HIV.D.DE733 - Trachelectomy
@activity: HIV.D28 Offer other services
@description: Invasive cervical cancer treatment method is a trachelectomy
*/
 
define "Trachelectomy":
  exists Elements."Trachelectomy" P 
  where P.performed during "Measurement Period" 
/* End of Trachelectomy */

/*
@dataElement: HIV.D.DE734 - Hysterectomy
@activity: HIV.D28 Offer other services
@description: Invasive cervical cancer treatment method is a hysterectomy
*/

define "Hysterectomy":
  exists Elements."Hysterectomy" P 
  where P.performed during "Measurement Period" 
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
  Elements."Management of invasive cervical cancer Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"

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
  Elements."Radiotherapy Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"

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
  Elements."Chemotherapy Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"

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
  Elements."Chemoradiation Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"

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
  Elements."Other D.DE739 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"

/* End of Other D.DE739 */

/*
@dataElement: HIV.D.DE760 - Eligible for DSD ART
@activity: HIV.D21 Determine regimen and treatment options
@description: Client is eligible for differentiated service delivery (DSD) for ART
*/

define "Eligible for DSD ART":
  exists Elements."Eligible for DSD ART" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Eligible for DSD ART */

/*
@dataElement: HIV.D.DE761 - Date DSD ART eligibility assessed
@activity: HIV.D21 Determine regimen and treatment options
@description: Date client was assessed for eligibility for differentiated service delivery (DSD) for ART
*/

define "Date DSD ART eligibility assessed":
  exists(Elements."Date DSD ART eligibility assessed" P where P during "Measurement Period")

/* End of Date DSD ART eligibility assessed */

/*
@dataElement: HIV.D.DE762 - Currently enrolled in DSD ART model
@activity: HIV.D21 Determine regimen and treatment options
@description: Client currently enrolled in differentiated service delivery (DSD) ART model
*/

define "Currently enrolled in DSD ART model":
  exists(
    [EpisodeOfCare] EOC
    where exists(EOC.type T where T ~ Concepts."Currently enrolled in DSD ART model")
    and (exists (
      EOC.statusHistory H
      where H.period starts after start of "Measurement Period"
      and H.period starts before end of "Measurement Period"
    ) 
    or (
      EOC.period starts after start of "Measurement Period"
      and EOC.period starts before end of "Measurement Period"
    )
    )
  )
/* End of Currently enrolled in DSD ART model */

/*
@dataElement: HIV.D.DE763 - DSD ART start date
@activity: HIV.D21 Determine regimen and treatment options
@description: Date client started on differentiated service delivery (DSD) for ART
*/

define "DSD ART start date":
  exists(Elements."DSD ART start date" t where t starts during "Measurement Period")
/* End of DSD ART start date */

/*
@dataElement: HIV.D.DE764 - DSD ART models
@activity: HIV.D21 Determine regimen and treatment options
@description: Type of DSD ART model client is enrolled in (country-specific)
*/

define "DSD ART models":
    case
    when "Fast track ART refill" then Concepts."Fast track ART refill"
    when "Facility adherence club" then Concepts."Facility adherence club"
    when "Community ART distribution point" then Concepts."Community ART distribution point"
    when "CHW/peer educator community ART group" then Concepts."CHW/peer educator community ART group"
    when "Patient/client community ART group" then Concepts."Patient/client community ART group"
    when "Other DSD ART model" then Concepts."Other DSD ART model"
    else null
  end

/* End of DSD ART models */

/*
@dataElement: HIV.D.DE765 - Fast track ART refill
@activity: HIV.D21 Determine regimen and treatment options
@description: Client is enrolled in fast track ART refill (DSD ART model)
*/

define "Fast track ART refill":
  exists(
    [EpisodeOfCare] EOC
    where exists(EOC.type T where T ~ Concepts."Fast track ART refill")
    and (exists (
      EOC.statusHistory H
      where H.period starts after start of "Measurement Period"
      and H.period starts before end of "Measurement Period"
    ) 
    or (
      EOC.period starts after start of "Measurement Period"
      and EOC.period starts before end of "Measurement Period"
    )
    )
  )
/* End of Fast track ART refill */

/*
@dataElement: HIV.D.DE766 - Facility adherence club
@activity: HIV.D21 Determine regimen and treatment options
@description: Client is enrolled in facility adherence club (DSD ART model)
*/

define "Facility adherence club":
  exists(
    [EpisodeOfCare] EOC
    where exists(EOC.type T where T ~ Concepts."Facility adherence club")
    and (exists (
      EOC.statusHistory H
      where H.period starts after start of "Measurement Period"
      and H.period starts before end of "Measurement Period"
    ) 
    or (
      EOC.period starts after start of "Measurement Period"
      and EOC.period starts before end of "Measurement Period"
    )
    )
  )
/* End of Facility adherence club */

/*
@dataElement: HIV.D.DE767 - Community ART distribution point
@activity: HIV.D21 Determine regimen and treatment options
@description: Client is enrolled in community ART distribution point (DSD ART model)
*/

define "Community ART distribution point":
  exists(
    [EpisodeOfCare] EOC
    where exists(EOC.type T where T ~ Concepts."Community ART distribution point")
    and (exists (
      EOC.statusHistory H
      where H.period starts after start of "Measurement Period"
      and H.period starts before end of "Measurement Period"
    ) 
    or (
      EOC.period starts after start of "Measurement Period"
      and EOC.period starts before end of "Measurement Period"
    )
    )
  )
/* End of Community ART distribution point */

/*
@dataElement: HIV.D.DE768 - CHW/peer educator community ART group
@activity: HIV.D21 Determine regimen and treatment options
@description: Client is enrolled in community health worker/peer educator community ART group (DSD ART model)
*/

define "CHW/peer educator community ART group":
  exists(
    [EpisodeOfCare] EOC
    where exists(EOC.type T where T ~ Concepts."CHW/peer educator community ART group")
    and (exists (
      EOC.statusHistory H
      where H.period starts after start of "Measurement Period"
      and H.period starts before end of "Measurement Period"
    ) 
    or (
      EOC.period starts after start of "Measurement Period"
      and EOC.period starts before end of "Measurement Period"
    )
    )
  )
/* End of CHW/peer educator community ART group */

/*
@dataElement: HIV.D.DE769 - Patient/client community ART group
@activity: HIV.D21 Determine regimen and treatment options
@description: Client is enrolled in patient/client community ART group (DSD ART model)
*/

define "Patient/client community ART group":
  exists(
    [EpisodeOfCare] EOC
    where exists(EOC.type T where T ~ Concepts."Patient/client community ART group")
    and (exists (
      EOC.statusHistory H
      where H.period starts after start of "Measurement Period"
      and H.period starts before end of "Measurement Period"
    ) 
    or (
      EOC.period starts after start of "Measurement Period"
      and EOC.period starts before end of "Measurement Period"
    )
    )
  )
/* End of Patient/client community ART group */

/*
@dataElement: HIV.D.DE770 - Other DSD ART model
@activity: HIV.D21 Determine regimen and treatment options
@description: Client is enrolled in another DSD ART model
*/

define "Other DSD ART model":
  exists(
    [EpisodeOfCare] EOC
    where exists(EOC.type T where T ~ Concepts."Other DSD ART model")
    and (exists (
      EOC.statusHistory H
      where H.period starts after start of "Measurement Period"
      and H.period starts before end of "Measurement Period"
    ) 
    or (
      EOC.period starts after start of "Measurement Period"
      and EOC.period starts before end of "Measurement Period"
    )
    )
  )
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
  Elements."Syndrome/STI diagnosed D.DE778 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Urethral discharge syndrome D.DE779 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Urethral discharge syndrome D.DE779 Observation":
  Elements."Urethral discharge syndrome D.DE779 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Vaginal discharge syndrome D.DE780 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Vaginal discharge syndrome D.DE780 Observation":
  Elements."Vaginal discharge syndrome D.DE780 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Lower Abdominal pain D.DE781 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Lower Abdominal pain D.DE781 Observation":
  Elements."Lower Abdominal pain D.DE781 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Genital ulcer disease syndrome D.DE782 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Genital ulcer disease syndrome D.DE782 Observation":
  Elements."Genital ulcer disease syndrome D.DE782 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Anorectal discharge D.DE783 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Anorectal discharge D.DE783 Observation":
  Elements."Anorectal discharge D.DE783 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Sent for testing D.DE784 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Sent for testing D.DE784 Observation":
  Elements."Sent for testing D.DE784 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Other D.DE785 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Other D.DE785 Observation":
  Elements."Other D.DE785 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Any STI syndrome diagnosed D.DE787 Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Any STI syndrome diagnosed D.DE787 */

/*
@dataElement: HIV.D.DE801 - Syphilis test date
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Date of syphilis test
*/
// TODO: Replace placeholder with relevant CQL logic
define "Syphilis test date D.DE801":
  Elements."Syphilis test date D.DE801" O
    where O.effective.toInterval() during "Measurement Period"
define "Syphilis test date D.DE801 Value":
  "Syphilis test date D.DE801" O
  return O.value as dateTime
/* End of Syphilis test date D.DE801  */

/*
@dataElement: HIV.D.DE802 - Syphilis test result
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Result from syphilis test
*/
// TODO: Replace placeholder with relevant CQL logic
define "Syphilis test result D.DE802":
  exists "Syphilis test result D.DE802 Observation"
define "Syphilis test result D.DE802 Observation":
  Elements."Syphilis test result D.DE802 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Positive D.DE803 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Positive D.DE803 Observation":
  Elements."Positive D.DE803 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Negative D.DE804 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Negative D.DE804 Observation":
  Elements."Negative D.DE804 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Inconclusive D.DE805 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Inconclusive D.DE805 Observation":
  Elements."Inconclusive D.DE805 Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Inconclusive D.DE805 */

/*
@dataElement: HIV.D.DE806 - Syphilis treatment start date
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Date of initiation of syphilis treatment
*/
// TODO: Replace placeholder with relevant CQL logic
define "Syphilis treatment start date D.DE806":
  Elements."Syphilis treatment start date D.DE806" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Gonorrhoea test date D.DE807" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Gonorrhoea test result D.DE808 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Positive D.DE809 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Positive D.DE809 Observation":
  Elements."Positive D.DE809 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Negative D.DE810 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Negative D.DE810 Observation":
  Elements."Negative D.DE810 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Inconclusive D.DE811 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Inconclusive D.DE811 Observation":
  Elements."Inconclusive D.DE811 Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Inconclusive D.DE811 */

/*
@dataElement: HIV.D.DE812 - Gonorrhoea treatment start date
@activity: HIV.D26 Offer sexual and reproductive health services
@description: Date of initiation of Gonorrhoea treatment
*/
// TODO: Replace placeholder with relevant CQL logic
define "Gonorrhoea treatment start date D.DE812":
  Elements."Gonorrhoea treatment start date D.DE812" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Type of specimen D.DE813 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Blood D.DE814 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Blood D.DE814 Observation":
  Elements."Blood D.DE814 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Urine D.DE815 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Urine D.DE815 Observation":
  Elements."Urine D.DE815 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Cervical or vaginal swab D.DE816 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Cervical or vaginal swab D.DE816 Observation":
  Elements."Cervical or vaginal swab D.DE816 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Urethral or penile swab D.DE817 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Urethral or penile swab D.DE817 Observation":
  Elements."Urethral or penile swab D.DE817 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Rectal swab D.DE818 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Rectal swab D.DE818 Observation":
  Elements."Rectal swab D.DE818 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Other D.DE819 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Other D.DE819 Observation":
  Elements."Other D.DE819 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Neisseria gonorrhoeae test type D.DE828 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."NAAT D.DE829 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "NAAT D.DE829 Observation":
  Elements."NAAT D.DE829 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."POC Test D.DE830 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "POC Test D.DE830 Observation":
  Elements."POC Test D.DE830 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Culture D.DE831 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Culture D.DE831 Observation":
  Elements."Culture D.DE831 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Microscopy D.DE832 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Microscopy D.DE832 Observation":
  Elements."Microscopy D.DE832 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Other D.DE833 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Other D.DE833 Observation":
  Elements."Other D.DE833 Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Other D.DE833 */

/*
@dataElement: HIV.D.DE939 - TB diagnosis result
@activity: HIV.D8 Capture or update client history
@description: Final result of the TB investigation (bacteriological and/or clinical)
*/

define "TB diagnosis result":
  exists Elements."TB diagnosis result" O
    where O.effective.toInterval() during "Measurement Period"
/* End of TB diagnosis result */

/*
@dataElement: HIV.D.DE940 - Diagnosed TB
@activity: HIV.D8 Capture or update client history
@description: Client is diagnosed with TB disease
*/

define "Diagnosed TB":
  exists Elements."Diagnosed TB" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Diagnosed TB */

/*
@dataElement: HIV.D.DE941 - TB excluded
@activity: HIV.D8 Capture or update client history
@description: Client is not diagnosed with TB
*/

define "TB excluded":
  exists Elements."TB excluded" O
    where O.effective.toInterval() during "Measurement Period"
/* End of TB excluded */

/*
@dataElement: HIV.D.DE945 - Presumptive TB
@activity: HIV.D8 Capture or update client history
@description: Client has signs or symptoms of tuberculosis (TB) without laboratory confirmation
*/

define "Presumptive TB D.DE945":
  exists Elements."Presumptive TB D.DE945" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Presumptive TB D.DE945 */

/*
@dataElement: HIV.D.DE952 - Date of TB diagnosis
@activity: HIV.D8 Capture or update client history
@description: The date when the diagnosis was established
*/

define "Date of TB diagnosis":
  exists(Elements."Date of TB diagnosis" C where C during "Measurement Period")

/* End of Date of TB diagnosis */

/*
@dataElement: HIV.D.DE954 - TB preventive treatment TPT start date
@activity: HIV.D8 Capture or update client history
@description: The date on which the client began taking TPT
*/
define "TB preventive treatment TPT start date in measurement period":
  Elements."TB preventive treatment TPT start date" D
    where D in "Measurement Period"

define "TB preventive treatment TPT start date in previous measurement period":
  Elements."TB preventive treatment TPT start date" D
    where D before (end of "Measurement Period" - duration in days of "Measurement Period")
    and D after (start of "Measurement Period" - duration in days of "Measurement Period")

define "TB preventive treatment TPT completed in measurement period":
  Elements."TPT regimen" MS
    where start of MS.effective.toInterval() in "Measurement Period"
      and MS.status = 'completed'
/* End of TB preventive treatment TPT start date */

/*
@dataElement: HIV.D.DE986 - TB screening result
@activity: HIV.D4 Screen for TB
@description: Record the result of the tuberculosis (TB) screening
*/

define "TB screening result":
  exists (Elements."TB screening result")
/* End of TB screening result */

/*
@dataElement: HIV.D.DE987 - Screen positive for TB
@activity: HIV.D4 Screen for TB
@description: Screening result was positive for tuberculosis (TB)
*/

define "Screen positive for TB":
  exists Elements."Screen positive for TB" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Screen positive for TB */

/*
@dataElement: HIV.D.DE988 - Screen negative for TB
@activity: HIV.D4 Screen for TB
@description: Screening result was negative for tuberculosis (TB)
*/

define "Screen negative for TB":
  exists Elements."Screen negative for TB" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Screen negative for TB */

/*
@dataElement: HIV.D.DE989 - Inconclusive
@activity: HIV.D4 Screen for TB
@description: Screening result was inconclusive for tuberculosis (TB)
*/

define "Inconclusive D.DE989":
  exists Elements."Inconclusive D.DE989" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Inconclusive D.DE989 */

/*
@dataElement: HIV.D.DE990 - TB screening date
@activity: HIV.D4 Screen for TB
@description: Date the TB screening was conducted
*/

define "TB screening date":
  exists (Elements."TB screening date" P
    where P.performed.toInterval() during "Measurement Period")

/* End of TB screening date */

/*
@dataElement: HIV.D.DE992 - TB diagnostic test category
@activity: HIV.D4 Screen for TB
@description: The type of diagnostic test performed to detect tuberculosis (TB) disease
*/

define "TB diagnostic test category":
  exists (Elements."TB diagnostic test category")
/* End of TB diagnostic test category */

/*
@dataElement: HIV.D.DE993 - LF-LAM
@activity: HIV.D4 Screen for TB
@description: Client tested for tuberculosis with a lateral flow urine lipoarabinomannan assay
*/

define "LF-LAM":
  exists (Elements."LF-LAM" O
     where O.performed.toInterval() during "Measurement Period")
/* End of LF-LAM */

/*
@dataElement: HIV.D.DE994 - mWRD test for TB
@activity: HIV.D4 Screen for TB
@description: Client tested with a WHO-recommended molecular diagnostic test to detect Mycobacterium tuberculosis (MTB)
*/

define "mWRD test for TB":
  exists (Elements."mWRD test for TB" O
     where O.performed.toInterval() during "Measurement Period")
/* End of mWRD test for TB */

/*
@dataElement: HIV.D.DE995 - Microscopy - Sputum acid-fast bacilli AFB
@activity: HIV.D4 Screen for TB
@description: Client tested for tuberculosis with a sputum acid-fast bacilli (AFB)
*/

define "Microscopy - Sputum acid-fast bacilli AFB":
    exists (Elements."Microscopy - Sputum acid-fast bacilli AFB" O
     where O.performed.toInterval() during "Measurement Period")
/* End of Microscopy - Sputum acid-fast bacilli AFB */

/*
@dataElement: HIV.D.DE996 - TB Culture
@activity: HIV.D4 Screen for TB
@description: Client tested for tuberculosis (TB) with a culture
*/

define "TB Culture":
  exists (Elements."TB Culture" O
     where O.performed.toInterval() during "Measurement Period")
/* End of TB Culture */

/*
@dataElement: HIV.D.DE997 - TB diagnostic test date
@activity: HIV.D4 Screen for TB
@description: The date when TB diagnostic test was performed
*/

define "TB diagnostic test date":
  exists(Elements."TB diagnostic test date" P where P during "Measurement Period")

/* End of TB diagnostic test date */

/*
@dataElement: HIV.D.DE1001 - TB treatment start date
@activity: HIV.D8 Capture or update client history
@description: The date on which the client start or restarted tuberculosis (TB) treatment
*/

define "TB treatment start date":
  exists(Elements."TB treatment start date" MS where MS during "Measurement Period")
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
  Elements."Eligible for TB preventive treatment Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Eligible for TB preventive treatment */

/*
@dataElement: HIV.D.DE1028 - TPT regimen type
@activity: HIV.D4 Screen for TB
@description: Type of TPT regimen the client is currently on
*/
define "On TPT regimen":
  exists "TPT regimen"

define "TPT regimen":
  Elements."TPT regimen" MS
    where MS.effective.toInterval() during "Measurement Period"

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
  Elements."TB preventive treatment TPT status Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Not started Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Not started Observation":
  Elements."Not started Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."On TPT Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "On TPT Observation":
  Elements."On TPT Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."On TPT with interruptions Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "On TPT with interruptions Observation":
  Elements."On TPT with interruptions Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."On hold Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "On hold Observation":
  Elements."On hold Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Completed Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Completed Observation":
  Elements."Completed Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Completed */

/*
@dataElement: HIV.E.DE41 - Timing of ART initiation
@activity: HIV.E1 Capture or update mother's history
@description: When the pregnant woman or mother initiated ART, for women living with HIV.
*/

define "Timing of ART initiation":
  case
    when "Already on ART at first antenatal care visit" then Concepts."Already on ART at first antenatal care visit"
    when "Newly on ART during pregnancy" then Concepts."Newly on ART during pregnancy"
    when "Newly on ART during labour and delivery" then Concepts."Newly on ART during labour and delivery"
    else null
  end
/* End of Timing of ART initiation */

/*
@dataElement: HIV.E.DE42 - Already on ART at first antenatal care visit
@activity: HIV.E1 Capture or update mother's history
@description: The pregnant woman was already on antiretroviral therapy (ART) at first antenatal care visit
*/

define "Already on ART at first antenatal care visit":
  exists Elements."Already on ART at first antenatal care visit" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Already on ART at first antenatal care visit */

/*
@dataElement: HIV.E.DE43 - Newly on ART during pregnancy
@activity: HIV.E1 Capture or update mother's history
@description: The pregnant woman started ART during her pregnancy
*/

define "Newly on ART during pregnancy":
  exists Elements."Newly on ART during pregnancy" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Newly on ART during pregnancy */

/*
@dataElement: HIV.E.DE44 - Newly on ART during labour and delivery
@activity: HIV.E1 Capture or update mother's history
@description: The woman started ART during labour and delivery
*/

define "Newly on ART during labour and delivery":
  exists Elements."Newly on ART during labour and delivery" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Newly on ART during labour and delivery */

/*
@dataElement: HIV.E.DE46 - Delivery date
@activity: HIV.E1 Capture or update mother's history
@description: Date on which the woman delivered
*/
define "Live Birth Delivery":
  Elements."Live Birth Delivery" O
    where O.effective.toInterval() during "Measurement Period"
define "Delivery date":
  "Live Birth Delivery" O
  return O.effective

define "Has Delivery in Health Facility":
  exists (
    "Live Birth Delivery" O
      where O.value is CodeableConcept
        and O.value as CodeableConcept = Concepts."Health facility"
  )
/* End of Delivery date */

/*
@dataElement: HIV.E.DE67 - Place of delivery
@activity: HIV.E1 Capture or update mother's history
@description: The type of place where the woman delivered
*/
// TODO: Replace placeholder with relevant CQL logic
define "Place of delivery":
  exists (Elements."Place of delivery" O
  where O.effective.toInterval() during "Measurement Period")
/* End of Place of delivery */

/*
@dataElement: HIV.E.DE68 - Health facility
@activity: HIV.E1 Capture or update mother's history
@description: The woman delivered at a health facility
*/
// TODO: Replace placeholder with relevant CQL logic
define "Health facility":
  exists (Elements."Health facility" O
  where O.effective.toInterval() during "Measurement Period")
/* End of Health facility */

/*
@dataElement: HIV.E.DE69 - Home
@activity: HIV.E1 Capture or update mother's history
@description: The woman delivered at home
*/
// TODO: Replace placeholder with relevant CQL logic
define "Home":
  exists (Elements."Health facility" O
  where O.effective.toInterval() during "Measurement Period")
/* End of Home */

/*
@dataElement: HIV.E.DE70 - Other
@activity: HIV.E1 Capture or update mother's history
@description: The woman delivered at another location that is not at home or at a health facility
*/
// TODO: Replace placeholder with relevant CQL logic
define "Other E.DE70":
  exists (Elements."Other E.DE70" O
  where O.effective.toInterval() during "Measurement Period")
/* End of Other E.DE70 */

/*
@dataElement: HIV.E.DE85 - ANC contact date
@activity: HIV.E1 Capture or update mother's history
@description: The date and time of the client's ANC contact (in the ANC DAK this is called 'Contact date')
*/

define "ANC contact date E.DE85":
  exists(Elements."ANC contact date E.DE85" E where E during "Measurement Period")

/* End of ANC contact date E.DE85 */

/*
@dataElement: HIV.E.DE87 - Infant date of birth
@activity: HIV.E1 Capture or update mother's history
@description: The infant's date of birth (DOB) if known
*/
// TODO: Replace placeholder with relevant CQL logic
define "Infant date of birth":
  Elements."Infant date of birth" O
    where O.effective.toInterval() during "Measurement Period"
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
  "Infant date of birth Value" bd
    return CalculateAgeInDaysAt(bd, start of "Measurement Period")

define "Age of infant in hours":
  "Infant date of birth Value" bd
    return CalculateAgeInHoursAt(bd, start of "Measurement Period")

define "Age of infant in weeks":
  "Infant date of birth Value" bd 
    return CalculateAgeInWeeksAt(bd, start of "Measurement Period")

define "Age of infant in years":
  "Infant date of birth Value" bd
    return CalculateAgeInYearsAt(bd, start of "Measurement Period")

define "Is Infant Patient":
  Patient.birthDate is not null
  and difference in years between Patient.birthDate and start of "Measurement Period" < 1

/* End of Age of infant */

/*
@dataElement: HIV.E.DE112 - HIV-exposed infant or child
@activity: HIV.F6 Check whether infant/child had HIV exposure
@description: Whether the infant or child was determined to have had HIV exposure
*/
define "is HIV-exposed infant or child E.DE112":
  "Is Infant Patient" and 
  exists(Elements."HIV-exposed infant or child E.DE112" O
    where O.effective.toInterval() during "Measurement Period")

define "HIV-exposed infant or child E.DE112":
  Elements."HIV-exposed infant or child E.DE112" O
    where O.effective.toInterval() during "Measurement Period"
/* End of HIV-exposed infant or child E.DE112 */

/*
@dataElement: HIV.E.DE114 - Key population member type
@activity: HIV.E1 Capture or update mother's history
@description: The type of key population that the infant's mother is included in
*/
// TODO: Replace placeholder with relevant CQL logic
define "Is Key population member type E.DE114":
  exists "Key population member type E.DE114 Observation"
define "Key population member type E.DE114 Observation":
  Elements."Key population member type E.DE114 Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Key population member type E.DE114 */

/*
@dataElement: HIV.E.DE168 - HIV test type
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: Type of HIV test
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV test type E.DE168":
  exists "HIV test type E.DE168 Observation"
define "HIV test type E.DE168 Observation":
  Elements."HIV test type E.DE168 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Rapid diagnostic test for HIV E.DE169 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Rapid diagnostic test for HIV E.DE169 Observation":
  Elements."Rapid diagnostic test for HIV E.DE169 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Enzyme immunoassay for HIV E.DE170 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Enzyme immunoassay for HIV E.DE170 Observation":
  Elements."Enzyme immunoassay for HIV E.DE170 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Nucleic acid test for HIV E.DE171 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Nucleic acid test for HIV E.DE171 Observation":
  Elements."Nucleic acid test for HIV E.DE171 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Dual HIV/syphilis rapid diagnostic test E.DE172 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Dual HIV/syphilis rapid diagnostic test E.DE172 Observation":
  Elements."Dual HIV/syphilis rapid diagnostic test E.DE172 Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Dual HIV/syphilis rapid diagnostic test E.DE172 */

/*
@dataElement: HIV.E.DE173 - Maternal and child health service visit
@activity: HIV.E1 Capture or update mother's history
@description: Maternal and child health service visit attended by an HIV-exposed infant
*/

define "Maternal and child health service visit":
  exists Elements."Maternal and child health service visit" E
  where E.period.toInterval() during "Measurement Period"
/* End of Maternal and child health service visit */

/*
@dataElement: HIV.E.DE174 - 12-month visit
@activity: HIV.E1 Capture or update mother's history
@description: HIV-exposed infant attending MCH services for a 12-month visit
*/

define "12-month visit":
  exists Elements."12-month visit" E
  where E.period.toInterval() during "Measurement Period"
/* End of 12-month visit */

/*
@dataElement: HIV.E.DE175 - 24-month visit
@activity: HIV.E1 Capture or update mother's history
@description: HIV-exposed infants attending MCH services for a 24-month visit
*/

define "24-month visit":
  exists Elements."24-month visit" E
  where E.period.toInterval() during "Measurement Period"
/* End of 24-month visit */

/*
@dataElement: HIV.E.DE176 - First visit after the end of breastfeeding
@activity: HIV.E1 Capture or update mother's history
@description: HIV-exposed infant attending MCH services for a first visit after the end of breastfeeding
*/

define "First visit after the end of breastfeeding":
  exists Elements."First visit after the end of breastfeeding" E
  where E.period.toInterval() during "Measurement Period"
/* End of First visit after the end of breastfeeding */

/*
@dataElement: HIV.E.DE179 - Registered in birth cohort
@activity: HIV.F3 Capture or update infant's/child's history
@description: Whether the infant has been registered in a birth cohort
*/

define "Registered in birth cohort":
  exists Elements."Registered in birth cohort" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Registered in birth cohort */

/*
@dataElement: HIV.E.DE186 - EID test number 1 test result
@activity: HIV.F8 Test infant/child for HIV using testing algorithm
@description: Early infant diagnosis test number 1 test result
*/

define "EID test number 1 test result":
  case 
      when "Positive E.DE187"  then Concepts."Positive - HIV.E.DE187"
      when "Negative E.DE188" then Concepts."Negative - HIV.E.DE188"
      when "Indeterminate E.DE189"then Concepts."Indeterminate - HIV.E.DE189"
      else null
  end

define "Positive E.DE187":
exists(
    Elements."Positive E.DE187" O 
    with [Patient] Pt
    such that O.subject.references(Pt) 
    and months between start of O.effective.toInterval() and FHIRHelpers.ToDate(Pt.birthDate) < 2 months)

define "Negative E.DE188":
exists(
    Elements."Negative E.DE188" O 
    with [Patient] Pt
    such that O.subject.references(Pt) 
    and months between start of O.effective.toInterval() and FHIRHelpers.ToDate(Pt.birthDate) < 2 months)

define "Indeterminate E.DE189":
exists(
    Elements."Indeterminate E.DE189" O 
    with [Patient] Pt
    such that O.subject.references(Pt) 
    and months between start of O.effective.toInterval() and FHIRHelpers.ToDate(Pt.birthDate) < 2 months)



/*
@dataElement: HIV.E.DE224 - HIV test date
@activity: HIV.F8 Test infant/child for HIV using testing algorithm
@description: Date of the HIV test
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV test date E.DE224":
  Elements."HIV test date E.DE224" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Infant HIV status Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."HIV-positive E.DE226 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "HIV-positive E.DE226 Observation":
  Elements."HIV-positive E.DE226 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."HIV-negative E.DE227 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "HIV-negative E.DE227 Observation":
  Elements."HIV-negative E.DE227 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Unknown E.DE228 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Unknown E.DE228 Observation":
  Elements."Unknown E.DE228 Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Unknown E.DE228 */

/*
@dataElement: HIV.E.DE229 - Infant ART start date
@activity: HIV.F16 Immediately start infant on ART
@description: The date on which the infant was started or restarted on antiretroviral therapy (ART)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Infant ART start date":
  Elements."Infant ART start date" O
    where O.effective.toInterval() during "Measurement Period"
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
  exists Elements."Final diagnosis of HIV-exposed infant E.DE230 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."HIV-positive E.DE231 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "HIV-positive E.DE231 Observation":
  Elements."HIV-positive E.DE231 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."HIV-negative and no longer breastfeeding Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "HIV-negative and no longer breastfeeding Observation":
  Elements."HIV-negative and no longer breastfeeding Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."HIV status unknown Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "HIV status unknown Observation":
  Elements."HIV status unknown Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of HIV status unknown */

/*
@dataElement: HIV.G.DE3 - Baseline CD4 count
@activity: HIV.D20 Diagnostics
@description: CD4 count performed at HIV diagnosis
*/
// TODO: Replace placeholder with relevant CQL logic
define "Baseline CD4 count G.DE3":
  Elements."Baseline CD4 count G.DE3" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Date of viral load sample collection G.DE8" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Viral load test result G.DE12" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."HBsAg test date G.DE17" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."HBsAg test result G.DE18 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Positive G.DE19 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Positive G.DE19 Observation":
  Elements."Positive G.DE19 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Negative G.DE20 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Negative G.DE20 Observation":
  Elements."Negative G.DE20 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Indeterminate G.DE21 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Indeterminate G.DE21 Observation":
  Elements."Indeterminate G.DE21 Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Indeterminate G.DE21 */

/*
@dataElement: HIV.G.DE42 - HCV test date
@activity: HIV.D20 Diagnostics
@description: Date client was tested for hepatitis C virus (HCV antibody, HCV RNA or HCV core antigen)
*/
// TODO: Replace placeholder with relevant CQL logic
define "HCV test date G.DE42":
  Elements."HCV test date G.DE42" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."HCV test result G.DE43 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Positive G.DE44 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Positive G.DE44 Observation":
  Elements."Positive G.DE44 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Negative G.DE45 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Negative G.DE45 Observation":
  Elements."Negative G.DE45 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Indeterminate G.DE46 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Indeterminate G.DE46 Observation":
  Elements."Indeterminate G.DE46 Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Indeterminate G.DE46 */

/*
@dataElement: HIV.G.DE47 - HCV viral load test date
@activity: HIV.D20 Diagnostics
@description: Hepatitis C viral load test date
*/
// TODO: Replace placeholder with relevant CQL logic
define "HCV viral load test date G.DE47":
  Elements."HCV viral load test date G.DE47" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."HCV viral load test result G.DE48 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Detected G.DE49 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Detected G.DE49 Observation":
  Elements."Detected G.DE49 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Not detected G.DE50 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Not detected G.DE50 Observation":
  Elements."Not detected G.DE50 Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Not detected G.DE50 */

/*
@dataElement: HIV.G.DE69 - Syphilis test date
@activity: HIV.D20 Diagnostics
@description: Date of syphilis test
*/
// TODO: Replace placeholder with relevant CQL logic
define "Syphilis test date G.DE69":
  Elements."Syphilis test date G.DE69" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Syphilis test result G.DE70 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Positive G.DE71 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Positive G.DE71 Observation":
  Elements."Positive G.DE71 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Negative G.DE72 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Negative G.DE72 Observation":
  Elements."Negative G.DE72 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Inconclusive G.DE73 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Inconclusive G.DE73 Observation":
  Elements."Inconclusive G.DE73 Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Inconclusive G.DE73 */

/*
@dataElement: HIV.H.DE35 - Already knew positive
@activity: HIV.B6 Capture or update client history
@description: The partner or contact of the index case already knew they are HIV-positive
*/

define "Already knew positive":
  exists(Elements."Already knew positive" O where O.issued during "Measurement Period")
/* End of Already knew positive */

/*
@dataElement: HIV.H.DE36 - Newly diagnosed
@activity: HIV.B6 Capture or update client history
@description: The partner or contact of the index case is newly diagnosed as HIV-positive
*/

define "Newly diagnosed":
  exists(Elements."Newly diagnosed" O where O.issued during "Measurement Period")
/* End of Newly diagnosed */

/*
@dataElement: HIV.H.DE37 - Negative
@activity: HIV.B6 Capture or update client history
@description: The partner or contact of the index case is newly diagnosed is HIV-negative
*/

define "Negative H.DE37":
  exists(Elements."Negative H.DE37" O where O.issued during "Measurement Period")
/* End of Negative H.DE37 */

/*
@dataElement: HIV.H.DE41 - HIV treatment outcome
@activity: HIV.H3 Record outreach and result
@description: The outcome for the client which is used for reporting retention/attrition.
*/

define "HIV treatment outcome":
  exists Elements."HIV treatment outcome" O
    where O.effective.toInterval() during "Measurement Period"
/* End of HIV treatment outcome */

/*
@dataElement: HIV.H.DE42 - Lost to follow-up
@activity: HIV.H3 Record outreach and result
@description: Twenty-eight days or more since last missed appointment 
*/
define "Lost to follow-up":
  Elements."On ART H.DE47" H
   where H.effective starts before end of "Measurement Period"
    and H.effective ends after start of "Measurement Period"
	and not (H.effective ends after (end of "Measurement Period" - Config."LTFU Days"))


define "Is lost to follow-up":
  exists("Lost to follow-up")

/* End of Lost to follow-up */

/*
@dataElement: HIV.H.DE43 - Transferred out
@activity: HIV.H3 Record outreach and result
@description: The client transferred to another facility
*/

define "Has transferred out":
  exists(Elements."Transferred out" t where t ends during "Measurement Period")
/* End of Transferred out */

/*
@dataElement: HIV.H.DE44 - Death documented
@activity: HIV.H3 Record outreach and result
@description: People living with HIV previously on ART who are confirmed to have died from any cause
*/
define "Has death documented":
  Elements."Death documented" before end of "Measurement Period"
/* End of Death documented */

/*
@dataElement: HIV.H.DE45 - Refused stopped treatment
@activity: HIV.H3 Record outreach and result
@description: Client was contacted and confirmed to have stopped ART (reasons may include stigma and discrimination, faith healing, etc.)
*/

define "Refused stopped treatment":
    exists(Elements."Refused stopped treatment" O where O.effective.toInterval() during "Measurement Period")
/* End of Refused stopped treatment */

/*
@dataElement: HIV.H.DE47 - On ART
@activity: HIV.H3 Record outreach and result
@description: Client is currently taking ART 
*/
define "On ART H.DE47":
  exists(Elements."On ART H.DE47" ART
   where ART.effective.toInterval() during "Measurement Period"
   )
/* End of On ART H.DE47 */

/*
@dataElement: HIV.H.DE73 - Date ART stopped
@activity: HIV.H3 Record outreach and result
@description: Date on which client stopped ART
*/
// TODO: Replace placeholder with relevant CQL logic
define "Date ART stopped H.DE73":
  Elements."Date ART stopped H.DE73" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Reason ART stopped H.DE74 Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Reason ART stopped H.DE74 */

/*
@dataElement: HIV.H.DE75 - Toxicity/side effects
@activity: HIV.H3 Record outreach and result
@description: Client stopped ART because of toxicity/side effects
*/

define "Toxicity/side effects H.DE75":
  exists([MedicationStatement] MS
    where MS.status in {'stopped'}
    and exists(MS.reasonCode C where C ~ Concepts."On ART - HIV.H.DE47")
    and exists(MS.statusReason R where R ~ Concepts."Toxicity/side effects - HIV.H.DE75")
    and start of MS.effective.toInterval() during "Measurement Period")
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
  Elements."Severe illness, hospitalization H.DE76 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Severe illness, hospitalization H.DE76 Observation":
  Elements."Severe illness, hospitalization H.DE76 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Excluded HIV infection in infant H.DE79 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Excluded HIV infection in infant H.DE79 Observation":
  Elements."Excluded HIV infection in infant H.DE79 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Other reason for stopping ART H.DE80 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "Other reason for stopping ART H.DE80 Observation":
  Elements."Other reason for stopping ART H.DE80 Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Other reason for stopping ART H.DE80 */

/*
@dataElement: HIV.PRV.DE1 - At elevated risk for HIV acquisition
@activity: HIV.B6 Capture or update client history
@description: Client is at elevated risk for HIV acquisition, defined according to country/programme context
*/
// TODO: Replace placeholder with relevant CQL logic
define "At elevated risk for HIV acquisition PRV.DE1":
  exists(Elements."At elevated risk for HIV acquisition PRV.DE1" O 
  where O.effective.toInterval() during "Measurement Period")
/* End of At elevated risk for HIV acquisition PRV.DE1 */

/*
@dataElement: HIV.PRV.DE2 - HIV prevention intervention
@activity: HIV.B6 Capture or update client history
@description: HIV prevention intervention that client accessed
*/

//(including PrEP, OAMT, NSP, STI services, VMMC) 
define "HIV prevention intervention":
  List<String>{
    if "PrEP service" then 'PrEP' else null,
    if "OAMT" then 'OAMT' else null,
    if "NSP" then 'NSP' else null,
    if "STI services" then 'STI services' else null,
    if "VMMC" then 'VMMC' else null,
    if "Other PRV.DE8" then 'other prevention' else null
  }

  define "HIV.PRV.DE2 - HIV prevention intervention":
    "PrEP service" or "OAMT" or "NSP" or "STI services" or "VMMC" or "Other PRV.DE8"


/* End of HIV prevention intervention */

/*
@dataElement: HIV.PRV.DE3 - PrEP service
@activity: HIV.B6 Capture or update client history
@description: Client accessed PrEP services
*/

define "PrEP service":
  exists(Elements."PrEP service" prep
   where prep.effective.toInterval() during "Measurement Period"
   )
/* End of PrEP service */

/*
@dataElement: HIV.PRV.DE4 - OAMT
@activity: HIV.B6 Capture or update client history
@description: Client accessed opioid agonist maintenance treatment (OAMT) services
*/

define "OAMT":
  exists(Elements."OAMT" t where t during "Measurement Period")
/* End of OAMT */

/*
@dataElement: HIV.PRV.DE5 - NSP
@activity: HIV.B6 Capture or update client history
@description: Client accessed needle-syringe programme (NSP) services
*/

define "NSP":
  false
  // TODO: doesn't compile DeviceUseStatement causes translation error
  //exists(Elements."NSP" DUS where DUS.timing.toInterval() during "Measurement Period")
/* End of NSP */

/*
@dataElement: HIV.PRV.DE6 - STI services
@activity: HIV.B6 Capture or update client history
@description: Client accessed sexually transmitted infection (STI) services
*/

define "STI services":
  exists(Elements."STI services" STI where STI.performed.toInterval() during "Measurement Period")
/* End of STI services */

/*
@dataElement: HIV.PRV.DE7 - VMMC
@activity: HIV.B6 Capture or update client history
@description: Client accessed voluntary medical male circumcision (VMMC) services
*/

define "VMMC":
  exists(Elements."VMMC" V where V.performed.toInterval() during "Measurement Period")
/* End of VMMC */

/*
@dataElement: HIV.PRV.DE8 - Other
@activity: HIV.B6 Capture or update client history
@description: Client accessed other HIV prevention services
*/

define "Other PRV.DE8":
  exists(Elements."Other PRV.DE8" O
    where O.effective.toInterval() during "Measurement Period")
/* End of Other PRV.DE8 */

/*
@dataElement: HIV.PRV.DE10 - Date accessed HIV prevention intervention
@activity: HIV.B6 Capture or update client history
@description: Date the client accessed HIV prevention intervention
*/

define "Date accessed HIV prevention intervention":
  Elements."Date accessed HIV prevention intervention" t where t included in "Measurement Period"
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
  Elements."HIV status of contact Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."HIV-positive PRV.DE12 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "HIV-positive PRV.DE12 Observation":
  Elements."HIV-positive PRV.DE12 Observation" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."HIV-negative PRV.DE13 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
define "HIV-negative PRV.DE13 Observation":
  Elements."HIV-negative PRV.DE13 Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of HIV-negative PRV.DE13 */

/*
@dataElement: HIV.PRV.DE14 - Unknown
@activity: HIV.B6 Capture or update client history
@description: Client does not know contact's HIV status
*/

/* End of Unknown PRV.DE14 */

/*
@dataElement: HIV.PRV.DE15 - Date injecting equipment provided
@activity: HIV.B21 Offer prevention options
@description: Date client was provided with injecting equipment
*/

define "Date injecting equipment provided":
  false
  // TODO: doesn't compile DeviceUseStatement causes translation error
  // exists(Elements."Date injecting equipment provided" DUS
  // where DUS.timing.toInterval() during "Measurement Period")
/* End of Date injecting equipment provided */

/*
@dataElement: HIV.PRV.DE17 - Date OAMT initiated
@activity: HIV.B21 Offer prevention options
@description: Date client initiated opioid agonist maintenance treatment (OAMT)
*/
// TODO: Replace placeholder with relevant CQL logic

/* End of Date OAMT initiated */

/*
@dataElement: HIV.PRV.DE20 - Currently on OAMT
@activity: HIV.B6 Capture or update client history
@description: Client is currently on opioid agonist maintenance treatment (OAMT) at reporting date, defined according to country/program to account for medication dispensed and LTFU criterion
*/
define "Currently on OAMT":
  exists(Elements."OAMT status" p
    where p.toInterval() overlaps "Measurement Period")
/* End of Currently on OAMT */

define "OAMT status":
  Elements."OAMT status" p
    where p.toInterval() overlaps "Measurement Period"
define "OAMT start":
  "OAMT status" p
  return start of p

define "OAMT end":
  "OAMT status" p
  return end of p
/*
@dataElement: HIV.PRV.DE21 - Retained on OAMT
@activity: HIV.B6 Capture or update client history
@description: Client is retained on opioid agonist maintenance treatment (OAMT) at reporting date, defined according to country/program to account for medication dispensed and LTFU criterion
*/
// TODO: Replace placeholder with relevant CQL logic
define "Retained on OAMT":
  exists "Retained on OAMT Observation"
define "Retained on OAMT Observation":
  Elements."Retained on OAMT Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Retained on OAMT */


/*
@dataElement: HIV.PRV.DE22 - Client being inducted on OAMT
@activity: HIV.B6 Capture or update client history
@description: Client is retained on opioid agonist maintenance treatment (OAMT) at reporting date, defined according to country/program to account for medication dispensed and LTFU criterion
*/

define "Client being inducted on OAMT":
exists (Elements."Client being inducted on OAMT" O
where O.effective.toInterval() during "Measurement Period")

/* End of Retained on OAMT */

/*
@dataElement: HIV.PRV.DE23 - Client on reducing doses of OAMT
@activity: HIV.B6 Capture or update client history
@description: Client is retained on opioid agonist maintenance treatment (OAMT) at reporting date, defined according to country/program to account for medication dispensed and LTFU criterion
*/

define "Client on reducing doses of OAMT":
exists(Elements."Client on reducing doses of OAMT" O
where O.effective.toInterval() during "Measurement Period")


/* End of Retained on OAMT */


/*
@dataElement: HIV.PRV.DE25 - Date of loss to follow-up or OAMT stopped
@activity: HIV.B6 Capture or update client history
@description: Date of loss to follow-up or opioid agonist maintenance treatment (OAMT) stopped
*/
// TODO: Replace placeholder with relevant CQL logic
define "Date of loss to follow-up or OAMT stopped":
  Elements."Date of loss to follow-up or OAMT stopped" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Date medications prescribed PRV.DE27" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Number of days prescribed PRV.DE28" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."HIV test date SRV.DE1" O
    where O.effective.toInterval() during "Measurement Period"
define "HIV test date SRV.DE1 Value":
  "HIV test date SRV.DE1" O
  return O.value as dateTime
/* End of HIV test date SRV.DE1 */

/*
@dataElement: HIV.SRV.DE2 - HIV test result
@activity: HIV.B7 Test for HIV using testing algorithm
@description: The result from HIV testing after applying the testing algorithm
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV test result SRV.DE2":
  Elements."HIV test result SRV.DE2" O
    where O.effective.toInterval() during "Measurement Period"
/* End of HIV test result SRV.DE2 */

/*
@dataElement: HIV.SRV.DE3 - Baseline CD4 count
@activity: HIV.D20 Diagnostics
@description: CD4 count performed at HIV diagnosis
*/

define "Baseline CD4 count SRV.DE3":
  Elements."Baseline CD4 count SRV.DE3" O
    where O.effective.toInterval() during "Measurement Period"
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
  exists(Elements."Date of baseline CD4 count test SRV.DE4" O where O starts during "Measurement Period")
/* End of Date of baseline CD4 count test SRV.DE4 */

/*
@dataElement: HIV.SRV.DE6 - ART start date
@activity: HIV.B8 Provide post-test counselling
@description: The date on which the client started or restarted antiretroviral therapy (ART)
*/
// TODO: Replace placeholder with relevant CQL logic
define "ART start date SRV.DE6":
  Elements."ART start date SRV.DE6" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Currently pregnant SRV.DE7 Condition" C
    where C.prevalenceInterval() overlaps "Measurement Period"
/* End of Currently pregnant SRV.DE7 */

/*
@dataElement: HIV.SRV.DE12 - Date of viral load sample collection
@activity: HIV.D10 Counsel returning client
@description: Date and time when the sample was collected to test the client's HIV viral load
*/
// TODO: Replace placeholder with relevant CQL logic
define "Date of viral load sample collection SRV.DE12":
  Elements."Date of viral load sample collection SRV.DE12" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Viral load test result SRV.DE13" O
    where O.effective.toInterval() during "Measurement Period"
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
  exists(Elements."Visit date SRV.DE15" E
    where start of E during "Measurement Period")
/* End of Visit date SRV.DE15 */

/*
@dataElement: HIV.SRV.DE18 - ANC contact date
@activity: HIV.E1 Capture or update mother's history
@description: The date and time of the client's ANC contact (in the ANC DAK this is called 'Contact date')
*/
// TODO: Replace placeholder with relevant CQL logic
define "ANC contact date SRV.DE18":
  Elements."ANC contact date SRV.DE18" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."HIV-exposed infant or child SRV.DE20 Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of HIV-exposed infant or child SRV.DE20 */

/*
@dataElement: HIV.SRV.DE22 - Final diagnosis of HIV-exposed infant
@activity: HIV.F20 Record infant's/child's final HIV diagnosis
@description: HIV-exposed infant final status at 18 months or 3 months after cessation of breastfeeding (whichever is later).
*/
// TODO: Replace placeholder with relevant CQL logic
define "Final diagnosis of HIV-exposed infant SRV.DE22":
  exists "Final diagnosis of HIV-exposed infant SRV.DE22 Observation"
define "Final diagnosis of HIV-exposed infant SRV.DE22 Observation":
  Elements."Final diagnosis of HIV-exposed infant SRV.DE22 Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Final diagnosis of HIV-exposed infant SRV.DE22 */

/*
@dataElement: HIV.Config.DE19 - Other priority populations
@activity: HIV.Configuration
@description: Other populations of priority of HIV prevention and care in local context (provided during adaptation)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Other priority populations":
  exists "Other priority populations Observation"
define "Other priority populations Observation":
  Elements."Other priority populations Observation" O
    where O.effective.toInterval() during "Measurement Period"
/* End of Other priority populations */

/*
@dataElement: HIV.Config.DE20 - Reporting period end date
@activity: HIV.Configuration
@description: End date of the reporting period
*/
// TODO: Replace placeholder with relevant CQL logic
define "Reporting period end date":
  Elements."Reporting period end date" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Reporting period start date" O
    where O.effective.toInterval() during "Measurement Period"
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
  Elements."Reporting date" O
    where O.effective.toInterval() during "Measurement Period"
define "Reporting date Value":
  "Reporting date" O
  return O.value as dateTime
/* End of Reporting date */


/*
 * Custom elements and logic for use DT and IND CQL Libraries
 */

 define "ANC within pregnancy":
  Elements."Antenatal care contact" E
  where E.period.toInterval() during First("Currently pregnant B.DE29").prevalenceInterval()

define "ANC within pregnancy dates":
  Elements."Antenatal care contact" E
  where E.period.toInterval() during First("Currently pregnant B.DE29").prevalenceInterval()
  return E.period.toInterval()

 define "ANC within pregnancy within measurement period":
  Elements."Antenatal care contact" E
  where E.period.toInterval() during First("Currently pregnant B.DE29").prevalenceInterval()
  and E.period.toInterval() during "Measurement Period"

define "all anc dates":
  flatten{"ANC within pregnancy dates"}

define "first anc date":
  First("ANC within pregnancy dates")