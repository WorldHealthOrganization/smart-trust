
Logical:       CWTPayload
Title:	       "CBOR Web Token (CWT) Payload (Common)"
Description:   "Logical Model for CBOR Web Token (CWT) Payload Logical Modelin CWT Payload https://www.iana.org/assignments/cwt/cwt.xhtml "


* ^url = "http://smart.who.int/trust/StructureDefinition/CWTPayload"
* ^status = #active

// HCERT spec 3.2.4: iss is a string value, optionally an ISO 3166-1 alpha-2 code
* 1 0..1 string "Issuer Code (iss)" "Issuer"
* 1 obeys iss-alpha-2
* 4 0..1 dateTime "Expiration Date Time(exp)" "Expiration Time"
* 6 0..1 dateTime "Issued At (iat)" "Issued At"
// HCERT spec 3.2.7: several types of health certificate share this claim key,
// one per certificate; the type is selected by the HCert subclaim
* -260 1..1 HCert "Health Certificate" "HCert"

Invariant: iss-alpha-2
Description: "The issuer claim, when present, is a two-letter upper-case ISO 3166-1 alpha-2 code"
Expression: "$this.matches('^[A-Z]{2}$')"
Severity: #error

