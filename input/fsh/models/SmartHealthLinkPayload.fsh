Logical: 	HealthLinkPayload
Title: 		"Health Link Payload (DRAFT)"
Description:	"Health Link Payload (DRAFT)

A [[ Health Link]] is generated from this payload according to the algorithm documented here <https://docs.smarthealthit.org/smart-health-links/spec#example-shlink-generation>.

"
* ^url = "http://smart.who.int/trust/StructureDefinition/HealthLinkPayload"
* ^version = "RC2"
* ^status = #draft
*  url 1..1 string "url" "Manifest URL for this Health Link"
*  key 1..1 string "Decryption key for processing files returned in the manifest. 43 characters, consisting of 32 random bytes base64urlencoded."
*  exp 0..1 string "Optional. Number representing expiration time in Epoch seconds, as a hint to help the Health Link Receiving Application determine if this QR is stale. (Note: epoch times should be parsed into 64-bit numeric types.)"
* flag 0..1 string "Optional. String created by concatenating single-character flags in alphabetical order
  L Indicates the Health Link is intended for long-term use and manifest content can evolve over time
  P Indicates the Health Link requires a Passcode to resolves
  U Indicates the Health Link's url resolves to a single encrypted file accessible via GET, bypassing the manifest. SHALL NOT be used in combination with P."
* label 0..1 string "Optional. String no longer than 80 characters that provides a short description of the data behind the Health Link."
* v 0..1 string "Optional. Integer representing the Health Links protocol version this Health Link conforms to. MAY be omitted when the default value (1) applies."
* type 0..1 code "classifying type code" "Classifying type code to distinguish different types of health links.  If not present then the assumed value is #shl corresponding to a Smart Health Link."
* type from HL_TYPE (preferred)


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
Expression: " (! type.exists()) or (type = 'vhl')"
