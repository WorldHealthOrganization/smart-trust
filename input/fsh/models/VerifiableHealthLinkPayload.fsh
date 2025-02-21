Logical: 	VerifiableHealthLinkPayload
Parent: 	HealthLinkPayload
Title: 		"Verifiable Health Link Payload (DRAFT)"
Description:	"Verifiable Health Link Payload (DRAFT)

This logical model constrains the Health Link Payload for a Verifiable Health Link
"
Characteristics: #can-be-target
* ^url = "https://profiles.ihe.net/ITI/VHL/StructureDefinition/VerifiableHealthLinkPayload"
* ^version = "RC2"
* ^status = #draft
* type 1..1
* type from HL_TYPE (preferred)
* type obeys is-a-verifiable-health-link


Invariant: is-a-verifiable-health-link
Description: "The Health Link type is is a verifiable health link"
Severity: #error
Expression: "type = 'vhl'"



