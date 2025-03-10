CodeSystem: WHO.TRUST.ACTOR
Title:        "WHO.TRUST.ACTOR CodeSystem"
Description:  """
CodeSystem for TRUST.ACTOR that has usage codes for verification keys published to the Trust Network as defined by the [certificate governance](concepts_certificate_governance.html)
"""

* ^experimental = true
* ^caseSensitive = false
* ^name = "WHO_TRUST_ACTOR"
* ^status = #active

* #credential-holder "Holder of a Credential"
* #credential-issuer "Issuer of a Credential"
* #gdhcn "GDHCN" "Global Digital Health Certification Network (GDHCN)"
* #TNG "TNG" "Trust Network Gateway"
* #TNP "TNP" "Trust Network Participant"
