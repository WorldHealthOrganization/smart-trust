/**
Library: HIV.C7.DT Logic

@DecisionID: HIV.C7.DT
@BusinessRule: Check suitability for PrEP or PEP
@Trigger: HIV.C7 Check suitability for PrEP or PEP
@HitPolicy: Rule Order
@Description: Check suitability for PrEP or PEP

Data Concepts:
 * HIV.B.DE49: Key population member | Client is a member of a key population that has an increased risk of HIV
 * HIV.B.DE115: HIV status | HIV status reported after applying the national HIV testing algorithm. No single HIV test can provide an HIV-positive diagnosis.
 * HIV.C.DE31: PEP history | The client's history in taking post-exposure prophylaxis (PEP) for HIV prevention
 * HIV.C.DE36: Signs of substantial risk of HIV infection | Signs the client is at a substantial risk of HIV infection
 * HIV.C.DE55: Sex partners HIV treatment status | Treatment adherence of client's sex partner for partners that are HIV-positive
 * HIV.C.DE106: Estimated creatinine clearance | Estimated creatinine clearance of the client returned from lab in mL/min
 * HIV.C.DE112: Contraindications to PrEP usage | Listing of contraindications to pre-exposure prophylaxis (PrEP)
 * HIV.C.DE117: Probable recent exposure to HIV | When the client is reported to have had probable recent exposure to HIV
 * HIV.Config.DE12: HIV burden of the setting | HIV burden of the setting (high or low) based on the national HIV prevalence or where the HIV prevalence and/or incidence in a geographical setting is higher than national prevalence and, therefore, needs priority in the HIV response
 * HIV.H.DE34: HIV status of partner or contact | HIV status of the partner or contact given by the index case

Consolidated guidelines on HIV prevention, testing, treatment, service delivery and monitoring: recommendations for a public health approach (2021) Chapter 5: Advanced HIV Disease. Figure 5.1: Algorithm for providing a package of care for people with advanced HIV disease.
*/

library HIVC7DTLogic
 
using FHIR version '4.0.1'

include HIVCommon version '0.0.1' called HIC
include HIVConcepts called Concepts
include HIVConfig called Config
include HIVEncounterElements called Elements
include FHIRHelpers version '4.0.1'

include WHOCommon called WCom

/*
 @input "HIV Status"
 @pseudocode: "HIV status"='HIV-negative'
 */
define "HIV negative":
  exists(
    Elements."HIV Status Observation" O
        where O.value ~ Concepts."HIV-negative"
  )

/*
 @input "HIV Status"
 @pseudocode: "HIV status"='HIV-negative'
 */
define "HIV negative or unknown":
  exists(
    Elements."HIV Status Observation" O
        where O.value ~ Concepts."HIV-negative" or
          O.value ~ Concepts."Unknown"
  )


/*
 @input "Estimated creatinine clearance"
 @pseudocode: "Estimated creatinine clearance" ≥ 60 mL/min
 */
define "Estimated creatinine clearance ≥ 60 mL/min":
  exists(
    Elements."Estimated creatinine clearance" O
      where FHIRHelpers.ToInteger(O.value) >= 60
  )

/*
 @input "Estimated creatinine clearance"
 @pseudocode: "Estimated creatinine clearance" < 60 mL/min
 */
define "Estimated creatinine clearance < 60 mL/min":
  exists(
    Elements."Estimated creatinine clearance" O
      where FHIRHelpers.ToInteger(O.value) < 60
  )

/*
 @input "Acute HIV infection symptoms"
 @pseudocode: "Acute HIV infection symptoms"=False
 */
define "No symptoms of Acute HIV infection":
  not(exists(
    Elements."Contraindications to PrEP usage" O
      where O.value ~ Concepts."Acute HIV infection symptoms - HIV.C.DE116"
  ))

/*
 @input "Acute HIV infection symptoms"
 @pseudocode: "Acute HIV infection symptoms"=True
 */
define "Symptoms of Acute HIV infection":
  exists(
    Elements."Contraindications to PrEP usage" O
      where O.value ~ Concepts."Acute HIV infection symptoms - HIV.C.DE116"
  )

/*
 @input: "Probable recent exposure to HIV"
 @pseudocode: "Probable recent exposure to HIV"=False
 */
define "No probable recent exposure to HIV":
  not(exists(
    Elements."Contraindications to PrEP usage" O
      where O.value ~ Concepts."Probable recent exposure to HIV"
  ))

/*
 @input: "Probable recent exposure to HIV"
 @pseudocode: "Probable recent exposure to HIV"=True
 */
