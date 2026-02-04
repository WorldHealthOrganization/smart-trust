library HIVEncounterElements

using FHIR version '4.0.1'

include FHIRHelpers version '4.0.1'

include WHOConcepts
include WHOCommon called WC
include WHOElements called WE

include HIVConcepts called Concepts
include HIVCommon called Common
include HIVElements called Elements

parameter Today Date default Today()
parameter EncounterId String

context Patient

/**
 * HIV Elements
 */

// Auto-generated Elements from DAK Data Dictionary
//   Entries based on DAK Data Dictionary for Data Elements marked as used
//   in at least one Decision Support Table or Aggregate Indicator

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
/* End of Age */

/*
@dataElement: HIV.A.DE18 - Gender
@activity: HIV.A6.1 Review sociodemographic data with client | HIV.A5 Create new client record
@description: Gender of the client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Gender":
  Patient.gender
/* End of Gender */

/*
@dataElement: HIV.A.DE19 - Female
@activity: HIV.A6.1 Review sociodemographic data with client | HIV.A5 Create new client record
@description: Client identifies as female
*/
define "Female":
  "Gender" ~ 'female'
/* End of Female */

/*
@dataElement: HIV.A.DE20 - Male
@activity: HIV.A6.1 Review sociodemographic data with client | HIV.A5 Create new client record
@description: Client identifies as male
*/
define "Male":
  "Gender" ~ 'male'
/* End of Male */

/*
@dataElement: HIV.B.DE14 - Date/time of suspected exposure to HIV
@activity: HIV.B1 Determine reason for visit
@description: Date and time when the client had suspected exposure to HIV
*/
define "Date/time of suspected exposure to HIV B.DE14":
  Elements."Date/time of suspected exposure to HIV B.DE14" O
    where O.encounter.references(EncounterId)
/* End of Date/time of suspected exposure to HIV B.DE14 */

/*
@dataElement: HIV.B.DE29 - Currently pregnant
@activity: HIV.B6 Capture or update client history
@description: Client is currently pregnant
*/
define "Currently pregnant B.DE29":
  exists Elements."Currently pregnant B.DE29" C
    where C.encounter.references(EncounterId)
/* End of Currently pregnant B.DE29 */

/*
@dataElement: HIV.B.DE33 - Partner HIV status reported
@activity: HIV.B6 Capture or update client history
@description: The HIV status of the client's partner.
*/
define "Partner HIV status reported Observation":
  Elements."Partner HIV status reported Observation" O
    where O.encounter.references(EncounterId)
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
    where C.prevalenceInterval() starts on or before Today
define "HIV-positive B.DE34 Observation":
  Elements."HIV-positive B.DE34 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
    where C.prevalenceInterval() starts on or before Today
define "HIV-negative B.DE35 Observation":
  Elements."HIV-negative B.DE35 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
    where C.prevalenceInterval() starts on or before Today
define "Unknown B.DE36 Observation":
  Elements."Unknown B.DE36 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Unknown B.DE36 */

/*
@dataElement: HIV.B.DE49 - Key population member
@activity: HIV.B6 Capture or update client history
@description: Client is a member of a key population that has an increased risk of HIV
*/
define "Is Key population member B.DE49":
  exists(
    "Key population member type Observation" O
      where O.encounter.references(EncounterId)
  )
/* End of Key population member B.DE49 */

/*
@dataElement: HIV.B.DE50 - Key population member type
@activity: HIV.B6 Capture or update client history
@description: The type of key population that the client is included in
*/
define "Key population member type Observation":
  Elements."Key population member type Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Key population member type B.DE50 */

/*
@dataElement: HIV.B.DE65 - Date informed of HIV-positive diagnosis
@activity: HIV.B6 Capture or update client history
@description: The date on which the client was diagnosed with HIV
*/
// TODO: Replace placeholder with relevant CQL logic
define "Date informed of HIV-positive diagnosis":
  Elements."Date informed of HIV-positive diagnosis" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
define "Date informed of HIV-positive diagnosis Value":
  "Date informed of HIV-positive diagnosis" O
  return O.value
/* End of Date informed of HIV-positive diagnosis */

/*
@dataElement: HIV.B.DE71 - HIV diagnosis date
@activity: HIV.B8 Provide post-test counselling
@description: Date diagnosis was returned to client
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV diagnosis date":
  Elements."HIV diagnosis date" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
define "HIV diagnosis date Value":
  "HIV diagnosis date" O
  return O.value
/* End of HIV diagnosis date */

/*
@dataElement: HIV.B.DE72 - ART start date
@activity: HIV.B8 Provide post-test counselling
@description: The date on which the client started or restarted antiretroviral therapy (ART)
*/
// TODO: Replace placeholder with relevant CQL logic
define "ART start date B.DE72":
  Elements."ART start date B.DE72" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
define "ART start date B.DE72 Value":
  "ART start date B.DE72" O
  return O.value
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
  Elements."HIV test conducted Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of HIV test conducted */

/*
@dataElement: HIV.B.DE81 - HIV test type
@activity: HIV.B7 Test for HIV using testing algorithm
@description: Type of HIV test
*/
define "HIV test type B.DE81":
  Elements."HIV test type B.DE81" O
    where O.encounter.references(EncounterId)
define "HIV test type B.DE81 Value":
  "HIV test type B.DE81" O
  return O.value
/* End of HIV test type B.DE81 */

/*
@dataElement: HIV.B.DE82 - Rapid diagnostic test for HIV
@activity: HIV.B7 Test for HIV using testing algorithm
@description: Antibody test for HIV performed with a rapid diagnostic
*/
define "Rapid diagnostic test for HIV B.DE82":
  Elements."Rapid diagnostic test for HIV B.DE82" O
    where O.encounter.references(EncounterId)
/* End of Rapid diagnostic test for HIV B.DE82 */

/*
@dataElement: HIV.B.DE83 - Enzyme immunoassay for HIV
@activity: HIV.B7 Test for HIV using testing algorithm
@description: Antibody test for HIV performed with an enzyme immunoassay
*/
define "Enzyme immunoassay for HIV B.DE83":
  Elements."Enzyme immunoassay for HIV B.DE83" O
    where O.encounter.references(EncounterId)
/* End of Enzyme immunoassay for HIV B.DE83 */

/*
@dataElement: HIV.B.DE84 - Nucleic acid test for HIV
@activity: HIV.B7 Test for HIV using testing algorithm
@description: Virological test, which includes testing for early infant diagnosis
*/
// TODO: Replace placeholder with relevant CQL logic
define "Nucleic acid test for HIV B.DE84":
  Elements."Nucleic acid test for HIV B.DE84" O
    where O.encounter.references(EncounterId)
/* End of Nucleic acid test for HIV B.DE84 */

/*
@dataElement: HIV.B.DE85 - Dual HIV/syphilis rapid diagnostic test
@activity: HIV.B7 Test for HIV using testing algorithm
@description: Antibody test for HIV and syphilis performed with a rapid diagnostic
*/
define "Dual HIV/syphilis rapid diagnostic test B.DE85":
  Elements."Dual HIV/syphilis rapid diagnostic test B.DE85" O
    where O.encounter.references(EncounterId)
/* End of Dual HIV/syphilis rapid diagnostic test B.DE85 */

/*
@dataElement: HIV.B.DE86 - HIV self-test
@activity: HIV.B7 Test for HIV using testing algorithm
@description: Antibody test for HIV performed by self-tester using a rapid diagnostic
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV self-test":
  Elements."HIV self-test" O
    where O.encounter.references(EncounterId)
/* End of HIV self-test */

/*
@dataElement: HIV.B.DE88 - Assay number in testing strategy
@activity: HIV.B7 Test for HIV using testing algorithm
@description: The number of the assay (test kit) in the HIV testing strategy
*/
define "Assay number in testing strategy B.DE88":
  Elements."Assay number in testing strategy B.DE88 Observation" O
    where O.encounter.references(EncounterId)
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
  Elements."Assay 0 B.DE89 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Assay 0 B.DE89 Observation":
  Elements."Assay 0 B.DE89 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Assay 0 B.DE89 */

/*
@dataElement: HIV.B.DE90 - Assay 1
@activity: HIV.B7 Test for HIV using testing algorithm
@description: The first test in the HIV testing strategy
*/
// TODO: Replace placeholder with relevant CQL logic
define "Assay 1 B.DE90 Observation":
  Elements."Assay 1 B.DE90 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Assay 1 B.DE90 */

/*
@dataElement: HIV.B.DE91 - Assay 2
@activity: HIV.B7 Test for HIV using testing algorithm
@description: The second test in the HIV testing strategy
*/
// TODO: Replace placeholder with relevant CQL logic
define "Assay 2 B.DE91 Observation":
  Elements."Assay 2 B.DE91 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Assay 2 B.DE91 */

/*
@dataElement: HIV.B.DE92 - Assay 3
@activity: HIV.B7 Test for HIV using testing algorithm
@description: The third test in the HIV testing strategy
*/
// TODO: Replace placeholder with relevant CQL logic
define "Assay 3 B.DE92 Observation":
  Elements."Assay 3 B.DE92 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Assay 1 repeated B.DE93 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Assay 1 repeated B.DE93 Observation":
  Elements."Assay 1 repeated B.DE93 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Assay 1 repeated B.DE93 */

/*
@dataElement: HIV.B.DE94 - Test result of HIV assay 1
@activity: HIV.B7 Test for HIV using testing algorithm
@description: The result of the first HIV assay in the testing strategy
*/
define "Test result of HIV assay 1 B.DE94":
  Elements."Test result of HIV assay 1 B.DE94 Observation" O
    where O.encounter.references(EncounterId)
/* End of Test result of HIV assay 1 B.DE94 */

/*
@dataElement: HIV.B.DE98 - Test result of HIV assay 2
@activity: HIV.B7 Test for HIV using testing algorithm
@description: The result of the second HIV assay in the testing strategy
*/
define "Test result of HIV assay 2 B.DE98":
  Elements."Test result of HIV assay 2 B.DE98 Observation" O
    where O.encounter.references(EncounterId)
/* End of Test result of HIV assay 2 B.DE98 */

/*
@dataElement: HIV.B.DE102 - Test result of HIV assay 3
@activity: HIV.B7 Test for HIV using testing algorithm
@description: The result of the third HIV assay in the testing strategy
*/
define "Test result of HIV assay 3 B.DE102":
  Elements."Test result of HIV assay 3 B.DE102 Observation" O
    where O.encounter.references(EncounterId)
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
  Elements."Reactive B.DE103 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Reactive B.DE103 Observation":
  Elements."Reactive B.DE103 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Non-reactive B.DE104 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Non-reactive B.DE104 Observation":
  Elements."Non-reactive B.DE104 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Invalid B.DE105 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Invalid B.DE105 Observation":
  Elements."Invalid B.DE105 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Test result of HIV assay 1 repeated B.DE106 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Reactive B.DE107 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Reactive B.DE107 Observation":
  Elements."Reactive B.DE107 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Non-reactive B.DE108 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Non-reactive B.DE108 Observation":
  Elements."Non-reactive B.DE108 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Invalid B.DE109 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Invalid B.DE109 Observation":
  Elements."Invalid B.DE109 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Invalid B.DE109 */

/*
@dataElement: HIV.B.DE111 - HIV test result
@activity: HIV.B7 Test for HIV using testing algorithm
@description: The result from HIV testing after applying the testing algorithm
*/
define "HIV test result":
  Elements."HIV test result Observation" O
    where O.encounter.references(EncounterId)
/* End of HIV test result B.DE111 */

/*
@dataElement: HIV.B.DE115 - HIV status
@activity: HIV.B7 Test for HIV using testing algorithm
@description: HIV status reported after applying the national HIV testing algorithm. No single HIV test can provide an HIV-positive diagnosis.
*/
define "HIV Status Observation":
  Elements."HIV Status Observation" O
    where O.encounter.references(EncounterId)
/* End of HIV status */

/*
@dataElement: HIV.B.DE141 - Partner virally suppressed on ART
@activity: HIV.B6 Capture or update client history
@description: ART and virally suppression status of a partner of the client
*/
// TODO: Replace placeholder with relevant CQL logic
define "Partner virally suppressed on ART":
  exists "Partner virally suppressed on ART Observation"
define "Partner virally suppressed on ART Observation":
  Elements."Partner virally suppressed on ART Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Counselling provided Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."HIV-positive counselling conducted Condition" C
    where C.prevalenceInterval() starts on or before Today
