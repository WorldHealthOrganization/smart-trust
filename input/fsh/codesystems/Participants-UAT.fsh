CodeSystem: Participants-UAT
Title:        "WHO GDHCN Trust Network Participants CodeSystem - UAT"
Description:  """
CodeSystem for GDHCN Trust Network Participants for User Acceptance Testing environment - includes only participants that are not in the RefMart Country List
"""

* ^experimental = true
* ^caseSensitive = false
* ^name = "Participants-UAT"
* ^status = #active

* #WHO "WHO" "World Health Organization"
// Note: Additional participants will be populated from the UAT repository
// This should only include participants that are NOT already in the RefMart Country List