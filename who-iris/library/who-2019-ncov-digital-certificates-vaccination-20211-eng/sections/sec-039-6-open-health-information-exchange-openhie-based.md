---
doc_id: who-2019-ncov-digital-certificates-vaccination-20211-eng
doc_title: "DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021 SECTION 1"
section_id: sec-039-6-open-health-information-exchange-openhie-based
section_title: "Open Health Information Exchange (OpenHIE)-based architectural blueprint"
section_number: 6
pages: 94-99
source_pdf: WHO-2019-nCoV-Digital-certificates-vaccination-2021.1-eng.pdf
source_sha256: f57b14cb2acb728d
toc_source: inferred
---
architectural blueprint
This section illustrates how a standards-based health-data-sharing infrastructure could support point-
of-care digital health solutions. If digital health solutions are employed in real time during the vaccine 
administration event, it is anticipated that complementary digital health infrastructure, such as the 
architectural elements described by the OpenHIE specification, could be leveraged. 
OpenHIE describes a reusable architectural framework that leverages health information standards, 
enables flexible implementation by country partners, and supports exchange of individual 
components. OpenHIE also serves as a global community of practice to support countries towards 
“open and collaborative development and support of country-driven, large-scale health information 
sharing architectures”1 
The OpenHIE high-level architecture2 is shown in Fig. A6.1. To show how a health-data-sharing 
infrastructure could support point-of-care digital health solutions to issue Digital Documentation of 
COVID-19 Certificates: Vaccination Status (DDCC:VS), a set of digital health interactions are described 
in terms of the conformance-testable Integrating the Healthcare Enterprise (IHE) specifications 
referenced by the OpenHIE specification.
1	 OpenHIE. In: OpenHIE [website]. OpenHIE; no date (https://ohie.org/about, accessed 29 June 2021)2
2	 OpenHIE Architecture Specification. OpenHIE; September 2020 (https://ohie.org/wp-content/uploads/2020/12/OpenHIE-Specification-
Release-3.0.pdf, accessed 29 June 2021).
Page
78
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Figure A6.1
OpenHIE architecture1
1	 Orange boxes indicate registries and repositories relevant to DDCC:VS.
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Page
79
The registries and repositories defined in the OpenHIE architecture (see Fig. A6.1) may play a role in 
providing data that are part of the DDCC:VS core data set defined in section ‎5. These registries and 
repositories include the following: 
TERMINOLOGY SERVICES: A registry service used to manage clinical and health system terminologies, 
which health applications can use for mapping to other standard or non-standard code systems 
to support semantic interoperability. For example, a terminology service can be used to manage 
terminology mappings of existing code systems to the International Classification of Diseases, 11th 
revision (ICD-11). 
CLIENT REGISTRY: Also referred to as a patient registry, a demographic database that contains 
definitive information about each Subject of Care. This database can include a Subject of Care’s 
name, date of birth, sex, address, phone number, email address, as well as other person-specific 
information such as parent–child relationships, caregiver relationships, family–clinician relationships 
and consent directives. It is also in the client registry that the list of unique identifiers (IDs; e.g. 
national ID, national health ID, health insurance ID) for a particular Subject of Care can be found. The 
data elements in the DDCC:VS core data set that may be populated with data from the client registry 
include:
	
→name 
	
→date of birth 
	
→sex 
	
→unique IDs. 
FACILITY REGISTRY: A database of facility information, including data such as the facility name, a Public 
Health Authority (PHA)-issued unique ID, the organization under whose responsibility the facility 
operates, location (by address and/or Global Positioning System [GPS] coordinates), facility type, 
hours of operation, and the health services offered. The data elements in the DDCC:VS core data set 
that may be populated with data from the facility registry include:
	
→administering centre: facility name or unique ID can be used to represent this
	
→country of vaccination. 
HEALTH WORKER REGISTRY: A database of health worker information that contains information such 
as name, date of birth, and qualifications of health workers (including cadre, accreditations and 
authorizations of practice). The health worker registry also references unique health worker IDs that 
may have been issued by a PHA, care delivery organizations or individual health facilities. The data 
element in the DDCC:VS core data set that may be provided with information from the health worker 
registry is:
	
→health worker ID.
Page
80
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
PRODUCT CATALOGUE: A system used to manage the metadata and multiple IDs for medical 
commodities. Depending on whether the product catalogue includes vaccine products, the data 
elements in the DDCC:VS core data set that could be obtained from the product catalogue are:
	
→vaccine or prophylaxis
	
→vaccine brand
	
→vaccine manufacturer
	
→vaccine market authorization holder
	
→vaccine batch number
	
→disease or agent targeted.
SHARED HEALTH RECORD (SHR): A repository that may be used to maintain longitudinal health 
information about a Subject of Care and to support continuity of care over time, across different care 
delivery sites. Health data in the SHR can include content such as the Subject of Care’s medication 
list, allergies, current problem list, immunization records, history of procedures, medical devices, 
diagnostic results, vital sign observation record, history of illness, history of pregnancies and current 
pregnancy status, care plan and advance directives. Such health data may be expressed using 
health data content standards such as the Health Level Seven (HL7) Fast Healthcare Interoperability 
Resources (FHIR) International Patient Summary (IPS) specification. Data in the SHR can be important 
for delivering guideline-based care during vaccine administration. Furthermore, data generated during 
vaccination administration could be added to the SHR, if in use, in order to support future provision of 
health services. 
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Page
81
Page
82
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
