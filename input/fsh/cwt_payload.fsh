
Logical:       CWTPayload
Title:	       "CBOR Web Token (CWT) Payload (Common)"
Description:   "Logical Model for CBOR Web Token (CWT) Payload Logical Modelin CWT Payload https://www.iana.org/assignments/cwt/cwt.xhtml "


* ^url = "http://smart.who.int/trust/StructureDefinition/CWTPayload"
* ^version = "1.0.0"
* ^status = #draft

* 1 0..1 Coding "Issuer Code (iss)" "Issuer"
* 4 0..1 dateTime "Expiration Date Time(exp)" "Expiration Time"
* 6 0..1 dateTime "Issued At (iat)" "Issued At"
* -260 0..1 HCert "Health Certificate" "HCert"

