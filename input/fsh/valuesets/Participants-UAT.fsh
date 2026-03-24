ValueSet:     Participants-UAT
Title:        "WHO GDHCN Trust Network Participant - UAT"
Description:  "ValueSet of GDHCN Trust Network Participants for User Acceptance Testing environment"

* ^status = #active
* ^experimental = true

* include codes from system Participants-UAT

// New logic for UAT environment:
// 1. If participant exists in RefMart, use RefMart code
// 2. If participant does NOT exist in RefMart, add to Participants-UAT CodeSystem
// 3. ValueSet includes codes from BOTH sources
//
// Current composition:
//   - RefMart codes (participants found in RefMart): 36
//   - Participants-UAT codes (participants NOT in RefMart): 11
//
// To regenerate, execute on tng-participants-uat repo:
//     gfind . -maxdepth 1 -type d -name '[A-Z][A-Z][A-Z](-[A-Z]+)*'

* $RefMartCountryList#ALB
* $RefMartCountryList#AND
* $RefMartCountryList#ARM
* $RefMartCountryList#BEL
* $RefMartCountryList#BEN
* $RefMartCountryList#BRA
* $RefMartCountryList#CAN
* $RefMartCountryList#CYP
* $RefMartCountryList#CZE
* $RefMartCountryList#ESP
* $RefMartCountryList#EST
* $RefMartCountryList#FIN
* $RefMartCountryList#FRA
* $RefMartCountryList#FRO
* $RefMartCountryList#HRV
* $RefMartCountryList#IDN
* $RefMartCountryList#IRL
* $RefMartCountryList#LTU
* $RefMartCountryList#LVA
* $RefMartCountryList#MCO
* $RefMartCountryList#MLT
* $RefMartCountryList#MYS
* $RefMartCountryList#NLD
* $RefMartCountryList#NZL
* $RefMartCountryList#OMN
* $RefMartCountryList#POL
* $RefMartCountryList#PRT
* $RefMartCountryList#SAU
* $RefMartCountryList#SGP
* $RefMartCountryList#SMR
* $RefMartCountryList#SVK
* $RefMartCountryList#SVN
* $RefMartCountryList#SWE
* $RefMartCountryList#TGO
* $RefMartCountryList#THA
* $RefMartCountryList#TUR
* $Participants-UAT#WHO
* $Participants-UAT#XXA
* $Participants-UAT#XXB
* $Participants-UAT#XXC
* $Participants-UAT#XXD
* $Participants-UAT#XXO
* $Participants-UAT#XXS
* $Participants-UAT#XXU
* $Participants-UAT#XXV
* $Participants-UAT#XXX
* $Participants-UAT#XYK

