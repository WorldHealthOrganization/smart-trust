Alias: $IPS = http://hl7.org/fhir/uv/ips/StructureDefinition/Bundle-uv-ips
Alias: $HCertDCC = http://smart.who.int/ddcc/StructureDefinition/HCertDCC
Alias: $DDCCVS = http://smart.who.int/ddcc/StructureDefinition/DDCCCoreDataSet.VS
Alias: $DDCCTR = http://smart.who.int/ddcc/StructureDefinition/DDCCCoreDataSet.TR
Alias: $SmartHealthLink = http://smart.who.int/ips-pilgrimage/StructureDefinition/SmartHealthLink

Logical:        HCert
Title:          "Health Certificate"
Description:    "Logical Model for the HCERT

The full data structure and encoding mechanisms for HCERT are defined here: [Electronic Health Certificate Specification](/smart-trust/hcert_spec.html)

An HCERT is claim -260 within the [CBOR Web Token (CWT) Claim](https://www.rfc-editor.org/rfc/rfc8392.html).

Note for subclaims:
- subclaims 0 and above are reserved by WHO to be assigned, a new sub claim can be requested for by requesting to create a new trust domain
- subclaims for negative integer values are for development purposes and are free to use
- While this logical model mentions assigned subclaims (below), the ones listed in the Electronic Health Certificate Specification are considered authoritative
"

 
* ^url = "http://smart.who.int/trust/StructureDefinition/HCert"
* ^status = #active
* 1 0..1 $HCertDCC "HCERT EU DCC"  "HCERT EU DCC"
//* 2 0..* $RACSEL_DDVC "RACSEL Vaccination Certficate Data Set claim" "RACSEL Vaccination Certificate (PROPOSED)" 
* 3 0..* $DDCCVS "Vaccination Core Data Set claim" "DDCC Vaccination claim (PROPOSED)"
* 4 0..* $DDCCTR "Test Result Core Data Set claim" "DDCC Test Result claim (PROPOSED)"
* 5 0..* $SmartHealthLink "SMART Health Link claim" "SMART Health Link (PROPOSED)"
//* 6 0..* $IPS "IPS" "IPS Bundle (EXAMPLE)"

