Logical: 	SmartHealthLinkPayload
Parent: 	HealthLinkPayload
Title: 		"Smart Health Link Payload (DRAFT)"
Description:	"Smart Health Link Payload (DRAFT)
This logical model was taken from the SMART Health Link documentation <https://docs.smarthealthit.org/smart-health-links/spec#construct-a-shlink-payload> as of 30 November 2023.

A [[ SMART Health Link]] is generated from this payload according to the algorithm documented here <https://docs.smarthealthit.org/smart-health-links/spec#example-shlink-generation>.
"
* ^url = "http://smart.who.int/trust/StructureDefinition/SmartHealthLinkPayload"
* ^version = "RC2"
* ^status = #draft

* type obeys is-a-smart-health-link

Invariant: is-a-smart-health-link
Description: "The Health Link type is is a Smart Health Link"
Severity: #error
Expression: " (! type.exists()) or (type = 'shl')"
