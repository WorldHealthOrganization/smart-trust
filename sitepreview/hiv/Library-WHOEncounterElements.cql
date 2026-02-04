library WHOEncounterElements

using FHIR version '4.0.1'

include FHIRHelpers version '4.0.1'

include WHOConcepts called Concepts
include WHOCommon called Common
include WHOElements called Elements

parameter AsOf Date default Today()
parameter EncounterId String

context Patient

define "Pregnant Observation":
  Elements."Pregnant Observation" O
    where O.encounter.references(EncounterId)
      or O.effective.toInterval() starts 9 months on or before day of AsOf