define "HIV-positive counselling conducted Observation":
  Elements."HIV-positive counselling conducted Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Hepatitis B positive counselling conducted Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Hepatitis B positive counselling conducted Observation":
  Elements."Hepatitis B positive counselling conducted Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Hepatitis C positive counselling conducted Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Hepatitis C positive counselling conducted Observation":
  Elements."Hepatitis C positive counselling conducted Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Syphilis counselling, treatment and further testing Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Syphilis counselling, treatment and further testing Observation":
  Elements."Syphilis counselling, treatment and further testing Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Linked to enrolment in care and ART initiation Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Linked to enrolment in care and ART initiation Observation":
  Elements."Linked to enrolment in care and ART initiation Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."VMMC counselling provided Condition" C
    where C.prevalenceInterval() starts on or before Today
define "VMMC counselling provided Observation":
  Elements."VMMC counselling provided Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Prevention services offered and referrals B.DE149 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Offer male and female condoms and condom-compatible lubricants B.DE150 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Offer male and female condoms and condom-compatible lubricants B.DE150 Observation":
  Elements."Offer male and female condoms and condom-compatible lubricants B.DE150 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Offer pre-exposure prophylaxis PrEP for people at elevated risk for HIV acquisition Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Offer pre-exposure prophylaxis PrEP for people at elevated risk for HIV acquisition Observation":
  Elements."Offer pre-exposure prophylaxis PrEP for people at elevated risk for HIV acquisition Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Offer post-exposure prophylaxis PEP following suspected exposure Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Offer post-exposure prophylaxis PEP following suspected exposure Observation":
  Elements."Offer post-exposure prophylaxis PEP following suspected exposure Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Voluntary medical male circumcision VMMC Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Voluntary medical male circumcision VMMC Observation":
  Elements."Voluntary medical male circumcision VMMC Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Harm reduction for people who inject drugs B.DE154 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Harm reduction for people who inject drugs B.DE154 Observation":
  Elements."Harm reduction for people who inject drugs B.DE154 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Behavioural interventions to support risk reduction, particularly for people with HIV and members of key populations Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Behavioural interventions to support risk reduction, particularly for people with HIV and members of key populations Observation":
  Elements."Behavioural interventions to support risk reduction, particularly for people with HIV and members of key populations Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."HIV testing for partners and biological children B.DE156 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "HIV testing for partners and biological children B.DE156 Observation":
  Elements."HIV testing for partners and biological children B.DE156 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."HIV testing for partners and social contacts of people from key populations, where appropriate Condition" C
    where C.prevalenceInterval() starts on or before Today
define "HIV testing for partners and social contacts of people from key populations, where appropriate Observation":
  Elements."HIV testing for partners and social contacts of people from key populations, where appropriate Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Sexual and reproductive health integrated services B.DE158 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Contraception and family planning B.DE159 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Contraception and family planning B.DE159 Observation":
  Elements."Contraception and family planning B.DE159 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Check pregnancy status B.DE160 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Check pregnancy status B.DE160 Observation":
  Elements."Check pregnancy status B.DE160 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Prevention of mother-to-child transmission counselling Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Prevention of mother-to-child transmission counselling Observation":
  Elements."Prevention of mother-to-child transmission counselling Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Cervical cancer screening and treatment counselling Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Cervical cancer screening and treatment counselling Observation":
  Elements."Cervical cancer screening and treatment counselling Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Anal cancer screening for men who have sex with men B.DE163 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Anal cancer screening for men who have sex with men B.DE163 Observation":
  Elements."Anal cancer screening for men who have sex with men B.DE163 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."STI testing and treatment services Condition" C
    where C.prevalenceInterval() starts on or before Today
define "STI testing and treatment services Observation":
  Elements."STI testing and treatment services Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Offer other clinical services B.DE165 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Assessment and provision of vaccinations B.DE166 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Assessment and provision of vaccinations B.DE166 Observation":
  Elements."Assessment and provision of vaccinations B.DE166 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Hepatitis B HBV and hepatitis C virus HCV testing and treatment provided Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Hepatitis B HBV and hepatitis C virus HCV testing and treatment provided Observation":
  Elements."Hepatitis B HBV and hepatitis C virus HCV testing and treatment provided Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Co-trimoxazole chemoprophylaxis to prevent Pneumocystis carinii pneumonia provided Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Co-trimoxazole chemoprophylaxis to prevent Pneumocystis carinii pneumonia provided Observation":
  Elements."Co-trimoxazole chemoprophylaxis to prevent Pneumocystis carinii pneumonia provided Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Intensified TB case finding and linkage to TB treatment provided Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Intensified TB case finding and linkage to TB treatment provided Observation":
  Elements."Intensified TB case finding and linkage to TB treatment provided Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Provision of isoniazid preventive therapy if person does not have TB B.DE170 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Provision of isoniazid preventive therapy if person does not have TB B.DE170 Observation":
  Elements."Provision of isoniazid preventive therapy if person does not have TB B.DE170 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Malaria prevention such as bed nets and prophylaxis, depending on epidemiology B.DE171 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Malaria prevention such as bed nets and prophylaxis, depending on epidemiology B.DE171 Observation":
  Elements."Malaria prevention such as bed nets and prophylaxis, depending on epidemiology B.DE171 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Other support services B.DE172 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Mental health services B.DE173 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Mental health services B.DE173 Observation":
  Elements."Mental health services B.DE173 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Psychosocial counselling, support and treatment adherence counselling B.DE174 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Psychosocial counselling, support and treatment adherence counselling B.DE174 Observation":
  Elements."Psychosocial counselling, support and treatment adherence counselling B.DE174 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Support for disclosure and partner services B.DE175 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Support for disclosure and partner services B.DE175 Observation":
  Elements."Support for disclosure and partner services B.DE175 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Legal and social services B.DE176 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Legal and social services B.DE176 Observation":
  Elements."Legal and social services B.DE176 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Services for responding to violence against women B.DE177 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Services for responding to violence against women B.DE177 Observation":
  Elements."Services for responding to violence against women B.DE177 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Type of follow-up appointment B.DE191 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Retesting for HIV B.DE192 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Retesting for HIV B.DE192 Observation":
  Elements."Retesting for HIV B.DE192 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Other B.DE193 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Other B.DE193 Observation":
  Elements."Other B.DE193 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Other B.DE193 */

/*
@dataElement: HIV.B.DE195 - Date/time of follow-up appointment
@activity: HIV.B20 Schedule retest
@description: Date the patient is to return for monitoring, re-supply or any other reason
*/
// TODO: Replace placeholder with relevant CQL logic
define "Date/time of follow-up appointment B.DE195":
  Elements."Date/time of follow-up appointment B.DE195" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
define "Date/time of follow-up appointment B.DE195 Value":
  "Date/time of follow-up appointment B.DE195" O
  return O.value
/* End of Date/time of follow-up appointment B.DE195 */

/*
@dataElement: HIV.B.DE224 - HIV retest prior to starting ART conducted
@activity: HIV.B20 Schedule retest
@description: HIV retest prior to starting ART conducted
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV retest prior to starting ART conducted":
  exists "HIV retest prior to starting ART conducted Observation"
define "HIV retest prior to starting ART conducted Observation":
  Elements."HIV retest prior to starting ART conducted Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of HIV retest prior to starting ART conducted */

/*
@dataElement: HIV.B.DE225 - At elevated risk for HIV acquisition
@activity: HIV.B6 Capture or update client history
@description: Client is at elevated risk for HIV acquisition
*/
define "At elevated risk for HIV acquisition B.DE225":
  Elements."At elevated risk for HIV acquisition B.DE225" C
    where C.prevalenceInterval() starts on or before Today
      or C.encounter.references(EncounterId)
/* End of At elevated risk for HIV acquisition B.DE225 */

/*
@dataElement: HIV.B.DE250 - Syphilis test result
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Result from syphilis test
*/
// TODO: Replace placeholder with relevant CQL logic
define "Syphilis test result B.DE250":
  Elements."Syphilis test result B.DE250" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Syphilis test result B.DE250 */

/*
@dataElement: HIV.B.DE251 - Positive
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Test result is positive for syphilis
*/
define "Positive B.DE251":
  exists "Syphilis test result B.DE250" O
    where O.value ~ Concepts."Positive - HIV.B.DE251"
/* End of Positive B.DE251 */

/*
@dataElement: HIV.B.DE252 - Negative
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Test result is negative for syphilis
*/
define "Negative B.DE252":
  exists "Syphilis test result B.DE250" O
    where O.value ~ Concepts."Negative - HIV.B.DE252"
/* End of Negative B.DE252 */

/*
@dataElement: HIV.B.DE253 - Inconclusive
@activity: HIV.B23 Offer sexual and reproductive health services
@description: Test result is inconclusive
*/
define "Inconclusive B.DE253":
  exists "Syphilis test result B.DE250" O
    where O.value ~ Concepts."Inconclusive - HIV.B.DE253" 
/* End of Inconclusive B.DE253 */

/*
@dataElement: HIV.C.DE9 - Date/time of suspected exposure to HIV
@activity: HIV.C3 Capture or update client history
@description: When the suspect exposure to HIV took place
*/
// TODO: Replace placeholder with relevant CQL logic
define "Date/time of suspected exposure to HIV C.DE9":
  Elements."Date/time of suspected exposure to HIV C.DE9" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
define "Date/time of suspected exposure to HIV C.DE9 Value":
  "Date/time of suspected exposure to HIV C.DE9" O
  return O.value
/* End of Date/time of suspected exposure to HIV C.DE9 */

/*
@dataElement: HIV.C.DE10 - Currently on PrEP
@activity: HIV.C3 Capture or update client history
@description: The client is currently taking PrEP. Oral pre-exposure prophylaxis (PrEP) of HIV is the use of ARV drugs by people who are not infected with HIV to block the acquisition of HIV.
*/
define "Currently on PrEP":
  Elements."Currently on PrEP" O
    where O.effective.toInterval() starts on or before Today
/* End of Currently on PrEP */

/*
@dataElement: HIV.C.DE17 - Current PrEP regimen
@activity: HIV.C3 Capture or update client history
@description: HIV pre-exposure prophylaxis (PrEP) regimen
*/
// TODO: Replace placeholder with relevant CQL logic
define "Current PrEP regimen":
  exists "Current PrEP regimen Observation"
define "Current PrEP regimen Observation":
  Elements."Current PrEP regimen Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Current PrEP regimen */

/*
@dataElement: HIV.C.DE18 - TDF + FTC
@activity: HIV.C3 Capture or update client history
@description: Treated with tenofovir disoproxil fumarate (TDF) and emtricitabine (FTC) pre-exposure prophylaxis (PrEP) regimen (oral PrEP)
*/
define "TDF + FTC C.DE18":
  exists Elements."TDF + FTC C.DE18"
/* End of TDF + FTC C.DE18 */

/*
@dataElement: HIV.C.DE19 - TDF
@activity: HIV.C3 Capture or update client history
@description: Treated with single-agent tenofovir disoproxil fumarate (TDF) pre-exposure prophylaxis (PrEP) regimen (oral PrEP)
*/
define "TDF C.DE19":
  Elements."TDF C.DE19" MS
    where MS.effective.toInterval() starts on or before Today

/*
@dataElement: HIV.C.DE20 - TDF + 3TC
@activity: HIV.C3 Capture or update client history
@description: Treated with tenofovir disoproxil fumarate (TDF) and lamivudine (3TC) pre-exposure prophylaxis (PrEP) regimen (oral PrEP)
*/
define "TDF + 3TC C.DE20":
  Elements."TDF + 3TC C.DE20" MS
    where MS.effective.toInterval() starts on or before Today
/* End of TDF + 3TC C.DE20 */

/*
@dataElement: HIV.C.DE21 - Other TDF-based regimen
@activity: HIV.C3 Capture or update client history
@description: Treated with other tenofovir disoproxil fumarate (TDF)-based regimen (oral PrEP)
*/
define "Other TDF-based regimen":
  Elements."Other TDF-based regimen" MS
    where MS.effective.toInterval() starts on or before Today
/* End of Other TDF-based regimen */

/*
@dataElement: HIV.C.DE22 - Dapivirine vaginal ring DVR
@activity: HIV.C3 Capture or update client history
@description: Dapivirine vaginal ring (DVR) for HIV prevention
*/
define "Dapivirine vaginal ring DVR C.DE22":
  Elements."Dapivirine vaginal ring DVR C.DE22" MS
    where MS.effective.toInterval() starts on or before Today
