/*
Library: HIV.B9.DT Logic

@DecisionID: HIV.B9.DT.HIV Re-testing Recommendations
@BusinessRule: HIV restesting recommendations
@Trigger: HIV.B9 Determine recommended services
@HitPolicy: Rule order
@Description: Determine retest recommendation

Data Concepts:
 * HIV.B.DE115: HIV status | HIV status reported after applying the national HIV testing algorithm. No single HIV test can provide an HIV-positive diagnosis.
 * HIV.B.DE33: Partner HIV status (reported) | The HIV status of the client's partner.
 * HIV.C.DE55: Sex partner's HIV treatment status | Treatment adherence of client's sex partner for partners that are HIV-positive
 * HIV.Config.DE12: HIV burden of the setting | HIV burden of the setting (high or low) based on the national HIV prevalence or where the HIV prevalence and/or incidence in a geographical setting is higher than national prevalence and, therefore, needs priority in the HIV response
 * HIV.B.DE49: Key population member | Client is a member of a key population that has an increased risk of HIV
 * HIV.B.DE29: Currently pregnant | Client is currently pregnant
 * HIV.D.DE939: TB diagnosis result | Final result of the TB investigation (bacteriological and/or clinical)
 * HIV.D.DE282: Presumptive TB | Client's comorbidities or coinfections or symptoms of these include presumptive TB
 * HIV.C.DE10: Currently on PrEP | The client is currently taking PrEP. Oral pre-exposure prophylaxis (PrEP) of HIV is the use of ARV drugs by people who are not infected with HIV to block the acquisition of HIV.
 * HIV.B.DE225: At elevated risk for HIV acquisition | Client is at elevated risk for HIV acquisition
*/
library HIVB9DTLogic

// Included Libraries
using FHIR version '4.0.1'

include HIVCommon version '0.0.1' called Common
include HIVConcepts called Concepts
include HIVConfig called Config
include HIVEncounterElements called Elements
include FHIRHelpers version '4.0.1'

include WHOCommon called WCom
// Included for PlanDefinition
include WHOConcepts called WCx
include WHOEncounterElements called WElm

parameter Today Date default Today()

context Patient

 /*
  @input: "HIV status negative or unknown"
  @pseudocode: "HIV status" IN 'HIV-negative', 'Unknown'
  */
define "HIV status negative or unknown":
  exists(Elements."HIV Status Observation" S
    where S.value ~ Concepts."HIV-negative"
       or S.value ~ Concepts."Unknown") 

 /*
  @input: "Partner HIV reported positive"
  @pseudocode: "Partner HIV status (reported)"='HIV-positive'
  */
define "Partner HIV positive":
  exists(Elements."Partner HIV status reported Observation" O
    where O.value ~ Concepts."HIV-positive")

 /*
  @input: "Sex partner's HIV treatment status is partner not virally suppressed"
  @pseudocode: "Sex partner's HIV treatment status"='Partner is not virally suppressed'
  */
define "Sex partner's HIV treatment status is partner not virally suppressed":
  exists(Elements."Sex partners HIV treatment status" O
    where O.value ~ Concepts."Partner is not virally suppressed")

 /*
  @input: "HIV burden of setting is high HIV burden setting"
  @pseudocode: "HIV burden of the setting"='High HIV burden setting'
  */
define "HIV burden of setting is high HIV burden setting":
  Config."HIV burden of setting" ~ Concepts."High HIV burden setting"

 /*
  @input: "HIV burden of setting is low HIV burden setting"
  @pseudocode: "HIV burden of the setting"='Low HIV burden setting'
  */
define "HIV burden of setting is low HIV burden setting":
  Config."HIV burden of setting" ~ Concepts."Low HIV burden setting"

 /*
  @input: "Key population member"
  @pseudocode: "Key population member" = TRUE
  */
define "Key population member":
  Elements."Is Key population member B.DE49"

 /*
  @input: "Currently pregnant"
  @pseudocode: "Currently pregnant"=True
  */
define "Currently pregnant":
  exists(WElm."Pregnant Observation")

 /*
  @input: "TB diagnosis result is diagnosed TB"
  @pseudocode: "Currently pregnant"=True
  */
define "TB diagnosis result is diagnosed TB":
  exists(Elements."TB diagnosis result Observation" O
    where O.value ~ Concepts."Diagnosed TB")

 /*
  @input: "Presumptive TB"
  @pseudocode: "Presumptive TB"=True
  */
define "Presumptive TB":
  exists(Elements."Presumptive TB D.DE282 Observation" O
    where O.value is true)

/*
  @input: "Currently on PrEP"
  @pseudocode: "Currently on PrEP"=True
  */
