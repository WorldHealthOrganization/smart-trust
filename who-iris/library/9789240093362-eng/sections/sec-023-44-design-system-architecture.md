---
doc_id: 9789240093362-eng
doc_title: "Digital transformation handbook for primary health care Optimizing person-centred point of service systems"
section_id: sec-023-44-design-system-architecture
section_title: "Design system architecture"
section_number: 4.4
pages: 56-60
source_pdf: 9789240093362-eng.pdf
source_sha256: 0d47d98390b1451d
toc_source: outline
---
A system architecture is a conceptual model that depicts how the PCPOSS will be structured and how 
it functions and includes all the software and hardware components that comprise the system. 
Further, the system architecture of a PCPOSS would need 
to function within an Enterprise Architecture (EA), which 
describes how the PCPOSS interacts with other parts of the 
digital health ecosystem and is used to drive interoperability 
requirements. Such architectures can be visualized with a 
variety of tools, similar to those mentioned for workflow 
mapping, including but not limited to diagrams.net, 
Lucidchart, Microsoft PowerPoint and Microsoft Visio.
The solution’s system architecture is highly dependent on 
requirements that are context-specific, such as requirements 
from existing systems, infrastructural constraints, requirements 
on software platforms or programming languages utilized, 
human resource capacity, and interoperability standards 
requirements. The WHO and ITU joint publication, Digital 
health platform handbook: building a digital information 
(infostructure) for health, provides a detailed walkthrough of 
how to design a solution’s system architecture while adhering 
to design principles (61). 
Interoperability is the ability of different applications to access, 
exchange, integrate and use data in a coordinated manner 
through the use of shared application interfaces and standards, 
which should be defined by the EA and independent of a 
particular solution’s system architecture (22). Interoperability 
encompasses standards on the syntax for representing 
structured data, the semantics of the data through use of code 
systems and standardized terminologies, and how to carry out 
the exchange of data across different digital health systems. 
Refer to section 4.4.2 for additional information on the 
different areas of interoperability. Adoption of interoperability 
with a PCPOSS provides a range of benefits, including timely 
and seamless portability of information, continuity of care, 
optimized health outcomes and reduced clerical burdens.
The machine-readable guidelines from SMART Guidelines 
(L3) include a number of computable artefacts which may 
be leveraged to support the design and implementation of 
a standards-based, interoperable PCPOSS. These artefacts 
include data components mapped to semantic and syntactic 
interoperability standards-based terminology systems, 
software platform independent business rules for software 
developers to incorporate standardized clinical decision 
support logic and indicator calculation logic from WHO 
guidelines into digital systems, and testable conformance 
standards in the form of HL7 FHIR implementation guides. 
Section 4.4.3 provides additional information on the 
importance of and types of data standards available for a 
PCPOSS. 
Existing HL7 FHIR implementation guides for machine-readable guidelines 
Depending on the health area targeted, there may already be implementation guides, in accordance with WHO 
guidelines, for adaptation into countries’ digital health service delivery and reporting systems. For example, WHO’s 
ANC FHIR Implementation Guide provides implementation resources and guidance in support of applying the WHO 
recommendations on antenatal care (ANC) for a positive pregnancy experience. This implementation guide represents the 
WHO ANC DAK content in a more computable way, using the HL7 FHIR standard (62).
TIP

4.4.1 	 Types of architecture  
Architecture sets the foundation and blueprint of the 
solution that describes how different processes, data, 
systems and technology fit together to achieve the desired 
features and requirements. A well-planned architecture is 
comprehensively defined across the various viewpoints 
of business, data, applications and technology, within the 
context of an overarching EA. The architectural approach 
provides an overview of all the necessary building blocks and 
a rational method of understanding, defining and manageably 
implementing digital health interventions (22).  
Architectural standards govern the architecture process, 
affecting the development, maintenance and use of the 
PCPOSS. They reflect a level of consensus among the various 
stakeholders and form the basis for making future IT decisions. 
There are various reference system architecture frameworks 
available for streamlining the development and maintenance 
of EAs and solutions-specific systems architecture. The 
paper, Enterprise Architectures – Enabling Interoperability 
Between Organizations, provides a comparative analysis of EA 
models with emphasis on the level of support they provide 
for technical, semantic and organizational interoperability 
(63). The most comprehensive and accessible framework is 
The Open Group Architecture Framework (TOGAF), which is 
included within Asia eHealth Information Network (AeHIN)’s 
Mind the GAPS Framework (64). TOGAF Standard is an EA 
framework developed by The Open Group that helps to 
define business objectives and align them with architecture 
objectives around software development. TOGAF standard 
plays an important role in standardization and de-risks the 
architecture development process (65). Table 2 describes four 
types of architecture accepted as a subset of an overall EA in 
the TOGAF framework (66,67).
Table 2. Types of architecture domains