/* End of Dapivirine vaginal ring DVR C.DE22 */

/*
@dataElement: HIV.C.DE23 - CAB-LA
@activity: HIV.C3 Capture or update client history
@description: Long-acting injectable cabotegravir
*/
define "CAB-LA C.DE23":
  Elements."CAB-LA C.DE23" MS
    where MS.effective.toInterval() starts on or before Today
/* End of CAB-LA C.DE23 */

/*
@dataElement: HIV.C.DE31 - PEP history
@activity: HIV.C3 Capture or update client history
@description: The client's history in taking post-exposure prophylaxis (PEP) for HIV prevention
*/
define "PEP history":
  Elements."PEP history" O
    where O.encounter.references(EncounterId)
/* End of PEP history */

/*
@dataElement: HIV.C.DE36 - Signs of substantial risk of HIV infection
@activity: HIV.C3 Capture or update client history
@description: Signs the client is at a substantial risk of HIV infection
*/
define "Signs of substantial risk of HIV infection C.DE36":
  Elements."Signs of substantial risk of HIV infection C.DE36" O
    where O.encounter.references(EncounterId)
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
  Elements."Acute HIV infection symptoms C.DE46 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Fever Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Fever Observation":
  Elements."Fever Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Sore throat Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Sore throat Observation":
  Elements."Sore throat Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Aches Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Aches Observation":
  Elements."Aches Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Pains Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Pains Observation":
  Elements."Pains Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Swollen glands Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Swollen glands Observation":
  Elements."Swollen glands Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Mouth sores Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Mouth sores Observation":
  Elements."Mouth sores Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Headaches Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Headaches Observation":
  Elements."Headaches Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Rash Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Rash Observation":
  Elements."Rash Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Rash */

/*
@dataElement: HIV.C.DE55 - Sex partners HIV treatment status
@activity: HIV.C3 Capture or update client history
@description: Treatment adherence of client's sex partner for partners that are HIV-positive
*/
define "Sex partners HIV treatment status":
  Elements."Sex partners HIV treatment status" O
    where O.encounter.references(EncounterId)
/* End of Sex partners HIV treatment status */

/*
@dataElement: HIV.C.DE61 - Suitable for PrEP
@activity: HIV.C8 Suitable for PrEP or PEP?
@description: The client is suitable for PrEP
*/
define "Suitable for PrEP":
  Elements."Suitable for PrEP Observation" O
    where O.encounter.references(EncounterId)
/* End of Suitable for PrEP */

/*
@dataElement: HIV.C.DE106 - Estimated creatinine clearance
@activity: HIV.C23 Prescribe or administer PrEP or PEP
@description: Estimated creatinine clearance of the client returned from lab in mL/min
*/
define "Estimated creatinine clearance":
  Elements."Estimated creatinine clearance" O
    where O.encounter.references(EncounterId)
/* End of Estimated creatinine clearance */

/*
@dataElement: HIV.C.DE112 - Contraindications to PrEP usage
@activity: HIV.C23 Prescribe or administer PrEP or PEP
@description: Listing of contraindications to pre-exposure prophylaxis (PrEP)
*/
define "Contraindications to PrEP usage":
  Elements."Contraindications to PrEP usage Observation" O
    where O.encounter.references(EncounterId)
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
  Elements."Tenofovir disoproxil fumarate TDF allergy or contraindication Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Tenofovir disoproxil fumarate TDF allergy or contraindication Observation":
  Elements."Tenofovir disoproxil fumarate TDF allergy or contraindication Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."HIV-positive C.DE114 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "HIV-positive C.DE114 Observation":
  Elements."HIV-positive C.DE114 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Low estimated creatinine clearance Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Low estimated creatinine clearance Observation":
  Elements."Low estimated creatinine clearance Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Low estimated creatinine clearance */

/*
@dataElement: HIV.C.DE117 - Probable recent exposure to HIV
@activity: HIV.C23 Prescribe or administer PrEP or PEP
@description: When the client is reported to have had probable recent exposure to HIV
*/
// TODO: Replace placeholder with relevant CQL logic
define "Probable recent exposure to HIV":
  Elements."Probable recent exposure to HIV" O
    where O.encounter.references(EncounterId)
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
  Elements."Other allergy or contraindication to a medicine in the PrEP regimen Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Other allergy or contraindication to a medicine in the PrEP regimen Observation":
  Elements."Other allergy or contraindication to a medicine in the PrEP regimen Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Other allergy or contraindication to a medicine in the PrEP regimen */

/*
@dataElement: HIV.C.DE123 - Adherence counselling provided
@activity: HIV.C23 Prescribe or administer PrEP or PEP
@description: Whether adherence counselling was provided
*/
// TODO: Replace placeholder with relevant CQL logic
define "Adherence counselling provided C.DE123":
  exists "Adherence counselling provided C.DE123 Observation"
define "Adherence counselling provided C.DE123 Observation":
  Elements."Adherence counselling provided C.DE123 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Adherence counselling provided C.DE123 */

/*
@dataElement: HIV.C.DE124 - Date/time of follow-up appointment
@activity: HIV.C24 Schedule follow-up
@description: Date the client is to return for monitoring, re-supply, or any other reason
*/
// TODO: Replace placeholder with relevant CQL logic
define "Date/time of follow-up appointment C.DE124":
  Elements."Date/time of follow-up appointment C.DE124" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
define "Date/time of follow-up appointment C.DE124 Value":
  "Date/time of follow-up appointment C.DE124" O
  return O.value
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
  Elements."Type of follow-up appointment C.DE125 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Retesting for HIV C.DE126 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Retesting for HIV C.DE126 Observation":
  Elements."Retesting for HIV C.DE126 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Follow-up appointment for PrEP Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Follow-up appointment for PrEP Observation":
  Elements."Follow-up appointment for PrEP Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Other C.DE128 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Other C.DE128 Observation":
  Elements."Other C.DE128 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Prevention services offered and referrals C.DE131 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Male and female condoms and condom-compatible lubricants offered Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Male and female condoms and condom-compatible lubricants offered Observation":
  Elements."Male and female condoms and condom-compatible lubricants offered Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Voluntary medical male circumcision VMMC referral Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Voluntary medical male circumcision VMMC referral Observation":
  Elements."Voluntary medical male circumcision VMMC referral Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Harm reduction for people who inject drugs C.DE134 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Harm reduction for people who inject drugs C.DE134 Observation":
  Elements."Harm reduction for people who inject drugs C.DE134 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Behavioural interventions to support risk reduction C.DE135 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Behavioural interventions to support risk reduction C.DE135 Observation":
  Elements."Behavioural interventions to support risk reduction C.DE135 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Behavioural interventions to support risk reduction C.DE135 */

/*
@dataElement: HIV.C.DE149 - Sexual and reproductive health integrated services
@activity: HIV.C10 Counsel on risk and prevention
@description: Offer or refer to sexual and reproductive health services
*/
// TODO: Replace placeholder with relevant CQL logic
define "Sexual and reproductive health integrated services C.DE149":
  exists "Sexual and reproductive health integrated services C.DE149 Observation"
define "Sexual and reproductive health integrated services C.DE149 Observation":
  Elements."Sexual and reproductive health integrated services C.DE149 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Contraception and family planning C.DE150 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Contraception and family planning C.DE150 Observation":
  Elements."Contraception and family planning C.DE150 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Check pregnancy status C.DE151 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Check pregnancy status C.DE151 Observation":
  Elements."Check pregnancy status C.DE151 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Prevent mother-to-child transmission Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Prevent mother-to-child transmission Observation":
  Elements."Prevent mother-to-child transmission Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Cervical cancer screening and treatment Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Cervical cancer screening and treatment Observation":
  Elements."Cervical cancer screening and treatment Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Anal cancer screening for men who have sex with men C.DE154 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Anal cancer screening for men who have sex with men C.DE154 Observation":
  Elements."Anal cancer screening for men who have sex with men C.DE154 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."STI testing and treatment C.DE155 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "STI testing and treatment C.DE155 Observation":
  Elements."STI testing and treatment C.DE155 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."HIV testing for partners and biological children C.DE156 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "HIV testing for partners and biological children C.DE156 Observation":
  Elements."HIV testing for partners and biological children C.DE156 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Offer other clinical services C.DE157 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Assessment and provision of vaccinations C.DE158 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Assessment and provision of vaccinations C.DE158 Observation":
  Elements."Assessment and provision of vaccinations C.DE158 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Hepatitis B virus HBV and hepatitis C virus HCV testing and treatment Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Hepatitis B virus HBV and hepatitis C virus HCV testing and treatment Observation":
  Elements."Hepatitis B virus HBV and hepatitis C virus HCV testing and treatment Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Co-trimoxazole chemoprophylaxis to prevent pneumocystis carinii pneumonia C.DE160 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Co-trimoxazole chemoprophylaxis to prevent pneumocystis carinii pneumonia C.DE160 Observation":
  Elements."Co-trimoxazole chemoprophylaxis to prevent pneumocystis carinii pneumonia C.DE160 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Intensified TB case finding and linkage to TB treatment C.DE161 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Intensified TB case finding and linkage to TB treatment C.DE161 Observation":
  Elements."Intensified TB case finding and linkage to TB treatment C.DE161 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Provision of isoniazid preventive therapy if person does not have TB C.DE162 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Provision of isoniazid preventive therapy if person does not have TB C.DE162 Observation":
  Elements."Provision of isoniazid preventive therapy if person does not have TB C.DE162 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Malaria prevention such as bed nets and prophylaxis, depending on epidemiology C.DE163 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Malaria prevention such as bed nets and prophylaxis, depending on epidemiology C.DE163 Observation":
  Elements."Malaria prevention such as bed nets and prophylaxis, depending on epidemiology C.DE163 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Other support services C.DE164 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Mental health services C.DE165 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Mental health services C.DE165 Observation":
  Elements."Mental health services C.DE165 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Psychosocial counselling, support and treatment adherence counselling C.DE166 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Psychosocial counselling, support and treatment adherence counselling C.DE166 Observation":
  Elements."Psychosocial counselling, support and treatment adherence counselling C.DE166 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Support for disclosure and partner services C.DE167 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Support for disclosure and partner services C.DE167 Observation":
  Elements."Support for disclosure and partner services C.DE167 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Legal and social services C.DE168 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Legal and social services C.DE168 Observation":
  Elements."Legal and social services C.DE168 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Services for responding to violence against women C.DE169 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Services for responding to violence against women C.DE169 Observation":
  Elements."Services for responding to violence against women C.DE169 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Services for responding to violence against women C.DE169 */

/*
@dataElement: HIV.D.DE1 - Reason for visit
@activity: HIV.D1 Determine reason for visit
@description: Whether visit was scheduled or unscheduled, clinical only, or for ARV drug pick-up
*/
define "Reason for visit D.DE1":
  Elements."Reason for visit D.DE1" O
    where O.encounter.references(EncounterId)
/* End of Reason for visit D.DE1 */

/*
@dataElement: HIV.D.DE9 - Body temperature
@activity: HIV.D2 Take vital signs
@description: Temperature of the client in Celsius
*/
// TODO: Replace placeholder with relevant CQL logic
define "Body temperature":
  Elements."Body temperature" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
define "Body temperature Value":
  "Body temperature" O
  return O.value
/* End of Body temperature */

/*
@dataElement: HIV.D.DE13 - Body weight
@activity: HIV.D2 Take vital signs
@description: The client's current weight in kilograms
*/
// TODO: Replace placeholder with relevant CQL logic
define "Body weight":
  Elements."Body weight" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
define "Body weight Value":
  "Body weight" O
  return O.value
/* End of Body weight */

/*
@dataElement: HIV.D.DE17 - Signs of serious illness
@activity: HIV.D3 Check for signs of serious illness
@description: Signs that may indicate the client has a serious illness and needs triage or an emergency referral
*/
define "Signs of serious illness":
  exists "Signs of serious illness Observation"
