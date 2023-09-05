

Alias: $TNGContracts = http://worldhealthorganization.github.io/smart-trust/TrustNetworkGatewayContracts


Logical: TrustNetworkGatewayParticipant
Title: "Trust Network Gateway Particpant"
Parent: BackboneElement
* ^url = "http://worldhealthorganization.github.io/smart-trust/TrustNetworkGatewayParticipant"
* ^version = "0.1"
* ^abstract = true
* ^status = #draft
* name			1..1	string  "TNG Participant" "Name of the Trust Network Gateway (TNG)  Partcipant"
* identifier  		1..1	string "Identifier for this Trusted Participant"






Logical: TrustNetworkGatewayTrustedService
Title: "Trust Network Gateway Trusted Service"
Description: "Trusted services.  "
Parent: BackboneElement
* ^url = "http://worldhealthorganization.github.io/smart-trust/TrustNetworkGatewayParticipant"
* ^version = "0.1"
* ^abstract = true
* ^status = #draft
* name			1..1	string  "TNG Participant" "Name of the Trust Network Gateway (TNG)  Partcipant"
* mimeType		1..1	string  "mime type of service"
* url			1..1	string  "URL of service"
* code			1..* 	CodeableConcept "Code that indicates service (transaction) that this endpoint fulfills"



Logical: TrustNetworkGatewayRelationship
Title: "Trust Network Gateway Relatiohsip"
Description: "Describes a Trust Network relationship.  Instantiated in FHIR as a Contract"
Parent: BackboneElement
* ^url = "http://worldhealthorganization.github.io/smart-trust/TrustNetworkGatewayRelationship"
* ^version = "0.1"
* ^abstract = true
* ^status = #draft
* name			1..1	string  "TNG Participant" "Name of the Trust Network Gateway (TNG)  Partcipant"
* governanceFramework	0..*	Attachment  "Desribes governance that TNG Participants are envaoring to ahere to when agreeing to participate in the Domain"
* signature		0..*	Attachment "Signed documents (digital or physical) singaling intention to adhere to governanve framework for the Trust Domain"
* domain		1..*	CodeableConcept "Trust Domain(s) that the participants in the relationship are operating under"
* domain from $TNGContracts (extensible)
* trustedServices	0..*	TrustNetworkGatewayTrustedService "Set of Trusted Services that are being operated under this relationship"
* paricipantIdentifier	1..*	string "Identifier for Trust Network Participant organization that is the source of the relationship"


