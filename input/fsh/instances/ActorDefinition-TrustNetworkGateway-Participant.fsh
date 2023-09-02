Alias $UsageContexts = http://terminology.hl7.org/ValueSet/usage-context-type
Alias $PublicationStatus = http://hl7.org/fhir/ValueSet/publication-status

Instance: TrustNetworkGatewayParticipant
InstanceOf: ActorDefinition
Description: """WHO GDHCN Trust Network Gateway Participant"""

* identifer = "TrustNetworkGatewayParticipant"
* name = "Trust Network Participant"
* title = "Trust Network Participant"
* useContext = $UsageContexts#workflow
* publisher = "World Health Organization"
* status = $PublicationStatus#draft