define "Signs of serious illness Observation":
  Elements."Signs of serious illness Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Fever of 39 C or greater Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Fever of 39 C or greater Observation":
  Elements."Fever of 39 C or greater Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Tachycardia Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Tachycardia Observation":
  Elements."Tachycardia Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Tachypnea Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Tachypnea Observation":
  Elements."Tachypnea Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Unable to walk unaided Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Unable to walk unaided Observation":
  Elements."Unable to walk unaided Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Lethargy D.DE22 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Lethargy D.DE22 Observation":
  Elements."Lethargy D.DE22 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Unconsciousness Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Unconsciousness Observation":
  Elements."Unconsciousness Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Convulsions Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Convulsions Observation":
  Elements."Convulsions Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Unable to drink Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Unable to drink Observation":
  Elements."Unable to drink Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Unable to breastfeed Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Unable to breastfeed Observation":
  Elements."Unable to breastfeed Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Repeated vomiting Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Repeated vomiting Observation":
  Elements."Repeated vomiting Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Headache D.DE28 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Headache D.DE28 Observation":
  Elements."Headache D.DE28 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Other sign of serious illness Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Other sign of serious illness Observation":
  Elements."Other sign of serious illness Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Currently pregnant D.DE31 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Currently pregnant D.DE31 */

/*
@dataElement: HIV.D.DE37 - Serodiscordant partner
@activity: HIV.D8 Capture or update client history
@description: Client's HIV status is different from a current partner's HIV status
*/
// TODO: Replace placeholder with relevant CQL logic
define "Serodiscordant partner D.DE37":
  exists "Serodiscordant partner D.DE37 Observation"
define "Serodiscordant partner D.DE37 Observation":
  Elements."Serodiscordant partner D.DE37 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Serodiscordant partner D.DE37 */

/*
@dataElement: HIV.D.DE38 - On ART
@activity: HIV.D8 Capture or update client history
@description: Client is currently taking ART
*/
define "On ART D.DE38":
  Elements."On ART D.DE38" MS
    where MS.context.references(EncounterId)
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
@dataElement: HIV.D.DE42 - Established on ART
@activity: HIV.D8 Capture or update client history
@description: Is the client successfully established on ART?
*/
// TODO: Replace placeholder with relevant CQL logic
define "Established on ART":
  exists "Established on ART Observation"
define "Established on ART Observation":
  Elements."Established on ART Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Established on ART */

/*
@dataElement: HIV.D.DE43 - ART start type
@activity: HIV.D8 Capture or update client history
@description: Whether the client is ART naive or is restarting ART
*/
define "ART start type":
  Elements."ART start type" MS
      where MS.effective.toInterval() starts on or before Today
      or MS.context.references(EncounterId)
/* End of ART start type */

/*
@dataElement: HIV.D.DE44 - First-time user of ART
@activity: HIV.D8 Capture or update client history
@description: Client is ART naive, having never taken ART to treat HIV before
*/
define "First-time user of ART":
  Elements."First-time user of ART" MS
      where MS.effective.toInterval() starts on or before Today
      or MS.context.references(EncounterId)
/* End of First-time user of ART */

/*
@dataElement: HIV.D.DE45 - Restarting ART
@activity: HIV.D8 Capture or update client history
@description: Client is restarting ART after stopping treatment for any reason
*/
define "Restarting ART":
  Elements."Restarting ART" MS
      where MS.effective.toInterval() starts on or before Today
      or MS.context.references(EncounterId)
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
  Elements."Current ART regimen Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Current ART regimen */

/*
@dataElement: HIV.D.DE77 - Preferred first-line ART regimen
@activity: HIV.D8 Capture or update client history
@description: The preferred first-line ART regimen for the client according to WHO (or national) guidelines
*/
// TODO: Replace placeholder with relevant CQL logic
define "Preferred first-line ART regimen":
  Elements."Preferred first-line ART regimen" MS
    where MS.effective.toInterval() starts on or before Today
    or MS.context.references(EncounterId)
/* End of Preferred first-line ART regimen */

/*
@dataElement: HIV.D.DE78 - Alternative first-line ART regimen
@activity: HIV.D8 Capture or update client history
@description: The alternative first-line ART regimen for the client according to WHO (or national) guidelines
*/
// TODO: Replace placeholder with relevant CQL logic
define "Alternative first-line ART regimen":
  Elements."Alternative first-line ART regimen" MS
    where MS.effective.toInterval() starts on or before Today
    or MS.context.references(EncounterId)
/* End of Alternative first-line ART regimen */

/*
@dataElement: HIV.D.DE79 - First-line ART regimen under special circumstances
@activity: HIV.D8 Capture or update client history
@description: The first-line ART regimen for the client under special circumstances according to WHO (or national) guidelines
*/
// TODO: Replace placeholder with relevant CQL logic
define "First-line ART regimen under special circumstances":
  Elements."First-line ART regimen under special circumstances" MS
    where MS.effective.toInterval() starts on or before Today
    or MS.context.references(EncounterId)
/* End of First-line ART regimen under special circumstances */

/*
@dataElement: HIV.D.DE80 - Preferred second-line ART regimen
@activity: HIV.D8 Capture or update client history
@description: The preferred second-line ART regimen for the client according to WHO (or national) guidelines
*/
define "Preferred second-line ART regimen":
  Elements."Preferred second-line ART regimen" MS
    where MS.effective.toInterval() starts on or before Today
    or MS.context.references(EncounterId)
/* End of Preferred second-line ART regimen */

/*
@dataElement: HIV.D.DE81 - Alternative second-line ART regimen
@activity: HIV.D8 Capture or update client history
@description: The alternative second-line ART regimen for the client according to WHO (or national) guidelines
*/
define "Alternative second-line ART regimen":
  Elements."Alternative second-line ART regimen" MS
    where MS.effective.toInterval() starts on or before Today
    or MS.context.references(EncounterId)
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
  Elements."Optimal regimen for transition Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Current ART regimen first-, second-, or third-line Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."First-line ART regimen for adults and adolescents Condition" C
    where C.prevalenceInterval() starts on or before Today
define "First-line ART regimen for adults and adolescents Observation":
  Elements."First-line ART regimen for adults and adolescents Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."First-line ART regimen for children Condition" C
    where C.prevalenceInterval() starts on or before Today
define "First-line ART regimen for children Observation":
  Elements."First-line ART regimen for children Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."First-line ART regimen for neonates Condition" C
    where C.prevalenceInterval() starts on or before Today
define "First-line ART regimen for neonates Observation":
  Elements."First-line ART regimen for neonates Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Second-line ART regimen for adults and adolescents Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Second-line ART regimen for adults and adolescents Observation":
  Elements."Second-line ART regimen for adults and adolescents Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Second-line ART regimen for children Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Second-line ART regimen for children Observation":
  Elements."Second-line ART regimen for children Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Third-line ART regimen Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Third-line ART regimen Observation":
  Elements."Third-line ART regimen Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."ART regimen composition Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."ABC Condition" C
    where C.prevalenceInterval() starts on or before Today
define "ABC Observation":
  Elements."ABC Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."FTC Condition" C
    where C.prevalenceInterval() starts on or before Today
define "FTC Observation":
  Elements."FTC Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."3TC Condition" C
    where C.prevalenceInterval() starts on or before Today
define "3TC Observation":
  Elements."3TC Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."AZT Condition" C
    where C.prevalenceInterval() starts on or before Today
define "AZT Observation":
  Elements."AZT Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."DDI Condition" C
    where C.prevalenceInterval() starts on or before Today
define "DDI Observation":
  Elements."DDI Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."D4T Condition" C
    where C.prevalenceInterval() starts on or before Today
define "D4T Observation":
  Elements."D4T Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."TDF D.DE135 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "TDF D.DE135 Observation":
  Elements."TDF D.DE135 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."EFV Condition" C
    where C.prevalenceInterval() starts on or before Today
define "EFV Observation":
  Elements."EFV Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."ETV Condition" C
    where C.prevalenceInterval() starts on or before Today
define "ETV Observation":
  Elements."ETV Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."NVP Condition" C
    where C.prevalenceInterval() starts on or before Today
define "NVP Observation":
  Elements."NVP Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."RIL Condition" C
    where C.prevalenceInterval() starts on or before Today
define "RIL Observation":
  Elements."RIL Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."ATV/r D.DE140 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "ATV/r D.DE140 Observation":
  Elements."ATV/r D.DE140 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."LPV/r D.DE141 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "LPV/r D.DE141 Observation":
  Elements."LPV/r D.DE141 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."DRV/r D.DE142 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "DRV/r D.DE142 Observation":
  Elements."DRV/r D.DE142 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."RTV Condition" C
    where C.prevalenceInterval() starts on or before Today
define "RTV Observation":
  Elements."RTV Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."DTG D.DE144 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "DTG D.DE144 Observation":
  Elements."DTG D.DE144 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."RAL D.DE145 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "RAL D.DE145 Observation":
  Elements."RAL D.DE145 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Prevention services offered and referrals D.DE152 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Offer male and female condoms and condom-compatible lubricants D.DE153 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Offer male and female condoms and condom-compatible lubricants D.DE153 Observation":
  Elements."Offer male and female condoms and condom-compatible lubricants D.DE153 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Harm reduction for people who inject drugs D.DE154 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Harm reduction for people who inject drugs D.DE154 Observation":
  Elements."Harm reduction for people who inject drugs D.DE154 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Behavioural interventions to support risk reduction D.DE155 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Behavioural interventions to support risk reduction D.DE155 Observation":
  Elements."Behavioural interventions to support risk reduction D.DE155 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Sexual and reproductive health integrated services D.DE156 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Contraception and family planning D.DE157 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Contraception and family planning D.DE157 Observation":
  Elements."Contraception and family planning D.DE157 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Check pregnancy status D.DE158 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Check pregnancy status D.DE158 Observation":
  Elements."Check pregnancy status D.DE158 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Prevention of mother-to-child transmission Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Prevention of mother-to-child transmission Observation":
  Elements."Prevention of mother-to-child transmission Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."STI testing and treatment D.DE160 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "STI testing and treatment D.DE160 Observation":
  Elements."STI testing and treatment D.DE160 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of STI testing and treatment D.DE160 */

/*
@dataElement: HIV.D.DE162 - HBsAg test result
@activity: HIV.D12 Determine recommended screenings and tests
@description: Hepatitis B virus test result (HBsAg)
*/
define "HBsAg test result D.DE162":
  Elements."HBsAg test result D.DE162" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of HBsAg test result D.DE162 */

/*
@dataElement: HIV.D.DE163 - Positive
@activity: HIV.D12 Determine recommended screenings and tests
@description: HBsAg test result was positive
*/
define "Positive D.DE163":
  Elements."Positive D.DE163" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Positive D.DE163 */

/*
@dataElement: HIV.D.DE164 - Negative
@activity: HIV.D12 Determine recommended screenings and tests
@description: HBsAg test result was negative
*/
define "Negative D.DE164":
  Elements."Negative D.DE164" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Negative D.DE164 */

/*
@dataElement: HIV.D.DE165 - Indeterminate
@activity: HIV.D12 Determine recommended screenings and tests
@description: HBsAg test result was indeterminate
*/
define "Indeterminate D.DE165":
  Elements."Indeterminate D.DE165" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Indeterminate D.DE165 */

/*
@dataElement: HIV.D.DE170 - HCV test result
@activity: HIV.D12 Determine recommended screenings and tests
@description: Hepatitis C virus test result (HCV antibody, HCV RNA or HCV core antigen)
*/
define "HCV test result D.DE170":
  Elements."HCV test result D.DE170" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of HCV test result D.DE170 */

/*
@dataElement: HIV.D.DE171 - Positive
@activity: HIV.D12 Determine recommended screenings and tests
@description: HCV test result was positive
*/
define "Positive D.DE171 Observation":
  Elements."Positive D.DE171" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Positive D.DE171 */

/*
@dataElement: HIV.D.DE172 - Negative
@activity: HIV.D12 Determine recommended screenings and tests
@description: HCV test result was negative
*/
define "Negative D.DE172":
  Elements."Negative D.DE172" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Negative D.DE172 */

/*
@dataElement: HIV.D.DE173 - Indeterminate
@activity: HIV.D12 Determine recommended screenings and tests
@description: HCV test result was indeterminate
*/
define "Indeterminate D.DE173":
  Elements."Indeterminate D.DE173" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Indeterminate D.DE173 */

