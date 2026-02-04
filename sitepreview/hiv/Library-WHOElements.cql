library WHOElements

using FHIR version '4.0.1'

include FHIRHelpers version '4.0.1'

include WHOConcepts version '0.0.2' called Concepts
include WHOCommon called Common

context Patient

define "Pregnancy Status Observation":
  [Observation: Concepts."Pregnancy status"] O
    where O.status in { 'final', 'amended', 'corrected' }

define "Pregnant Observation":
  "Pregnancy Status Observation" O
    where O.value ~ Concepts."Pregnant"