define "Probable recent exposure to HIV":
  exists(
    Elements."Contraindications to PrEP usage" O
      where O.value ~ Concepts."Probable recent exposure to HIV"
  )

/*
 @input: "Contraindications to PrEP usage"
 @pseudocode: "Contraindications to PrEP usage" is NULL
 */
define "No contraindications to PrEP usage":
  not(exists(
    Elements."Contraindications to PrEP usage" O
  ))

/*
 @input: "Contraindications to PrEP usage"
 @pseudocode: "Contraindications to PrEP usage" is NOT NULL
 */
define "Contraindications to PrEP usage":
  exists(
    Elements."Contraindications to PrEP usage" O
  )

/*
 @input: "Contraindications to PrEP usage"
 @pseudocode: "Contraindications to PrEP usage"='Tenofovir disoproxil fumarate (TDF)'
 */
define "TDF allergy or contraindication":
  exists(
    Elements."Contraindications to PrEP usage" O
      where O.value ~ Concepts."Tenofovir disoproxil fumarate TDF allergy or contraindication"
  )

/*
 @input: "HIV status of partner or contact"
 @pseudocode: "HIV status of partner or contact"='HIV-positive'
 */
define "HIV status of partner or contact is positive":
  exists(
    Elements."HIV status of partner or contact" O
      where O.value ~ Concepts."HIV-positive"
  )

/*
 @input: "Sex partner's HIV treatment status"
 @pseudocode: "Sex partner's HIV treatment status"='Partner is not virally suppressed'
 */
define "Sex partner is on HIV treatment and not virally suppressed":
  exists(
    Elements."Sex partners HIV treatment status" O
      where O.value ~ Concepts."Partner is not virally suppressed"
  )

/*
 @input: "Key population member"
 @pseudocode: "Key population member"=True
 */
define "Is Key population member":
  Elements."Is Key population member B.DE49"

 /*
  @input: "Signs of substantial risk of HIV infection"
  @pseudocode: "HIV burden of the setting"='High HIV burden setting'
  */
define "HIV burden of setting is high HIV burden setting":
  Config."HIV burden of setting" ~ Concepts."High HIV burden setting"

/*
 @input: "Signs of substantial risk of HIV infection"
 @pseudocode: "Signs of substantial risk of HIV infection"='PrEP requested by client'
 */
define "PrEP requested by client":
  exists(
    Elements."Signs of substantial risk of HIV infection C.DE36" O
      where O.value ~ Concepts."PrEP requested by client - HIV.C.DE40"
  )

/*
 @input: "Signs of substantial risk of HIV infection"
 @pseudocode: "Signs of substantial risk of HIV infection"='A sexual partner in the past 6 months had one or more HIV risk factors'
 */
define "A sexual partner in the past 6 months had one or more HIV risk factors":
  exists(
    Elements."Signs of substantial risk of HIV infection C.DE36" O
      where O.value ~ Concepts."A sexual partner in the past 6 months had one or more HIV risk factors - HIV.C.DE39"
  )

/*
 @input: "Signs of substantial risk of HIV infection"
 @pseudocode: "Signs of substantial risk of HIV infection"='STI in the past 6 months'
 */
define "STI in the past 6 months":
  exists(
    Elements."Signs of substantial risk of HIV infection C.DE36" O
      where O.value ~ Concepts."STI in the past 6 months - HIV.C.DE38"
  )

/*
 @input: "Signs of substantial risk of HIV infection"
 @pseudocode: "Signs of substantial risk of HIV infection"='No condom use during sex with more than one partner in the past 6 months'
 */
define "No condom use during sex with more than one partner in the past 6 months":
  exists(
    Elements."Signs of substantial risk of HIV infection C.DE36" O
      where O.value ~ Concepts."No condom use during sex with more than one partner in the past 6 months - HIV.C.DE37"
  )

/*
 @input: "PEP history"
 @pseudocode: "PEP history"='Repeat user'
 */
define "Repeat PEP user":
  exists(
    Elements."PEP history" O
      where O.value ~ Concepts."Repeat user"
  )

/*
 @output "Suitable for PrEP"
 */
