

Logical:        CWT
Title:          "CBOR Web Token (CWT) Claim"
Description:    "Logical Model for Data elements in CBOR Web Token (CWT) https://www.iana.org/assignments/cwt/cwt.xhtml"

* ^url = "http://smart.who.int/trust/StructureDefinition/CWT"
* ^abstract = true
* ^status = #active
* header 1..1 COSEHeader "COSE Header" "Header"
* payload 1..1 CWTPayload "CWT Payload"  "Payload"
* signature 1..1 string "Signature" "Signature"
