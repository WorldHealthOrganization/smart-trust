/**
Library: HIV.D12.DT Logic

@DecisionID: HIV.D12.DT
@BusinessRule: Determine recommended screenings and tests
@Trigger: HIV.D12.Determine recommended screenings and tests
@HitPolicy: Rule Order
@Description: Determine recommended screenings and tests

Data Concepts:


Consolidated guidelines on HIV prevention, testing, treatment, service delivery and monitoring: recommendations for a public health approach (2021).
*/

library HIVD12DTLogic
 
using FHIR version '4.0.1'

include HIVCommon version '0.0.1' called HIC
include HIVConcepts called Concepts
include HIVEncounterElements called Elements
include FHIRHelpers version '4.0.1'

include WHOCommon called WCom

context Patient

/*
 @input: "Reason for Visit"
 @pseudocode: "Reason for visit"='HIV testing services visit'
 */
define "HIV testing services visit":
  exists(
    Elements."Reason for visit D.DE1" O
      where O.value ~ Concepts."HIV testing services visit"
  )

/*
 @input: "Reason for Visit"
 @pseudocode: "Reason for visit"='ART initiation'
 */
define "ART initiation visit":
  exists(
    Elements."Reason for visit D.DE1" O
      where O.value ~ Concepts."ART initiation"
  )

/*
 @input: "Reason for Visit"
 @pseudocode: "Reason for visit"='Clinical visit
 */
define "Clinical visit":
  exists(
    Elements."Reason for visit D.DE1" O
      where O.value ~ Concepts."Clinical visit - HIV.D.DE3"
  )

/*
 @input: "Age"
 @pseudocode: "Age" ≥ 20 years
 */
define "Age 20 or older":
  Elements."Current Patient Age In Years" >= 20

/*
 @input: "Age"
 @pseudocode: ""Age"<20 years
 */
define "Age under 20":
  Elements."Current Patient Age In Years" < 20

 /*
  @input: "Age"
  @pseudocode: 'Age' ≥ 10 years
  */
define "Age 10 or older":
  Elements."Current Patient Age In Years" >= 10

/*
 @input: "HIV test result"
 @pseudocode: "HIV test result"='HIV-positive'
 */
define "HIV Positive test result":
  exists(
    Elements."HIV test result" O
      where O.value ~ Concepts."HIV-positive"
  )

/*
 @input: "On ART"
 @pseudocode: "On ART"=False
 */
define "Not on ART":
  not(exists(
    Elements."On ART D.DE38"
  ))

/*
 @input: "On ART"
 @pseudocode: "On ART"=True
 */
define "On ART":
  exists(
    Elements."On ART D.DE38"
  )

/*
 @input: "Gender"
 @pseudocode: "Gender"='Female'
 */
define "Client is female":
  Elements."Female"

/*
 @input: "CD4 count"
 @pseudocode: "CD4 count" ≤ 100 cells/mm3
 */
define "CD4 less than or equal to 100 cells/mm3":
  exists(
    Elements."CD4 count D.DE364" O
      where O.value <= 100
  )

/*
 @input: "CD4 count"
 @pseudocode: "CD4 count" ≤ 200 cells/mm3
 */
define "CD4 less than or equal to 200 cells/mm3":
  exists(
    Elements."CD4 count D.DE364" O
      where O.value <= 200
  )

/*
 @input: "Current medications"
 @pseudocode: "Current medications"='AZT'
 */
define "On AZT":
  exists(
    Elements."On ART D.DE38" MS
      where MS.medication ~ Concepts."AZT"
  )

/*
 @input: "Current medications"
 @pseudocode: "Current medications"='TDF'
 */
define "On TDF":
  exists(
    Elements."On ART D.DE38" MS
      where MS.medication ~ Concepts."TDF - HIV.D.DE135"
  )

/*
 @input: "Suspicion of treatment failure or interruption"
 @pseudocode: "Suspicion of treatment failure or interruption"=True
 */
define "Suspicion of treatment failure or interruption":
  exists(
    Elements."Suspicion of treatment failure or interruption Observation" O
      where O.value = true
  )


/*
 @dynamicValue: Guidance
 */