define "Suitable for PrEP":
  case
    when "HIV negative" and 
         "Estimated creatinine clearance ≥ 60 mL/min" and
         "No symptoms of Acute HIV infection" and
         "No probable recent exposure to HIV" and
         "No contraindications to PrEP usage" and
         "PrEP requested by client"
      then true
    when "HIV negative" and 
         "Estimated creatinine clearance ≥ 60 mL/min" and
         "No symptoms of Acute HIV infection" and
         "No probable recent exposure to HIV" and
         "No contraindications to PrEP usage" and
         "HIV status of partner or contact is positive" and
         "Sex partner is on HIV treatment and not virally suppressed"
      then true
    when "HIV negative" and 
         "Estimated creatinine clearance ≥ 60 mL/min" and
         "No symptoms of Acute HIV infection" and
         "No probable recent exposure to HIV" and
         "No contraindications to PrEP usage" and
         "Is Key population member" and
         "PrEP requested by client"
      then true
    when "HIV negative" and 
         "Estimated creatinine clearance ≥ 60 mL/min" and
         "No symptoms of Acute HIV infection" and
         "No probable recent exposure to HIV" and
         "No contraindications to PrEP usage" and
         "Is Key population member" and
         "A sexual partner in the past 6 months had one or more HIV risk factors"
      then true
    when "HIV negative" and 
         "Estimated creatinine clearance ≥ 60 mL/min" and
         "No symptoms of Acute HIV infection" and
         "No probable recent exposure to HIV" and
         "No contraindications to PrEP usage" and
         "Is Key population member" and
         "STI in the past 6 months"
      then true
    when "HIV negative" and 
         "Estimated creatinine clearance ≥ 60 mL/min" and
         "No symptoms of Acute HIV infection" and
         "No probable recent exposure to HIV" and
         "No contraindications to PrEP usage" and
         "Is Key population member" and
         "Repeat PEP user"
      then true
    when "HIV negative" and 
         "Estimated creatinine clearance ≥ 60 mL/min" and
         "No symptoms of Acute HIV infection" and
         "No probable recent exposure to HIV" and
         "No contraindications to PrEP usage" and
         "Is Key population member" and
         "No condom use during sex with more than one partner in the past 6 months"
      then true
    when "HIV negative" and 
         "Estimated creatinine clearance ≥ 60 mL/min" and
         "No symptoms of Acute HIV infection" and
         "No probable recent exposure to HIV" and
         "No contraindications to PrEP usage" and
         "HIV burden of setting is high HIV burden setting" and
         "PrEP requested by client"
      then true
    when "HIV negative" and 
         "Estimated creatinine clearance ≥ 60 mL/min" and
         "No symptoms of Acute HIV infection" and
         "No probable recent exposure to HIV" and
         "No contraindications to PrEP usage" and
         "HIV burden of setting is high HIV burden setting" and
         "A sexual partner in the past 6 months had one or more HIV risk factors"
      then true
    when "HIV negative" and 
         "Estimated creatinine clearance ≥ 60 mL/min" and
         "No symptoms of Acute HIV infection" and
         "No probable recent exposure to HIV" and
         "No contraindications to PrEP usage" and
         "HIV burden of setting is high HIV burden setting" and
         "STI in the past 6 months"
      then true
    when "HIV negative" and 
         "Estimated creatinine clearance ≥ 60 mL/min" and
         "No symptoms of Acute HIV infection" and
         "No probable recent exposure to HIV" and
         "No contraindications to PrEP usage" and
         "HIV burden of setting is high HIV burden setting" and
         "Repeat PEP user"
      then true
    when "HIV negative" and 
         "Estimated creatinine clearance ≥ 60 mL/min" and
         "No symptoms of Acute HIV infection" and
         "No probable recent exposure to HIV" and
         "No contraindications to PrEP usage" and
         "HIV burden of setting is high HIV burden setting" and
         "No condom use during sex with more than one partner in the past 6 months"
      then true
    when "HIV negative or unknown" and
         "Symptoms of Acute HIV infection"
      then false
    when "HIV negative or unknown" and
         "Probable recent exposure to HIV"
      then false
    when "HIV negative" and
         "TDF allergy or contraindication"
      then false
    when "HIV negative" and
         "Contraindications to PrEP usage"
      then false
    when "HIV negative" and
         "Estimated creatinine clearance < 60 mL/min"
      then false
    else null
  end

define "Not suitable for PrEP":
  not(IsNull("Suitable for PrEP")) and not("Suitable for PrEP")

/*
 @dynamicValue: Guidance
 */
define "Guidance":
  case
    when "HIV negative" and 
         "Estimated creatinine clearance ≥ 60 mL/min" and
         "No symptoms of Acute HIV infection" and
         "No probable recent exposure to HIV" and
         "No contraindications to PrEP usage" and
         "PrEP requested by client"
      then 'Counsel client on PrEP. Based on answers given, client is suitable for PrEP.'
    when "HIV negative" and 
         "Estimated creatinine clearance ≥ 60 mL/min" and
         "No symptoms of Acute HIV infection" and
         "No probable recent exposure to HIV" and
         "No contraindications to PrEP usage" and
         "HIV status of partner or contact is positive" and
         "Sex partner is on HIV treatment and not virally suppressed"
      then 'Counsel client on PrEP. Based on answers given, client is suitable for PrEP.

