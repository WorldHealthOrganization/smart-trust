---
doc_id: who-2019-ncov-digital-certificates-vaccination-20211-eng
doc_title: "DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021 SECTION 1"
section_id: sec-front-matter
section_title: "Front matter"
section_number: null
pages: 1-18
source_pdf: WHO-2019-nCoV-Digital-certificates-vaccination-2021.1-eng.pdf
source_sha256: f57b14cb2acb728d
toc_source: inferred
---
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Page
A
SECTION 1
Introduction
Digital Documentation 
of COVID-19 Certificates: 
Vaccination Status
TECHNICAL SPECIFICATIONS AND IMPLEMENTATION GUIDANCE
 27 August 2021
Page
B
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Introduction
SECTION 1
Digital Documentation 
of COVID-19 Certificates: 
Vaccination Status
TECHNICAL SPECIFICATIONS AND IMPLEMENTATION GUIDANCE
 27 August 2021
Digital Documentation of COVID-19 Certificates: Vaccination Status — Technical Specifications and 
Implementation Guidance, 27 August 2021. 
WHO/2019-nCoV/Digital_certificates/vaccination/2021.1 
© World Health Organization 2021 
Some rights reserved. This work is available under the Creative Commons Attribution-NonCommercial-ShareAlike 
3.0 IGO licence (CC BY-NC-SA 3.0 IGO; https://creativecommons.org/licenses/by-nc-sa/3.0/igo). 
Under the terms of this licence, you may copy, redistribute and adapt the work for non-commercial purposes, 
provided the work is appropriately cited, as indicated below. In any use of this work, there should be no 
suggestion that WHO endorses any specific organization, products or services. The use of the WHO logo is not 
permitted. If you adapt the work, then you must license your work under the same or equivalent Creative 
Commons licence. If you create a translation of this work, you should add the following disclaimer along with the 
suggested citation: “This translation was not created by the World Health Organization (WHO). WHO is not 
responsible for the content or accuracy of this translation. The original English edition shall be the binding and 
authentic edition”. 
Any mediation relating to disputes arising under the licence shall be conducted in accordance with the mediation 
rules of the World Intellectual Property Organization (http://www.wipo.int/amc/en/mediation/rules/). 
Suggested citation. Digital Documentation of COVID-19 Certificates: Vaccination Status — Technical 
Specifications and Implementation Guidance, 27 August 2021. Geneva: World Health Organization; 2021 
(WHO/2019-nCoV/Digital_certificates/vaccination/2021.1). Licence CC BY-NC-SA 3.0 IGO. 
Cataloguing-in-Publication (CIP) data. CIP data are available at http://apps.who.int/iris. 
Sales, rights and licensing. To purchase WHO publications, see http://apps.who.int/bookorders. To submit 
requests for commercial use and queries on rights and licensing, see http://www.who.int/about/licensing. 
Third-party materials. If you wish to reuse material from this work that is attributed to a third party, such as 
tables, figures or images, it is your responsibility to determine whether permission is needed for that reuse and to 
obtain permission from the copyright holder. The risk of claims resulting from infringement of any third-party-
owned component in the work rests solely with the user. 
General disclaimers. The designations employed and the presentation of the material in this publication do not 
imply the expression of any opinion whatsoever on the part of WHO concerning the legal status of any country, 
territory, city or area, or of its authorities, or concerning the delimitation of its frontiers or boundaries. Dotted 
and dashed lines on maps represent approximate border lines, for which there may not yet be full agreement. 
The mention of specific companies or of certain manufacturers’ products does not imply that they are endorsed or 
recommended by WHO in preference to others of a similar nature that are not mentioned. Errors and omissions 
excepted; the names of proprietary products are distinguished by initial capital letters. 
All reasonable precautions have been taken by WHO to verify the information contained in this publication. 
However, the published material is being distributed without warranty of any kind, either expressed or implied. 
The responsibility for the interpretation and use of the material lies with the reader. In no event shall WHO be 
liable for damages arising from its use. 
Editing: Green Ink Publishing Services Ltd. 
Design and layout: RRD Design LLC 
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Page
iii
Contents
Acknowledgements	
v
Abbreviations	
vii
Glossary	
viii
1.1.	
Purpose of this document	
1
1.2.	
Target audience	
2
1.3.	
Scope 	
2
1.4.	
Assumptions	
3
1.5.	
Methods 	
5
1.6.	
Additional WHO guidance documents 	
5
1.7.	
Other initiatives	
5
2.1.	
Ethical considerations for a DDCC:VS	
6
2.2.	
Data protection principles for a DDCC:VS	
12
2.3.	
DDCC:VS design criteria	
15
3.1.	
Key settings, personas and digital services 	
16
3.2.	
Continuity of Care workflows and use cases	
18
3.3.	
Functional requirements for Continuity of Care scenario	
24
4.1.	
Key settings, personas and digital services	
27
4.2.	
Proof of Vaccination workflows and use cases 	
29
4.3.	
Functional requirements for Proof of Vaccination scenario	
37
SECTION 1 	 Introduction 	
1
Executive Summary 	
xi
SECTION 2 	 Ethical considerations and data protection principles 	
6
SECTION 3 	 Continuity of Care scenario 	
16
SECTION 4 	 Proof of Vaccination scenario  	
27
Page
iv
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
5.1.	
Core data set principles	
40
5.2.	
Core data elements	
42
6.1.	
Signing a DDCC:VS	
48
6.2.	
Verifying a DDCC:VS signature	
49
6.3.	
Trusting a DDCC:VS signature	
50
8.1.	
Considerations before deploying	
54
8.2.	
Key factors to consider with solution developers 	
56
8.3.	
Cost category considerations 	
57
8.4.	
Additional resources to support implementation	
59
References	
60
Annex 1 	
Illustrative example of Digital Documentation of COVID-19 
Certificates: Vaccination Status (DDCC:VS)	
63
Annex 2	
Business process symbols used in workflows	
64
Annex 3 	
Guiding principles for mapping the WHO Family of International 
Classifications (WHO-FIC) and other classifications	
65
Annex 4 	
What is public key infrastructure (PKI)?	
68
Annex 5 	
Non-functional requirements	
72
Annex 6 	
Open Health Information Exchange (OpenHIE)-based 
architectural blueprint	
77
	
Web Annex A	
DDCC:VS Core data dictionary
	
	
https://apps.who.int/iris/bitstream/handle/10665/343264/WHO-2019-
	
	
nCoV-Digital-certificates-vaccination-data-dictionary-2021.1-eng.xlsx
	
Web Annex B	
Technical Briefing
	
	
https://apps.who.int/iris/bitstream/handle/10665/344456/WHO-2019-
	
	
nCoV-Digital_certificates-vaccination-technical_briefing-2021.1-eng.pdf
SECTION 6 	 National Trust Architecture 	
46
SECTION 7	
National governance considerations 	
51
SECTION 8 	 Implementation considerations  	
53
Annexes 	
62
SECTION 5 	 DDCC:VS core data set 	
40
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Page
v
Acknowledgements
The World Health Organization (WHO) is grateful for the contribution that many individuals and organizations have made to 
the development of this document. 
This document was coordinated by Garrett Mehl, Natschja Ratanaprayul, Derek Ritz, Philippe Veltsos, and Bernardo Mariano 
Junior of the WHO Department of Digital Health and Innovations, in collaboration with individuals in departments across 
WHO and other organizations, who include: Marta Gacic-Dobo and Jan Grevendonk of the WHO Department of Immunization, 
Vaccines and Biologicals; Carmen Dolea and Thomas Hofmann of the International Health Regulations Secretariat; Sara 
Barragan Montes and Ninglan Wang of the WHO Department of Country Readiness Strengthening; Andreas Reis and 
Katherine Littler of the WHO Department of Health Ethics and Governance; Ayman Badr and Kevin Crampton of the 
WHO Department of Information Management and Technology; Thomas Grein and Abdi Rahman Mahamud of Strategic 
Health Operations WHO Emergency Response; Wouter ’T Hoen of the WHO Department of Human Resources and Talent 
Management; Carl Leitner, Jenny Thompson and Luke Duncan from PATH; Voo Teck Chuan from National University of 
Singapore; and Robert Jakob and Nenad Kostanjsek of the WHO Department of Data and Analytics.
The following individuals (listed in alphabetical order) reviewed, provided feedback and contributed to this document 
at various stages: Aasim Ahmad (Aga Khan University), Onyema Ajuebor (WHO), Shada Alsalamah (WHO), Thalia Arawi 
(American University), Joaquin Andres Blaya (World Bank), Emily Carnahan (PATH), Ciaran Carolan (International Civil 
Aviation Organization (ICAO), Gabriel Catan (World Bank), Jim Case (SNOMED International), Vladimir Choi (WHO), Adam 
Cooper (World Bank consultant), Angus Dawson (University of Sydney), Christiane Demarkar (ICAO), Vyjayanti T Desai (World 
Bank), Edward Simon Dunstone (World Bank consultant), Marie Eichholtzer (World Bank), Ezekiel J Emanuel (University of 
Pennsylvania), Ioana-Maria Gligor (European Commission Directorate-General for Health and Food Safety), Marelize Gorgens 
(World Bank), Clayton Hamilton (WHO), Monica Harry (SNOMED International), Christopher Hornek (ICAO), Matthew Thomas 
Hulse (World Bank), Konstantin Hyppönen (European Commission Directorate-General for Health and Food Safety), Sharon 
Kaur (University of Malaya), Alastair Kenworthy (New Zealand Ministry of Health – Manatū Hauora), Tarek Khorshed (WHO), 
Edmund Kienast (Australian Digital Health Agency), Mark Landry (WHO), Christos Maramis (European Commission Directorate-
General for Communications Networks, Content and Technology), Marco Marsella (European Commission Directorate-General 
for Communications Networks, Content and Technology), Jonathan Marskell (World Bank), Ignacio Mastroleo (Facultad 
Latinoamericana de Ciencias Sociales), Rajeesh Menon (Ernst & Young), Jane Millar (SNOMED International), Anita Mittal (World 
Bank consultant), Toni Morrison (SNOMED International), Richard Morton (International Port Community Systems Association), 
James L Neumann (World Bank), Beth Newcombe (Immigration, Refugees and Citizenship Canada), Mohamed Nour (WHO), 
Vanja Pajic (WHO), Roberta Pastore (WHO), Maria Paz Canales (Derechos Digitales), Alexandrine Pirlot de Corbion (Privacy 
International), R Rajeshkumar (Auctorizium Pte Ltd), Eric Ramirez (El Salvador Secretaría de Innovación de la Presidencia), 
Suzy Roy (SNOMED International), Carla Saenz (WHO Regional Office for the Americas), David Satola (World Bank), Ester Sikare 
(United States Centers for Disease Control and Prevention), Maxwell J Smith (University of Toronto), Vincent van Pelt (Nictiz), 
Pramod Varma (EkStep Foundation), Gillan Ward (World Bank consultant), Stefanie Weber (Federal Institute for Drugs and 
Medical Devices, Germany), and Stephen Wilson (Lockstep Group). 
The WHO extends sincere thanks to the following individuals (listed in alphabetical order), who contributed to the technical 
consultation process: Roberta Andraghetti (WHO), Housseynou Ba (WHO), Madhava Balakrishnan (WHO), Andre Arsene Bita 
Fouda (WHO), Stuart Campo (United Nations Office for the Coordination of Humanitarian Affairs, Centre for Humanitarian 
Data), Marcela Contreas (WHO), Jun Gao (WHO), Fernando Gonzalez-Martin (WHO), Christopher Haskew (WHO), Jennifer 
Horton (WHO), Beverly Knight (ISO TC215 Health Informatics Canadian Mirror Committee), Kathleen Krupinski (WHO), 
Ephrem Lemango (WHO), Ann Linstrand (WHO), Jason Mwenda Mathiu (WHO), Ngum Meh Zang (WHO), Derrick Muneene 
(WHO), Henry Mwanyika (PATH), Craig Nakagawa (WHO), Patricia Ndumbi (WHO), Alejandro Lopez Osornio (CIIPS 
Page
vi
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
(Center for Implementation and Innovation in Health Policies), Buenos Aires, Argentina), Elizabeth Peloso (Liz Peloso 
Consulting Inc.), Alain Poy (WHO), Magdalena Rabini (WHO), Maria Soc (PATH), Soumya Swaminathan (WHO), Martha 
Velandia (WHO), Petra Wilson (Health Connect Partners), and all members and observers of the Smart Vaccination Certificate 
Working Group.  
This work was funded by the Bill and Melinda Gates Foundation, the Government of Estonia, Fondation Botnar, the State of 
Kuwait, and the Rockefeller Foundation. The views of the funding bodies have not influenced the content of this document. 
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Page
vii
Abbreviations
1D
one-dimensional
2D
two-dimensional
AEFI
adverse event(s) following immunization
API
application programming interface
COVID-19
coronavirus disease 2019
DDCC
Digital Documentation of COVID-19 Certificates
DDCC:VS
Digital Documentation of COVID-19 Certificates: Vaccination Status
DSC
document signer certificate 
EIR
electronic immunization registry
FHIR
Fast Healthcare Interoperability Resources 
HCID
health certificate identifier
HL7
Health Level Seven
HPV
human papillomavirus
ICD
International Classification of Diseases
ICT
information and communications technology
ID
identifier
IHR
International Health Regulations (2005)
IPS
International Patient Summary
ISO
International Organization for Standardization
OPENHIE
Open Health Information Exchange
PHA
public health authority
PHSMS
public health and social measures
PKI
public key infrastructure 
QA
quality assurance
SHR
shared health record
SLA
service level agreement
SNOMED CT GPS
Systematized Nomenclature of Medicine Clinical Terms Global Patient Set
WHO-FIC
WHO Family of International Classifications
Page
viii
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Glossary
CERTIFICATE: A document attesting a fact. In the context of the vaccination certificate, it attests to the 
fact that a vaccine has been administered to an individual. 
CERTIFICATE AUTHORITY (CA): Also known as a “certification authority” in the context of a public key 
infastructure, is an entity or organization that issues digital certificates.
COVAX: The vaccines pillar of the Access to COVID-19 Tools (ACT) Accelerator. It aims to accelerate the 
development and manufacture of COVID-19 vaccines, and to guarantee fair and equitable access for 
every country in the world. 
DATA CONTROLLER: The person or entity that, alone or jointly with others, determines the purposes 
and means of the processing of personal data. A data controller has primary responsibility for the 
protection of personal data.
DATA PROCESSING: “Processing” means any operation or set of operations performed on personal 
data or on sets of personal data, whether by automated means or not, such as collection, recording, 
organization, structuring, storage, adaptation or alteration, retrieval, consultation, use, disclosure by 
transmission, dissemination or otherwise making available, alignment or combination, restriction, 
erasure or destruction.
DATA PROCESSOR: A person or entity that processes personal data on behalf of, or under instruction 
from, the data controller.
DATA SUBJECT: The Subject of Care or the DDCC:VS Holder if the DDCC:VS Holder represents the Subject 
of Care, such as a minor, or represents a person who is physically or legally incapable of giving consent 
for the processing of their personal data.
DDCC:VS GENERATION SERVICE: The service that is responsible for generating a digitally signed 
representation, the DDCC, of the information concerning a COVID-19 vaccination.
DDCC:VS REGISTRY SERVICE: The service that can be used to request and receive the digitally signed 
COVID-19 vaccination information.  
DDCC:VS REPOSITORY SERVICE: A potentially federated service that has a repository, or database, of 
DDCC:VS. 
DIGITAL DIVIDE: The gap between demographic groups and regions that have access to modern ICT and 
those that do not, or that have restricted access. 
DIGITAL DOCUMENTATION OF COVID-19 CERTIFICATE(S) (DDCC): A digitally signed FHIR document that 
represents the core data set for the relevant COVID-19 certificate using the JavaScript Object Notation 
(JSON) representation. 
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Page
ix
DIGITAL DOCUMENTATION OF COVID-19 CERTIFICATE(S): VACCINATION STATUS (DDCC:VS): A type of DDCC 
that is used to represent the COVID-19 vaccination status of an individual. Specifically, the DDCC:VS 
is a digitally signed Health Level Seven (HL7) Fast Healthcare Interoperability Resources (FHIR) 
document containing the data elements included in the DDCC:VS core data set.
DIGITAL REPRESENTATION: A virtual representation of a physical object or system. In this context, the 
digital representation must be a digitally signed FHIR document or a digitally signed two-dimensional 
(2D) barcode (e.g. a QR code).
DIGITAL SIGNATURE: In the context of this guidance document, it is a hash generated from the HL7 
FHIR data concerning a vaccination signed with a private key. 
DIGITALLY SIGNED: A digital document is digitally signed when plain-text health content is “hashed” 
with an algorithm, and that hash is encrypted, or “signed”, with a private key. 
ENCRYPTION: A security procedure that translates electronic data in plain text into a cipher code, by 
means of either a code or a cryptographic system, to render it incomprehensible without the aid of the 
original code or cryptographic system.
HEALTH CERTIFICATE IDENTIFIER (HCID): A unique alphanumeric identifier (ID) for a physical and/or 
digital health document which contains one or more vaccination events. It is the key identifier, present 
within the DDCC:VS and retained in the DDCC:VS registry.
HEALTH DATA: Personal data related to the physical or mental health of a natural person, including the 
provision of health services, which reveal information about his or her health status. These include 
personal data derived from the testing or examination of a body part or bodily substance, including 
from genetic data and biological samples.
IDENTIFICATION DOCUMENT: A document that attests the identity of or a linkage to someone, for 
example, a passport or a national identity card. 
IDENTIFIER: A name that labels the identity of an object or individual. Usually, it is a unique 
alphanumeric string that is associated with an individual, for example, a passport number or medical 
record ID.
ONE-DIMENSIONAL (1D) BARCODE: A visual black and white pattern using variable-width lines and 
spaces for encoding information in a machine-readable form. It is also known as a linear code. 
MAY: MAY is used to describe technical features and functions that are optional, and it is the 
implementer’s decision whether to include that feature or function based on the implementation 
context.1 
PASS: A document that gives an individual the authorization to have access to something, such as 
public spaces, events and modes of transport. 
1	 This definition is based on the definition published by the Internet Engineering Task Force (IETF) (https://www.ietf.org/rfc/rfc2119.txt, 
accessed 30 June 2021).
Page
x
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
PERSONAL DATA: Any information relating to an individual who is or can be identified, directly or 
indirectly, from that information. Personal data include: biographical data (biodata), such as name, 
sex, civil status, date and place of birth, country of origin, country of residence, individual registration 
number, occupation, religion and ethnicity; biometric data, such as a photograph, fingerprint, facial or 
iris image; health data; as well as any expression of opinion about the individual, such as assessments 
of his or her health status and/or specific needs.
PUBLIC KEY: The part of a private–public key pair used for digital encryption that is designed to be 
freely distributed. 
PUBLIC KEY INFRASTRUCTURE (PKI): The policies, roles, software and hardware components and their 
governance that facilitate digital signing of documents and issuance/distribution/exchange of keys.
PRIVATE KEY: The part of a private–public key pair used for digital encryption that is kept secret and 
held by the individual/organization signing a digital document.
SHALL: SHALL is used to describe technical features and functions that are mandatory for this 
specification.1 
SHOULD: SHOULD is used to describe technical features and functions that are recommended, but 
are not mandatory. It is the implementer’s decision whether to include that feature or function based 
on the implementation context. However, it is highly recommended that the implementer review the 
reasons for not following the recommendations before deviating from the technical specifications 
outlined2  
SUBJECT OF CARE: The vaccinated person.
THIRD PARTY USE: Use by a natural or legal person, public authority, agency or body other than the 
data subject, controller, processor and persons who, under the direct authority of the controller or 
processor, are authorized to process personal data.
TWO-DIMENSIONAL (2D) BARCODE: Also called a matrix code. A 2D way to represent information using 
individual black dots within a square or rectangle. For example, a QR code is a type of 2D barcode. It 
is similar to a linear (1D) barcode, but it can represent more data per unit area. There are different 
types, defined by standards such as ISO/IEC 16022, 24778, 18004, etc.
VERIFIER: A natural person or legal person, either private or public, who is formally authorized (under 
national law, decree, regulation or other official act or order) to verify the vaccination status presented 
on the DDCC.
1	 This definition is based on the definition published by the Internet Engineering Task Force (IETF) (https://www.ietf.org/rfc/rfc2119.txt, 
accessed 30 June 2021).
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Page
xi
In the context of the coronavirus disease (COVID-19) pandemic, the 
concept of Digital Documentation of COVID-19 Certificates (DDCC) 
is proposed as a mechanism by which a person’s COVID-19-related 
health data can be digitally documented via an electronic certificate. 
A digital vaccination certificate that documents a person’s current 
vaccination status to protect against COVID-19 can then be used for 
continuity of care or as proof of vaccination for purposes other than 
health care. The resulting artefact of this approach is referred to as the 
Digital Documentation of COVID-19 Certificates: Vaccination Status 
(DDCC:VS). 
The current document is written for the ongoing global COVID-19 pandemic; thus, the approach is 
architected to respond to the evolving science and to the immediate needs of countries in this rapidly 
changing context; for this reason, the document is issued as interim guidance. The approach could 
eventually be extended to capture vaccination status to protect against other diseases.
The document is part of a series of guidance documents (see Fig. 1) on digital documentation of 
COVID-19-related data of interest: vaccination status (this document), laboratory test results, and 
history of SARS-CoV-2 infection.
The World Health Organization (WHO) has developed this guidance and accompanying technical 
specifications, in collaboration with a multidisciplinary group of partners and experts, in order to 
support WHO Member States in adopting interoperable standards for recording vaccination status. The 
audience of this document is therefore Member States and their implementing partners that want to 
put in place digitally signed vaccination records.
Executive summary
Page
xii
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
What is the DDCC:VS? 
A vaccination certificate is a health document that records a vaccination service received by an 
individual, traditionally as a paper card noting key details about the vaccinated individual, vaccine 
administered, date administered, and other data in the core data set (see section 5.2). Digital 
vaccination certificates are immunization records in an electronic format that are accessible by both 
the vaccinated person and authorized health workers, and which can be used in the same way as the 
paper card: to ensure continuity of care or provide proof of vaccination. These are the two scenarios 
considered in this document (see Table 1). 
A vaccination certificate can be purely digital (e.g. stored in a smartphone application or on a cloud-
based server) and replace the need for a paper card, or it can be a digital representation of the 
traditional paper-based record (see Fig. 2). A digital certificate should never require individuals to 
have a smartphone or computer. The link between the paper record and the digital record can be 
established using a one-dimensional (1D) or two-dimensional (2D) barcode, for example, printed on 
or affixed to the paper vaccination card. References to the “paper” record in this document mean a 
physical document (printed on paper, plastic card, cardboard, etc.). An illustrative example of a paper-
based DDCC:VS is given in Annex 1. 
The guidance in this document is for a digital record that only shows that a vaccination has occurred. 
The digital record is not intended to serve as an immunity passport or provide a judgement or decision 
on what that vaccination means or permits.
This guidance is consistent with advice provided to the WHO secretariat at the eighth meeting of the 
International Health Regulations (2005) Emergency Committee (IHR EC) regarding the coronavirus 
disease (COVID-19), “advocating for WHO to expedite the work to establish updated means for 
Figure 1
Guidance documents for DDCC
Guidance 
on digitally 
documenting 
COVID-19 
vaccination 
status
Guidance on digitally 
documenting SARS-CoV-2 
test results 
Guidance on digitally 
documenting history of 
SARS-CoV-2 infection 
DDCC: Vaccination Status
DDCC: SARS-CoV-2 
Test Result
DDCC: History of 
SARS-CoV-2 Infection
The DDCC:VS is a digitally signed representation of data content that describes a vaccination 
event. DDCC:VS data content respects the specified core data set and follows the Health Level 
Seven (HL7) Fast Healthcare Interoperability Resources (FHIR) standard detailed in the FHIR 
Implementation Guide. 
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Page
xiii
documenting COVID-19 status of travellers, including vaccination, history of SARS-CoV-2 infection, and 
SARS-CoV-2 test results.”1 In the absence of a mechanism to digitally document COVID-19 vaccination 
status, it may be recorded in the International Certificate of Vaccination and Prophylaxis (ICVP). The 
ICVP format and data set would suffice as a valid health document for any future digitization efforts. 
Furthermore, in response to the IHR EC advice to the Secretariat, WHO is actively working to update the 
design of the ICVP to accommodate the COVID-19 status of travelers, including vaccination, history of 
infection, and test results consistent with the DDCC:VS specifications. In relation to the ICVP, The IHR EC 
furthermore recommends States Parties “recognition of all COVID-19 vaccines that have received WHO 
Emergency Use Listing in the context of international travel. In addition, States Parties are encouraged 
to include information on COVID-19 status, in accordance with WHO guidance, within the WHO booklet 
containing the International Certificate of Vaccination and Prophylaxis; and to use the digitized version 
when available.”
1	 Statement on the eighth meeting of the International Health Regulations (2005) Emergency Committee regarding the coronavirus disease 
(COVID-19) pandemic
Digital Documentation of COVID-19 Certificates: Vaccination Status
Figure 2
Different illustrative formats of DDCC:VS
International 
Certificate of Vaccination 
or Prophylaxis 
(i.e. yellow card) 
National 
Immunization 
Home-based 
Record
A PDF print-out 
certificate with only a 
HCID which links to a 
DDCC:VS 
OR 
A PDF print-out with a 
2D barcode containing 
the full DDCC:VS core 
data set
A handwritten paper 
certificate with only a 
HCID, which links to a 
DDCC:VS 
OR 
A handwritten paper 
certificate with a 2D 
barcode containing the 
full DDCC:VS core data set
A DDCC:VS 
held on a smartphone
1
2
4
3
5
NATIONAL
CERTIFICATE
NATIONAL
CERTIFICATE
NATIONAL
CERTIFICATE
Page
xiv
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Scenarios of use of the DDCC:VS
The scope of this document covers two scenarios of use for the DDCC:VS (see Table 1). 
1.	
CONTINUITY OF CARE: Vaccination records are an important part of an individual’s medical records, 
starting at birth. The Continuity of Care scenario describes the primary purpose of a vaccination 
certificate. The vaccination record shows individuals and caregivers which vaccinations an 
individual has received, as part of that individual’s medical history; it therefore supports informed 
decision-making on any future health service provision.
2.	
PROOF OF VACCINATION: Vaccination records can also provide proof of vaccination status for 
purposes not related to health care. 
Table 1
Some possible uses of DDCC:VS
Continuity of Care 
Proof of Vaccination 
	
→
Provides a basis for health workers to offer a subsequent 
dose and/or appropriate health services
	
→
Provides schedule information for an individual to know 
whether another dose, and of which vaccine, is needed, and 
when the next dose is due
	
→
Enables investigation into adverse events by health workers, 
as per existing guidance on adverse events following 
immunization (AEFI) (vaccine safety)
	
→
Establishes the vaccination status of individuals in coverage 
monitoring surveys 
	
→
Establishes vaccination status after a positive COVID-19 test, 
to understand vaccine effectiveness
	
→
For work
	
→
For university education
	
→
For international travel*
*	In the context of international travel, in accordance with advice from the 8th meeting of the International Health Regulations (2005) Emergency Committee on COVID-19, held on 
14 July 2021, countries should not require proof of COVID-19 vaccination as a condition for travel.
The use cases within the two scenarios will vary depending on the digital maturity and local context of 
the country in which a DDCC:VS solution is implemented.
What are the minimum requirements to implement a 
DDCC:VS?
Digital vaccination certificates should meet the public health needs of each WHO Member State, 
as well as the needs of individuals around the world. They should never create inequity due to lack 
of access to specific software or technologies (i.e. a digital divide). The recommendations for the 
implementation of DDCC:VS must therefore be applicable to the widest range of use cases, catering to 
many different levels of digital maturity between implementing countries. The minimum requirements 
were developed accordingly, to allow the greatest possible flexibility for Member States and their 
implementer(s) to build a solution that is fit for purpose in the context of their overall health 
information systems.  
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Page
xv
The minimum requirements for a DDCC:VS are as follows.
	
→The potential benefits, risks and costs of implementing a DDCC:VS solution should be assessed 
before introducing a DDCC:VS system and its associated infrastructure. This includes an impact 
assessment of the ethical and privacy implications and potential risks that may arise with the 
implementation of a DDCC:VS.
	
→Member States must establish the appropriate policies for appropriate use, data protection and 
governance of the DDCC:VS to reduce the potential harms, while achieving the public health 
benefits involved in deploying such a solution. 
	
→A digitally signed electronic version of the data about a vaccination event, called a DDCC:VS, must 
exist. As a minimum, both the required data elements in the core data set and the metadata should 
be recorded, as described in section 5.2.
	
→An individual who has received a vaccination should have access to proof of this – either as a 
traditional paper card or a version of the electronic DDCC:VS.
	
→Where a paper vaccination card is used, it should be associated with a health certificate identifier 
(HCID). A DDCC:VS should be associated, as a digital representation, with the paper vaccination 
card via the HCID. Multiple forms of digital representations of the DDCC:VS may be associated with 
the paper vaccination card via the HCID.
	
→The HCID should appear on any paper card in both a human-readable and a machine-readable 
format (i.e. alphanumeric characters that are printed, as well as rendered as a 1D or 2D barcode).
	
→A DDCC:VS Generation Service should exist. The DDCC:VS Generation Service is responsible for 
taking data about a vaccination event, converting it to use the FHIR standard, and then digitally 
signing the FHIR document and returning it to the DDCC:VS Holder. This signed FHIR document is 
the DDCC:VS.
	
→A DDCC:VS Registry Service should exist. The DDCC:VS Registry Service is responsible for storing 
an index that associates an HCID with metadata about the DDCC:VS. As a minimum, the Registry 
Service stores the core metadata described in section 5.2. One or more DDCC:VS Repository 
Service(s) may exist, which can be used to retrieve a DDCC:VS; in which case the location of the 
DDCC:VS may also be included in the metadata within the DDCC:VS Registry Service. 
The different services are discussed in more detail in sections 3 and 4, and are shown in Fig. 7.
These components are minimum requirements; Member States may adopt and develop additional 
components for their deployed DDCC:VS system. 
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Page
1
SECTION 1
