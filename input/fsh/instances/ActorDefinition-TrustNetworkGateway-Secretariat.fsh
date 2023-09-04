Alias: $UsageContexts = http://terminology.hl7.org/ValueSet/usage-context-type
Alias: $PublicationStatus = http://hl7.org/fhir/ValueSet/publication-status

Instance: TrustNetworkGatewaySecretariat
InstanceOf: ActorDefinition
Description: """WHO GDHCN Trust Network Gateway Secretariat"""

* identifer = "TrustNetworkGatewaySecretariat"
* name = "Trust Network Secretariat"
* title = "Trust Network Secretariat"
* useContext = $UsageContexts#workflow
* publisher = "World Health Organization"
* status = $PublicationStatus#draft
