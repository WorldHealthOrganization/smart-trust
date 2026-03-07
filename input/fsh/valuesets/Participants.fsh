ValueSet:     Participants
Title:        "WHO GDHCN Trust Network Participant"
Description:  "ValueSet of GDHCN Trust Network Participants for Production environment"

* ^status = #active
* ^experimental = true

* include codes from system Participants


// To generate this list of codes for PROD environment
// execute the following on tng-participants-prod repo:
//     gfind . -maxdepth 1 -type d -name '[A-Z][A-Z][A-Z](-[A-Z]+)*' -printf "* \$RefMartCountryList#%P\n"  | grep -v WHO
//
// in the future, will need to exclude more than just WHO as not being from the RefMart set.

* $RefMartCountryList#ALB
* $RefMartCountryList#AND
* $RefMartCountryList#ARM
* $RefMartCountryList#BEL
* $RefMartCountryList#BRA
* $RefMartCountryList#CYP
* $RefMartCountryList#CZE
* $RefMartCountryList#BEN
* $RefMartCountryList#EST
* $RefMartCountryList#FRO
* $RefMartCountryList#FIN
* $RefMartCountryList#FRA
* $RefMartCountryList#ISL
* $RefMartCountryList#IDN
* $RefMartCountryList#IRL
* $RefMartCountryList#LVA
* $RefMartCountryList#LTU
* $RefMartCountryList#MYS
* $RefMartCountryList#MLT
* $RefMartCountryList#MCO
* $RefMartCountryList#OMN
* $RefMartCountryList#NLD
* $RefMartCountryList#NZL
* $RefMartCountryList#POL
* $RefMartCountryList#PRT
* $RefMartCountryList#SMR
* $RefMartCountryList#SGP
* $RefMartCountryList#SVK
* $RefMartCountryList#SVN
* $RefMartCountryList#ESP
* $RefMartCountryList#SWE
* $RefMartCountryList#THA
* $RefMartCountryList#TGO
* $RefMartCountryList#TUR