| Domain | Definition |
| --- | --- |
| **Business architecture** | Defines the digital health solution strategy, governance, organization and health system business processes that identify the components and technologies needed. |
| **Data architecture** | Describes the structure of an organization’s logical and physical data assets and data management resources. It defines how data is collected and utilized at different moments of the health journey. It also outlines the data standards that the system uses to ensure that external applications access and use data properly. |
| **Application architecture** | Provides a blueprint for individual software applications to be deployed, interactions between software and how software relates to the core business processes of the organization. It includes internal and external software applications used by end users and interactions with external components including APIs and standards needed for interoperability. |
| **Technology architecture** | Describes the logical software and hardware components required to support the deployment of business, data and application services, including information technology, infrastructure, middleware, networks, communications, processing and standards. |
Other commonly used frameworks include the Zachman 
Framework (68), the Federal Enterprise Architecture 
framework (69), the Gartner methodologies (70) and the 
Reference Model of Open Distributed Processing (71). The 
Open Health Information Exchange (OpenHIE) model is also 
a reference architecture model used in the health sector. 
OpenHIE is a community of practice that offers a reusable 
approach to enterprise architecture that employs existing 
health information standards, uses a common language 
for describing typical components of a health information 
architecture and allows for flexibility of integration and 
implementation (72).
4.4.2 	 Types of interoperability in health
Interoperability is the ability of different applications to 
access, exchange, integrate and use data in a coordinated 
manner through the use of shared application interfaces 
and data representation standards, within and across 
organizational, regional and national boundaries, to provide 
timely and seamless portability of information and optimize 
health outcomes. Interoperability is commonly split into four 
broad areas (detailed in Table 3): syntactic interoperability, 
semantic interoperability, organizational interoperability 
and legal interoperability (73,74). A fully interoperable health 
system encompasses all four areas of interoperability in a 
multi-faceted approach. 
Table 3. Types of interoperability in health

| Domain | Definition |
| --- | --- |
| **Syntactic interoperability** | Also referred to as structural interoperability, refers to the way technology enables interoperability across digital systems. Under syntactic interoperability, two or more systems can communicate structured data and securely share or exchange data (i.e. interface specifications and communication protocols), thus allowing different types of software to work together. Syntactic standards are used for specifying data formats to be shared such as HL7 FHIR, JSON (JavaScript Object Notation) or XML (Extensible Markup Language). |
| **Semantic interoperability** | Refers to the way in which two or more systems connect and share data elements that each system understands in a meaningful way (i.e. data representation standards). Semantic standards include terminology and classification standards, which are used for classifying diseases with the ICD (International Statistical Classification of Diseases and Related Health Problems) or health-care interventions with ICHI (International Classification of Health Interventions), for example. |
| **Organizational interoperability** | Refers to the way different organizations and their management and workforces collaborate and align their business processes, responsibilities and expectations to achieve collaboration, information exchange, and commonly agreed and mutually beneficial goals. Organizational interoperability aims to remove factors blocking the use and exchange of data between different stakeholders. Initiatives that may facilitate organizational interoperability include defining standard operating procedures, governance, mechanisms for establishing trust (e.g. trust frameworks), business process coordination across organizations, sharing strategy documents, and establishing formal or informal collaborations and partnerships. |
| **Legal interoperability** | Consists of the legal frameworks and legal basis to facilitate smooth data usage and exchange between different organizations working across different jurisdictions (e.g. regions, countries). Legal frameworks need to consider individuals’ rights to privacy and access to their health-care data; and mechanisms for ensuring data and privacy protection, and secure data processing and storage. Legal interoperability also includes policies that enable the secure sharing and use of person-centred data for health care and public health purposes. |
4.4.3 	 Types of standards 
Digital health standards, including architectural standards, 
interoperability standards and policy standards, are key to 
how different digital applications can exchange data with 
each other. Standards provide a common language and set of 
expectations that enable interoperability between systems (75). 
With common standards, digital health solutions can share an 
integrated information infrastructure whereby data is collected 
and reused for multiple purposes. Common standards also 
support effective assimilation of new knowledge into decision 
support tools. Several types of standards exist today, including 
standards that fall under the following categories: terminology 
and classification standards, content standards, communication 
standards, and privacy protection standards (See Table 4). 
There are a number of standards that are used and adopted in 
health care; however, listed below are open standards that have 
evidence of global adoption.
Table 4. Types of standards

