---
doc_id: who-2019-ncov-digital-certificates-vaccination-20211-eng
doc_title: "DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021 SECTION 1"
section_id: sec-004-14-assumptions
section_title: "Assumptions"
section_number: 1.4
pages: 20-22
source_pdf: WHO-2019-nCoV-Digital-certificates-vaccination-2021.1-eng.pdf
source_sha256: f57b14cb2acb728d
toc_source: inferred
---
The technological specification for a DDCC:VS is intended to be flexible and adaptable for each Member 
State to meet its diverse public health needs as well as the diverse needs of individuals around the 
world. It is assumed that there is no one-size-fits-all solution, and so the specification must remain 
flexible and software-agnostic, while minimizing the amount of digital infrastructure required. 
The requirements outlined are intended to allow for DDCC:VS solutions to meet the needs of a 
country’s holistic public health preparedness and response plan, while still being usable in other 
national and local contexts. An overarching assumption is that multiple digital health products and 
solutions will be implemented to operationalize the requirements described in this document. This 
allows for support of local and sustainable development so that Member States have a broad choice of 
appropriate solutions without excluding compliant products from any source.
The following assumptions are made about Member States’ responsibilities as foundational aspects of 
setting up and running a DDCC:VS solution. 
	
→Member States will be responsible for implementing the policies necessary to support the 
DDCC:VS workflows, complying with their legal obligations under national and international 
law, including any applicable obligations related to respecting human rights and data protection 
policies.
Page
4
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Introduction
SECTION 1
	
→Member States will adhere to ethical principles and act to prevent new inequities from being 
created by a DDCC:VS solution.
	
→The DDCC:VS is a health document associated with an individual who has proved that they are who 
they claim to be, based on the policies established by the Member State; it is not, itself, an identity 
card or identification document.
	
→It will be up to the Member State to determine the mechanism for unique identification of the 
Subject of Care. For continuity of care, a health worker is able to ascertain the identity of a Subject 
of Care as per the norms and policies of the Public Health Authority (PHA) and based on existing 
national laws and policies. 
	
→It will be up to the Member State to determine the format in which to implement the DDCC:VS. 
To avoid digital exclusion, the recommendations and requirements in the current document 
are designed to support the use of paper augmented with 1D or 2D barcodes or a smartphone 
application, or in another format.
	
→If a Member State decides to implement the DDCC:VS in paper format, any paper vaccination card 
issued will have a health certificate identifier (HCID) in both a human-readable and, additionally, 
a machine-readable (1D or 2D barcode) format to link it to a digital record. The HCID will be used as 
an index for the DDCC:VS.
	
→Respecting the data protection principles (see section 2.2), Members States will adhere to data 
protection and privacy laws and regulations established under national law or adopted through 
bilateral or multilateral agreements. 
	
→The PHA of a Member State will need to have access to a national public key infrastructure (PKI) 
for digitally signing the DDCC:VS. This document does not describe the PKI in detail, but key 
assumptions are that the PHA will need to:
	»
establish and maintain a root certificate authority that anchors the country’s PKI for the purposes of 
supporting DDCC:VS;
	»
generate and cryptographically sign document signer certificates (DSCs);
	»
authorize document signer private keys to cryptographically sign digital DDCC:VS;
	»
broadly disseminate public keys if there is a desire to allow others to validate issued DDCC:VS;
	»
allow for the health content contained within a traditional paper vaccination card to be digitized 
and verifiable by one or more digital representations, including, as a minimum, a DDCC:VS identified 
through the HCID; a Member State may choose to also generate and distribute to the DDCC:VS Holder 
a signed 2D barcode as a digital representation, containing, as a minimum, the core data set content 
(e.g. printed on or attached to the paper record, sent by email, loaded into a smartphone app or 
downloaded from website); 
	»
keep the signature-verification processes manageable; the number of private keys used by the PHA 
to sign DDCC:VS should be no more than a small proportion relative to the number of digital health 
solutions used to capture health events; and
	»
ensure private keys used to sign DDCC:VS will not be associated with individual health workers.
	
→The PHA will need to operate a DDCC:VS Generation Service to create DDCC:VS, and a DDCC:VS 
Registry Service to record their issuance. Optionally, the PHA may also decide to provide a DDCC:VS 
Repository Service to allow requesters to search for, and retrieve, a DDCC:VS using the HCID (for 
the purposes of verification or continuity of care).
	
→Subsequent vaccinations recorded on a paper card may be added to the Subject of Care’s digital 
record associated to the HCID on the paper card, resulting in a new instance of a DDCC:VS. 
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Page
5
SECTION 1
Introduction
