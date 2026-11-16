---
doc_id: 9789240099456-eng
doc_title: "Digital adaptation kit for immunizations"
section_id: sec-front-matter
section_title: "Front matter"
section_number: null
pages: 1-15
source_pdf: 9789240099456-eng.pdf
source_sha256: 6b0f603e2a792bb4
toc_source: inferred
---
SMART GUIDELINES COLLECTION
Digital 
adaptation kit for 
immunizations
Operational requirements for 
implementing WHO recommendations 
in digital systems
Digital 
adaptation kit for 
immunizations
Operational requirements for 
implementing WHO recommendations 
in digital systems
Digital adaptation kit for immunizations: operational requirements for implementing WHO recommendations in digital systems
(SMART Guidelines collection)
ISBN 978-92-4-009945-6 (electronic version)
ISBN 978-92-4-009946-3 (print version)
© World Health Organization 2024
Some rights reserved. This work is available under the Creative Commons Attribution-NonCommercial-ShareAlike 3.0 IGO licence (CC BY-NC-SA 3.0 IGO; 
https://creativecommons.org/licenses/by/3.0/igo/).
Under the terms of this licence, you may copy, redistribute and adapt the work for non-commercial purposes, provided the work is appropriately cited, as indicated 
below. In any use of this work, there should be no suggestion that WHO endorses any specific organization, products or services. The use of the WHO logo is not 
permitted. If you adapt the work, then you must license your work under the same or equivalent Creative Commons licence. If you create a translation of this work, you 
should add the following disclaimer along with the suggested citation: “This translation was not created by the World Health Organization (WHO). WHO is not responsible 
for the content or accuracy of this translation. The original English edition shall be the binding and authentic edition”. 
Any mediation relating to disputes arising under the licence shall be conducted in accordance with the mediation rules of the World Intellectual Property Organization 
(http://www.wipo.int/amc/en/mediation/rules/).
Suggested citation: Digital adaptation kit for immunizations: operational requirements for implementing WHO recommendations in digital systems. Geneva: World 
Health Organization; 2024 (SMART Guidelines collection). Licence: CC BY-NC-SA 3.0 IGO.
Cataloguing-in-Publication (CIP) data: CIP data are available at https://iris.who.int/.
Sales, rights and licensing: To purchase WHO publications, see https://www.who.int/publications/book-orders. To submit requests for commercial use and queries on 
rights and licensing, see https://www.who.int/copyright.
Third-party materials: If you wish to reuse material from this work that is attributed to a third party, such as tables, figures or images, it is your responsibility to 
determine whether permission is needed for that reuse and to obtain permission from the copyright holder. The risk of claims resulting from infringement of any third-
party-owned component in the work rests solely with the user.
General disclaimers: The designations employed and the presentation of the material in this publication do not imply the expression of any opinion whatsoever on the 
part of WHO concerning the legal status of any country, territory, city or area or of its authorities, or concerning the delimitation of its frontiers or boundaries. Dotted and 
dashed lines on maps represent approximate border lines for which there may not yet be full agreement.
The mention of specific companies or of certain manufacturers’ products does not imply that they are endorsed or recommended by WHO in preference to others of a 
similar nature that are not mentioned. Errors and omissions excepted, the names of proprietary products are distinguished by initial capital letters.
All reasonable precautions have been taken by WHO to verify the information contained in this publication. However, the published material is being distributed without 
warranty of any kind, either expressed or implied. The responsibility for the interpretation and use of the material lies with the reader. In no event shall WHO be liable for 
damages arising from its use. 
iii
Contents
Acknowledgements .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  iv
Abbreviations .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . v
Glossary .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . vi
Part 1. Overview of SMART guideline digital adaptation kits	
Background .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 2
Digital health interventions incorporated into this digital adaptation kit  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 5
Digital adaptation kits within a strategic vision for SMART guidelines .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 6
Objectives .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 6
Components of a digital adaptation kit .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 8
How this digital adaptation kit was developed .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 11
How to use this digital adaptation kit .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 11
Links to the broader digital health ecosystem .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  13
Part 2. Digital adaptation kit content for immunizations
Component 1.	
Health interventions and recommendations
16
Component 2.	
Generic personas
18
Component 3.	
User scenarios
21
Component 4.	
Generic business processes and workflows
26
Component 5.	
Core data elements
60
Component 6.	
Decision-support logic
64
Component 7.	
Indicators and performance metrics
76
Component 8.	
High-level functional and non-functional requirements
78
References .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 84
Annex. Guidance for adding data elements to or amending existing data elements in the data dictionary .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 86
Implementation tools	
Core data dictionary .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  smart.who.int/dak-immz/dictionary
Decision-support logic .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . smart.who.int/dak-immz/decision-logic
Indicators and performance metrics .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  smart.who.int/dak-immz/indicators
Functional and non-functional requirements  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . smart.who.int/dak-immz/system-requirements
iv
Digital adaptation kit for immunizations
Acknowledgements
The World Health Organization (WHO) thanks the contributions of many individuals across different organizations. Development of this digital adaptation kit for 
immunizations was coordinated by (in alphabetical order) Constantin Corman, Carl Leitner, Akshita Palliwal, Natschja Ratanaprayul and Ritika Rawlani, under the 
leadership of Garrett Mehl, Unit Head (WHO Department of Digital Health and Innovation, Switzerland), Donald Joseph Brooks, Carolina Danovaro, Marta Gacic-Dobo, 
Tracey Goodman, Jan Grevendonk, Laura Nic Lochlainn and Stephanie Shendale (WHO Department of Immunization, Vaccines and Biologicals, Switzerland).
The following individuals (listed in alphabetical order) contributed to development of this document: Luke Duncan (PATH, United States of America), Kelly Felt (PATH, 
United States), Mohamed Ibrahim (Hamilton Health Sciences [HHS], Canada), Dipti Kale (eZest Solutions, India), Nityan Khanna (HHS, Canada), Liz Peloso (HHS, Canada), 
Ted Scott (HHS, Canada), Peter Sztur (HHS, Canada), Jose Costa Teixeira (PATH, Belgium) and Jenny Thompson (PATH, United States).   
WHO is grateful to the following individuals (listed in alphabetical order) for their input, review and feedback throughout the various stage of development of the digital 
adaptation kit for immunizations: Brian Amolo (IntelliSOFT Consulting, Kenya), Sharon Baker (Canadian Institute for Health Information [CIHI], Canada), Madeline Barber 
Dal Molin (SanteSuite, Canada), Duane Bender (SanteSuite, Canada), Klaidi Bido (AIRIS Solutions, Albania), Stella Chelagat (IntelliSOFT Consulting, Kenya), Raghavan 
Chandrabalan (PuraJuniper, Canada), Marcela Contreras (WHO Regional Office for the Americas/Pan American Health Organization, United States), Vittoria Crispino 
(University of Oslo, Norway), Joseph Dal Molin (SanteSuite, Canada), Doriana Delija (AIRIS Solutions, Albania), Vikas Dwivedi (United Nations Children’s Fund [UNICEF], 
United States), Joel Francis (Canada Health Infoway [CHI], Canada), Mike Frost (University of Oslo, Norway), Justin Fyfe (SanteSuite, Canada), Alex Goel (PuraJuniper, 
Canada), Alana Lane (CIHI, Canada), Jordan Lerner (Dimagi, United States), Andrea MacLean (CHI, Canada), Laura MacMillan-Jones (Peterborough Family Health Team, 
Canada), Janice MacNeil (CIHI, Canada), Quincy Morgan (IntelliSOFT, Kenya), Prisca K. Muange (HealthStrat, Kenya), David Mukungi (IntelliSOFT, Kenya), Martha Muselu 
(Ministry of Health Kenya, Kenya), Remy Mwamba (UNICEF, United States), Brian O’Donnell (University of Oslo, Norway), Rebecca Potter (University of Oslo, Norway), 
Vrunda Rathod (PATH, United States of America), Matiko Riro (Clinton Health Access Initiative Inc. [CHAI],  Kenya), Derek Ritz (ecGroup Inc., Canada) and Steven Wanyee 
(IntelliSOFT, Kenya).
This work was funded by Gavi, the Vaccine Alliance, the Rockefeller Foundation and the United States Agency for International Development (USAID). The views of 
funding bodies have not influenced the content of this document.
v
Abbreviations
AEFI	
	
adverse event following immunization
BCG	
	
bacille Calmette–Guérin (vaccine)
bOPV	
	
bivalent oral polio vaccine
DAK	
	
digital adaptation kit
DTP vaccine		
diphtheria–tetanus–pertussis vaccine
EIR	
	
electronic immunization registry
EPI	
	
Expanded Programme on Immunization
HAV	
	
hepatitis A virus
Hib	
	
Haemophilus influenzae type b
HMIS	
	
health management information system 
HPV	
	
human papillomavirus
ICD	
	
International Classification of Diseases 
ICD-11	
	
International Classification of Diseases 11th Revision
ID	
	
identification
IIS	
	
immunization information system
IPV	
	
inactivated polio vaccine
JE	
	
Japanese encephalitis
MCV	
	
measles-containing vaccine
NMFL	
	
National Master Facility List
OPV	
	
oral polio vaccine
PCPOSS	
	
person-centred point-of-service system
PIRI	
	
periodic intensification of routine immunization
polio	
	
poliomyelitis
SIA	
	
supplementary immunization activity
SMART	
	standards-based, machine-readable, adaptive, requirements-
based and testable
SNOMED	
	
Systematized Nomenclature of Medicine
TBE 	
	
tick-borne encephalitis
TCV	
	
typhoid conjugate vaccine
ViPS	
	
Vi polysaccharide
WC-rBS	
	
whole cell-recombinant B subunit
WHO	
	
World Health Organization
vi
Digital adaptation kit for immunizations
Glossary
Note: Terms in definitions that are also defined in this glossary are shown in italics.
Business process
A set of related activities or tasks performed together to achieve the objectives of the health programme area, such as registration, counselling and referrals (1,2).
Clinic
The setting where health workers are administering services that include vaccinations. This may be in clinics for children aged under 5 years that include 
monitoring and some other health promotion activities, or it may be in stand-alone vaccination clinics set up for specific vaccinations, such as COVID-19 or seasonal 
influenza.
Campaign
A time-limited event aimed at vaccinating a main target population against one or more specific diseases. Campaigns may be supplementary immunization 
activities (SIAs), “catch-up campaigns”, or periodic intensification of routine immunization (PIRI) activities, or through innovative local strategies that ensure 
individuals receive routine immunizations for which they are overdue and eligible. This may also include the activities around new vaccine introductions.
Data dictionary
A centralized repository of information about the data elements that contains their definition, relationships, origin, usage and type of data. For this digital 
adaptation kit, the data dictionary is provided as a spreadsheet.
Data element
A unit of data that has specific and precise meaning.
Decision-support logic
A set of decision rules for standard and exceptional cases that is separate from the business process. This will help to reduce the complexity of the business process 
depiction without losing the detail necessary for coding the rules required for system functionality. 
Decision support (for health 
workers)
Digitized job aids that combine an individual’s health information with the health worker’s knowledge and clinical protocols to assist health workers in making 
diagnosis and treatment decisions (3,4).
Decision-support table
Semi-structured way to depict each discrete decision that will need to be embedded in the system. Depending on the complexity of the clinical guidelines, there 
will likely be multiple decision-support tables.
Defaulter
A person who has missed the scheduled dose of a vaccine.
Digital health
The systematic application of information and communications technologies, computer science and data to support informed decision-making by individuals, the 
health workforce and health systems to strengthen resilience to disease and improve health and wellness (1,5).
Digital tracking
The use of a digitized record to capture and store clients’ health information to enable follow-up of their health status and services received. This may include 
digital forms of paper-based registers and case management logs within specific target populations, as well as electronic medical records linked to uniquely 
identified individuals (3,4).
Electronic immunization registry 
(EIR)
Computerized individualized immunization registries that facilitate monitoring and tracking of individual immunization schedules and contain individuals’ 
immunization histories, supporting health workers to determine whether an individual is up to date on their immunization schedule and whether that individual 
has been vaccinated in a timely manner.
Functional requirement
Capabilities the system must have to meet the end users’ needs and achieve tasks within the business process. 
Health information system (HIS)
A system that integrates data collection, processing, reporting and use of the information necessary for improving health service effectiveness and efficiency 
through better management at all levels of health services (6).
Health management information 
system (HMIS)
An information system specifically designed to assist in the management and planning of health programmes, as opposed to delivery of care (6).
Home-based record
A health document used to record the history of health services received by an individual. It is kept in the household, in either paper or electronic format, by the 
individual or their caregiver and is intended to be integrated into the health information system and complement records maintained by health-care facilities (7).
Immunization information 
system (IIS)
Population-based, computerized databases that record immunization doses administered by multiple health workers and that can be used in the design and 
maintenance of effective immunization strategies.
vii
Interoperability
The ability of different applications to access, exchange, integrate and use data in a coordinated manner through the use of shared application interfaces and 
standards, within and across organizational, regional and national boundaries, to provide timely and seamless portability of information and optimize health 
outcomes.
Non-functional requirement
General attributes and features of the digital system to ensure usability and overcome technical and physical constraints. Examples of non-functional requirements 
include ability to work offline, multiple language settings and password protection.
Periodic intensification of 
routine immunization (PIRI)
An umbrella term to describe a spectrum of time-limited, intermittent activities used to administer routine vaccinations – including catch-up doses – to under-
vaccinated populations and/or raise awareness of the benefits of vaccination. Examples include Child Health Days, National Vaccination Weeks, intensified social 
mobilization efforts, etc. PIRI activities are intended to augment routine immunization services by providing a catch-up opportunity for those who are the usual 
target for routine services but have been missed or were not reached during the year. A key distinction between PIRI and supplementary immunization activities 
(SIAs) is that PIRI doses are recorded on the home-based record/immunization card as routine immunization doses and included in the administrative routine 
immunization coverage data. By contrast, SIA doses are considered “supplemental” and not included in the administrative routine immunization coverage.
Person-centred point-of-service 
system (PCPOSS)
Person-centred point of service system (PCPOSS) are digital systems that facilitate the provision and delivery of health services to individuals (i.e. persons, clients, 
patients, health service users) at the point of service or point of care. This includes software capabilities and embedded health interoperability standards that 
enable health workers to access, record and update individuals’ health information. This also includes software capabilities and embedded health interoperability 
standards that enable screening, managing, treating and/or communicating with individuals. PCPOSS encompass various services and application types including 
community-based information systems, decision support systems, electronic medical (or health) record systems and personal health records (4).  
Persona
A generic aggregate description of a person involved in or benefitting from a health programme.
Reminder
A notification sent to remind a client that they have a vaccine due. The same mechanism may be used to alert clients that they have missed a scheduled vaccine.
Standard
In a software, a standard is a speciﬁcation used in digital application development that has been established, approved and published by an authoritative 
organization. These rules allow information to be shared and processed in a uniform, consistent manner independent of a particular application.
Supplementary immunization 
activity (SIA)
Vaccination campaigns that aim to quickly deliver vaccination of one (or multiple) antigens to a large target population with the objective of closing immunity 
gaps in the population. Achieving high population level immunity and speed are the priority, and typically there is no screening of vaccination history/status. The 
supplementary doses given are tallied but not included in the routine administrative national coverage data. SIA doses may be recorded in campaign cards. Note 
that these campaigns are out of scope for this document.
Task
A specific action in a business process.
Terminologies
For clinical care, terminologies are structured vocabularies covering health-related concepts – such as diseases, diagnoses, laboratory tests and treatments – to 
enable the storage, analysis and exchange of data in a consistent and standard way (8).
Vaccination location
Designated location where vaccinations are administered to individuals. These sites may be established and operated by health-care organizations, government 
agencies or other entities involved in public health efforts. Vaccination locations can vary in size and set-up depending on the scale of the vaccination campaign 
and available resources. A health-care facility may have multiple vaccination locations under it. Some vaccination locations may be established temporarily during 
an outbreak or pandemic as part of a facility, while others may be permanent facilities.
Vaccination record
A health document used to record the history of vaccinations received by an individual. Vaccination record may be in a digital or paper format. Depending on the 
context, vaccination record may also be referred to as a home-based record, vaccination card, child health booklet and integrated maternal and child health book. 
Workflow
A visual representation of the progression of activities (tasks, events, decision points) in a logical flow illustrating the interactions within the business process (2).
viii
Digital adaptation kit for immunizations
GLOSSARY REFERENCES1
1	
 All references were accessed on 10 July 2024.
1.	 Digital implementation investment guide (DIIG): integrating digital interventions into health programmes. Geneva: World Health Organization; 2020 (https://apps.who.int/iris/handle/10665/334306). 
2.	 Public Health Informatics Institute. Collaborative Requirements Development Methodology (CRDM). In: Public Health Informatics Institute [website]. Decatur (GA): The Task Force for Global Health; 2016 
(https://www.phii.org/crdm/).
3.	 WHO guideline: recommendations on digital interventions for health system strengthening. Geneva: World Health Organization; 2019 (https://iris.who.int/handle/10665/311941).
4.	 Classification of digital interventions, services and applications in health: a shared language to describe the uses of digital technology for health, 2nd ed. Geneva: World Health Organization; 2023 (https://
iris.who.int/handle/10665/373581).
5.	 Key terms and Theory of Change Small Working Group. Digital health & interoperability [presentation]. Slide 5: Consensus definition (of digital health); 2019 (https://docs.google.com/presentation/
d/1TnTFaunk-1WLlG4sKJQ_aSfjmfmivvcENil4mY4XxJs). 
6.	 Developing health management information systems: a practical guide for developing countries. Manila: World Health Organization Regional Office for the Western Pacific; 2004 (https://apps.who.int/iris/
handle/10665/207050).
7.	 WHO recommendations on home-based records for maternal, newborn and child health. Geneva: World Health Organization; 2018 (https://iris.who.int/handle/10665/274277).
8.	 International Statistical Classification of Diseases and Related Health Problems (ICD) [website]. Geneva: World Health Organization; 2023 (https://www.who.int/standards/classifications/classification-of-
diseases). 
1
Overview of the 
SMART guidelines 
digital adaptation 
kits
1
OVERVIEW
2
Digital adaptation kit for immunizations
Background
As digital technologies are increasingly being leveraged to enable and support health service delivery and accountability, health ministries and partners have 
recognized the value of digital health as articulated within the World Health Assembly resolution (1) and the WHO Global strategy on digital health 2020–2025 (2). 
Similarly, funding agencies have advocated for the rational use of digital tools as part of efforts to expand coverage and quality of services, as well as promote data 
use and monitoring efforts (3,4,5). 
However, guidelines are often only available in a narrative format that requires a resource-intensive process to be elaborated into the specifications needed for 
operationalizing into digital systems. This translation of guidelines for digital systems often results in subjective interpretation for implementers and software 
vendors, which can lead to inconsistencies or inability to verify the content within these systems, potentially leading to adverse health outcomes and other 
unintended effects (6,7,8,9). Despite the abundance of digital tools developed and deployed for health, there is often limited transparency in the data model, 
logic model and the evidence-based clinical or public health recommendations contained in these digital tools, as system documentation may be unavailable or 
proprietary, requiring governments to start from scratch and expend additional resources each time they intend to update and deploy such a system (10). This 
lack of health content documentation undermines the credibility of such systems, leading to dependency on one vendor and haphazard deployments that are 
unscalable, impeding the opportunity for interoperability that would otherwise enable continuity of care (9,11,12). 
WHO standards-based, machine-readable, adaptive, requirements-based and testable (SMART) guidelines provide essential ingredients to facilitate digital health 
transformation of health programmes in a way that is consistent with recommended clinical, public health, data practices and interoperability standards. To ensure 
countries can effectively benefit from digital health investments, “digital adaptation kits” (DAKs), which are the second knowledge layer of the SMART guidelines 
approach, are designed to facilitate the accurate reflection of WHO clinical, public health and data use guidelines within the digital systems that countries are 
adopting. DAKs are operational, software-neutral, standardized documentation that distil clinical, public health and data use guidance into a format that can be 
transparently incorporated into digital systems (12). Although digital implementations comprise multiple factors – including the (i) health domain data and content, 
(ii) digital intervention or functionality, and (iii) digital application or communication channel for delivering the digital intervention – DAKs focus primarily on 
ensuring the validity of the health content (see Fig. 1) (13,14). Accordingly, DAKs provide the generic content requirements that should be housed within digital 
systems, independently of a specific software application and with the intention that countries can customize them to local needs.
For this DAK, the requirements are based on systems that provide the functionalities of person-centred point-of-service systems (PCPOSS) (see Box 1) and include 
components such as personas, workflows, core data elements, decision-support algorithms, scheduling logic and reporting indicators. Operational outputs, such 
as spreadsheets of the data dictionary and the detailed decision-support algorithms, are included as part of the DAK as practical resources that implementers can 
use as starting points when developing digital systems. Furthermore, data components within the DAK are mapped to standards-based terminology, such as the 
International Classification of Diseases (ICD), to facilitate interoperability.
OVERVIEW
3
Overview
The DAKs follow a modular approach in detailing the data and 
content requirements for a specific health programme area – 
such as antenatal care, family planning, sexually transmitted 
infections. This DAK focuses on providing the content 
requirements for PCPOSS used in primary health care 
settings by health workers for provision of immunization 
services. In the context of immunization programmes, 
electronic immunization registries (EIRs), immunization 
information systems (IIS), and immunization modules within 
a electronic medical record system can all serve as the 
PCPOSS. In certain contexts, the terms EIR and IIS are used 
interchangeably. IIS are population-based, computerized 
databases that record immunization doses administered by 
multiple health-care providers and that can be used in the 
design and maintenance of effective immunization strategies 
(15). IIS are designed to provide relevant information 
related to the distinct management areas of the Expanded 
Programme on Immunization (EPI). Whereas EIRs, a part of IIS, 
are computerized individualized immunization registries that 
facilitate monitoring and tracking of individual immunization 
schedules and contain individuals’ immunization histories, 
supporting health workers to determine whether an 
individual is up to date on their immunization schedule and 
whether that individual has been vaccinated in a timely 
manner (15). Apart from EIR, IIS include capabilities for supply 
chain management, logistics management and adverse event 
reporting, but these functionalities are out of scope of this 
DAK. As the focus of this DAK is on person-centred care 
and longitudinal tracking of a person’s health status and 
services, this DAK focuses on requirements for a PCPOSS 
for immunizations, which includes EIRs. 
Foundational Layer: ICT and enabling environment
LEADERSHIP & GOVERNANCE
STRATEGY AND
INVESTMENT
SERVICES AND 
APPLICATIONS
LEGISLATION, 
POLICY AND 
COMPLIANCE
WORKFORCE
STANDARDS AND 
INTEROPERABILITY
INFRASTRUCTURE
HEALTH CONTENT
Information that is aligned 
with recommended health 
practices or validated health 
content 
DIGITAL HEALTH
INTERVENTIONS
A discrete function of digital 
technology to achieve 
health-sector objectives
DIGITAL 
APPLICATIONS
ICT systems and 
communication channels 
that facilitate delivery of the 
digital interventions and 
health content
+
+
Digital adaptation kits representing health content within 
broader needs for digital health implementations
Fig. 1
ICT: information and communications technology.
Source: Adapted from (14).
OVERVIEW
4
Digital adaptation kit for immunizations
What is a person-centred point-of-service system?
A person-centred point-of-service system (PCPOSS), digital in nature, facilitates the provision and delivery of health 
services to individuals (i.e. persons, clients, patients, health service users) at the point of care. A PCPOSS includes 
software capabilities that enable health-care providers to access, record and update individuals’ health information as 
well as interactively communicate with them. The term PCPOSS encompasses various services and application types 
including:
	»
Community-based information systems: Systems that “facilitate data collection and use at the community level. These applications are utilized by 
community-based workers who provide health promotion and disease prevention activities” (16). 
	»
Decision support systems: Digital “tools that combine medical information databases and algorithms with patient specific data. They are intended 
to provide health-care professionals and/or users with recommendations for diagnosis, prognosis, monitoring and treatment of individual 
patients” (16). 
	»
Electronic health record systems: “Secure, online system that holds information about people’s health and clinical care and is managed by health 
workers” (16).
	»
Personal health records: A “record of an individual’s health information in a structured digital format for a set of defined use cases over which the 
person has agency” (16).
End users of PCPOSS can include all health worker occupational groups operating at all care levels, including those operating outside of formal health-
care facilities (e.g. community health workers and health volunteers).
Box 1
Based on the principle of “collect once, use many times” (17), this DAK outlines the requirements of a PCPOSS that facilitates the use of more reliable source data 
for aggregate indicators at management levels by providing access to primary data collected directly at the point of care, allowing a shift away from the need for 
aggregate indicators to be reported separately and for investments in paper-based or digital indicator reporting systems. Data collected for the purposes of service 
delivery can also be used to calculate aggregate indicators required for reporting and accountability, including monitoring provider, stock and system performance. 
Factors affecting overall health system performance can thus be highlighted more promptly and accurately while reducing the clerical burden on health workers. 
OVERVIEW
5
Overview
WHO recommendation related to person-centred point-of-service systems
WHO has provided the 
following context-specific 
recommendation for 
the use of an integrated 
system that provides both 
digital tracking of client’s 
health status and services 
and decision support (14). 
Box 2