| Type of interoperability supported | Standard category | Standard description | Common examples |
| --- | --- | --- | --- |
| **Semantic** | Terminology and Classification Standards | Terminology and classification standards enable effective communication between systems and address the ability to represent concepts in an unambiguous manner between a sender and receiver of information. Health information systems that communicate with each other rely on structured vocabularies, terminologies, code sets and classification systems to represent health concepts. | **The WHO Family of International Classifications and Terminologies (WHO-FIC)** serve as the global standards for health data, clinical documentation and statistical aggregation and allows all health workers and health service users to communicate using one language. WHO-FIC includes: the International Statistical Classification of Diseases and Related Health Problems (ICD), the International Classification of Functioning, Disability and Health (ICF), and the International Classification of Health Interventions (ICHI) (76).<br>**The International classification of diseases, 11th revision (ICD-11)** is a medical classification list developed by WHO that contains codes for diseases, signs and symptoms, abnormal findings, complaints, social circumstances and external causes of injury or diseases (77).<br>**Logical Observation Identifiers Names and Codes (LOINC)** is a universal code system created by Regenstrief Institute and used for laboratory and clinical tests, measurements, and observations (78).<br>**Systematized Nomenclature of Medicine-Global Patient Set (SNOMED-GPS)** is a clinical health terminology product owned by SNOMED International that supports the sharing of health service user’s health information coded with SNOMED GPS (79). |
| **Organizational** | Health Content standards | Health content standards are based on clinical and public health evidence-based best practice, representing potential areas of integrated care. | **Digital adaptation kits (DAKs)** outline key workflows and user personas that highlight areas for integration across the different health domains.<br>**WHO guidelines and normative guidance documents** are information products developed by WHO that contain WHO recommendations for clinical practice or public health policy. Examples include *Consolidated guidelines on person-centred HIV strategic information: strengthening routine data for impact* (80) and the *WHO Outbreak toolkit* (81). |
| **Organizational** | Digital health strategies | Digital health strategies established at global, regional and national levels establish foundations for sustainable and integrated health systems, promote collaboration and alignment of work priorities. | • An example of a national-level digital health strategy: India’s National Digital Health Mission (82)<br>• An example of a regional-level digital health strategy and framework: African Union Health Information Exchange guidelines and standards (83)<br>• An example of a global-level digital health strategy and framework: WHO’s *Global strategy on digital health 2020–2025* (84) |
| **Syntactic** | Communication standards | Communication standards facilitate data exchange between different solutions by defining the formats, data elements, methods, document architecture and APIs. | **HL7 Fast Healthcare Interoperability Resources (FHIR)** is an open standard developed by Health Level Seven International (HL7), a not-for-profit organization dedicated to standards development (85), for exchanging health-care information electronically. The HL7 FHIR standard (available at http://hl7.org/fhir) offers a set of modular resources to define a data model for specific but common processes in health care (86). A resource is the basic exchangeable data element of HL7 FHIR (87). This allows for easier exchange of information across other systems that also adhere to HL7 FHIR standards. HL7 FHIR also provides standardization for application programming interfaces (APIs). The terminology standards and HL7 FHIR Resources together form a basis for communicating the structure and meaning of the clinical data. This sets the stage for clinical decision support, which can leverage HL7 FHIR’s data structures and semantic terminology standards to ensure decision support logic is implementable. Please see Annex 14 for additional information on the components and architecture of FHIR.<br>**Integrating the Healthcare Enterprise (IHE) Profiles** provide a standards-based framework for sharing information within care sites and across networks. They address critical interoperability issues related to information access for care providers and health service users, clinical workflow, security, administration and information infrastructure. IHE Profiles organize and leverage the integration capabilities that can be achieved by coordinated implementation of communication standards, such as DICOM, HL7 and W3C (88).<br>**Digital Imaging and Communications in Medicine (DICOM)** is an international communication protocol and file format for exchanging medical images across systems and facilitates the development and expansion of picture archiving and communication systems (89).<br>**GS1 Standards** provide common language to identify, capture and share supply chain data and exchange metadata about medicinal products, devices, commodities, and vaccines (90). They are open, technology-independent standards that provide a global system of traceability built around globally identified products. |
| **Legal** | Privacy protection | Establish administrative and technical rules to protect sensitive health data from misuse, unauthorized access, or disclosure | Examples of national level policies include:<br>• Health Insurance Portability and Accountability Act in the United States of America (91)<br>• Thailand Personal Data Protection Act (92)<br>• Rwanda’s Data Protection Law (93)<br>Examples of regional level policies include: General Data Protection Regulation, which is the European Union’s privacy and security regulations for all processing and storage of data relating to data subjects – or people – in the European Union (94). |
