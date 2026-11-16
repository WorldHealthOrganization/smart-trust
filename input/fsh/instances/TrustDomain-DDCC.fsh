// From Annex I of the GDHCN Administrative and Operational Framework 1.2.
// The terms of use are not yet used by any BPMN business process, so
// invariant gdhcn-td-4 reports this instance until one is linked.
Instance: TrustDomain-DDCC
InstanceOf: TrustDomain
Title: "Trust Domain: DDCC"
Description: "The Digital Documentation of COVID-19 Certificates (DDCC) Trust Domain, from Annex I of the GDHCN Administrative and Operational Framework 1.2."
Usage: #example
* code = #DDCC
* name = "Digital Documentation of COVID-19 Certificates (DDCC)"
* description = "Defined in Annex I of the GDHCN Administrative and Operational Framework 1.2. It covers the utilization of COVID-19 Vaccine Certificates and Test Certificates."
* useCase[0].title = "DDCC: Vaccination Status (DDCC:VS)"
* useCase[0].description = "Technical specifications and implementation guidance for vaccination certificates for the purposes of continuity of care and proof of vaccination."
* useCase[1].title = "DDCC: Test Result (DDCC:TR)"
* useCase[1].description = "Technical specifications and implementation guidance for test result certificates that attest to: (a) the fact that an individual has been tested for SARS-CoV-2, and (b) the result of that SARS-CoV-2 diagnostic test."
* technicalSpecification[0] = "https://smart.who.int/ddcc/"
* policyStandard[0].code = DDCCTermsOfUse#DDCC-DATA-PROTECTION
* policyStandard[0].text = "comply with Ethical principles and data protection considerations outlined in Section 2 of: https://www.who.int/publications/i/item/WHO-2019-nCoV-Digital_certificates-vaccination-2021.1 and in particular ensure that the personal data contained in the certificates issued shall be processed only for the purpose of accessing and verifying the information included in the certificate, shall be limited to what is strictly necessary for the intended use case, and shall not be retained longer than is strictly necessary"
* policyStandard[1].code = DDCCTermsOfUse#DDCC-GDHCN-STANDARDS
* policyStandard[1].text = "comply with standards, cybersecurity requirements and technological systems and processes for the GDHCN as described in https://smart.who.int/trust/"
* policyStandard[2].code = DDCCTermsOfUse#DDCC-VERIFIABLE
* policyStandard[2].text = "ensure that COVID-19 certificates issued can be verified for their authenticity, validity and integrity utilizing the WHO GDHCN"
* termsOfUse.valueSet = Canonical(DDCCTermsOfUse)
