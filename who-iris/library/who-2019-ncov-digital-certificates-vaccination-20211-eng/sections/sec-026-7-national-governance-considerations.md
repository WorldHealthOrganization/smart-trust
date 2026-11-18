---
doc_id: who-2019-ncov-digital-certificates-vaccination-20211-eng
doc_title: "DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021 SECTION 1"
section_id: sec-026-7-national-governance-considerations
section_title: "National governance considerations"
section_number: 7
pages: 68-70
source_pdf: WHO-2019-nCoV-Digital-certificates-vaccination-2021.1-eng.pdf
source_sha256: f57b14cb2acb728d
toc_source: inferred
---
SECTION
National 
governance 
considerations 
7 
Governance in the health sector is “a wide range of steering and 
rule-making related functions carried out by governments/decisions 
makers as they seek to achieve national health policy objectives that 
are conducive to universal health coverage” (33). A national framework 
to govern the complex and dynamic health policy for implementing 
DDCC:VS should be tailored to meet the Member State’s needs, which 
vary. This section provides an overview of some key governance 
considerations for Member States implementing DDCC:VS solutions. 
However, it will be the responsibility of the Member State to determine 
the most appropriate governance mechanisms for its context. 
Fundamentally, trust in the system should derive from the security-by-design of a PKI and the 
governance rules put in place by the Member State to operate it. The Proof of Vaccination scenario of 
use requires governance to be established at two levels: 1. the PHA; and 2. the Member State. At PHA 
level, at least one DSC needs to be utilized to sign the DDCC:VS. At Member State level, an authorized 
DSC-sharing mechanism needs to be established to indicate which DSCs are currently permitted to 
sign the DDCC:VS. There are two recommended approaches.
1.	 ROOT CERTIFICATE AUTHORITY: The Member State establishes a root certificate authority, which 
holds a root certificate for the DDCC:VS. The private key of the Root Certificate managed by the 
Member State may be used by the Member State to sign a PHA’s DSC that has been authorized for 
use. The public key of the root certificate can be used to validate that the DSC is authorized. Note 
that the term “root” does not imply hierarchy or that the root certificate authority is at the top of 
that hierarchy. Rather, it is used to denote that a root certificate authority may be trusted directly 
(34). 
2.	 MASTER LIST: The Member State establishes a mechanism to manage and distribute, as appropriate, 
a master list of DSCs that have been authorized for PHAs to use to sign the DDCC:VS.
Member States can leverage an existing PKI or create a new one specifically for DDCC:VS. Regardless, 
depending on how a Member State’s health systems are organized, there are several PKI options that the 
national-level ministry of health could consider, depending on the governance context in the Member State.
Page
52
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
National governance considerations
SECTION 7
To ensure that national governing bodies can establish mutual trust with other Member States through 
bilateral or multilateral agreements, governance mechanisms should be in place for the digital signing 
infrastructure based on each Member State’s governance context. In addition to the authorized DSC-
sharing mechanism, the following components should be addressed, with clear policies in place for 
each Member State.
	
→ISSUING DDCC:VS: There should be clear and transparent processes in place for issuing DDCC:VS in 
order to establish trust in the system. Transparently acknowledging which entities are eligible to 
issue a DDCC:VS reduces the potential for fraudulent issuance of DDCC:VS and provides accountable 
entities when possible fraud has occurred. 
	
→VERIFYING DDCC:VS: Member States need to define the requirements for what it means to have a 
“valid” DDCC:VS. Furthermore, Member States will need to decide whether the DDCC:VS can be 
verified by anyone with the means to verify a DDCC:VS; alternatively, they may decide on a list 
of trusted Verifiers, in which case only trusted Verifiers would be able to verify a DDCC:VS. The 
appropriate privacy mechanisms should be built into the implementation based on this decision. 
	
→REVOCATION OF DDCC:VS: There should be clear and transparent processes for revocation of a 
DDCC:VS in case fraud has occurred, incorrect information needs to be rectified, faulty vaccine 
batches have been discovered or issues have been detected within the vaccine supply chain. These 
revocation processes should also include standard operating procedures for:
	»
INFORMING INDIVIDUALS: Individuals will need to be informed if their DDCC:VS has been revoked 
and for what reason. Enforcing revocation without clearly communicated justification may lead to 
erosion of trust in governing bodies.
	»
INFORMING VERIFIERS: Verifiers will need to be informed if DDCC:VS have been revoked in order to 
be able to continuously trust that DDCC:VS issued by a specific entity are still valid. For example, 
if there are reports of counterfeit DDCC:VS, Verifiers should be informed about the possibility of 
encountering counterfeit DDCC:VS. This allows for continued trust in the system.
	»
REMEDY PROVISION: If a DDCC:VS is revoked, Member States should apply measures to rectify the 
situation, for example, by providing the option of a new vaccination, if advisable. Alternatively, there 
might be processes to obtain a new, verifiable DDCC:VS.
	
→DATA MANAGEMENT AND PRIVACY PROTECTION: Member States are responsible for data timeliness 
and completeness, and for the accuracy of DDCC:VS issued by their PHAs. Personal data about 
individuals with DDCC:VS from other countries need to be processed according to a set of principles 
and processes agreed upon by Member States, in order to establish trust between Member States. 
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Page
53
SECTION 8
