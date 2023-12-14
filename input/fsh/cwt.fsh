

Logical:        CWT
Title:          "CBOR Web Token (CWT) Claim"
Description:    "Logical Model for Data elements in CBOR Web Token (CWT) https://www.iana.org/assignments/cwt/cwt.xhtml"

* ^url = "http://smart.who.int/ddcc/StructureDefinition/CWT"
* ^version = "RC2"
* ^abstract = true
* ^status = #draft
* header 0..1 COSEHeader "COSE Header" "Header"
* payload 0..1 CWTPayload "CWT Payload"  "Payload"
* signature 0..1 string "Signature" "Signature"