/*
@dataElement: HIV.D.DE186 - HIV clinical stage
@activity: HIV.D8 Capture or update client history
@description: WHO clinical stage of client based on signs and symptoms. WHO clinical staging is a way to categorize HIV disease severity based on new or recurrent clinical events. There are 4 WHO clinical stages that range from mild symptoms (WHO clinical stage 1) to severe symptoms (WHO clinical stage 4).
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV clinical stage D.DE186":
  exists "HIV clinical stage D.DE186 Observation"
define "HIV clinical stage D.DE186 Observation":
  Elements."HIV clinical stage D.DE186 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."WHO HIV clinical stage 1 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "WHO HIV clinical stage 1 Observation":
  Elements."WHO HIV clinical stage 1 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."WHO HIV clinical stage 2 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "WHO HIV clinical stage 2 Observation":
  Elements."WHO HIV clinical stage 2 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."WHO HIV clinical stage 3 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "WHO HIV clinical stage 3 Observation":
  Elements."WHO HIV clinical stage 3 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."WHO HIV clinical stage 4 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "WHO HIV clinical stage 4 Observation":
  Elements."WHO HIV clinical stage 4 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of WHO HIV clinical stage 4 */

/*
@dataElement: HIV.D.DE194 - Date of viral load sample collection
@activity: HIV.D10 Counsel returning client
@description: Date and time when the sample was collected to test the client's HIV viral load
*/
// TODO: Replace placeholder with relevant CQL logic
define "Date of viral load sample collection D.DE194":
  Elements."Date of viral load sample collection D.DE194" P
    where P.encounter.references(EncounterId)
      or P.performed.toInterval() starts on or before Today
/* End of Date of viral load sample collection D.DE194 */

/*
@dataElement: HIV.D.DE195 - Date of scheduled review of viral load test results
@activity: HIV.D10 Counsel returning client
@description: Expected date when client's viral load test results will be returned and reviewed
*/
// TODO: Replace placeholder with relevant CQL logic
define "Date of scheduled review of viral load test results":
  Elements."Date of scheduled review of viral load test results" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
define "Date of scheduled review of viral load test results Value":
  "Date of scheduled review of viral load test results" O
  return O.value
/* End of Date of scheduled review of viral load test results */

/*
@dataElement: HIV.D.DE225 - Treatment failure
@activity: HIV.D17 Check for signs of treatment failure
@description: ART treatment failure
*/
// TODO: Replace placeholder with relevant CQL logic
define "Treatment failure":
  exists "Treatment failure Observation"
define "Treatment failure Observation":
  Elements."Treatment failure Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Clinical failure Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Clinical failure Observation":
  Elements."Clinical failure Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Immunological failure Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Immunological failure Observation":
  Elements."Immunological failure Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Virological failure Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Virological failure Observation":
  Elements."Virological failure Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Risk factors, comorbidities and coinfections signs and symptoms Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
    where C.prevalenceInterval() starts on or before Today
define "Presumptive TB D.DE282 Observation":
  Elements."Presumptive TB D.DE282 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Presumptive TB D.DE282 */

/*
@dataElement: HIV.D.DE289 - WHO HIV clinical stage condition or symptom
@activity: HIV.D15 Determine clinical stage of HIV
@description: New or recurrent clinical events used to categorize HIV disease severity based at baseline and follow up
*/
define "WHO HIV clinical stage condition or symptom D.DE289 Observation":
  Elements."WHO HIV clinical stage condition or symptom D.DE289 Observation" O
    where O.encounter.references(EncounterId)
/* End of WHO HIV clinical stage condition or symptom D.DE289 */

/*
@dataElement: HIV.D.DE364 - CD4 count
@activity: HIV.D20 Diagnostics
@description: CD4 cell count in cells/mm^3
*/
define "CD4 count D.DE364":
  Elements."CD4 count D.DE364" O
    where O.encounter.references(EncounterId)
/* End of CD4 count D.DE364 */

/*
@dataElement: HIV.D.DE387 - Viral load test result
@activity: HIV.D20 Diagnostics
@description: Result from the viral load test in number of copies/mL
*/
// TODO: Replace placeholder with relevant CQL logic
define "Viral load test result D.DE387":
  Elements."Viral load test result D.DE387" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
define "Viral load test result D.DE387 Value":
  "Viral load test result D.DE387" O
  return O.value
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
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
    where C.prevalenceInterval() starts on or before Today
define "Routine viral load test Observation":
  Elements."Routine viral load test Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
    where C.prevalenceInterval() starts on or before Today
define "Targeted viral load monitoring Observation":
  Elements."Targeted viral load monitoring Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
    where C.prevalenceInterval() starts on or before Today
define "Initial viral load test Observation":
  Elements."Initial viral load test Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
    where C.prevalenceInterval() starts on or before Today
define "Follow-up viral load test after receiving enhanced adherence counselling Observation":
  Elements."Follow-up viral load test after receiving enhanced adherence counselling Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Monitoring examinations Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Haemoglobin Hb Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Haemoglobin Hb Observation":
  Elements."Haemoglobin Hb Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Pregnancy test Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Pregnancy test Observation":
  Elements."Pregnancy test Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Syphilis test Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Syphilis test Observation":
  Elements."Syphilis test Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Chest X-ray CXR Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Chest X-ray CXR Observation":
  Elements."Chest X-ray CXR Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Sputum or culture for TB Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Sputum or culture for TB Observation":
  Elements."Sputum or culture for TB Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."HBsAg test HBV Condition" C
    where C.prevalenceInterval() starts on or before Today
define "HBsAg test HBV Observation":
  Elements."HBsAg test HBV Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."HIV viral load test ordered Condition" C
    where C.prevalenceInterval() starts on or before Today
define "HIV viral load test ordered Observation":
  Elements."HIV viral load test ordered Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."HIV viral load test scheduled Condition" C
    where C.prevalenceInterval() starts on or before Today
define "HIV viral load test scheduled Observation":
  Elements."HIV viral load test scheduled Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."CD4 count ordered Condition" C
    where C.prevalenceInterval() starts on or before Today
define "CD4 count ordered Observation":
  Elements."CD4 count ordered Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."CD4 count test scheduled Condition" C
    where C.prevalenceInterval() starts on or before Today
define "CD4 count test scheduled Observation":
  Elements."CD4 count test scheduled Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Cryptococcal antigen test Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Cryptococcal antigen test Observation":
  Elements."Cryptococcal antigen test Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Histoplasmosis antigen test Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Histoplasmosis antigen test Observation":
  Elements."Histoplasmosis antigen test Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Cervical cancer screening scheduled Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Cervical cancer screening scheduled Observation":
  Elements."Cervical cancer screening scheduled Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Cervical cancer screening scheduled */

/*
@dataElement: HIV.D.DE413 - Date of scheduled monitoring examination
@activity: HIV.D28 Offer other services
@description: Date of scheduled monitoring examination
*/
// TODO: Replace placeholder with relevant CQL logic
define "Date of scheduled monitoring examination":
  Elements."Date of scheduled monitoring examination" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
define "Date of scheduled monitoring examination Value":
  "Date of scheduled monitoring examination" O
  return O.value
/* End of Date of scheduled monitoring examination */

/*
@dataElement: HIV.D.DE427 - Switch to second-line ART regimen recommended
@activity: HIV.D21 Determine regimen and treatment options
@description: A switch to second-line ART regimen is recommended
*/
// TODO: Replace placeholder with relevant CQL logic
define "Switch to second-line ART regimen recommended":
  exists "Switch to second-line ART regimen recommended Observation"
define "Switch to second-line ART regimen recommended Observation":
  Elements."Switch to second-line ART regimen recommended Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Regimen substitution recommended Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Dose adjustment recommended Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Dose adjustment recommended */

/*
@dataElement: HIV.D.DE443 - Suspicion of treatment failure or interruption
@activity: HIV.D23 Prescribe
@description: Client has been on ART, but has stopped taking it or a treatment failure is suspected
*/
define "Suspicion of treatment failure or interruption Observation":
  Elements."Suspicion of treatment failure or interruption Observation" O
    where O.encounter.references(EncounterId)
/* End of Suspicion of treatment failure or interruption */

/*
@dataElement: HIV.D.DE465 - Adherence counselling provided
@activity: HIV.D24 Counsel
@description: Counselling was carried out during visit
*/
// TODO: Replace placeholder with relevant CQL logic
define "Adherence counselling provided D.DE465":
  exists "Adherence counselling provided D.DE465 Observation"
define "Adherence counselling provided D.DE465 Observation":
  Elements."Adherence counselling provided D.DE465 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Adherence counselling provided D.DE465 */

/*
@dataElement: HIV.D.DE496 - Enhanced adherence counselling provided
@activity: HIV.D24 Counsel
@description: Enhanced adherence counselling was provided to the client during the visit
*/
// TODO: Replace placeholder with relevant CQL logic
define "Enhanced adherence counselling provided":
  exists "Enhanced adherence counselling provided Observation"
define "Enhanced adherence counselling provided Observation":
  Elements."Enhanced adherence counselling provided" C
    where C.encounter.references(EncounterId)
      or C.sent.toInterval() starts on or before Today
      or C.received.toInterval() starts on or before Today
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
  Elements."Counselling provided on diagnoses Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Syphilis counselling and treatment Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Other support services D.DE519 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Mental health services D.DE520 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Mental health services D.DE520 Observation":
  Elements."Mental health services D.DE520 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Psychosocial counselling, support and treatment adherence counselling D.DE521 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Psychosocial counselling, support and treatment adherence counselling D.DE521 Observation":
  Elements."Psychosocial counselling, support and treatment adherence counselling D.DE521 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Legal and social services D.DE522 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Legal and social services D.DE522 Observation":
  Elements."Legal and social services D.DE522 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Services for responding to violence against women D.DE523 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Services for responding to violence against women D.DE523 Observation":
  Elements."Services for responding to violence against women D.DE523 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Services for responding to violence against women D.DE523 */

/*
@dataElement: HIV.D.DE524 - Date/time of follow-up appointment
@activity: HIV.D29 Schedule follow-up
@description: Date the client is to return for monitoring, re-supply or any other reason
*/
// TODO: Replace placeholder with relevant CQL logic
define "Date/time of follow-up appointment D.DE524":
  Elements."Date/time of follow-up appointment D.DE524" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
define "Date/time of follow-up appointment D.DE524 Value":
  "Date/time of follow-up appointment D.DE524" O
  return O.value
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
  Elements."Type of follow-up appointment D.DE525 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Clinical visit D.DE526 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Clinical visit D.DE526 Observation":
  Elements."Clinical visit D.DE526 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Antiretroviral drug pick up Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Antiretroviral drug pick up Observation":
  Elements."Antiretroviral drug pick up Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Post-treatment follow-up visit for cervical precancer lesions or invasive cervical cancer D.DE528 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Post-treatment follow-up visit for cervical precancer lesions or invasive cervical cancer D.DE528 Observation":
  Elements."Post-treatment follow-up visit for cervical precancer lesions or invasive cervical cancer D.DE528 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Other D.DE529 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Other D.DE529 Observation":
  Elements."Other D.DE529 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Other D.DE529 */

/*
@dataElement: HIV.D.DE531 - Follow-up test recommended date
@activity: HIV.D29 Schedule follow-up
@description: A test or screening recommended for the client's care plan at a future date
*/
// TODO: Replace placeholder with relevant CQL logic
define "Follow-up test recommended date":
  Elements."Follow-up test recommended date" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
define "Follow-up test recommended date Value":
  "Follow-up test recommended date" O
  return O.value
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
  Elements."Current medications Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."No medications Condition" C
    where C.prevalenceInterval() starts on or before Today
define "No medications Observation":
  Elements."No medications Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Dont know of any current medications Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Dont know of any current medications Observation":
  Elements."Dont know of any current medications Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Analgesic Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Analgesic Observation":
  Elements."Analgesic Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Antacids Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Antacids Observation":
  Elements."Antacids Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Antibiotics broad-spectrum Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Antibiotics broad-spectrum Observation":
  Elements."Antibiotics broad-spectrum Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Anticonvulsive Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Anticonvulsive Observation":
  Elements."Anticonvulsive Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Antidiabetic Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Antidiabetic Observation":
  Elements."Antidiabetic Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Antifungals Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Antifungals Observation":
  Elements."Antifungals Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Antihelmintic Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Antihelmintic Observation":
  Elements."Antihelmintic Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Antihypertensive Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Antihypertensive Observation":
  Elements."Antihypertensive Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Antimalarials Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Antimalarials Observation":
  Elements."Antimalarials Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Antiretrovirals ARVs Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Antiretrovirals ARVs Observation":
  Elements."Antiretrovirals ARVs Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Antiparasitics Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Antiparasitics Observation":
  Elements."Antiparasitics Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Antivirals Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Antivirals Observation":
  Elements."Antivirals Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Antivirals */

