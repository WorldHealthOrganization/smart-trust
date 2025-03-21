ValueSet:     Participants
Title:        "GDHCN Trust Network Participant"
Description:  "ValueSet of GDHCN Trust Network Participants"

* ^status = #active
* ^experimental = true

* include codes from system Participants


// To generate this list of codes
// execute the following on tng-participants-prod repo:
//     gfind . -maxdepth 1 -type d -name '[A-Z][A-Z][A-Z]' -printf "* \$GHOCountryList#%P\n"  | grep -v WHO
//
// in the future, will need to exclude more than just WHO as not being from the ISO set.

* $GHOCountryList#BRA
* $GHOCountryList#SVN
* $GHOCountryList#OMN
* $GHOCountryList#POL
* $GHOCountryList#FRO
* $GHOCountryList#FRA
* $GHOCountryList#ESP
* $GHOCountryList#PRT
* $GHOCountryList#FIN
* $GHOCountryList#SMR
* $GHOCountryList#UKR
* $GHOCountryList#MYS
* $GHOCountryList#BEL
* $GHOCountryList#TUR
* $GHOCountryList#IRL
* $GHOCountryList#ALB
* $GHOCountryList#LVA
* $GHOCountryList#TGO
* $GHOCountryList#SWE
* $GHOCountryList#MLT
* $GHOCountryList#LTU
* $GHOCountryList#AND
* $GHOCountryList#SVK
* $GHOCountryList#IDN
* $GHOCountryList#CZE
* $GHOCountryList#NLD
* $GHOCountryList#EST
* $GHOCountryList#BEN
* $GHOCountryList#SGP
* $GHOCountryList#ISL
* $GHOCountryList#CYP
* $GHOCountryList#ARM
* $GHOCountryList#THA
* $GHOCountryList#MCO
* $GHOCountryList#NZL
 