ValueSet:     Participants-UAT
Title:        "WHO GDHCN Trust Network Participant - UAT"
Description:  "ValueSet of GDHCN Trust Network Participants for User Acceptance Testing environment"

* ^status = #active
* ^experimental = true

* include codes from system Participants-UAT


// To generate this list of codes for UAT environment
// execute the following on tng-participants-uat repo:
//     gfind . -maxdepth 1 -type d -name '[A-Z][A-Z][A-Z](-[A-Z]+)*' -printf "* \$Participants-UAT#%P\n"  | grep -v WHO
// Note: Only includes participants NOT found in RefMart

* $Participants-UAT#TST
* $Participants-UAT#DEV