PrEP can protect the HIV-negative partner in a serodiscordant relationship when the HIV-positive partner is either not on antiretroviral therapy (ART) or has not yet achieved viral suppression.'
    when "HIV negative" and 
         "Estimated creatinine clearance ≥ 60 mL/min" and
         "No symptoms of Acute HIV infection" and
         "No probable recent exposure to HIV" and
         "No contraindications to PrEP usage" and
         "Is Key population member" and
         "PrEP requested by client"
      then 'Counsel client on PrEP. Based on answers given, client is suitable for PrEP.'
    when "HIV negative" and 
         "Estimated creatinine clearance ≥ 60 mL/min" and
         "No symptoms of Acute HIV infection" and
         "No probable recent exposure to HIV" and
         "No contraindications to PrEP usage" and
         "Is Key population member" and
         "A sexual partner in the past 6 months had one or more HIV risk factors"
      then 'Counsel client on PrEP. Based on answers given, client is suitable for PrEP.

PrEP services provide a unique opportunity to screen for hepatitis B and hepatitis C infection and thus address multiple public health issues. Hepatitis B is endemic in some parts of the world where there is also a high burden of HIV. Testing oral PrEP users for hepatitis B surface antigen (HBsAg) once, at PrEP initiation, is preferred and has several advantages in these settings. Rapid point-of-care tests are available for HBsAg, and WHO has prequalified several rapid diagnostic tests.'
    when "HIV negative" and 
         "Estimated creatinine clearance ≥ 60 mL/min" and
         "No symptoms of Acute HIV infection" and
         "No probable recent exposure to HIV" and
         "No contraindications to PrEP usage" and
         "Is Key population member" and
         "STI in the past 6 months"
      then 'Counsel client on PrEP. Based on answers given, client is suitable for PrEP.

Recently diagnosed STIs are often indicators of risk of sexual acquisition of HIV. The predictive value of STI indicators varies by region, the type of STI and a person\'s demographic characteristics. A new diagnosis of syphilis or genital herpes is a strong predictor of HIV risk among men who have sex with men in most settings and among heterosexual men and women in areas of high HIV prevalence. PrEP services should be prioritized; local epidemiology will be essential to guide decisions about when to offer PrEP and to which populations.'
    when "HIV negative" and 
         "Estimated creatinine clearance ≥ 60 mL/min" and
         "No symptoms of Acute HIV infection" and
         "No probable recent exposure to HIV" and
         "No contraindications to PrEP usage" and
         "Is Key population member" and
         "Repeat PEP user"
      then 'Counsel client on PrEP. Based on answers given, client is suitable for PrEP.

People may be subject to ongoing high risk of exposure to HIV, leading to multiple prescriptions for PEP. In such situations, health-care providers should discuss with their clients the potential benefits of transitioning to HIV PrEP.'
    when "HIV negative" and 
         "Estimated creatinine clearance ≥ 60 mL/min" and
         "No symptoms of Acute HIV infection" and
         "No probable recent exposure to HIV" and
         "No contraindications to PrEP usage" and
         "Is Key population member" and
         "No condom use during sex with more than one partner in the past 6 months"
      then 'Counsel client on PrEP.  Based on answers given, PrEP is suitable for client.

Inconsistent use of condoms (male or female), including an intention to use condoms during sex with some occasional omissions or accidents, increases HIV risk. Social desirability bias in reporting condom use may occur, so PrEP could be considered for people reporting any intercourse without a condom or concerns about their future use of condoms. For example, someone who reports a desire to stop using condoms may be already having sex without condoms.'
    when "HIV negative" and 
         "Estimated creatinine clearance ≥ 60 mL/min" and
         "No symptoms of Acute HIV infection" and
         "No probable recent exposure to HIV" and
         "No contraindications to PrEP usage" and
         "HIV burden of setting is high HIV burden setting" and
         "PrEP requested by client"
      then 'Counsel client on PrEP. Based on answers given, client is suitable for PrEP.'
    when "HIV negative" and 
         "Estimated creatinine clearance ≥ 60 mL/min" and
         "No symptoms of Acute HIV infection" and
         "No probable recent exposure to HIV" and
         "No contraindications to PrEP usage" and
         "HIV burden of setting is high HIV burden setting" and
         "A sexual partner in the past 6 months had one or more HIV risk factors"
      then 'Counsel client on PrEP. Based on answers given, client is suitable for PrEP.'
    when "HIV negative" and 
         "Estimated creatinine clearance ≥ 60 mL/min" and
         "No symptoms of Acute HIV infection" and
         "No probable recent exposure to HIV" and
         "No contraindications to PrEP usage" and
         "HIV burden of setting is high HIV burden setting" and
         "STI in the past 6 months"
      then 'Counsel client on PrEP. Based on answers given, PrEP is suitable for client.

