ValueSet:     Participants
Title:        "WHO GDHCN Trust Network Participant"
Description:  "ValueSet of GDHCN Trust Network Participants"

* ^status = #active
* ^experimental = true

* include codes from system Participants


// To generate this list of codes
// execute the following on tng-participants-prod repo:
//     gfind . -maxdepth 1 -type d -name '[A-Z][A-Z][A-Z]' -printf "* \$RefMartCountryList#%P\n"  | grep -v WHO
//
// in the future, will need to exclude more than just WHO as not being from the ISO set.

* $RefMartCountryList#BRA
* $RefMartCountryList#SVN
* $RefMartCountryList#OMN
* $RefMartCountryList#POL
* $RefMartCountryList#FRO
* $RefMartCountryList#FRA
* $RefMartCountryList#ESP
* $RefMartCountryList#PRT
* $RefMartCountryList#FIN
* $RefMartCountryList#SMR
* $RefMartCountryList#UKR
* $RefMartCountryList#MYS
* $RefMartCountryList#BEL
* $RefMartCountryList#TUR
* $RefMartCountryList#IRL
* $RefMartCountryList#ALB
* $RefMartCountryList#LVA
* $RefMartCountryList#TGO
* $RefMartCountryList#SWE
* $RefMartCountryList#MLT
* $RefMartCountryList#LTU
* $RefMartCountryList#AND
* $RefMartCountryList#SVK
* $RefMartCountryList#IDN
* $RefMartCountryList#CZE
* $RefMartCountryList#NLD
* $RefMartCountryList#EST
* $RefMartCountryList#BEN
* $RefMartCountryList#SGP
* $RefMartCountryList#ISL
* $RefMartCountryList#CYP
* $RefMartCountryList#ARM
* $RefMartCountryList#THA
* $RefMartCountryList#MCO
* $RefMartCountryList#NZL
 