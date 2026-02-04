library WHOCommon

using FHIR version '4.0.1'

include FHIRHelpers version '4.0.1'

codesystem "ConditionClinicalStatusCodes": 'http://terminology.hl7.org/CodeSystem/condition-clinical'

// Condition Clinical Status Codes - Consider value sets for these
code "active": 'active' from "ConditionClinicalStatusCodes"
code "recurrence": 'recurrence' from "ConditionClinicalStatusCodes"
code "relapse": 'relapse' from "ConditionClinicalStatusCodes"
code "inactive": 'inactive' from "ConditionClinicalStatusCodes"
code "remission": 'remission' from "ConditionClinicalStatusCodes"
code "resolved": 'resolved' from "ConditionClinicalStatusCodes"

context Patient

define fluent function official(identifiers List<Identifier>):
  singleton from (identifiers I where I.use = 'official')

define fluent function official(addresses List<Address>):
  singleton from (addresses A where A.use = 'official')

define fluent function official(names List<HumanName>):
  singleton from (names N where N.use = 'official')

define fluent function mobile(contactPoints List<ContactPoint>):
  singleton from (contactPoints P where P.use = 'mobile')

define fluent function only(allergies List<AllergyIntolerance>):
  singleton from allergies

define fluent function only(appointments List<Appointment>):
  singleton from appointments

define fluent function only(careplans List<CarePlan>):
  singleton from careplans

define fluent function only(conditions List<Condition>):
  singleton from conditions

define fluent function only(encounters List<Encounter>):
  singleton from encounters

define fluent function only(immunizations List<Immunization>):
  singleton from immunizations

define fluent function only(locations List<Location>):
  singleton from locations

define fluent function only(medicationrequests List<MedicationRequest>):
  singleton from medicationrequests

define fluent function only(observations List<Observation>):
  singleton from observations

define fluent function only(procedures List<Procedure>):
  singleton from procedures

define fluent function only(serviceRequests List<ServiceRequest>):
  singleton from serviceRequests

define fluent function only(dosages List<Dosage>):
  singleton from dosages

define fluent function only(doses List<FHIR.Dosage.DoseAndRate>):
  singleton from doses

define fluent function earliest(observations List<Observation>):
  First(
    observations O
      sort by issued
  )

define fluent function latest(observations List<Observation>):
  Last(
    observations O
      sort by issued
  )

define fluent function mostRecent(observations List<Observation>):
  Last(
    observations O
      sort by issued
  )

define fluent function mostRecent(procedures List<Procedure>):
  Last(
    procedures P
      sort by start of performed.toInterval()
  )

define fluent function mostRecent(immunizations List<Immunization>):
  Last(
    immunizations I
      sort by start of occurrence.toInterval()
  )

define fluent function mostRecent(medicationRequests List<MedicationRequest>):
  Last(
    medicationRequests MR
      sort by authoredOn
  )

define fluent function lowest(observations List<Observation>):
  First(
    observations O
      sort by FHIRHelpers.ToQuantity(value as FHIR.Quantity)
  )

define fluent function highest(observations List<Observation>):
  Last(
    observations O
      sort by FHIRHelpers.ToQuantity(value as FHIR.Quantity)
  )

define function EarliestOf(dates List<Date>):
  Min(dates)

define function LatestOf(dates List<Date>):
  Max(dates)

/*
From FHIRCommon 4.1.0:
*/

/*
@description: Normalizes a value that is a choice of timing-valued types to an equivalent interval
@comment: Normalizes a choice type of FHIR.dateTime, FHIR.Period, FHIR.Timing, FHIR.instance, FHIR.string, FHIR.Age, or FHIR.Range types
to an equivalent interval. This selection of choice types is a superset of the majority of choice types that are used as possible
representations for timing-valued elements in FHIR, allowing this function to be used across any resource.

The input can be provided as a dateTime, Period, Timing, instant, string, Age, or Range.
The intent of this function is to provide a clear and concise mechanism to treat single
elements that have multiple possible representations as intervals so that logic doesn't have to account
for the variability. More complex calculations (such as medication request period or dispense period
calculation) need specific guidance and consideration. That guidance may make use of this function, but
the focus of this function is on single element calculations where the semantics are unambiguous.
If the input is a dateTime, the result a DateTime Interval beginning and ending on that dateTime.
If the input is a Period, the result is a DateTime Interval.
If the input is a Timing, an error is raised indicating a single interval cannot be computed from a Timing.
If the input is an instant, the result is a DateTime Interval beginning and ending on that instant.
If the input is a string, an error is raised indicating a single interval cannot be computed from a string.
If the input is an Age, the result is a DateTime Interval beginning when the patient was the given Age,
and ending immediately prior to when the patient was the given Age plus one year.
If the input is a Range, the result is a DateTime Interval beginning when the patient was the Age given
by the low end of the Range, and ending immediately prior to when the patient was the Age given by the
high end of the Range plus one year.

NOTE: Due to the
complexity of determining a single interval from a Timing or String type, this function will throw a run-time exception if it is used
with a Timing or String.
*/
define fluent function toInterval(choice Choice<FHIR.dateTime, FHIR.Period, FHIR.Timing, FHIR.instant, FHIR.string, FHIR.Age, FHIR.Range>):
  case
    when choice is FHIR.dateTime then
      Interval[FHIRHelpers.ToDateTime(choice as FHIR.dateTime), FHIRHelpers.ToDateTime(choice as FHIR.dateTime)]
    when choice is FHIR.Period then
      FHIRHelpers.ToInterval(choice as FHIR.Period)
    when choice is FHIR.instant then
      Interval[FHIRHelpers.ToDateTime(choice as FHIR.instant), FHIRHelpers.ToDateTime(choice as FHIR.instant)]
    when choice is FHIR.Age then
      Interval[FHIRHelpers.ToDate(Patient.birthDate) + FHIRHelpers.ToQuantity(choice as FHIR.Age),
        FHIRHelpers.ToDate(Patient.birthDate) + FHIRHelpers.ToQuantity(choice as FHIR.Age) + 1 year)
    when choice is FHIR.Range then
      Interval[FHIRHelpers.ToDate(Patient.birthDate) + FHIRHelpers.ToQuantity((choice as FHIR.Range).low),
        FHIRHelpers.ToDate(Patient.birthDate) + FHIRHelpers.ToQuantity((choice as FHIR.Range).high) + 1 year)
    when choice is FHIR.Timing then
      Message(null as Interval<DateTime>, true, 'NOT_IMPLEMENTED', 'Error', 'Calculation of an interval from a Timing value is not supported')
    when choice is FHIR.string then
      Message(null as Interval<DateTime>, true, 'NOT_IMPLEMENTED', 'Error', 'Calculation of an interval from a String value is not supported')
    else
      null as Interval<DateTime>
  end

