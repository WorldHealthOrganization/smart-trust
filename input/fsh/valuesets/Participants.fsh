ValueSet:     Participants
Title:        "GDHCN Trust Network Participant"
Description:  "ValueSet of GDHCN Trust Network Participants"

* ^status = #active
* ^experimental = true
* ^name = "Participants"

* include codes from system $Participants


// To generate this list of codes
// execute the following on tng-participants-prod repo:
//     gfind . -maxdepth 1 -type d -name '[A-Z][A-Z][A-Z]' -printf "* \$ISO31663#%P\n"  | grep -v WHO
//
// in the future, will need to exclude more than just WHO as not being from the ISO set.

* $ISO31663#BRA
* $ISO31663#SVN
* $ISO31663#OMN
* $ISO31663#POL
* $ISO31663#FRO
* $ISO31663#FRA
* $ISO31663#ESP
* $ISO31663#PRT
* $ISO31663#FIN
* $ISO31663#SMR
* $ISO31663#UKR
* $ISO31663#MYS
* $ISO31663#BEL
* $ISO31663#TUR
* $ISO31663#IRL
* $ISO31663#ALB
* $ISO31663#LVA
* $ISO31663#TGO
* $ISO31663#SWE
* $ISO31663#MLT
* $ISO31663#LTU
* $ISO31663#AND
* $ISO31663#SVK
* $ISO31663#IDN
* $ISO31663#CZE
* $ISO31663#XXO
* $ISO31663#NLD
* $ISO31663#EST
* $ISO31663#BEN
* $ISO31663#SGP
* $ISO31663#ISL
* $ISO31663#CYP
* $ISO31663#ARM
* $ISO31663#THA
* $ISO31663#MCO
* $ISO31663#NZL
 