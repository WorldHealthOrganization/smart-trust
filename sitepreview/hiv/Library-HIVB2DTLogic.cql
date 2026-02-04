/**
Library: HIV.B2.DT Logic

@DecisionID: HIV.B2.DT
@BusinessRule: Check for signs of serious illness
@Trigger: HIV.B2 Check for signs of serious illness
@Trigger: HIV.D3 Check for signs of serious illness
@HitPolicy: Rule Order
@Description: Check for serious illness

Data Concepts:
 * HIV.A.DE17: Age | Calculated age (number of years) of the client based on date of birth
 * HIV.D.DE17: Signs of serious illness | Signs that may indicate the client has a serious illness and needs triage or an emergency referral
 * HIV.D.DE9: Body temperature | Temperature of the client in Celsius

Consolidated guidelines on HIV prevention, testing, treatment, service delivery and monitoring: recommendations for a public health approach (2021) Chapter 5: Advanced HIV Disease. Figure 5.1: Algorithm for providing a package of care for people with advanced HIV disease.
*/

library HIVB2DTLogic
 
using FHIR version '4.0.1'

include HIVCommon version '0.0.1' called HIC
include HIVConcepts called Concepts
include HIVEncounterElements called Elements
include FHIRHelpers version '4.0.1'

include WHOCommon called WCom

parameter Today default Today()

context Patient

 /*
  @input: "Age"
  @pseudocode: 'Age' >= 10 years
  */
define "Age 10 or older":
  Elements."Current Patient Age In Years" >= 10

 /*
  @input: "Age"
  @pseudocode: 'Age' < 10 years
  */
define "Age under 10":
  Elements."Current Patient Age In Years" < 10

/*
 @output: "Immediately take action or refer for care if a client is having this issue"
 */
define "Immediately take action or refer for care if a client is having this issue":
  "Age 10 or older" and exists(
    Elements."Signs of serious illness Observation" O
      where O.value ~ Concepts."Tachycardia"
  )

/*
 @output "Immediately take action or refer for care if client is showing this sign of a serious illness."
 */
define "Immediately take action or refer for care if client is showing this sign of a serious illness":
  "Signs of serious illness age 10 or older" or "Signs of serious illness age under 10"

/*
 @output "Use clinical judgement and consider local epidemiology to determine if symptoms suggest client is seriously ill"
 */
define "Use clinical judgement and consider local epidemiology to determine if symptoms suggest client is seriously ill":
  "Signs of serious illness requiring clinical judgement age 10 or older" or "Signs of serious illness requiring clinical judgement age under 10"

/*
 @dynamicValue: Guidance
 */
define "Guidance":
  Combine({ 
    if "Immediately take action or refer for care if a client is having this issue" 
      then 'Immediately take action or refer for care if a client is having this issue.'
      else '',
    if "Immediately take action or refer for care if client is showing this sign of a serious illness" and "Age 10 or older"
      then 'Immediately take action or refer for care if client is showing this sign of a serious illness.'
      else '',
    if "Immediately take action or refer for care if client is showing this sign of a serious illness" and "Age under 10"
      then 'This is a sign and/or symptom of a serious health condition.
    
  Immediately take action or refer for care if client is showing this sign of a serious illness.'
      else '',
    if "Use clinical judgement and consider local epidemiology to determine if symptoms suggest client is seriously ill"
      then 'Use clinical judgement and consider local epidemiology to determine if symptoms suggest client is seriously ill. '
      else ''
  })

/*
 Supporting Logic
*/
define "Signs of serious illness age 10 or older":
  "Age 10 or older" and exists(
    Elements."Signs of serious illness Observation" O
      where
        O.value ~ Concepts."Tachypnea" or
        O.value ~ Concepts."Unable to walk unaided"
  )

define "Signs of serious illness age under 10":
  "Age under 10" and exists(
    Elements."Signs of serious illness Observation" O
      where
        O.value ~ Concepts."Lethargy - HIV.D.DE22" or
        O.value ~ Concepts."Unconsciousness" or
        O.value ~ Concepts."Convulsions" or
        O.value ~ Concepts."Unable to breastfeed" or
        O.value ~ Concepts."Unable to drink" or
        O.value ~ Concepts."Repeated vomiting"
    )

define "Signs of serious illness requiring clinical judgement age 10 or older":
  "Age 10 or older" and exists(
    Elements."Signs of serious illness Observation" O
      where
        O.value ~ Concepts."Fever of 39 C or greater" or
        O.value ~ Concepts."Other sign of serious illness"
  )

define "Signs of serious illness requiring clinical judgement age under 10":
  "Age under 10" and exists(
    Elements."Signs of serious illness Observation" O
      where
        O.value ~ Concepts."Fever of 39 C or greater" or
        O.value ~ Concepts."Other sign of serious illness"
  )
