---
doc_id: who-2019-ncov-digital-certificates-vaccination-20211-eng
doc_title: "DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021 SECTION 1"
section_id: sec-021-51-core-data-set-principles
section_title: "Core data set principles"
section_number: 5.1
pages: 57-59
source_pdf: WHO-2019-nCoV-Digital-certificates-vaccination-2021.1-eng.pdf
source_sha256: f57b14cb2acb728d
toc_source: inferred
---
To develop the core data set, data requirements under the International Health Regulations (15), WHO 
home-based records guidance (13), WHO adverse events following immunization (AEFI) reporting 
requirements (26) and WHO immunization programme monitoring guidance are considered (12). 
The core data set has been further informed by analysis of existing digital vaccination certificates 
deployed in some countries and by pre-existing standards for digital vaccination certificates.
The following key principles were used to guide the formulation of the core data set.
	
→DATA MINIMIZATION. Aligned with the principle of data privacy protection, only the minimum set 
of data elements necessary for documenting a vaccination event for the purposes of a DDCC:VS 
should be included. Each data element must have a purpose in accordance with the predefined use 
cases. This is especially important for personal data.
	
→OPEN STANDARDS. Aligned with the principle of open access, proprietary terminology code systems 
or proprietary standards cannot be recommended to Member States. 
	
→IMPLEMENTABLE ON DIGITAL AND PAPER. Aligned with the principle of equity, data requirements 
should not increase inequities or put individuals at risk. Additionally, data input requirements 
should be feasible on paper but take advantage of the benefits of digital technology. 
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Page
41
SECTION 5
DDCC:VS core data set 
	
→NOT ALL DATA ELEMENTS NEED TO BE IN THE VACCINATION CERTIFICATE. Aligned with the principle of 
capability, flexibility and sustainability, the vaccination certificate is intended to be part of a much 
larger ecosystem of immunization information systems which include:
	»
EIRs (such as OpenSRP [27]);
	»
reporting systems for vaccine coverage monitoring (such as District Health Information Software 2; 
DHIS2 [28]); and
	»
AEFI reporting systems (such as Vigiflow [29]).
To underscore the importance of the ability to implement, the data content model for the DDCC:VS 
core data set has been developed as an HL7 FHIR implementation guide. The DDCC vaccination 
certificate implementation guide1 is based on the widely adopted HL7 FHIR International Patient 
Summary (IPS) health data content model (30). 
International Classification of Diseases (ICD) is the preferred data standard for DDCC:VS. The 11th 
revision of ICD (ICD-11) (31), which comes into effect for recording and reporting in January 2022, is 
recommended as the most suitable and future-proof value set for use in the DDCC:VS data dictionary. 
ICD-11 is:
	
→a global public good that is completely free and available for all to use in its entirety; no payment 
will be required to access any additional parts of the code system; 
	
→kept clinically updated through an open, public and transparent maintenance process; 
	
→able to provide comprehensive content coverage and the granularity required for data fields in 
individual-level systems, including the DDCC:VS; 
	
→easy to integrate into software systems via a public API for use in all settings, without additional 
tooling; this is due to ICD-11’s digital and multilingual structure; and
	
→human-readable and machine-readable. 
For countries with legacy ICD systems (e.g. the 10th revision of ICD, ICD-10), WHO will provide ICD-10- 
based value sets for use in the DDCC:VS data dictionary, as well as mappings to other freely available 
classifications and terminologies (e.g. Anatomical Therapeutic Chemical [ATC], SNOMED CT GPS [32], 
etc.). For guiding principles of the WHO Family of International Classifications (WHO-FIC) and other 
classifications, and terminology mapping in the context of the WHO DDCC:VS, see Annex 3.
1	 The DDCC implementation guide can be found here: https://worldhealthorganization.github.io/ddcc/
Page
42
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
DDCC:VS core data set
SECTION 5
