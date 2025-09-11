ValueSet:     Participants-DEV
Title:        "WHO GDHCN Trust Network Participant - DEV"
Description:  "ValueSet of GDHCN Trust Network Participants for Development environment"

* ^status = #active
* ^experimental = true

// Include ALL codes from Participants-DEV CodeSystem (new participants not in RefMart)
* include codes from system Participants-DEV

// Include ONLY specific RefMart codes for participants found in DEV repo

// New logic for DEV environment:
// 1. If participant exists in RefMart, use RefMart code
// 2. If participant does NOT exist in RefMart, add to Participants-DEV CodeSystem
// 3. ValueSet includes codes from BOTH sources
//
// Current composition:
//   - RefMart codes (participants found in RefMart): 30
//   - Participants-DEV codes (participants NOT in RefMart): 19
//
// To regenerate, execute on tng-participants-dev repo:
//     gfind . -maxdepth 1 -type d -name '[A-Z][A-Z][A-Z](-[A-Z]+)*' | grep -v WHO

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

