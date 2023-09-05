Alias: $UsageContexts = http://terminology.hl7.org/CodeSystem/usage-context-type
Alias: $PublicationStatus = http://hl7.org/fhir/CodeSystem/publication-status
Alias: $ActorTypes = http://hl7.org/fhir/examplescenario-actor-type

Instance: TrustNetworkGatewaySecretariat
InstanceOf: ActorDefinition
Description: """WHO GDHCN Trust Network Gateway Secretariat"""


* name = "Trust Network Secretariat"
* title = "Trust Network Secretariat"
// * useContext.usageContext.code = $UsageContexts#workflow
* publisher = "World Health Organization"
* status = $PublicationStatus#draft
* type = $ActorTypes#system
