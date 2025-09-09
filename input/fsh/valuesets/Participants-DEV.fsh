ValueSet:     Participants-DEV
Title:        "WHO GDHCN Trust Network Participant - DEV"
Description:  "ValueSet of GDHCN Trust Network Participants for Development environment"

* ^status = #active
* ^experimental = true

* include codes from system Participants-DEV


// To generate this list of codes for DEV environment
// execute the following on tng-participants-dev repo:
//     gfind . -maxdepth 1 -type d -name '[A-Z][A-Z][A-Z](-[A-Z]+)*' -printf "* \$Participants-DEV#%P\n"  | grep -v WHO

* $Participants-DEV#TST
* $Participants-DEV#ABC
* $Participants-DEV#XYZ

