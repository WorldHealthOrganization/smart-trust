Logical: 	SMARTHealthLinkPayload
Parent: 	HealthLinkPayload
Title: 		"SMART Health Link Payload (DRAFT)"
Description:	"SMART Health Link Payload (DRAFT)

This logical model constrains the Health Link Payload for a SMART Health Link

A SMART Health Link URI is generated from this payload according to the algorithm documented [here](https://build.fhir.org/ig/HL7/smart-health-cards-and-links/links-specification.html#smart-health-links-sharing-application-generates-a-smart-health-link-uri)

"
Characteristics: #can-be-target
* ^url = "http://hl7.org/fhir/uv/smart-health-cards-and-links/StructureDefinition/SMARTHealthLinkPayload"
* ^version = "RC2"
* ^status = #draft
* type 0..0