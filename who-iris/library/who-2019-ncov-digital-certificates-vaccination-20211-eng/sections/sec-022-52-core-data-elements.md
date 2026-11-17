---
doc_id: who-2019-ncov-digital-certificates-vaccination-20211-eng
doc_title: "DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021 SECTION 1"
section_id: sec-022-52-core-data-elements
section_title: "Core data elements"
section_number: 5.2
pages: 59-65
source_pdf: WHO-2019-nCoV-Digital-certificates-vaccination-2021.1-eng.pdf
source_sha256: f57b14cb2acb728d
toc_source: inferred
---
The three key sections of the core data set are: 
1.	
the header 
2.	
data elements for each vaccination event 
3.	
vaccination certificate metadata.
The header section data elements include the Subject of Care’s ID information (see Table 10). The 
header section is intended to capture information about the vaccinated individual to allow for 
information on the vaccination event to be linked to a specific person. This data should remain the 
same regardless of which vaccination a person has received; thus, it should only be collected once. 
Table 10
Header section of the DDCC:VS with preferred code system
Data element label
Description
Data type
Preferred code 
system
Requirement status 
for Continuity of 
Care
Requirement 
status for Proof of 
Vaccination
Name
The full name of the 
vaccinated person.
String
Not applicable
Required
Required
Date of birth 
The vaccinated person’s date 
of birth (DOB), if known. If 
unknown, use assigned DOB 
for administrative purposes. 
Date
Complete date, 
following ISO 8601 
(YYYYMMDD or 
YYYY-MM-DD)
Required 
Required 
Unique identifier
Unique ID for the vaccinated 
person, according to the 
policies applicable to each 
country. There can be more 
than one unique ID used to 
link records (e.g. national 
ID, health ID, immunization 
information system ID, 
medical record ID).
ID
Not applicable
Optional –
recommended
Optional –
recommended
Sex
Documentation of a specific 
instance of sex information 
for the vaccinated person.
Coding1
As defined by 
Member State
Optional –
recommended
Not needed 
ID: identifier; ISO: International Organization for Standardization.
1 	 Coding data elements are multiple choice and the input options, or values, are data elements taken from a set of predefined options (e.g. 
sex, vaccine or prophylaxis, vaccine brand).
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Page
43
SECTION 5
DDCC:VS core data set 
The data elements for each vaccination event section outlines data that need to have been collected 
for each vaccination the vaccinated person received (see Table 11). For each dose, all the data 
elements in Table 11 are required to have been recorded. In paper form, this is equivalent to a separate 
row on a vaccination certificate that is then repeated for each vaccination received. 
Table 11
Data for each vaccination event, with preferred code system	
Data element label
Description
Data type
Preferred code 
system
Requirement status 
for Continuity of 
Care
Requirement 
status for Proof of 
Vaccination
Vaccine or 
prophylaxis
Generic description of the 
vaccine or vaccine sub-type 
(e.g. COVID-19 mRNA vaccine, 
HPV vaccine).
Coding
ICD-11
Required 
Required 
Vaccine brand
The brand or trade name 
used to refer to the vaccine 
received.
Coding
As defined by 
Member State
Required 
Required 
Vaccine 
manufacturer
Name of the manufacturer 
of the vaccine received (e.g. 
Serum Institute of India, 
AstraZeneca). If vaccine 
manufacturer is unknown, 
market authorization holder 
is REQUIRED.
Coding
As defined by 
Member State
Required – 
conditional
Required – 
conditional
Vaccine market 
authorization holder
Name of the market 
authorization holder of 
the vaccine received. If 
market authorization 
holder is unknown, vaccine 
manufacturer is REQUIRED.
Coding
As defined by 
Member State
Required – 
conditional
Required – 
conditional
Vaccine batch 
number 
Batch number or lot number 
of the vaccine.
String
Not applicable
Required 
Required 
Date of vaccination
Date on which the vaccine 
was provided.
Date
Complete date, 
following ISO 8601 
Required 
Required 
Vaccination 
valid from
Date upon which provided 
vaccination is considered 
valid
This data should only be 
considered valid at the time 
of issuance, as guidance is 
likely to evolve with further 
scientific evidence.  Any 
user of this data (Vaccinator, 
Verifier) should validate 
this date according to their 
national policy.  
In the case of repeated 
doses, the data field for a 
subsequent dose should 
override the data field for a 
predecessor dose.
Date
Complete date, 
following ISO 8601
Optional
Optional
Dose number
Vaccine dose number.
Quantity
Not applicable
Required 
Required 
Page
44
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
DDCC:VS core data set
SECTION 5
Data element label
Description
Data type
Preferred code 
system
Requirement status 
for Continuity of 
Care
Requirement 
status for Proof of 
Vaccination
Total doses
Total expected doses as 
defined by Member State 
care plan and immunization 
programme policies. 
Quantity
Not applicable
Optional –
recommended
Optional –
recommended
Country of 
vaccination
The country in which 
the individual has been 
vaccinated.
Coding
ISO 3166-1 alpha-3 (or 
numeric)
Required 
Required 
Administering 
centre
The name or ID of the 
vaccination facility 
responsible for providing the 
vaccination.
String
As defined by 
Member State
Required 
Optional –
recommended
Signature of 
health worker
The health worker who 
provided the vaccination or 
the supervising clinician's 
handwritten signature. 
REQUIRED for PAPER 
vaccination certificates 
that have been filled out 
with handwriting ONLY. A 
printed paper vaccination 
certificate does not require 
the handwritten signature of 
a health worker. 
Signature
Not applicable
Optional –
recommended
Required – 
conditional
Health worker 
identifier
OPTIONAL for DIGITAL 
and PAPER vaccination 
certificates. The unique ID 
for the health worker as 
determined by the Member 
State. There can be more 
than one unique ID used 
(e.g. system-generated ID, 
health profession number, 
cryptographic signature, or 
any other form of unique ID 
for a health worker). This can 
be used in lieu of a paper-
based signature. 
ID
Not applicable
Optional –
recommended
Optional –
recommended
Disease or agent 
targeted
Name of disease that vaccine 
given to protect against 
(such as COVID-19).
Coding
ICD-11
Optional –
recommended
Optional –
recommended
Due date of next 
dose
Date on which the next 
vaccination should be 
administered, if a second 
dose is required.
Date
Complete date, 
following ISO 8601 
Optional –
recommended
Not needed 
HPV: human papilloma virus; ICD-11: International Classification of Diseases 11th Revision; ID: identifier; ISO: International Organization for 
Standardization; mRNA: messenger ribonucleic acid.
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Page
45
SECTION 5
DDCC:VS core data set 
The vaccination certificate metadata contain data elements that are not typically visible to the 
user, but that are required to be linked to the certificate itself (see Table 12). It is anticipated that 
additional metadata elements will be added by Member States at the time of certificate generation to 
support specific use case implementations.
Table 12
Vaccination certificate metadata
Data element label
Description
Data type
Preferred code 
system
Requirement status 
for Continuity of 
Care
Requirement 
status for Proof of 
Vaccination
Certificate issuer
The authority or authorized 
organization that issued the 
vaccination certificate.
String
Not applicable
Required
Required
Health certificate 
identifier (HCID)
Unique ID used to associate 
the vaccination status 
represented in a paper 
vaccination card to its digital 
representation(s).
ID
Not applicable
Required
Required
Certificate 
valid from
Date in which the certificate 
for a vaccination event 
became valid. No health or 
clinical inferences should be 
made from this date.
Date
Complete date, 
following ISO 8601 
Optional 
Optional 
Certificate valid 
until
Last date in which the 
certificate for a vaccination 
event is valid. No health or 
clinical inferences should be 
made from this date.
Date
Complete date, 
following ISO 8601 
Optional 
Optional 
Certificate schema 
version
Version of the core 
data set and HL7 FHIR 
implementation guide that 
the certificate is using.
String
Not applicable
Required
Required
FHIR: Fast Healthcare Interoperability Resources; HL7: Health Level Seven; ID: identifier; ISO: International Organization for Standardization.
Page
46
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
PKI for signing and verifying a DDCC:VS
SECTION 6
SECTION
National Trust 
Architecture for
the DDCC:VS
6 
The scenarios presented in earlier chapters, and the data associated 
with them, suggest the need for a digital ecosystem within a country 
for the issuance, updating and verification of the DDCC:VS. This 
ecosystem would comprise a suite of digital tools for the management 
of DDCC:VS data and the processes and governance rules for using 
these systems. It could be as simple as a server for storing and 
managing the data or as extensive as an entire health information 
exchange infrastructure. 
In Annex 6, considerations for such a national architecture of digital components are presented as a 
generic design for a set of interconnected components that would facilitate the successful operation 
of a national DDCC:VS system. Member States are at different levels of digital health maturity and 
investment, and have different local contexts. The architecture is presented as general guidance with 
the expectation that this guidance will be adapted and tailored to suit the specific real-world needs of 
each Member State. 
In order to sign a digital document, PKI technology is required. PKI uses private and public key pairs 
to operationalize digital signing and cryptographic verification. Content that is signed by a private 
key can be verified by the corresponding public key of the key pair. This sign–verify mechanism is 
leveraged to establish the trust framework (chain of trust; see Fig. 13). There are many different 
mechanisms/technologies to implement this approach. PKI is described in further detail in Annex 4.
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Page
47
SECTION 6
PKI for signing and verifying a DDCC:VS
Member States will need to establish or utilize a domestic PKI that can be leveraged to issue and to 
verify DDCC:VS. An existing PKI framework may be used, provided it meets the requirements outlined 
in this document. This document assumes that a PKI has already been deployed or is available within 
a country to support the DDCC:VS workflows described in sections 3 and 4. The PKI can be maintained 
and managed by another government entity (e.g. ministry of ICT, ministry of interior, ministry of 
foreign affairs) or by a contractor that the PHA has selected. Regardless, PHAs will have the signing 
authority. The two key steps for establishing a PKI framework are: 
1.	 The PHA will need to generate at least one document signer certificate (DSC) – a private–public 
key pair that can be used by the trusted agents of the PHA to sign the DDCC:VS. 
2.	 The Member State will need to establish a mechanism to assert that a DSC from a PHA has been 
authorized to sign health documents. Two approaches are outlined in section 7.
There are many ways in which a PKI can be implemented. An example implementation of digital 
signing is provided in the implementation guide available at: https://WorldHealthOrganization.github.
io/ddcc. The precise algorithms used for the implementation – for example, for hashing and for 
signature generation – are at the discretion of the Member State.
Figure 13
The chain of trust
CSCA
country signing 
certificate authority
DSC
document signer 
certificate
DDCC
Digital 
Documentation 
of COVID-19 
Certificate
public
private
public
private
Signing and Issuing a DDCC
Verifying a DDCC
1
3
3
1
2
2
Page
48
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
PKI for signing and verifying a DDCC:VS
SECTION 6
