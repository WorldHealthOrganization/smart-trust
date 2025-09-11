CodeSystem: KeyUsage-DEV
Title:        "WHO GDHCN Key Usage CodeSystem - DEV"
Description:  """
CodeSystem for GDHCN Key Usage that has usage codes for verification keys published to the Trust Network as defined by the [certificate governance](concepts_certificate_governance.html) for Development environment
"""

* ^experimental = true
* ^caseSensitive = false

* ^status = #active

* #SCA "Signer Certificate Authority (SCA)"	"A certificate which acts a trust anchor in the verification of the certificate chain for the DSCs issued by a Trust Network participant"
* #DSC "Document Signing Certificate (DSC)"	"A certificate which may be used to verify a digital signature within a Verfifiable Digital Health Certificate"

* #DECA "Data Exchange Certificate Authority (DECA)"	"A certificate which acts a trust anchor in the verification of the certificate chain for the DESCs issued by a Trust Network Participant"
* #DESC "Data Exchange Signing Certificate (DESC)"	"A certificate which may be used to initiate a secure data exchange connection (e.g. mTLS) between Trust Network Participants"

* #TLS "Transport Layer Security (TLS)"	 	"Used for establishing (m)TLS connections with systems, in particular between the Trust Network Gateway and backend systems of a Trust Network Participant"
* #UP  "Upload (UP)"		 		"Used to verify digital signature of cryptographically signed content uploaded to services within the Global Digital Health Certification Network, in particular the Trust Network Gateway"