/*
@description: Returns an interval representing the normalized Abatement of a given Condition resource.
@comment: NOTE: Due to the complexity of determining an interval from a String, this function will throw
a run-time exception if used with a Condition instance that has a String as the abatement value.
*/
define fluent function abatementInterval(condition Condition):
  if condition.abatement is FHIR.dateTime then
    Interval[FHIRHelpers.ToDateTime(condition.abatement as FHIR.dateTime), FHIRHelpers.ToDateTime(condition.abatement as FHIR.dateTime)]
  else if condition.abatement is FHIR.Period then
    FHIRHelpers.ToInterval(condition.abatement as FHIR.Period)
  else if condition.abatement is FHIR.string then
    Message(null as Interval<DateTime>, true, 'NOT_IMPLEMENTED', 'Error', 'Calculation of an interval from a String value is not supported')
  else if condition.abatement is FHIR.Age then
    Interval[FHIRHelpers.ToDate(Patient.birthDate) + FHIRHelpers.ToQuantity(condition.abatement as FHIR.Age),
      FHIRHelpers.ToDate(Patient.birthDate) + FHIRHelpers.ToQuantity(condition.abatement as FHIR.Age) + 1 year)
  else if condition.abatement is FHIR.Range then
    Interval[FHIRHelpers.ToDate(Patient.birthDate) + FHIRHelpers.ToQuantity((condition.abatement as FHIR.Range).low),
      FHIRHelpers.ToDate(Patient.birthDate) + FHIRHelpers.ToQuantity((condition.abatement as FHIR.Range).high) + 1 year)
  else if condition.abatement is FHIR.boolean then
    Interval[end of condition.onset.toInterval(), condition.recordedDate)
  else 
    null

/*
@description: Returns an interval representing the normalized prevalence period of a given Condition resource.
@comment: Uses the toInterval and toAbatementInterval functions to determine the widest potential interval from
onset to abatement as specified in the given Condition.
*/
define fluent function prevalenceInterval(condition Condition):
if condition.clinicalStatus ~ "active"
  or condition.clinicalStatus ~ "recurrence"
  or condition.clinicalStatus ~ "relapse" then
  Interval[start of condition.onset.toInterval(), end of condition.abatementInterval()]
else
  (end of condition.abatementInterval()) abatementDate
    return 
	  if abatementDate is null then
        Interval[start of condition.onset.toInterval(), abatementDate)
      else
        Interval[start of condition.onset.toInterval(), abatementDate]

/*
@description: Returns true if the given reference is to the given resource
@comment: Returns true if the `id` element of the given resource exactly equals the tail of the given reference.
NOTE: This function assumes resources from the same source server.
*/
define fluent function references(reference FHIR.Reference, resource FHIR.Resource):
  resource.id = Last(Split(reference.reference, '/'))  

/*
@description: Returns true if the given reference is to the given resourceId
@comment: Returns true if the `resourceId` parameter exactly equals the tail of the given reference.
NOTE: This function assumes resources from the same source server.
*/
define fluent function references(reference FHIR.Reference, resourceId String):
  resourceId = Last(Split(reference.reference, '/'))

/*
@description: Returns true if any of the given references are to the given resource
@comment: Returns true if the `id` element of the given resource exactly equals the tail of any of the given references.
NOTE: This function assumes resources from the same source server.
*/
define fluent function references(references List<FHIR.Reference>, resource FHIR.Resource):
  exists (references R where R.references(resource))
  
/*
@description: Returns true if any of the given references are to the given resourceId
@comment: Returns true if the `resourceId` parameter exactly equals the tail of any of the given references.
NOTE: This function assumes resources from the same source server.
*/
define fluent function references(references List<FHIR.Reference>, resourceId String):
  exists (references R where R.references(resourceId))
