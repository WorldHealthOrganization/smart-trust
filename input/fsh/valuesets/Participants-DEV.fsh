ValueSet:     Participants-DEV
Title:        "WHO GDHCN Trust Network Participant - DEV"
Description:  "ValueSet of GDHCN Trust Network Participants for Development environment"

* ^status = #active
* ^experimental = true

* include codes from system Participants-DEV


// To generate this list of codes for DEV environment
// execute the following on tng-participants-dev repo:
//     gfind . -maxdepth 1 -type d -name '[A-Z][A-Z][A-Z](-[A-Z]+)*' -printf "* \$Participants-DEV#%P\n"  | grep -v WHO

* $Participants-DEV#AND
* $Participants-DEV#ARG
* $Participants-DEV#ARM
* $Participants-DEV#BHS
* $Participants-DEV#BLZ
* $Participants-DEV#BRA
* $Participants-DEV#BRB
* $Participants-DEV#CHL
* $Participants-DEV#COL
* $Participants-DEV#CRI
* $Participants-DEV#CYP
* $Participants-DEV#DOM
* $Participants-DEV#ECU
* $Participants-DEV#EST
* $Participants-DEV#GTM
* $Participants-DEV#HND
* $Participants-DEV#IDN
* $Participants-DEV#LVA
* $Participants-DEV#OMN
* $Participants-DEV#PAN
* $Participants-DEV#PER
* $Participants-DEV#PRY
* $Participants-DEV#SGP
* $Participants-DEV#SLV
* $Participants-DEV#SMR
* $Participants-DEV#SUR
* $Participants-DEV#SVN
* $Participants-DEV#TGO
* $Participants-DEV#URY
* $Participants-DEV#USA
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

