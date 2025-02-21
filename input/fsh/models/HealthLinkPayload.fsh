Logical: 	HealthLinkPayload
Title: 		"Health Link Payload (DRAFT)"
Description:	"Health Link Payload (DRAFT)

A Health Link URI is generated from this payload according to the algorithm documented [here](https://build.fhir.org/ig/HL7/smart-health-cards-and-links/links-specification.html#smart-health-links-sharing-application-generates-a-smart-health-link-uri)

"
* ^url = "http://hl7.org/fhir/uv/smart-health-cards-and-links/StructureDefinition/HealthLinkPayload"
* ^version = "RC2"
* ^status = #draft
*  url 1..1 string "url" "Manifest URL for this Health Link"
*  key 1..1 string "Decryption key for processing files returned in the manifest. 43 characters, consisting of 32 random bytes base64urlencoded."
*  exp 0..1 string "Optional. Number representing expiration time in Epoch seconds, as a hint to help the Health Link Receiving Application determine if this QR is stale. (Note: epoch times should be parsed into 64-bit numeric types.)"
* flag 0..1 string "Optional. String created by concatenating single-character flags in alphabetical order:
'L' indicates the Health Link is intended for long-term use and manifest content can evolve over time; 
'P' indicates the Health Link requires a Passcode to resolves; and 'U' indicates the Health Link's url resolves to a single encrypted file accessible via GET, bypassing the manifest and SHALL NOT be used in combination with P.
</ul>
  "
* label 0..1 string "Optional. String no longer than 80 characters that provides a short description of the data behind the Health Link."
* v 0..1 string "Optional. Integer representing the Health Links protocol version this Health Link conforms to. MAY be omitted when the default value (1) applies."
* type 0..1 code "Classifying type code to distinguish different types of health links.  If not present then the Health Link is a SMART Health Link."