Recently diagnosed STIs are often indicators of risk of sexual acquisition of HIV. The predictive value of STI indicators varies by region, the type of STI and a person\'s demographic characteristics. A new diagnosis of syphilis or genital herpes is a strong predictor of HIV risk among men who have sex with men in most settings and among heterosexual men and women in areas of high HIV prevalence. PrEP services should be prioritized; local epidemiology will be essential to guide decisions about when to offer PrEP and to which populations.'
    when "HIV negative" and 
         "Estimated creatinine clearance ≥ 60 mL/min" and
         "No symptoms of Acute HIV infection" and
         "No probable recent exposure to HIV" and
         "No contraindications to PrEP usage" and
         "HIV burden of setting is high HIV burden setting" and
         "Repeat PEP user"
      then 'Counsel client on PrEP. Based on answers given, client is suitable for PrEP.'
    when "HIV negative" and 
         "Estimated creatinine clearance ≥ 60 mL/min" and
         "No symptoms of Acute HIV infection" and
         "No probable recent exposure to HIV" and
         "No contraindications to PrEP usage" and
         "HIV burden of setting is high HIV burden setting" and
         "No condom use during sex with more than one partner in the past 6 months"
      then 'Counsel client on PrEP. Based on answers given, client is suitable for PrEP.'
    when "HIV negative or unknown" and
         "Symptoms of Acute HIV infection"
      then 'Client is ineligible for PrEP based on answers given.'
    when "HIV negative or unknown" and
         "Probable recent exposure to HIV"
      then 'Client is ineligible for PrEP based on answers given.  Counsel client on risk and prevention.  

If the person has had a recent high-risk HIV exposure (such as within the past 72 hours) they can be offered PEP and transition to PrEP after the completion of PEP and following additional HIV testing.

The following types of exposure may warrant HIV PEP.
• Body fluids: blood, blood-stained saliva, breast-milk, genital secretions; cerebrospinal, amniotic, peritoneal, synovial, pericardial or pleural fluids. Although these fluids carry a high risk of HIV infection, this list is not exhaustive. All cases should be assessed clinically, and the health care workers should decide whether the actual exposure constitutes a significant risk.
• Types of exposure: (1) mucous membrane from sexual exposure; splashes to the eye, nose, or oral cavity and (2) parenteral exposures.
Exposure that does not require HIV PEP includes:
• when the exposed individual is already HIV positive;
• when the source is established to be HIV negative; and
• exposure to bodily fluids that do not pose a significant risk: tears, non-blood-stained saliva, urine and sweat.

People may be subject to ongoing high risk of exposure to HIV, leading to multiple prescriptions for PEP. In such situations, health-care providers should discuss with their clients the potential benefits of transitioning to HIV PrEP.'
    when "HIV negative" and
         "TDF allergy or contraindication"
      then 'Client is ineligible for PrEP based on answers given. Counsel client on risk and prevention.'
    when "HIV negative" and
         "Contraindications to PrEP usage"
      then 'Client is ineligible for PrEP based on answers given. Counsel client on risk and prevention.'
    when "HIV negative" and
         "Estimated creatinine clearance < 60 mL/min"
      then 'Client is ineligible for PrEP based on answers given.  Counsel client on risk and prevention.

Measurement of kidney function will depend on age and comorbidities.  See Table 2. of source: Suggested procedures for measuring kidney function for TDF-containing oral PrEP

Measuring kidney function is optional for those aged under 30 years without kidney-related comorbidities.

Individuals aged 30 years and older without comorbidities may be screened once, at or within one to three months of oral PrEP initiation. Depending on available resources, this can be considered optional for those aged 30–49 years, particularly those aged 30–39, given the low risk of kidney impairment.

More frequent screening (every 6–12 months) is suggested for individuals with comorbidities, those aged 50 years and older, and those with a previous kidney function test result suggesting at least a mild reduction in function (eGFR <90 mL/min per 1.73 m^2).

Waiting for kidney function test results should not delay initiation or continuation of oral PrEP.'
    else null
  end
