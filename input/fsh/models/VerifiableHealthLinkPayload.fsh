Logical: 	VerifiableHealthLinkPayload
Parent: SmartHealthLinkPayload
Title: 		"Verifiable Health Link Payload (DRAFT)"
Description:	"Verifiable Health Link Payload (DRAFT)

This logical model was extends the Smart Health Link Payload

"

* ^url = "http://smart.who.int/trust/StructureDefinition/VerifiableHealthLinkPayload"
* ^version = "RC2"
* ^status = #draft

* type 1..1 code "classifying type code" "Classifying type code to distinguish between SHL and VHL"
* type from HL_TYPE