Alias: $IPS = http://hl7.org/fhir/uv/ips/StructureDefinition/Bundle-uv-ips
Alias: $HCertDCC = http://smart.who.int/ddcc/StructureDefinition/HCertDCC
Alias: $DDCCVS = http://smart.who.int/ddcc/StructureDefinition/DDCCCoreDataSet.VS
Alias: $DDCCTR = http://smart.who.int/ddcc/StructureDefinition/DDCCCoreDataSet.TR
Alias: $SmartHealthLink = http://smart.who.int/ips-pilgrimage/StructureDefinition/SmartHealthLink

Logical:        HCert
Title:          "Health Certificate"
Description:    "Logical Model for the HCERT

The full data structure and encoding mechanisms for HCERT are defined here: [Electronic Health Certificate Specification](http://smart.who.int/trust/hcert_spec.html)"

* ^url = "http://smart.who.int/trust/StructureDefinition/HCert"
* ^version = "1.1.0"
* ^status = #active
* hcert 0..1 $HCertDCC "HCERT EU DCC"  "HCERT EU DCC"
// * 2 0..* RACSEL_DDVC "RACSEL Vaccination Certficate Data Set claim" "RACSEL Vaccination Certificate (PROPOSED)" 
* ddccvs 0..* $DDCCVS "Vaccination Core Data Set claim" "DDCC Vaccination claim (PROPOSED)"
* ddcctr 0..* $DDCCTR "Test Result Core Data Set claim" "DDCC Test Result claim (PROPOSED)"
* shl 0..* $SmartHealthLink "SMART Health Link claim" "SMART Health Link (PROPOSED)"
* ips 0..* $IPS "IPS" "IPS Bundle (EXAMPLE)"