/*
@dataElement: HIV.D.DE552 - Buprenorphine
@activity: HIV.D8 Capture or update client history
@description: Opioid substitution to treat opioid dependence
*/
// TODO: Replace placeholder with relevant CQL logic
define "Buprenorphine D.DE552":
  Elements."Buprenorphine D.DE552" MR
    where MR.authoredOn.toInterval() starts on or before Today
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
  Elements."Co-trimoxazole preventive therapy CPT Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Co-trimoxazole preventive therapy CPT Observation":
  Elements."Co-trimoxazole preventive therapy CPT Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Hormonal family planning method Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Hormonal family planning method Observation":
  Elements."Hormonal family planning method Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Hormonal family planning method */

/*
@dataElement: HIV.D.DE555 - Methadone
@activity: HIV.D8 Capture or update client history
@description: Opioid substitution to treat opioid dependence
*/
define "Methadone D.DE555":
  Elements."Methadone D.DE555" MR
    where MR.authoredOn.toInterval() starts on or before Today
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
  Elements."PrEP to prevent HIV Condition" C
    where C.prevalenceInterval() starts on or before Today
define "PrEP to prevent HIV Observation":
  Elements."PrEP to prevent HIV Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Other antibiotics Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Other antibiotics Observation":
  Elements."Other antibiotics Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Other medications Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Other medications Observation":
  Elements."Other medications Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Other medications */

/*
@dataElement: HIV.D.DE656 - Date of cervical cancer screening test
@activity: HIV.D28 Offer other services
@description: Date of cervical cancer screening test
*/
define "Date of cervical cancer screening test":
  Elements."Cervical cancer primary screening test" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
    return O.effective.toInterval().low
/* End of Date of cervical cancer screening test */

/*
@dataElement: HIV.D.DE657 - Lifetime screening test number
@activity: HIV.D28 Offer other services
@description: Client's lifetime number of screenings for cervical cancer
*/
// TODO: Replace placeholder with relevant CQL logic
define "Lifetime screening test number":
  Elements."Lifetime screening test number" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
define "Lifetime screening test number Value":
  "Lifetime screening test number" O
  return O.value
/* End of Lifetime screening test number */

/*
@dataElement: HIV.D.DE658 - Cervical cancer primary screening test type
@activity: HIV.D28 Offer other services
@description: Type of cervical cancer screening test used in primary screening
*/
// TODO: Replace placeholder with relevant CQL logic
define "Cervical cancer primary screening test":
  exists "Cervical cancer primary screening test type Observation"
define "Cervical cancer primary screening test type Observation":
  Elements."Cervical cancer primary screening test" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Cervical cancer primary screening test type */

/*
@dataElement: HIV.D.DE659 - HPV-DNA
@activity: HIV.D28 Offer other services
@description: Screened for cervical cancer using HPV-DNA test
*/
define "HPV-DNA":
  Elements."HPV-DNA" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of HPV-DNA */

/*
@dataElement: HIV.D.DE660 - VIA
@activity: HIV.D28 Offer other services
@description: Screened for cervical cancer using visual inspection with acetic acid (VIA)
*/
define "VIA":
  Elements."VIA" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of VIA */

/*
@dataElement: HIV.D.DE661 - Cervical cytology
@activity: HIV.D28 Offer other services
@description: Screened for cervical cancer using cervical cytology
*/
define "Cervical cytology":
  Elements."Cervical cytology" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Cervical cytology */

/*
@dataElement: HIV.D.DE662 - Other
@activity: HIV.D28 Offer other services
@description: Screened for cervical cancer using other method
*/
define "Other D.DE662":
  Elements."Other D.DE662" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Other D.DE662 */

/*
@dataElement: HIV.D.DE745 - Cervical cancer screening interval amongst WLHIV
@activity: HIV.D28 Offer other services
@description: Country-specific interval between cancer screenings amongst women living with HIV (typically 3 or 5 years)
*/
// TODO: Replace placeholder with relevant CQL logic
define "Cervical cancer screening interval amongst WLHIV":
  Elements."Cervical cancer screening interval amongst WLHIV" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
define "Cervical cancer screening interval amongst WLHIV Value":
  "Cervical cancer screening interval amongst WLHIV" O
  return O.value
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
  Elements."Offer other clinical services D.DE753 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Assessment and provision of vaccinations D.DE754 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Assessment and provision of vaccinations D.DE754 Observation":
  Elements."Assessment and provision of vaccinations D.DE754 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Hepatitis B HBV and hepatitis C virus HCV testing and treatment Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Hepatitis B HBV and hepatitis C virus HCV testing and treatment Observation":
  Elements."Hepatitis B HBV and hepatitis C virus HCV testing and treatment Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Co-trimoxazole chemoprophylaxis to prevent pneumocystis carinii pneumonia D.DE756 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Co-trimoxazole chemoprophylaxis to prevent pneumocystis carinii pneumonia D.DE756 Observation":
  Elements."Co-trimoxazole chemoprophylaxis to prevent pneumocystis carinii pneumonia D.DE756 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Intensified TB case finding and linkage to TB treatment D.DE757 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Intensified TB case finding and linkage to TB treatment D.DE757 Observation":
  Elements."Intensified TB case finding and linkage to TB treatment D.DE757 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Provision of isoniazid preventive therapy if person does not have TB D.DE758 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Provision of isoniazid preventive therapy if person does not have TB D.DE758 Observation":
  Elements."Provision of isoniazid preventive therapy if person does not have TB D.DE758 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Malaria prevention such as bed nets and prophylaxis, depending on epidemiology D.DE759 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Malaria prevention such as bed nets and prophylaxis, depending on epidemiology D.DE759 Observation":
  Elements."Malaria prevention such as bed nets and prophylaxis, depending on epidemiology D.DE759 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Malaria prevention such as bed nets and prophylaxis, depending on epidemiology D.DE759 */

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
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
    where C.prevalenceInterval() starts on or before Today
define "Positive D.DE803 Observation":
  Elements."Positive D.DE803 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
    where C.prevalenceInterval() starts on or before Today
define "Negative D.DE804 Observation":
  Elements."Negative D.DE804 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
    where C.prevalenceInterval() starts on or before Today
define "Inconclusive D.DE805 Observation":
  Elements."Inconclusive D.DE805 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Inconclusive D.DE805 */

/*
@dataElement: HIV.D.DE903 - Medication/drug
@activity: HIV.D21 Determine regimen and treatment options
@description: Current or considered medication/drug, for the purpose of determining drug interactions
*/
// TODO: Replace placeholder with relevant CQL logic
define "Medication/drug":
  exists "Medication/drug Observation"
define "Medication/drug Observation":
  Elements."Medication/drug Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Rifampicin Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Rifampicin Observation":
  Elements."Rifampicin Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Halofantrine Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Halofantrine Observation":
  Elements."Halofantrine Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Lovastatin Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Lovastatin Observation":
  Elements."Lovastatin Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Simvastatin Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Simvastatin Observation":
  Elements."Simvastatin Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Hormonal contraception Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Hormonal contraception Observation":
  Elements."Hormonal contraception Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Metformin Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Metformin Observation":
  Elements."Metformin Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Astemizole Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Astemizole Observation":
  Elements."Astemizole Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Terfenadine Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Terfenadine Observation":
  Elements."Terfenadine Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Terfenadine */

/*
@dataElement: HIV.D.DE912 - TDF
@activity: HIV.D21 Determine regimen and treatment options
@description: TDF currently being taken by, or considered for, client
*/
define "TDF D.DE912":
  Elements."TDF D.DE912" MS
    where MS.effective.toInterval() starts on or before Today
    or MS.context.references(EncounterId)
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
  Elements."Simeprevir Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Simeprevir Observation":
  Elements."Simeprevir Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Ombitasvir + paritaprevir/ritonavir + dasabuvir Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Ombitasvir + paritaprevir/ritonavir + dasabuvir Observation":
  Elements."Ombitasvir + paritaprevir/ritonavir + dasabuvir Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Methadone D.DE915 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Methadone D.DE915 Observation":
  Elements."Methadone D.DE915 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Buprenorphine D.DE916 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Buprenorphine D.DE916 Observation":
  Elements."Buprenorphine D.DE916 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Dofetilide Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Dofetilide Observation":
  Elements."Dofetilide Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Carbamazepine Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Carbamazepine Observation":
  Elements."Carbamazepine Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Phenobarbital Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Phenobarbital Observation":
  Elements."Phenobarbital Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Phenytoin Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Phenytoin Observation":
  Elements."Phenytoin Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Polyvalent cation products containing Mg, Al, Fe, Ca and Zn Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Polyvalent cation products containing Mg, Al, Fe, Ca and Zn Observation":
  Elements."Polyvalent cation products containing Mg, Al, Fe, Ca and Zn Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Amodiaquine Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Amodiaquine Observation":
  Elements."Amodiaquine Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Cisapride Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Cisapride Observation":
  Elements."Cisapride Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Ergotamine Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Ergotamine Observation":
  Elements."Ergotamine Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Dihydroergotamine Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Dihydroergotamine Observation":
  Elements."Dihydroergotamine Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Midazolam Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Midazolam Observation":
  Elements."Midazolam Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Triazolam Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Triazolam Observation":
  Elements."Triazolam Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Estrogen-based hormonal contraception Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Estrogen-based hormonal contraception Observation":
  Elements."Estrogen-based hormonal contraception Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Ribavirin Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Ribavirin Observation":
  Elements."Ribavirin Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Peginterferon alfa-2a Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Peginterferon alfa-2a Observation":
  Elements."Peginterferon alfa-2a Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Other D.DE931 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Other D.DE931 Observation":
  Elements."Other D.DE931 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Medication change recommended Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."WHO HIV clinical stage condition or symptom D.DE934 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Pulmonary TB D.DE935 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Pulmonary TB D.DE935 Observation":
  Elements."Pulmonary TB D.DE935 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Lymph node TB D.DE936 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Lymph node TB D.DE936 Observation":
  Elements."Lymph node TB D.DE936 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Extrapulmonary TB D.DE937 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Extrapulmonary TB D.DE937 Observation":
  Elements."Extrapulmonary TB D.DE937 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Extrapulmonary TB D.DE937 */

/*
@dataElement: HIV.D.DE939 - TB diagnosis result
@activity: HIV.D8 Capture or update client history
@description: Final result of the TB investigation (bacteriological and/or clinical)
*/
define "TB diagnosis result":
  Elements."TB diagnosis result" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of TB diagnosis result */

/*
@dataElement: HIV.D.DE940 - Diagnosed TB
@activity: HIV.D8 Capture or update client history
@description: Client is diagnosed with TB disease
*/
// TODO: Replace placeholder with relevant CQL logic
define "Diagnosed TB":
  Elements."Diagnosed TB" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Diagnosed TB */

/*
@dataElement: HIV.D.DE941 - TB excluded
@activity: HIV.D8 Capture or update client history
@description: Client is not diagnosed with TB
*/
define "TB excluded":
  Elements."TB excluded" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of TB excluded */

/*
@dataElement: HIV.D.DE945 - Presumptive TB
@activity: HIV.D8 Capture or update client history
@description: Client has signs or symptoms of tuberculosis (TB) without laboratory confirmation
*/
define "Presumptive TB D.DE945":
  Elements."Presumptive TB D.DE945" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Presumptive TB D.DE945 */

/*
@dataElement: HIV.D.DE956 - TB screening algorithm
@activity: HIV.D4 Screen for TB
@description: Screening algorithm selected for screening activities
*/
define "TB screening algorithm Observation":
  Elements."TB screening algorithm Observation" O
    where O.encounter.references(EncounterId)
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
  Elements."Screening with cough Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Screening with cough Observation":
  Elements."Screening with cough Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Screening with any TB symptom Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Screening with any TB symptom Observation":
  Elements."Screening with any TB symptom Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."W4SS single screening algorithm Condition" C
    where C.prevalenceInterval() starts on or before Today
define "W4SS single screening algorithm Observation":
  Elements."W4SS single screening algorithm Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."CRP single screening algorithm Condition" C
    where C.prevalenceInterval() starts on or before Today
define "CRP single screening algorithm Observation":
  Elements."CRP single screening algorithm Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."CXR single screening algorithm Condition" C
    where C.prevalenceInterval() starts on or before Today
