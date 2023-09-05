Alias: $UsageContexts = http://terminology.hl7.org/CodeSystem/usage-context-type
Alias: $PublicationStatus = http://hl7.org/fhir/CodeSystem/publication-status
Alias: $ActorTypes = http://hl7.org/fhir/examplescenario-actor-type

Instance: TrustNetworkGatewayParticipant
InstanceOf: ActorDefinition
Description: """WHO GDHCN Trust Network Gateway Participant"""


* name = "Trust Network Participant"
* title = "Trust Network Participant"
// * useContext = $UsageContexts#workflow
* publisher = "World Health Organization"
* status = $PublicationStatus#draft
* type = $ActorTypes#system