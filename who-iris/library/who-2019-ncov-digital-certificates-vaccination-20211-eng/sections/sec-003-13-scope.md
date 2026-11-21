---
doc_id: who-2019-ncov-digital-certificates-vaccination-20211-eng
doc_title: "DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021 SECTION 1"
section_id: sec-003-13-scope
section_title: "Scope"
section_number: 1.3
pages: 19-20
source_pdf: WHO-2019-nCoV-Digital-certificates-vaccination-2021.1-eng.pdf
source_sha256: f57b14cb2acb728d
toc_source: inferred
---
1.3.1.	In scope
This document specifically focuses on how to digitally document COVID-19 vaccination status and 
attest that an individual has received a vaccine (i.e. how to provide a signed digital vaccination 
certificate). Two priority scenarios are described in Table 1: Continuity of Care and Proof of 
Vaccination. This document describes a specification for a signed digital vaccination certificate, 
including:
	
→ethical and legal considerations, and privacy and data protection principles for the design, 
implementation and use of a DDCC:VS;
	
→use cases arising from the two scenarios for the operation of a DDCC:VS, including the sequence of 
steps involved in executing the scenarios;
	
→a core data set with the data elements that must be handled for a DDCC:VS describing vaccination 
status, as described in the use cases;
	
→a Health Level Seven (HL7) Fast Healthcare Interoperability Resources (FHIR) implementation 
guide based on the content outlined in this guidance document, to support the adoption of open 
standards for interoperability; and 
	
→approaches for implementing a DDCC:VS, including considerations for setting up a national trust 
framework to enable digital signing of a vaccination certificate. 
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Page
3
SECTION 1
Introduction
1.3.2.	Out of scope
Aspects that are considered out of the scope of this work are: 
	
→digital documentation of COVID-19 laboratory test results (which will be covered in a separate 
guidance document);
	
→digital documentation of history of SARS-CoV-2 infection (which will be covered in a separate 
guidance document);
	
→digital documentation of COVID-19 recovery status because of the uncertainty around any 
immunity status arising from recovery;
	
→any governance, judgement or decision based on the information provided in a DDCC:VS for any 
purpose (e.g. its use as a vaccine passport);
	
→recording and handling of adverse event reporting;
	
→considerations for monitoring and evaluation of DDCC:VS roll-out and use;
	
→the choice of algorithm for generating any two-dimensional (2D) barcodes, which is at the 
discretion of the Member State. A Member State may augment the core data set with additional 
information (e.g. a passport number) to provide a stronger identity binding than is presumed in 
this document, for use cases that require it under existing Member State policies and regulations. 
Identity binding would enable utilization of existing 2D barcode algorithms such as those set out 
by the International Civil Aviation Organization (ICAO) and the European Union. The HL7 FHIR 
implementation guide (at https://WorldHealthOrganization.github.io/ddcc) provides an algorithm 
for generating 2D barcodes that may be used in the absence of identifying information beyond that 
found within the core data set; and
	
→technical functionality to support selective disclosure of information contained in DDCC:VS.
