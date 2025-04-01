CodeSystem: Actors
Title:        "WHO GDHCN Trust Actors CodeSystem"
Description:  """
CodeSystem for SMART Trust actors that has usage codes for verification keys published to the Trust Network as defined by the [certificate governance](concepts_certificate_governance.html)
"""

* ^experimental = true
* ^caseSensitive = false

* ^status = #active

* #credential-holder "Holder of a Credential"
* #credential-issuer "Issuer of a Credential"
* #gdhcn "GDHCN" "Global Digital Health Certification Network (GDHCN)"
* #TNG "TNG" "Trust Network Gateway"
* #TNP "TNP" "Trust Network Participant"
