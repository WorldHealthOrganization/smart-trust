/**
Library: HIV.D4.DT Logic

@DecisionID: HIV.D4.DT
@BusinessRule: 
@Trigger: 
@HitPolicy: Rule Order
@Description:

Data Concepts:


Consolidated guidelines on HIV prevention, testing, treatment, service delivery and monitoring: recommendations for a public health approach (2021) Chapter 5: Advanced HIV Disease. Figure 5.1: Algorithm for providing a package of care for people with advanced HIV disease.
*/
library HIVD4DTLogic

using FHIR version '4.0.1'

include HIVCommon version '0.0.1' called HIC
include HIVConcepts called Concepts
include HIVEncounterElements called Elements
include FHIRHelpers version '4.0.1'

include WHOCommon called WCom

context Patient

 /*
  @input: TB screening algorithm
  @pseudocode: "TB screening algorithm"='W4SS single screening algorithm'
  */
define "W4SS single screening algorithm":
  exists(
    Elements."TB screening algorithm Observation" O
      where O.value ~ Concepts."W4SS single screening algorithm"
  )

 /*
  @input: TB screening algorithm
  @pseudocode: "TB screening algorithm"='Sequential positive screening algorithm with W4SS and CRP'
  */
define "Sequential positive screening algorithm with W4SS and CRP":
  exists(
    Elements."TB screening algorithm Observation" O
      where O.value ~ Concepts."Sequential positive screening algorithm with W4SS and CRP"
  )

 /*
  @input: TB screening algorithm
  @pseudocode: "TB screening algorithm"='Screening with any TB symptom'
  */
define "Screening with any TB symptom":
  exists(
    Elements."TB screening algorithm Observation" O
      where O.value ~ Concepts."Screening with any TB symptom"
  )

/*
 @input: Estimated age
 @pseudocode: "Estimated age" >= 10 years
 */
define "Age 10 or older":
  Elements."Current Patient Age In Years" >= 10

/*
 @input: Estimated age
 @pseudocode: "Estimated age" < 15 years
 */
define "Age under 15":
  Elements."Current Patient Age In Years" < 15

/*
 @input: Symptoms of TB
 @pseudocode: "Symptoms of TB" IN 'Current cough', 'Fever of 39 °C or greater', 'Weight loss (reported)', 'Night sweats'
 */
define "Has symptoms of TB":
  exists(
    Elements."Symptoms of TB Observation" O
      where O.value ~ Concepts."Current cough"
         or O.value ~ Concepts."Fever of 39 °C or greater"
         or O.value ~ Concepts."Weight loss reported"
         or O.value ~ Concepts."Night sweats"
  )

/*
 @input: Symptoms of TB
 @pseudocode: "Symptoms of TB" = 'None'
 */
define "Does not have symptoms of TB":
  exists(
    Elements."Symptoms of TB Observation" O
      where O.value ~ Concepts."None"
  ) or not("Has symptoms of TB")

/*
 @input: C-reactive protein test result
 @pseudocode:
 */
define "No C-reactive protein test done":
  not(exists(
    Elements."C reactive protein test result"
  ))

/*
 @input: C-reactive protein test result
 @pseudocode: "C reactive protein test result" ≤ 5 mg/L
 */
define "C-reactive protein at or under 5mg/L":
  exists(
    Elements."C reactive protein test result" O
      where O.value < 5
  )

/*
 @input: C-reactive protein test result
 @pseudocode: "C reactive protein test result" > 5 mg/L
 */
define "C-reactive protein over 5mg/L":
  exists(
    Elements."C reactive protein test result" O
      where O.value > 5
  )

/*
 @input: History of contact with a person with TB
 @pseudocode: "History of contact with a person with TB"=True
 */
define "History of contact with a person with TB":
  exists(
    Elements."History of contact with a person with TB Observation" O
      where O.value = true
  )

/*
 @dynamicValue: Guidance
 */
