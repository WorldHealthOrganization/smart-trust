// Quoted from Annex I (GDHCN Trust Domain: DDCC), "Policy and regulatory
// standards", of the GDHCN Administrative and Operational Framework 1.2.
CodeSystem: DDCCTermsOfUse
Title: "DDCC Trust Domain terms of use"
Description: "The policy and regulatory standards of the DDCC Trust Domain, quoted from Annex I of the GDHCN Administrative and Operational Framework 1.2. GDHCN Participants confirm their readiness and intent to follow each one."
* ^experimental = true
* ^caseSensitive = true
* ^status = #draft
* ^version = "1.2"
* #DDCC-DATA-PROTECTION "Ethical principles and data protection" "comply with Ethical principles and data protection considerations outlined in Section 2 of: https://www.who.int/publications/i/item/WHO-2019-nCoV-Digital_certificates-vaccination-2021.1 and in particular ensure that the personal data contained in the certificates issued shall be processed only for the purpose of accessing and verifying the information included in the certificate, shall be limited to what is strictly necessary for the intended use case, and shall not be retained longer than is strictly necessary"
* #DDCC-GDHCN-STANDARDS "GDHCN standards and cybersecurity" "comply with standards, cybersecurity requirements and technological systems and processes for the GDHCN as described in https://smart.who.int/trust/"
* #DDCC-VERIFIABLE "Verifiable through the GDHCN" "ensure that COVID-19 certificates issued can be verified for their authenticity, validity and integrity utilizing the WHO GDHCN"

ValueSet: DDCCTermsOfUse
Title: "DDCC Trust Domain terms of use"
Description: "The policies of the DDCC Trust Domain that a participant may name in a VC termsOfUse entry (TrustDomainPolicy)."
* ^experimental = true
* ^status = #draft
* include codes from system DDCCTermsOfUse
