---
doc_id: 10665-360948
doc_title: "PERSON-CENTRED HIV STRATEGIC INFORMATION"
section_id: sec-152-633-system-architecture-and-methods-of-uid
section_title: "System architecture and methods of UID"
section_number: 6.3.3
pages: 277-282
source_pdf: 10665-360948.pdf
source_sha256: 2647e4d36f0be148
toc_source: outline
---
Technical resources
This section presents the basic components of system architecture and the UID. This guidance 
should enable programme managers to discuss the key considerations with the technical 
specialists who will develop UID systems. It should be used in conjunction with documents that 
provide more detailed technical information, including the following:
•	 Standard guide for properties of a universal healthcare identifier (ASTM E-1714-07R13) (43);
•	 Standard guide for implementation of a voluntary universal healthcare identification system 
(ASTM E-2553-07 (2013) (44);
•	 Health informatics: identification of subjects of health care (ISO/TS22220:2011) (35);
•	 Health informatics: patient healthcard data. Part 5: identification data (ISO 21549-5:2015) (45);
•	 Health informatics: guidance on patient identification and cross‐referencing of identities 
(DS/CEN/TR 15872) (46).
Considerations for system architecture
The system architecture will depend on the layers of paper, power and networks in facilities. 
There are three layers:
•	 Layer 1 – Paper: facilities with no reliable power or telecommunications; cold chain may 
be powered by generators. Such facilities can support only paper systems.
•	 Layer 2 – Power: facilities with a minimum of reliable daily power (solar, generator, power 
lines and uninterrupted power supply) sufficient to charge/operate an efficient computer. 
These can support offline electronic systems.
•	 Layer 3 – Network: facilities with reliable daily telecommunications and power can have 
clinic operations dependent on internet-based applications. These can support mixed 
online/offline or fully online systems.
The overall system design, including identifying necessary communications links, should 
consider the following equipment requirements, depending on the layer of the facility:
Data entry workstations
Each person entering data from paper forms into a computer needs a data entry terminal, 
unless scannable forms are used. If scannable forms are used, each site needs at least one 
workstation paired with a form scanner.
Central registry servers
At least one larger-capacity server located centrally is needed to host the national UID registry. 
In addition, at least one larger-capacity server located centrally is needed to receive and 
process transaction files and generate response files.
Distributed registry servers and cloud computing
Most countries will not want to depend on a single server that must be operational at all times 
to process all requests to the patient registry, since the failure of a single communications 
link or router would cause widespread outage. Ways to avoid the problem of a single point of 
failure would be to use cloud-based servers or regional servers (an outage then affects only 
one region and is likely to simplify troubleshooting and repair). Cloud hosting has the potential 
to offer accessible, flexible and stable hosting infrastructure, and it can be configured to have 
security and data protection on a par with on-premises hosting. However, cloud computing 
may mean servers are located, and data stored, in another country, which may raise questions 
of data protection policies (see section 6.4 on privacy, security, data access and control). If 
cloud computing is considered, data protection policies in the country where the data are 
stored should be consulted. If strong laws and data governance models protecting personal 
data are in place where servers are located, then cloud computing may be a suitable option for 
making data accessible, enabling scalability and maximum server uptime. 
Interoperability
Effective national health information systems should enable data to be shared and understood 
across clinics, hospitals, laboratories, pharmacies and individuals, regardless of the application 
or vendor. Interoperability ensures that data can be shared and understood in such a manner. 
Interoperable health care record systems need supportive governance, an enabling policy 
environment and technical standards for data content and exchange (see section 6.2). 
Technical components of a UID system
Attributes and security of a UID
To maximize the benefits of a UID, several system attributes or functions are required (40): 
•	 an identifier scheme consisting of alphanumeric characters that do not represent any aspect 
of the identity of the individual (a content-free UID);
•	 differentiation of the security of different types of information with different rules of 
access;
•	 cross-references to any local, site-specific, individual identifiers that may be in use;
•	 mechanisms to hide or encrypt identifiers;
•	 software to mass-register individuals and appropriate personnel to carry out this task;
•	 software to search, identify, match, encrypt and in other ways manipulate the underlying 
information; and
•	 administrative and telecommunications infrastructure, including central governing 
authority.
The use of UIDs improves the anonymity of existing name-based person-centred records but 
must be augmented by appropriate and ongoing measures to protect the information. Some of 
these protections are the following: 
Chapter 6 – Digital health data
•	 Robust measures to control access, including software security, physical access security, 
encryption protection and an authentication mechanism, must be in place to prevent 
unauthorized access and ensure legitimate access.
•	 Training programmes are required to ensure that all staff with access to personally 
identifiable health information are aware of their responsibilities and have the necessary 
skills to perform their tasks consistently and correctly.
•	 Security measures should be specified, including audit trails for tracking inappropriate 
access and steps preventing possible misuse.
While not containing personally identifying information, UIDs may link to personally identifying 
information. For organizations that generate, access or use personally identifiable health 
information, the following measures should be implemented:
•	 access protection;
•	 user authentication;
•	 audit trails;
•	 training and education;
•	 physical security;
•	 organizational policies and procedures;
•	 promotion of an organizational culture conducive to protecting privacy;
•	 appropriate classification of data into identifiable, non-identifiable and non-person-
associated, to aid in determining appropriate system security measures;
•	 built-in computer security in hardware, operating systems, application software and 
communication protocols and methods;
•	 appropriate segregation of computer networks by firewalls into private, semi-private and 
public networks;
•	 periodic testing of the security of the system to identify the strengths and weaknesses of 
security and protection;
•	 proper disposal of electronic and paper health records, by electronic scrubbing of old media 
using software designed for that purpose and by shredding paper records.
Section 6.4 presents more detailed guidance on protecting the privacy, confidentiality and 
security of personal health information. 
Box 6.6 Case example of implementation of UID numbers in a health 
care setting in South Africa 
South Africa has developed the Health Patient Registration System (HPRS), which 
follows individuals longitudinally through their life course, including assignment 
of a health UID, the health patient registration number (HPRN). The HPRS, 
provides a patient registry and a Master Patient Index (MPI), and provides core 
patient administration functionality including recording attendances and scheduling 
appointments. Patients can be followed through the HPRN as they access different 
facilities, with the potential to improve the delivery of services to patients, as well 
as provide better data to aid strategic decision-making and planning.
The HPRN (a 10-digit randomly-assigned numeric identifier with the last digit being 
a checksum) was chosen instead of the South African national ID number as the UID 
in order to protect patient privacy as well as to ensure that a single system could be 
applicable to all patients, as a national ID is not a pre-requisite for accessing health 
care. The national ID is however considered a key additional unique identifier critical to 
de-duplication and the integrity of the MPI, and services are encouraged to request and 
record whenever possible. All health registration data are considered sensitive data and 
may not be shared for any purpose other than for provision of health care (see below).
Implementation of the HPRS was made possible by a collaborative effort between 
national government departments (the departments of Health, Home Affairs, Basic 
Education and the South Africa Social Security Agency) and provincial departments of 
health, starting in 2013.
By March 2019 there were 3059 primary health care facilities and 34 hospitals 
implementing the HPRS, with over 45 million individuals registered (in a total 
population of almost 59 million). Although there were delays in 2018/2019 due to the 
complexity of linking patient data from hospital systems, it is estimated that almost 
70% of the population had been registered in the system by the time that the 2018/19 
Annual Report was published (47, 48). 
Patient privacy is enshrined in the South African constitution of 1996 and the National 
Health Act of 2003 which requires patient consent for the disclosure of personal 
information, with limited exceptions. The Protection of Personal Information Act (49, 
50), reaffirmed these provisions related to health as part of a general approach to 
personal privacy protection, and recently came into full effect resulting in a renewed 
focus on patient privacy. Whereas public sector personal health services and associated 
information systems are largely managed at provincial level at present, national eHealth 
strategies, the Health Normative Standards Framework, and the information system 
provisions in the current National Health Insurance Bill, all envisage a shared national 
standards-based health information exchange with the HPRS as the client registry. 
Already a number of national and facility-based systems interoperate with the HPRS to 
retrieve patient details in a standards-compliant manner, including the National Health 
Laboratory Service.
Sources: 
•	 Department of Health of South Africa, 2020 (47)
•	 Department of Health of South Africa, 2019 (48) 
•	 Protection of Personal Information Act, 2013 (49) 
•	 WHO Regional Office for Africa, Regional Workshop on Unique Identification and Application go HIV Patient 
Monitoring and Case Surveillance, 2019 (50).
Box 6.6 (continued) Case example of implementation of UID numbers 
in a health care setting in South Africa 
Chapter 6 – Digital health data
Box 6.7 UIDs and data use for programme improvement among 
people who inject drugs in Pakistan 
Background
The Nai Zindagi Trust is a Pakistani non-profit organization established in 1989 to 
support people who inject drugs with needs-based and context-appropriate lifesaving 
services. People who inject drugs, their spouses or intimate partners and their children 
receive comprehensive HIV prevention services and are provided free treatment and 
care if they are living with HIV.
Pakistan has a concentrated HIV epidemic among key populations, primarily among 
people who inject drugs, followed by hijra (transgender) sex workers, trans and gender 
diverse people, men who have sex with men, male sex workers and female sex workers, 
in that order (51). In Pakistan laws criminalize injecting or using drugs, with a possible 
maximum penalty of life imprisonment. The prevailing legal environment, stigma and 
discrimination create barriers to health care services. 
Despite these challenges, Nai Zindagi Trust provides regular health services to 
approximately 34 000 people who inject drugs, and to their partners and children, 
through a mobile outreach approach at 44 sites across 58 districts. Services such as 
those listed in Table 6.3 are provided at more than 500 hotspots six days a week, 
reaching about 8000 people who use drugs daily and providing sterile needles and 
syringes and follow-up services.
Table 6.3 HIV prevention and treatment services provided by the 
Nai Zindagi Trust through mobile outreach
HIV prevention services
HIV treatment services
•	
Needle–syringe provision
•	
POC CD4 testing
•	
HIV testing and counselling
•	
POC VL testing
•	
HIV prevention services for spouses of clients
•	
Linkage to ART for clients, partners and family 
members who test HIV-positive
•	
Condom provision 
•	
Differentiated ART services and adherence 
monitoring
•	
Basic primary health care
•	
Rehabilitative ART adherence support 
Data collection
Since the start of the project, an electronic health management information system 
using UIDs has captured data at each service delivery point, including both facilities 
and community outreach. Direct upload of service delivery data was interrupted during 
the COVID-19 pandemic, however, due to the lack of safety in sharing portable devices, 
and it was replaced for a time with paper-based data collection. UIDs are generated 
for each client at registration and help avoid duplication in the absence of any other 
credential such as national identity cards. At the time of client enrolment, field staff 
collect baseline data, including demographic information and risk behaviours, as part 
of registration for a UID. All service delivery components are captured, including each 
client–staff interaction with the date, time, location, supplies provided. Commodity 
data are directly linked with an inventory management system to manage procurement.
