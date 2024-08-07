CodeSystem: WHO.TRUST.KEYUSAGE
Title:        "WHO.TRUST.KEYUSAGE CodeSystem"
Description:  """
CodeSystem for TRUST.KEYUSAGE that has usage codes for verification keys published to the Trust Network as defined by the [certificate governance](concepts_certificate_governance.html)
"""

* ^experimental = true
* ^caseSensitive = false
* ^name = "WHO_TRUST_KEYUSAGE"
* ^status = #active

* #SCA "Signer Certificate Authority (SCA)"	"A certificate which acts a trust anchor in the verification of the certificate chain for the DSCs issued by a Trust Network participant"
* #DSC "Document Signing Certificate (DSC)"	"A certificate which may be used to verify a digital signature within a Verfifiable Digital Health Certificate"
* #TLS "Transport Layer Security (TLS)"	 	"Used for establishing (m)TLS connections with systems, in particular between the Trust Network Gateway and backend systems of a Trust Network Participant"
* #UP  "Upload (UP)"		 		"Used to verify digital signature of cryptographically signed content uploaded to services within the Global Digital Health Certification Network, in particular the Trust Network Gateway"
