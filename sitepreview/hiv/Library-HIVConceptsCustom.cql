library HIVConceptsCustom version '0.0.1'
// codesystem "HIVConceptsCustom": 'http://smart.who.int/hiv/CodeSystem/HIVConceptsCustom'

codesystem "ConditionCategoryCodes": 'http://terminology.hl7.org/CodeSystem/condition-category'
codesystem "ConditionClinicalStatusCodes": 'http://terminology.hl7.org/CodeSystem/condition-clinical'
codesystem "ObservationCategoryCodes": 'http://terminology.hl7.org/CodeSystem/observation-category'
codesystem "missing concepts": 'https://worldhealthorganization.github.io/smart-hiv/CodeSystem/missing-concepts'
codesystem "Devicestatement-status": 'http://hl7.org/fhir/device-statement-status'
codesystem "SNOMEDCT:2018-03": 'http://snomed.info/sct' version '2018-03'
codesystem "SNOMEDCT": 'http://snomed.info/sct'
codesystem "AdverseEventSeverity": 'http://terminology.hl7.org/CodeSystem/adverse-event-severity'
codesystem "RoleCode": 'http://terminology.hl7.org/CodeSystem/v3-RoleCode'

code "encounter-diagnosis": 'encounter-diagnosis' from "ConditionCategoryCodes" display 'Encounter Diagnosis'

// Related Person
valueset "RelatedPersonRelationshipType": 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype'
code "Mother": 'MTH' from "RoleCode"

// Condition Clinical Status Codes
code "active": 'active' from "ConditionClinicalStatusCodes"
code "recurrence": 'recurrence' from "ConditionClinicalStatusCodes"
code "relapse": 'relapse' from "ConditionClinicalStatusCodes"
code "inactive": 'inactive' from "ConditionClinicalStatusCodes"
code "remission": 'remission' from "ConditionClinicalStatusCodes"
code "resolved": 'resolved' from "ConditionClinicalStatusCodes"

//Observation category codes
code "social-history": 'social-history' from "ObservationCategoryCodes" display 'Social History'

//Device statement status
code "completed": 'completed' from "Devicestatement-status"

//adverse event severity
code "mild": 'mild' from "AdverseEventSeverity"
code "moderate": 'moderate' from "AdverseEventSeverity"
code "severe": 'severe' from "AdverseEventSeverity"

//frequency
code "Every eight hours (qualifier value)": '307469008' from "SNOMEDCT:2018-03" display 'Every eight hours (qualifier value)'
code "Every eight to twelve hours (qualifier value)": '396140003' from "SNOMEDCT" display 'Every eight to twelve hours (qualifier value)'
code "Every forty eight hours (qualifier value)": '396131002' from "SNOMEDCT:2018-03" display 'Every forty eight hours (qualifier value)'
code "Every four hours (qualifier value)": '225756002' from "SNOMEDCT" display 'Every four hours (qualifier value)'
code "Every seventy two hours (qualifier value)": '396143001' from "SNOMEDCT:2018-03" display 'Every seventy two hours (qualifier value)'
code "Every six hours (qualifier value)": '307468000' from "SNOMEDCT:2018-03" display 'Every six hours (qualifier value)'
code "Every six to eight hours (qualifier value)": '396139000' from "SNOMEDCT" display 'Every six to eight hours (qualifier value)'
code "Every thirty six hours (qualifier value)": '396126004' from "SNOMEDCT:2018-03" display 'Every thirty six hours (qualifier value)'
code "Every three to four hours (qualifier value)": '225754004' from "SNOMEDCT" display 'Every three to four hours (qualifier value)'
code "Every three to six hours (qualifier value)": '396127008' from "SNOMEDCT" display 'Every three to six hours (qualifier value)'
code "Every twelve hours (qualifier value)": '307470009' from "SNOMEDCT:2018-03" display 'Every twelve hours (qualifier value)'
code "Every twenty four hours (qualifier value)": '396125000' from "SNOMEDCT:2018-03" display 'Every twenty four hours (qualifier value)'
code "Every two to four hours (qualifier value)": '225752000' from "SNOMEDCT" display 'Every two to four hours (qualifier value)'
code "Four times daily (qualifier value)": '307439001' from "SNOMEDCT:2018-03" display 'Four times daily (qualifier value)'
code "Once daily (qualifier value)": '229797004' from "SNOMEDCT:2018-03" display 'Once daily (qualifier value)'
code "One to four times a day (qualifier value)": '396109005' from "SNOMEDCT" display 'One to four times a day (qualifier value)'
code "One to three times a day (qualifier value)": '396108002' from "SNOMEDCT" display 'One to three times a day (qualifier value)'
code "One to two times a day (qualifier value)": '396107007' from "SNOMEDCT" display 'One to two times a day (qualifier value)'
code "Three times daily (qualifier value)": '229798009' from "SNOMEDCT:2018-03" display 'Three times daily (qualifier value)'
code "Twice a day (qualifier value)": '229799001' from "SNOMEDCT:2018-03" display 'Twice a day (qualifier value)'
code "Two to four times a day (qualifier value)": '396111001' from "SNOMEDCT" display 'Two to four times a day (qualifier value)'


// Encounter Types
code "HTS Visit": 'HTS Visit' from "missing concepts"

//not currently provided
code "needle-syringe": 'needle syringe' from "missing concepts"
code "methadone": 'methadone' from "missing concepts"
code "buprenorphine": 'buprenorphine' from "missing concepts"
code "viral load test": 'viral load test' from "missing concepts"
code "delivery": 'delivery' from "missing concepts"
code "tb treatment": 'tb treatment' from "missing concepts"
code "ART medication": 'ART medication' from "missing concepts"
code "DSD ART eligibility assessed" : 'DSD ART eligibility assessed' from "missing concepts"
code "syphilis test" : 'syphilis test' from "missing concepts"
code "HBsAg test" : 'HBsAg test' from "missing concepts"
code "Gonorrhoea test" : 'Gonorrhoea test' from "missing concepts"
code "syphilis treatment" : 'syphilis treatment' from "missing concepts"
code "Gonorrhoea treatment" : 'Gonorrhoea treatment' from "missing concepts"
code "HCV test" : 'HCV test' from "missing concepts"
code "HCV viral load" : 'HCV viral load' from "missing concepts"
code "cervical cancer screening test" : 'cervical cancer screening test' from "missing concepts"
code "cervical precancer lesion treatment" : 'cervical precancer lesion treatment' from "missing concepts"
code "Invasive cervical cancer treatment" : 'Invasive cervical cancer treatment' from "missing concepts"
code "Antenatal care contact": 'Antenatal care contact' from "missing concepts"
code "No longer breastfeeding": 'No longer breasfeeding' from "missing concepts"