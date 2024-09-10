Logical: 	SmartHealthLinkPayload
Title: 		"Smart Health Link Payload (DRAFT)"
Description:	"Smart Health Link Payload (DRAFT)

This logical model was taken from the SMART Health Link documentation <https://docs.smarthealthit.org/smart-health-links/spec#construct-a-shlink-payload> as if 30 November 2023.

A [[ SMART Health Link]] is generated from this payload according to the algorithm documented here <https://docs.smarthealthit.org/smart-health-links/spec#example-shlink-generation> to create a 

It is generated 

"

* ^url = "http://smart.who.int/trust/StructureDefinition/SmartHealthLinkPayload"
* ^version = "RC2"
* ^status = #draft
*  url 1..1 string "url" "Manifest URL for this SHLink"
*  key 1..1 string "Decryption key for processing files returned in the manifest. 43 characters, consisting of 32 random bytes base64urlencoded."
*  exp 0..1 string "Optional. Number representing expiration time in Epoch seconds, as a hint to help the SHL Receiving Application determine if this QR is stale. (Note: epoch times should be parsed into 64-bit numeric types.)"
* flag 0..1 string "Optional. String created by concatenating single-character flags in alphabetical order
  L Indicates the SHLink is intended for long-term use and manifest content can evolve over time
  P Indicates the SHLink requires a Passcode to resolves
  U Indicates the SHLink's url resolves to a single encrypted file accessible via GET, bypassing the manifest. SHALL NOT be used in combination with P."
* label 0..1 string "Optional. String no longer than 80 characters that provides a short description of the data behind the SHLink."
* v 0..1 string "Optional. Integer representing the SHLinks protocol version this SHLink conforms to. MAY be omitted when the default value (1) applies."