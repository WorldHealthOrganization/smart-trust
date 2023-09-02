Profile: TrustNetworkGatewayTrustedService
Id: TrustNetworkGatewayTrustedService
Parent: Endpoint
Title: "TNG Trusted Service Endpoint"
Description: """A service Endpoint for WHO Global Digital Health Certification Network (GDHCN) Trusted Service"""


Alias $HL7ConnectionTypes = http://terminology.hl7.org/CodeSystem/endpoint-connection-type
Alias $TNGContracts = http://worldhealthorganization.github.io/smart-trust/TrustNetworkGatewayContracts

// connectionType.coding contains at least one thing from  $TNGContracts
