ValueSet:     Participants-DEV
Title:        "WHO GDHCN Trust Network Participant - DEV"
Description:  "ValueSet of GDHCN Trust Network Participants for Development environment"

* ^status = #active
* ^experimental = true

* include codes from system Participants-DEV

// New logic for DEV environment:
// 1. If participant exists in RefMart, use RefMart code
// 2. If participant does NOT exist in RefMart, add to Participants-DEV CodeSystem
// 3. ValueSet includes codes from BOTH sources
//
// Current composition:
//   - RefMart codes (participants found in RefMart): 30
//   - Participants-DEV codes (participants NOT in RefMart): 20
//
// To regenerate, execute on tng-participants-dev repo:
//     gfind . -maxdepth 1 -type d -name '[A-Z][A-Z][A-Z](-[A-Z]+)*'

* $RefMartCountryList#AND
* $RefMartCountryList#ARG
* $RefMartCountryList#ARM
* $RefMartCountryList#BHS
* $RefMartCountryList#BLZ
* $RefMartCountryList#BRA
* $RefMartCountryList#BRB
* $RefMartCountryList#CHL
* $RefMartCountryList#COL
* $RefMartCountryList#CRI
* $RefMartCountryList#CYP
* $RefMartCountryList#DOM
* $RefMartCountryList#ECU
* $RefMartCountryList#EST
* $RefMartCountryList#GTM
* $RefMartCountryList#HND
* $RefMartCountryList#IDN
* $RefMartCountryList#LVA
* $RefMartCountryList#OMN
* $RefMartCountryList#PAN
* $RefMartCountryList#PER
* $RefMartCountryList#PRY
* $RefMartCountryList#SGP
* $RefMartCountryList#SLV
* $RefMartCountryList#SMR
* $RefMartCountryList#SUR
* $RefMartCountryList#SVN
* $RefMartCountryList#TGO
* $RefMartCountryList#URY
* $RefMartCountryList#USA
* $Participants-DEV#WHO
* $Participants-DEV#XCL
* $Participants-DEV#XML
* $Participants-DEV#XXA
* $Participants-DEV#XXB
* $Participants-DEV#XXC
* $Participants-DEV#XXD
* $Participants-DEV#XXE
* $Participants-DEV#XXF
* $Participants-DEV#XXG
* $Participants-DEV#XXH
* $Participants-DEV#XXI
* $Participants-DEV#XXJ
* $Participants-DEV#XXK
* $Participants-DEV#XXO
* $Participants-DEV#XXP
* $Participants-DEV#XXU
* $Participants-DEV#XXV
* $Participants-DEV#XXX
* $Participants-DEV#XYK