define "CXR single screening algorithm Observation":
  Elements."CXR single screening algorithm Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Parallel screening algorithm with W4SS and CRP Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Parallel screening algorithm with W4SS and CRP Observation":
  Elements."Parallel screening algorithm with W4SS and CRP Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Sequential positive screening algorithm with W4SS and CRP Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Sequential positive screening algorithm with W4SS and CRP Observation":
  Elements."Sequential positive screening algorithm with W4SS and CRP Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Sequential negative screening algorithm with W4SS and CRP Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Sequential negative screening algorithm with W4SS and CRP Observation":
  Elements."Sequential negative screening algorithm with W4SS and CRP Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Parallel screening algorithm with W4SS and CXR Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Parallel screening algorithm with W4SS and CXR Observation":
  Elements."Parallel screening algorithm with W4SS and CXR Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Sequential positive screening algorithm with W4SS and CXR Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Sequential positive screening algorithm with W4SS and CXR Observation":
  Elements."Sequential positive screening algorithm with W4SS and CXR Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Sequential negative screening algorithm with W4SS and CXR Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Sequential negative screening algorithm with W4SS and CXR Observation":
  Elements."Sequential negative screening algorithm with W4SS and CXR Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Screening with mWRD Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Screening with mWRD Observation":
  Elements."Screening with mWRD Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Clinical assessment Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Clinical assessment Observation":
  Elements."Clinical assessment Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Other TB screening algorithm Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Other TB screening algorithm Observation":
  Elements."Other TB screening algorithm Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Other TB screening algorithm */

/*
@dataElement: HIV.D.DE973 - Symptoms of TB
@activity: HIV.D4 Screen for TB
@description: Symptoms that may indicate TB disease in clients living with HIV, based on a clinical algorithm
*/
define "Symptoms of TB Observation":
  Elements."Symptoms of TB Observation" O
    where O.encounter.references(EncounterId)
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
  Elements."Current cough Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Current cough Observation":
  Elements."Current cough Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Prolonged cough >=2w Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Prolonged cough >=2w Observation":
  Elements."Prolonged cough >=2w Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Fever of 39 °C or greater Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Fever of 39 °C or greater Observation":
  Elements."Fever of 39 °C or greater Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Weight loss reported Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Weight loss reported Observation":
  Elements."Weight loss reported Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Night sweats Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Night sweats Observation":
  Elements."Night sweats Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Poor weight gain Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Poor weight gain Observation":
  Elements."Poor weight gain Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Reduced playfulness Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Reduced playfulness Observation":
  Elements."Reduced playfulness Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Chest pain Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Chest pain Observation":
  Elements."Chest pain Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Haemoptysis Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Haemoptysis Observation":
  Elements."Haemoptysis Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Lethargy D.DE983 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Lethargy D.DE983 Observation":
  Elements."Lethargy D.DE983 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."None Condition" C
    where C.prevalenceInterval() starts on or before Today
define "None Observation":
  Elements."None Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of None */

/*
@dataElement: HIV.D.DE985 - History of contact with a person with TB
@activity: HIV.D4 Screen for TB
@description: Client had a history of a contact with a person with TB
*/
define "History of contact with a person with TB Observation":
  Elements."History of contact with a person with TB Observation" O
    where O.encounter.references(EncounterId)
/* End of History of contact with a person with TB */

/*
@dataElement: HIV.D.DE986 - TB screening result
@activity: HIV.D4 Screen for TB
@description: Record the result of the tuberculosis (TB) screening
*/
define "TB screening result":
  Elements."TB screening result" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of TB screening result */

/*
@dataElement: HIV.D.DE987 - Screen positive for TB
@activity: HIV.D4 Screen for TB
@description: Screening result was positive for tuberculosis (TB)
*/
define "Screen positive for TB":
  Elements."Screen positive for TB" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Screen positive for TB */

/*
@dataElement: HIV.D.DE988 - Screen negative for TB
@activity: HIV.D4 Screen for TB
@description: Screening result was negative for tuberculosis (TB)
*/
define "Screen negative for TB":
  Elements."Screen negative for TB" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Screen negative for TB */

/*
@dataElement: HIV.D.DE989 - Inconclusive
@activity: HIV.D4 Screen for TB
@description: Screening result was inconclusive for tuberculosis (TB)
*/
define "Inconclusive D.DE989":
  Elements."Inconclusive D.DE989" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Inconclusive D.DE989 */

/*
@dataElement: HIV.D.DE1023 - TB prevention services accepted
@activity: HIV.D21 Determine regimen and treatment options
@description: Indicates if the client accepts to be evaluated for TB infection and to take the treatment in case he/she is eligible
*/
// TODO: Replace placeholder with relevant CQL logic
define "TB prevention services accepted":
  exists "TB prevention services accepted Observation"
define "TB prevention services accepted Observation":
  Elements."TB prevention services accepted Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of TB prevention services accepted */

/*
@dataElement: HIV.D.DE1026 - C reactive protein test result
@activity: HIV.D4 Screen for TB
@description: Test result of the client's C reactive protein test result in mg/L
*/
define "C reactive protein test result":
  Elements."C reactive protein test result" O
    where O.encounter.references(EncounterId)
/* End of C reactive protein test result */

/*
@dataElement: HIV.E.DE85 - ANC contact date
@activity: HIV.E1 Capture or update mother's history
@description: The date and time of the client's ANC contact (in the ANC DAK this is called 'Contact date')
*/
define "ANC contact date E.DE85":
  Elements."Antenatal care contact" E
    where E.period.toInterval() starts on or before Today
    or E.partOf.references(EncounterId)
    return E.period

/* End of ANC contact date E.DE85 */

/*
@dataElement: HIV.E.DE113 - Key population member
@activity: HIV.E1 Capture or update mother's history
@description: Mother is a member of a key population which has an increased risk of HIV
*/
// TODO: Replace placeholder with relevant CQL logic
define "Key population member E.DE113":
  exists "Key population member E.DE113 Observation"
define "Key population member E.DE113 Observation":
  Elements."Key population member E.DE113 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Key population member type E.DE114 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Key population member type E.DE114 */

/*
@dataElement: HIV.E.DE115 - Sex worker
@activity: HIV.E1 Capture or update mother's history
@description: Infant's mother is a sex worker
*/
define "Sex worker E.DE115":
  Elements."Sex worker E.DE115" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Sex worker E.DE115 */

/*
@dataElement: HIV.E.DE116 - People who inject drugs
@activity: HIV.E1 Capture or update mother's history
@description: Infant's mother is a person who injects drugs
*/
define "People who inject drugs E.DE116":
  Elements."People who inject drugs E.DE116" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of People who inject drugs E.DE116 */

/*
@dataElement: HIV.E.DE117 - Trans and gender-diverse people
@activity: HIV.E1 Capture or update mother's history
@description: Infant's mother identifies as trans and gender-diverse
*/
// TODO: Replace placeholder with relevant CQL logic
define "Trans and gender-diverse people E.DE117":
  Elements."Trans and gender-diverse people E.DE117" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Trans and gender-diverse people E.DE117 */

/*
@dataElement: HIV.E.DE118 - People living in prisons and other closed setting
@activity: HIV.E1 Capture or update mother's history
@description: Infant's mother is in a prison or closed setting
*/
// TODO: Replace placeholder with relevant CQL logic
define "People living in prisons and other closed setting":
  Elements."People living in prisons and other closed setting" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Signs of substantial risk of HIV infection E.DE155 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."No condom use during sex with more than one partner in the past 6 months E.DE156 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "No condom use during sex with more than one partner in the past 6 months E.DE156 Observation":
  Elements."No condom use during sex with more than one partner in the past 6 months E.DE156 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."STI in the past 6 months E.DE157 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "STI in the past 6 months E.DE157 Observation":
  Elements."STI in the past 6 months E.DE157 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."A sexual partner in the past 6 months had one or more HIV risk factors E.DE158 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "A sexual partner in the past 6 months had one or more HIV risk factors E.DE158 Observation":
  Elements."A sexual partner in the past 6 months had one or more HIV risk factors E.DE158 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."PrEP requested by client E.DE159 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "PrEP requested by client E.DE159 Observation":
  Elements."PrEP requested by client E.DE159 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Serodiscordant partner E.DE160 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."HIV test type E.DE168 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
    where C.prevalenceInterval() starts on or before Today
define "Rapid diagnostic test for HIV E.DE169 Observation":
  Elements."Rapid diagnostic test for HIV E.DE169 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
    where C.prevalenceInterval() starts on or before Today
define "Enzyme immunoassay for HIV E.DE170 Observation":
  Elements."Enzyme immunoassay for HIV E.DE170 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
    where C.prevalenceInterval() starts on or before Today
define "Nucleic acid test for HIV E.DE171 Observation":
  Elements."Nucleic acid test for HIV E.DE171 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
    where C.prevalenceInterval() starts on or before Today
define "Dual HIV/syphilis rapid diagnostic test E.DE172 Observation":
  Elements."Dual HIV/syphilis rapid diagnostic test E.DE172 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Dual HIV/syphilis rapid diagnostic test E.DE172 */

/*
@dataElement: HIV.E.DE180 - EID sample number
@activity: HIV.F8 Test infant/child for HIV using testing algorithm
@description: Early infant diagnosis (EID) sample number
*/
// TODO: Replace placeholder with relevant CQL logic
define "EID sample number":
  exists "EID sample number Observation"
define "EID sample number Observation":
  Elements."EID sample number Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."EID sample 1 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "EID sample 1 Observation":
  Elements."EID sample 1 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."EID sample 2 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "EID sample 2 Observation":
  Elements."EID sample 2 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."EID test number Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."EID test number 1 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "EID test number 1 Observation":
  Elements."EID test number 1 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."EID test number 2 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "EID test number 2 Observation":
  Elements."EID test number 2 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of EID test number 2 */

/*
@dataElement: HIV.E.DE186 - EID test number 1 test result
@activity: HIV.F8 Test infant/child for HIV using testing algorithm
@description: Early infant diagnosis test number 1 test result
*/
define "EID test number 1 test result":
  Elements."EID test number 1 test result" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of EID test number 1 test result */

/*
@dataElement: HIV.E.DE187 - Positive
@activity: HIV.F8 Test infant/child for HIV using testing algorithm
@description: Positive HIV test result from the nucleic acid test
*/
// TODO: Replace placeholder with relevant CQL logic
define "Positive E.DE187":
  Elements."Positive E.DE187" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Positive E.DE187 */

/*
@dataElement: HIV.E.DE188 - Negative
@activity: HIV.F8 Test infant/child for HIV using testing algorithm
@description: Negative HIV test result from the nucleic acid test
*/
// TODO: Replace placeholder with relevant CQL logic
define "Negative E.DE188":
  Elements."Negative E.DE188" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Negative E.DE188 */

/*
@dataElement: HIV.E.DE189 - Indeterminate
@activity: HIV.F8 Test infant/child for HIV using testing algorithm
@description: Indeterminate HIV test result from the nucleic acid test
*/
// TODO: Replace placeholder with relevant CQL logic
define "Indeterminate E.DE189":
  Elements."Indeterminate E.DE189" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."EID test number 2 test result Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Positive E.DE191 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Positive E.DE191 Observation":
  Elements."Positive E.DE191 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Negative E.DE192 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Negative E.DE192 Observation":
  Elements."Negative E.DE192 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Indeterminate E.DE193 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Indeterminate E.DE193 Observation":
  Elements."Indeterminate E.DE193 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Assay number in testing strategy E.DE194 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Assay 0 E.DE195 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Assay 0 E.DE195 Observation":
  Elements."Assay 0 E.DE195 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Assay 1 E.DE196 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Assay 1 E.DE196 Observation":
  Elements."Assay 1 E.DE196 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Assay 2 E.DE197 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Assay 2 E.DE197 Observation":
  Elements."Assay 2 E.DE197 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Assay 3 E.DE198 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Assay 3 E.DE198 Observation":
  Elements."Assay 3 E.DE198 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Assay 1 repeated E.DE199 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Assay 1 repeated E.DE199 Observation":
  Elements."Assay 1 repeated E.DE199 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Test result of HIV assay 1 E.DE200 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Reactive E.DE201 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Reactive E.DE201 Observation":
  Elements."Reactive E.DE201 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Non-reactive E.DE202 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Non-reactive E.DE202 Observation":
  Elements."Non-reactive E.DE202 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Invalid E.DE203 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Invalid E.DE203 Observation":
  Elements."Invalid E.DE203 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Test result of HIV assay 2 E.DE204 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Reactive E.DE205 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Reactive E.DE205 Observation":
  Elements."Reactive E.DE205 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Non-reactive E.DE206 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Non-reactive E.DE206 Observation":
  Elements."Non-reactive E.DE206 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Invalid E.DE207 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Invalid E.DE207 Observation":
  Elements."Invalid E.DE207 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Test result of HIV assay 3 E.DE208 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Reactive E.DE209 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Reactive E.DE209 Observation":
  Elements."Reactive E.DE209 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Non-reactive E.DE210 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Non-reactive E.DE210 Observation":
  Elements."Non-reactive E.DE210 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Invalid E.DE211 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Invalid E.DE211 Observation":
  Elements."Invalid E.DE211 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Test result of HIV assay 1 repeated E.DE212 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Reactive E.DE213 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Reactive E.DE213 Observation":
  Elements."Reactive E.DE213 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Non-reactive E.DE214 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Non-reactive E.DE214 Observation":
  Elements."Non-reactive E.DE214 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Invalid E.DE215 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Invalid E.DE215 Observation":
  Elements."Invalid E.DE215 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Test result of syphilis assay 1 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Reactive E.DE217 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Reactive E.DE217 Observation":
  Elements."Reactive E.DE217 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Non-reactive E.DE218 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Non-reactive E.DE218 Observation":
  Elements."Non-reactive E.DE218 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Invalid E.DE219 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Invalid E.DE219 Observation":
  Elements."Invalid E.DE219 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Test result of syphilis assay 1 repeated Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Reactive E.DE221 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Reactive E.DE221 Observation":
  Elements."Reactive E.DE221 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Non-reactive E.DE222 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Non-reactive E.DE222 Observation":
  Elements."Non-reactive E.DE222 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Invalid E.DE223 Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Invalid E.DE223 Observation":
  Elements."Invalid E.DE223 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Invalid E.DE223 */