define "Guidance":
  Combine({
    if "HIV testing services visit" and "Age 20 or older" and "HIV Positive test result" and "Not on ART"
      then 'Recommended actions:
CD4 cell count
TB symptom screening

Desirable actions:
HBV (HBsAg) serology
HCV serology
Screen for sexually transmitted infections   
Assess for major noncommunicable chronic diseases and comorbidities

General care activities recommended: 
Determine WHO clinical stage based on past and current HIV-related conditions
Prepare for ART
Prepare, assess and support adherence
Provide family planning and contraception
Support disclosure and partner notification
Counsel on risk reduction and combination HIV prevention approaches
Assess, prevent and manage noncommunicable diseases
Screen for and manage mental health problems
Screen for and manage and substance use issues
Provide psychosocial counselling and support
Manage pain and symptoms
Conduct a nutritional assessment and counsel on nutrition

Preventing and treating coinfections: 
Provide co-trimoxazole preventive therapy
Conduct intensified TB case-finding
Provide isoniazid preventive therapy
Screen for cryptococcal infection and fungal prophylaxis
Prevent malaria (insecticide- treated  bed-nets and prophylaxis)
Screen for sexually transmitted infections
Assess for vaccine-preventable diseases'
    else '',
    if "HIV testing services visit" and "Age under 20" and "HIV Positive test result" and "Not on ART"
      then 'Recommended:
CD4 cell count
TB symptom screening

Desirable: 
HBV (HBsAg) serology
HCV serology
Screen for sexually transmitted infections   
Assess for major noncommunicable chronic diseases and comorbidities

General care activities recommended:
 Determine WHO clinical stage based on past and current HIV-related conditions
Prepare for ART
Prepare, assess and support adherence
Provide family planning and contraception
Support disclosure and partner notification
Counsel on risk reduction and combination HIV prevention approaches
Assess, prevent and manage noncommunicable diseases
Screen for and manage mental health problems
Screen for and manage and substance use issues
Provide psychosocial counselling and support
Manage pain and symptoms
Conduct a nutritional, growth and development assessment

Preventing and treating coinfections: 
Provide co-trimoxazole preventive therapy
Conduct intensified TB case-finding
Provide isoniazid preventive therapy
Screen for cryptococcal infection and fungal prophylaxis
Prevent malaria (insecticide- treated  bed-nets and prophylaxis)
Screen for sexually transmitted infections
Assess for vaccine-preventable diseases'
    else '',
    if "HIV testing services visit" and "HIV Positive test result" and "Not on ART" and "CD4 less than or equal to 100 cells/mm3"
      then 'Desirable actions:
Cryptococcus antigen test'
    else '',
    if "HIV testing services visit" and "HIV Positive test result" and "Not on ART" and "Client is female"
      then 'Desirable actions: 
Pregnancy test'
    else '',
    if "ART initiation visit" and "Not on ART"
      then 'Recommended: 
Baseline CD4 cell count for identifying advanced HIV disease
Age-appropriate TB symptom screening

Desirable: 
Blood pressure measurement 

General care activities recommended:
Preparing people for ART
WHO clinical staging, past and current HIV- related conditions
Preparing, assessing and supporting adherence
Pregnancy status, family planning and contraception
Support for disclosure and partner notification
Risk-reduction counselling and combination and HIV prevention approaches
Screening for, preventing and managing noncommunicable diseases
Screening for and managing mental health problems and substance use
Psychosocial counselling and support
Managing pain and symptoms
Nutritional assessment and counselling
Infant and child feeding
Nutritional, growth and development assessment for children and adolescents

Preventing and treating coinfections: 
Co-trimoxazole preventive therapy
Intensified TB case- finding
Isoniazid preventive therapy
Screening for cryptococcal infection and fungal prophylaxis when appropriate
Screening for hepatitis B and C
Malaria prevention (insecticide-treated bed nets and prophylaxis)
Screening for sexually transmitted infections
Preventing and screening for cervical cancer
Assessing for vaccine- preventable diseases other than HBV and HCV infection'
    else '',
    if "ART initiation visit" and "Age 10 or older" and "Not on ART" and "CD4 less than or equal to 200 cells/mm3"
      then 'Perform a cryptococcal antigen for adults and adolescents'
    else '',
    if "ART initiation visit" and "Not on ART" and "On AZT"
      then 'Desirable actions: 
Haemoglobin test'
    else '',
    if "ART initiation visit" and "Not on ART" and "On TDF"
      then 'Desirable actions: 
Serum creatinine test
Estimated glomerular filtration rate (eGFR)'
    else '',
    if "ART initiation visit" and "Not on ART" and "Client is female"
      then 'Desirable actions: 
Pregnancy test'
    else '',
    if "Clinical visit" and "Age 20 or older" and "On ART"
      then 'Recommended actions:
Schedule the following viral load tests: 
HIV viral load test ≤ (ART start date + 6 months)
HIV viral load test ≤ (ART start date + 12 months)
HIV viral load test every 12 months thereafter
Perform a CD4 cell count every 6 months until ""Established on ART"" = TRUE

Desirable actions:
Serum creatinine and estimated glomerular filtration rate for TDF

Recommended general care activities: 
Adherence support interventions should be provided to people on ART (p xxxix of source).
Manage current medications.
Provide family planning and contraception.
Support disclosure and partner notification.
Counsel on risk reduction and combination HIV prevention approaches.
Assess, prevent and manage noncommunicable diseases.
Screen for and manage mental health problems.
Screen for and manage and substance use issues.
Provide psychosocial counselling and support.
Manage pain and symptoms.
Conduct a nutritional assessment and counsel on nutrition.

Preventing and treating coinfections:
Provide co-trimoxazole preventive therapy
Prevent malaria (insecticide- treated  bed-nets and prophylaxis)
Screen for sexually transmitted infections
Assess for vaccine-preventable diseases'
    else '',
    if "Clinical visit" and "Age under 20" and "On ART"
      then 'Recommended actions: 
Schedule viral load tests on the following dates: 
HIV viral load test ≤ (ART start date + 6 months)
HIV viral load test ≤ (ART start date + 12 months)
HIV viral load test every 12 months thereafter
CD4 cell count every 6 months until ""Established on ART"" = TRUE

Recommended general care activities: 
Prepare, assess and support adherence.
Manage current medications.
Provide family planning and contraception.
Support disclosure and partner notification.
Counsel on risk reduction and combination HIV prevention approaches.
Assess, prevent and manage noncommunicable diseases.
Screen for and manage mental health problems.
Screen for and manage and substance use issues.
Provide psychosocial counselling and support.
Manage pain and symptoms.
Conduct a nutritional, growth and development assessment.

Preventing and treating coinfections:
Provide co-trimoxazole preventive therapy
Prevent malaria (insecticide- treated  bed-nets and prophylaxis)
Screen for sexually transmitted infections
Assess for vaccine-preventable diseases'
    else '',
    if "Clinical visit" and "Age under 20" and "Client is female"
      then 'Pregnancy test'
    else '',
    if "Clinical visit" and "On ART" and "On TDF"
      then 'Desirable actions: 
Serum creatinine
Estimated glomerular filtration rate for TDF'
    else '',
    if "Clinical visit" and "Age 20 or older" and "Suspicion of treatment failure or interruption"
      then 'Desirable actions: 
HBV (HBsAg) serology (before switching ART regimen if this testing was not done or if the result was negative at baseline and the patient was not vaccinated thereafter) 

Recommended general care activities: 
Prepare, assess and support adherence.
Manage current medications.
Provide family planning and contraception.
Support disclosure and partner notification.
Counsel on risk reduction and combination HIV prevention approaches.
Assess, prevent and manage noncommunicable diseases.
Screen for and manage mental health problems.
Screen for and manage and substance use issues.
Provide psychosocial counselling and support.
Manage pain and symptoms.
Conduct a nutritional assessment and counsel on nutrition.

Preventing and treating coinfections: 
Provide co-trimoxazole preventive therapy
Conduct intensified TB case-finding
Prevent malaria (insecticide- treated  bed-nets and prophylaxis)
Screen for sexually transmitted infections
Assess for vaccine-preventable diseases'
    else '',
    if "Clinical visit" and "Age 20 or older" and "Suspicion of treatment failure or interruption"
      then 'Desirable actions: 
HBV (HBsAg) serology (before switching ART regimen if this testing was not done or if the result was negative at baseline and the patient was not vaccinated thereafter)

Recommended general care activities:
Prepare, assess and support adherence.
Manage current medications.
Provide family planning and contraception.
Support disclosure and partner notification.
Counsel on risk reduction and combination HIV prevention approaches.
Assess, prevent and manage noncommunicable diseases.
Screen for and manage mental health problems.
Screen for and manage and substance use issues.
Provide psychosocial counselling and support.
Manage pain and symptoms.
Conduct a nutritional, growth and development assessment.

Preventing and treating coinfections:
Provide co-trimoxazole preventive therapy
Conduct intensified TB case-finding
Prevent malaria (insecticide- treated  bed-nets and prophylaxis)
Screen for sexually transmitted infections
Assess for vaccine-preventable diseases'
    else ''
  })