define "Currently on PrEP":
  exists(Elements."Currently on PrEP Observation" O
    where O.value is true)

 /*
  @input: "At elevated risk for HIV acquisition"
  @pseudocode: "At elevated risk for HIV acquisition"=True
  */
define "At elevated risk for HIV acquisition":
  exists(Elements."At elevated risk for HIV acquisition PRV.DE1 Observation" O
    where O.value is true)

 /*
  @output: "Schedule an annual follow-up test"
  @pseudocode: "Follow-up test recommended date" = "Visit date" + 1 year
  */
define "Schedule an annual follow-up test":
  "HIV status negative or unknown" and
    case
    when "Partner has HIV and is not virally suppressed"
      then true
    when "HIV burden of setting is high HIV burden setting"
      then true
    when "Key population member"
      then true
    when "At elevated risk for HIV acquisition"
      then true
    else false
    end

/*
 @output: "Follow-up test recommended"
 @pseudocode: N/A
 */
define "Follow-up test recommended":
  "HIV status negative or unknown" and
  case
  when "TB diagnosis result is diagnosed TB"
    then true
  when "Presumptive TB"
    then true
  else false
  end

/*
 @output: "Schedule quarterly retesting for PrEP users"
 @pseudocode: N/A
 */
define "Schedule quarterly retesting for PrEP users":
  "HIV status negative or unknown" and "Currently on PrEP"

/*
 @output: "Schedule an HIV test, syphilis test, hepatitis B test as early as possible during this pregnancy"
 @pseudocode: N/A
 */
define "Schedule an HIV test, syphilis test, hepatitis B test as early as possible during this pregnancy":
  "Pregnant in high HIV burden setting"

/*
 @output: "Schedule a 'Follow-up test recommended date during a third trimester visit"
 @pseudocode: N/A
 */
define "Schedule a 'Follow-up test recommended date' during a third trimester visit":
  "Pregnant in high HIV burden setting"

/*
 @output: "Schedule a 'Follow-up test recommended date during a third trimester visit"
 @pseudocode: N/A
 */
define "Schedule a 'Follow-up test recommended date' at first ANC contact date":
  "Pregnant in low HIV burden setting" and 
  case
  when "Key population member"
    then true
  when "Partner has HIV and is not virally suppressed"
    then true
  when "At elevated risk for HIV acquisition"
    then true
  else false
  end

/*
 @dynamicValue: Guidance
 */
define "Guidance":
  Combine({
    if "Schedule an annual follow-up test"
      then 'Schedule an annual follow-up test.  

  WHO guidance recommends annual retesting for people who have ongoing HIV-related risks in all settings. These include people with a known HIV-positive partner who is not virally suppressed on ART.'
      else '',
    if "Follow-up test recommended"
      then 'Recommend a follow-up test.  

  In certain conditions and situations, individuals who have been tested for HIV in the past can be advised to retest. These include: 
  * Individuals presenting with a diagnosis or receiving treatment for STIs or viral hepatitis, 
  * Individuals with a confirmed or presumptive TB diagnosis, 
  * Outpatients presenting with clinical conditions or symptoms indicative of HIV, individuals with recent HIV risk exposure.'
      else '',
    if "Schedule quarterly retesting for PrEP users"
      then 'Schedule quarterly retesting for PrEP users.'
      else '',
    if "Schedule an HIV test, syphilis test, hepatitis B test as early as possible during this pregnancy"
      then 'Schedule an HIV test, syphilis test, hepatitis B test as early as possible during this pregnancy

  All pregnant women should be tested for HIV as well as syphilis and hepatitis B virus at least once and as early as possible during pregnancy.'
      else '',
    if "Schedule a 'Follow-up test recommended date' at first ANC contact date"
      then 'In low HIV burden settings, retesting all pregnant women is not warranted unless focused among women from key populations or at high ongoing risk, such as those from key populations or with partners with HIV who are not virally suppressed. Countries could consider one additional retest in the post-partum period, such as at 14 weeks, six months or nine months for women in high HIV burden or incidence districts or provinces, key populations or women with partners with HIV who are not virally suppressed.'
      else ''
  })

/*
 @dynamicValue: "Date to schedule"
 */
define "Schedule Follow-up Date":
  case
  when "Schedule an annual follow-up test"
    then Today + 1 years
  when "Schedule quarterly retesting for PrEP users"
    then Today + 3 months
  else null
  end

// Helper Logic
define "Pregnant in high HIV burden setting":
  "HIV status negative or unknown" and
  "HIV burden of setting is high HIV burden setting" and
  "Currently pregnant"

define "Pregnant in low HIV burden setting":
  "HIV status negative or unknown" and
  "HIV burden of setting is low HIV burden setting" and
  "Currently pregnant"

define "Partner has HIV and is not virally suppressed":
  "Partner HIV positive" and "Sex partner's HIV treatment status is partner not virally suppressed"