/*
@dataElement: HIV.G.DE1 - CD4 count
@activity: HIV.D20 Diagnostics
@description: CD4 cell count in cells/mm^3
*/
// TODO: Replace placeholder with relevant CQL logic
define "CD4 count G.DE1":
  Elements."CD4 count G.DE1" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
define "CD4 count G.DE1 Value":
  "CD4 count G.DE1" O
  return O.value
/* End of CD4 count G.DE1 */

/*
@dataElement: HIV.G.DE8 - Date of viral load sample collection
@activity: HIV.D20 Diagnostics
@description: Date and time when the sample was collected to test the client's HIV viral load
*/
// TODO: Replace placeholder with relevant CQL logic
define "Date of viral load sample collection G.DE8":
  Elements."Date of viral load sample collection G.DE8" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
define "Date of viral load sample collection G.DE8 Value":
  "Date of viral load sample collection G.DE8" O
  return O.value
/* End of Date of viral load sample collection G.DE8 */

/*
@dataElement: HIV.G.DE12 - Viral load test result
@activity: HIV.D20 Diagnostics
@description: Result from the viral load test in number of copies/mL
*/
// TODO: Replace placeholder with relevant CQL logic
define "Viral load test result G.DE12":
  Elements."Viral load test result G.DE12" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
define "Viral load test result G.DE12 Value":
  "Viral load test result G.DE12" O
  return O.value
/* End of Viral load test result G.DE12 */

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
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
    where C.prevalenceInterval() starts on or before Today
define "Positive G.DE19 Observation":
  Elements."Positive G.DE19 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
    where C.prevalenceInterval() starts on or before Today
define "Negative G.DE20 Observation":
  Elements."Negative G.DE20 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
    where C.prevalenceInterval() starts on or before Today
define "Indeterminate G.DE21 Observation":
  Elements."Indeterminate G.DE21 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Indeterminate G.DE21 */

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
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
    where C.prevalenceInterval() starts on or before Today
define "Positive G.DE44 Observation":
  Elements."Positive G.DE44 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
    where C.prevalenceInterval() starts on or before Today
define "Negative G.DE45 Observation":
  Elements."Negative G.DE45 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
    where C.prevalenceInterval() starts on or before Today
define "Indeterminate G.DE46 Observation":
  Elements."Indeterminate G.DE46 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Indeterminate G.DE46 */

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
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
    where C.prevalenceInterval() starts on or before Today
define "Positive G.DE71 Observation":
  Elements."Positive G.DE71 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
    where C.prevalenceInterval() starts on or before Today
define "Negative G.DE72 Observation":
  Elements."Negative G.DE72 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
    where C.prevalenceInterval() starts on or before Today
define "Inconclusive G.DE73 Observation":
  Elements."Inconclusive G.DE73 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Inconclusive G.DE73 */

/*
@dataElement: HIV.H.DE34 - HIV status of partner or contact
@activity: HIV.B6 Capture or update client history
@description: HIV status of the partner or contact given by the index case
*/
define "HIV status of partner or contact":
  Elements."HIV status of partner or contact" O
    where O.encounter.references(EncounterId)
/* End of HIV status of partner or contact */

/*
@dataElement: HIV.H.DE35 - Already knew positive
@activity: HIV.B6 Capture or update client history
@description: The partner or contact of the index case already knew they are HIV-positive
*/
// TODO: Replace placeholder with relevant CQL logic
define "Already knew positive":
  Elements."Already knew positive" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Already knew positive */

/*
@dataElement: HIV.H.DE36 - Newly diagnosed
@activity: HIV.B6 Capture or update client history
@description: The partner or contact of the index case is newly diagnosed as HIV-positive
*/
// TODO: Replace placeholder with relevant CQL logic
define "Newly diagnosed":
  Elements."Newly diagnosed" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Newly diagnosed */

/*
@dataElement: HIV.H.DE37 - Negative
@activity: HIV.B6 Capture or update client history
@description: The partner or contact of the index case is newly diagnosed is HIV-negative
*/
// TODO: Replace placeholder with relevant CQL logic
define "Negative H.DE37 Observation":
  Elements."Negative H.DE37" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Negative H.DE37 */

/*
@dataElement: HIV.H.DE47 - On ART
@activity: HIV.H3 Record outreach and result
@description: Client is currently taking ART 
*/
// TODO: Replace placeholder with relevant CQL logic
define "On ART H.DE47 Observation":
  Elements."On ART H.DE47" MS
    where MS.context.references(EncounterId)
      or MS.effective.toInterval() starts on or before Today
/* End of On ART H.DE47 */

/*
@dataElement: HIV.PRV.DE1 - At elevated risk for HIV acquisition
@activity: HIV.B6 Capture or update client history
@description: Client is at elevated risk for HIV acquisition, defined according to country/programme context
*/
define "At elevated risk for HIV acquisition PRV.DE1 Observation":
  Elements."At elevated risk for HIV acquisition PRV.DE1" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of At elevated risk for HIV acquisition PRV.DE1 */

/*
@dataElement: HIV.SRV.DE2 - HIV test result
@activity: HIV.B7 Test for HIV using testing algorithm
@description: The result from HIV testing after applying the testing algorithm
*/
define "HIV test result SRV.DE2":
  Elements."HIV test result SRV.DE2" O
    where O.encounter.references(EncounterId)
/* End of HIV test result SRV.DE2 */

/*
@dataElement: HIV.SRV.DE5 - HIV clinical stage
@activity: HIV.D8 Capture or update client history
@description: WHO clinical stage of client based on signs and symptoms. WHO clinical staging is a way to categorize HIV disease severity based on new or recurrent clinical events. There are 4 WHO clinical stages that range from mild symptoms (WHO clinical stage 1) to severe symptoms (WHO clinical stage 4).
*/
// TODO: Replace placeholder with relevant CQL logic
define "HIV clinical stage SRV.DE5":
  exists "HIV clinical stage SRV.DE5 Observation"
define "HIV clinical stage SRV.DE5 Observation":
  Elements."HIV clinical stage SRV.DE5 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of HIV clinical stage SRV.DE5 */

/*
@dataElement: HIV.SRV.DE6 - ART start date
@activity: HIV.B8 Provide post-test counselling
@description: The date on which the client started or restarted antiretroviral therapy (ART)
*/
// TODO: Replace placeholder with relevant CQL logic
define "ART start date SRV.DE6":
  Elements."ART start date SRV.DE6" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
define "ART start date SRV.DE6 Value":
  "ART start date SRV.DE6" O
  return O.value
/* End of ART start date SRV.DE6 */

/*
@dataElement: HIV.SRV.DE7 - Currently pregnant
@activity: HIV.B6 Capture or update client history
@description: Client is currently pregnant
*/
define "Currently pregnant SRV.DE7":
  Elements."Currently pregnant SRV.DE7 Condition" C
    where C.prevalenceInterval() starts on or before Today
    or C.encounter.references(EncounterId)
/* End of Currently pregnant SRV.DE7 */

/*
@dataElement: HIV.SRV.DE8 - CD4 count
@activity: HIV.D20 Diagnostics
@description: CD4 cell count in cells/mm^3
*/
// TODO: Replace placeholder with relevant CQL logic
define "CD4 count SRV.DE8":
  Elements."CD4 count SRV.DE8" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
define "CD4 count SRV.DE8 Value":
  "CD4 count SRV.DE8" O
  return O.value
/* End of CD4 count SRV.DE8 */

/*
@dataElement: HIV.SRV.DE12 - Date of viral load sample collection
@activity: HIV.D10 Counsel returning client
@description: Date and time when the sample was collected to test the client's HIV viral load
*/
// TODO: Replace placeholder with relevant CQL logic
define "Date of viral load sample collection SRV.DE12":
  Elements."Date of viral load sample collection SRV.DE12" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
define "Date of viral load sample collection SRV.DE12 Value":
  "Date of viral load sample collection SRV.DE12" O
  return O.value
/* End of Date of viral load sample collection SRV.DE12 */

/*
@dataElement: HIV.SRV.DE13 - Viral load test result
@activity: HIV.D20 Diagnostics
@description: Result from the viral load test in number of copies/mL
*/
// TODO: Replace placeholder with relevant CQL logic
define "Viral load test result SRV.DE13":
  Elements."Viral load test result SRV.DE13" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
define "Viral load test result SRV.DE13 Value":
  "Viral load test result SRV.DE13" O
  return O.value
/* End of Viral load test result SRV.DE13 */

/*
@dataElement: HIV.SRV.DE15 - Visit date
@activity: HIV.A2 Gather client details
@description: The date and time of the client's visit
*/
// TODO: Replace placeholder with relevant CQL logic
define "Visit date SRV.DE15":
  Elements."Visit date SRV.DE15" p
  where p starts on or before Today
/* End of Visit date SRV.DE15 */

/*
@dataElement: HIV.SRV.DE18 - ANC contact date
@activity: HIV.E1 Capture or update mother's history
@description: The date and time of the client's ANC contact (in the ANC DAK this is called 'Contact date')
*/
// TODO: Replace placeholder with relevant CQL logic
define "ANC contact date SRV.DE18":
  Elements."ANC contact date SRV.DE18" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
define "ANC contact date SRV.DE18 Value":
  "ANC contact date SRV.DE18" O
  return O.value
/* End of ANC contact date SRV.DE18 */

/*
@dataElement: HIV.SRV.DE21 - Test result of HIV assay 1
@activity: HIV.E4 Test mother for HIV using testing algorithm
@description: The result of the first HIV assay in the testing strategy
*/
// TODO: Replace placeholder with relevant CQL logic
define "Test result of HIV assay 1 SRV.DE21":
  exists "Test result of HIV assay 1 SRV.DE21 Observation"
define "Test result of HIV assay 1 SRV.DE21 Observation":
  Elements."Test result of HIV assay 1 SRV.DE21 Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of Test result of HIV assay 1 SRV.DE21 */

/*
@dataElement: HIV.Config.DE6 - Malaria-endemic setting
@activity: HIV.Configuration
@description: Whether the setting is a malaria-endemic setting
*/
// TODO: Replace placeholder with relevant CQL logic
define "Malaria-endemic setting":
  exists "Malaria-endemic setting Observation"
define "Malaria-endemic setting Observation":
  Elements."Malaria-endemic setting Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."HIV burden of the setting Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."High HIV burden setting Condition" C
    where C.prevalenceInterval() starts on or before Today
define "High HIV burden setting Observation":
  Elements."High HIV burden setting Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."Low HIV burden setting Condition" C
    where C.prevalenceInterval() starts on or before Today
define "Low HIV burden setting Observation":
  Elements."Low HIV burden setting Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
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
  Elements."HPV DNA testing operational at the health facility Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts on or before Today
/* End of HPV DNA testing operational at the health facility */


/*
 * Custom elements and logic for use DT and IND CQL Libraries
 */