define "Guidance":
  Combine({
    if "W4SS single screening algorithm" and "Age 10 or older" and "Has symptoms of TB"
      then 'Screen positive for TB.  Refer for diagnostic evaluation including mWRD & clinical evaluation as indicated.  

In PLHIV, diagnostic testing for TB with LF-LAM and other methods is usually considered early on.  See WHO consolidated guidelines on tuberculosis, Module 3: Diagnosis - Rapid diagnostics for tuberculosis detection.  

LF-LAM can assist TB diagnosis among people with advanced HIV disease (AHD) with symptoms and signs of TB. For inpatients with CD4 count ≤200 cells/mm3, outpatients with CD4 count ≤100 cells/mm3, or individuals with any CD4 count with symptoms of AHD or if seriously ill (See WHO Consolidated guidelines on HIV prevention, testing, treatment, service delivery and monitoring: recommendations for a public health approach (2021))'
      else '',
    if "W4SS single screening algorithm" and "Age 10 or older" and "Does not have symptoms of TB"
      then 'Screen negative for TB, assess for TPT.'
      else '',
    if "Sequential positive screening algorithm with W4SS and CRP" and "Age 10 or older" and "Does not have symptoms of TB"
      then 'Screen negative for TB.  Assess for TPT.'
      else '',
    if "Sequential positive screening algorithm with W4SS and CRP" and "Age 10 or older" and "Has symptoms of TB" and "No C-reactive protein test done"
      then 'Perform C reative protein test.'
      else '',
    if "Sequential positive screening algorithm with W4SS and CRP" and "Age 10 or older" and "Has symptoms of TB" and "C-reactive protein at or under 5mg/L"
      then 'Screen positive for TB.  Refer for diagnostic evaluation including mWRD & clinical evaluation as indicated.  

In PLHIV, diagnostic testing for TB with LF-LAM and other methods is usually considered early on.  

Currently, the c-reative protein cut-off value of > 5 mg/L is recommended, as it is the lowest threshold indicating abnormality in many clinical settings and because it is the most sensitive. At this cut-off, CRP has a similar sensitivity and higher or similar specificity to symptom screening in all subpopulations of adults and adolescents living with HIV tested (Section 5.2.2, 2021 WHO operation handbook on tuberculosis, Module 2: screening).  

LF-LAM can assist TB diagnosis among people with advanced HIV disease (AHD) with symptoms and signs of TB. For inpatients with CD4 count ≤200 cells/mm3, outpatients with CD4 count ≤100 cells/mm3, or individuals with any CD4 count with symptoms of AHD or if seriously ill.'
      else '',
    if "Sequential positive screening algorithm with W4SS and CRP" and "Age 10 or older" and "Has symptoms of TB" and "C-reactive protein over 5mg/L"
      then 'In PLHIV, diagnostic testing for TB with LF-LAM and other methods is usually considered early on.  

Currently, the c-reative protein cut-off value of > 5 mg/L is recommended, as it is the lowest threshold indicating abnormality in many clinical settings and because it is the most sensitive. At this cut-off, CRP has a similar sensitivity and higher or similar specificity to symptom screening in all subpopulations of adults and adolescents living with HIV tested (Section 5.2.2, 2021 WHO operation handbook on tuberculosis, Module 2: screening).  

LF-LAM can assist TB diagnosis among people with advanced HIV disease (AHD) with symptoms and signs of TB. For inpatients with CD4 count ≤200 cells/mm3, outpatients with CD4 count ≤100 cells/mm3, or individuals with any CD4 count with symptoms of AHD or if seriously ill.'
      else '',
    if "Screening with any TB symptom" and "Age under 15" and "Has symptoms of TB" and "History of contact with a person with TB"
      then 'Screen positive for TB.  Refer for diagnostic evaluation including mWRD & clinical evaluation as indicated.  

Any child < 15 years who has had close contact with someone with TB disease should be screened for TB with a symptom screen and/or CXR as part of active contact-tracing (see Algorithm A.5.1 in Annex 5). Symptoms that should be used to screen for TB are cough, fever and poor weight gain (or weight loss). In young children, reduced playfulness or lethargy should also be included in symptom screening; cough may be absent.'
      else '',
    if "Screening with any TB symptom" and "Age under 15" and "Does not have symptoms of TB" and "History of contact with a person with TB"
      then 'Screen negative for TB.  Refer for TPT.'
      else ''
  })
