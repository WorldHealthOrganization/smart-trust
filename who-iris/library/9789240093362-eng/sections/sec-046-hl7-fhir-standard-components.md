---
doc_id: 9789240093362-eng
doc_title: "Digital transformation handbook for primary health care Optimizing person-centred point of service systems"
section_id: sec-046-hl7-fhir-standard-components
section_title: "HL7 FHIR standard components"
section_number: null
pages: 96-98
source_pdf: 9789240093362-eng.pdf
source_sha256: 0d47d98390b1451d
toc_source: outline
---
ANNEX 14.
HL7 FHIR standard components

Resources
A “FHIR Resource” is a modular component that serves as the basic data exchange format in the HL7 FHIR standard. A FHIR 
Resource contains the data elements, constraints on those data elements and the data relationships that together make up an 
exchangeable data model, in the context of health data (1).
Each FHIR Resource also contains links to relevant information in other FHIR Resources. For example, the ANC Observation 
resource in the WHO Antenatal Care Guideline Implementation Guide (2) contains information on the observed body part, how 
the observation was done, and links to the ANC Patient resource, ANC Encounter resource, and ANC Practitioner resource, and 
others.
Each FHIR Resource has an identified version that changes if the contents of the FHIR Resource changes.
HL7 FHIR defines a “Resource” as having: (i) a common way to define and represent Resources; (ii) a common set of metadata; 
and (iii) a human readable part (3).
Implementation guide
A “FHIR Implementation guide” is a standards-based technical guide that outlines how the FHIR Resources should be used for a 
given use case (4).
In the context of WHO SMART Guidelines, the L3-machine-readable guidelines are packaged in a FHIR Implementation guide that 
provides code necessary for software developers to incorporate standardized logic from WHO guidelines into digital systems. The 
FHIR Implementation guide builds on L2-Digital adaptation kits and allows for semantic and syntactic interoperability at scale.
Profiles
A “FHIR Profile” is a set of additional rules, constraints or instructions for use of FHIR Resources.
FHIR Profiles can be used to extend and restrict FHIR application programming interfaces (APIs) by defining additional 
operations and adding new search parameters. Further, they can extend and restrict Resources by defining extensions of 
Resources and changing the cardinality of data fields. FHIR Profiles help countries, regions, districts and organizations customize 
data in accordance with their health-care data regulations and needs using the HL7 FHIR standard (5).
Stores
A “FHIR Store” is where different applications or modules hold, write and read FHIR Resources. FHIR Stores exist inside datasets 
(6).
Application Programming Interface (API)
APIs are not unique to HL7 FHIR. APIs are “interfaces” that allow one system, solution or application to access features and/or 
data of another system, solution or application. This interface defines the interactions between applications (e.g. how data can 
be searched across applications) and how that data must be formatted. FHIR APIs mainly involve the access and exchange of 
health data across digital health solutions (7).
Annex 14 References
1.	
Introduction to FHIR Resources. The Office of the National Coordinator for Health Information Technology (healthit.gov); 
undated (https://www.healthit.gov/sites/default/files/page/2021-04/Intro%20to%20FHIR%20Resources%20Fact%20Sheet.pdf). 
2.	
WHO Antenatal Care Guideline Implementation Guide version 0.3.0. World Health Organization; 2017 (http://build.fhir.org/
ig/WorldHealthOrganization/smart-anc/, accessed 12 October 2023).
3.	
FHIR overview. In: HL7.org [website]. HL7 FHIR Release 5; 2023 (https://www.hl7.org/fhir/overview.html, accessed 12 
October 2023).
4.	
Resource implementation guide – content. In: HL7.org [website]. HL7 FHIR Release 5; 2023 (https://build.fhir.org/
implementationguide.html, accessed 12 October 2023).
5.	
Profiling FHIR. In: HL7.org [website]. HL7 FHIR Release 5; 2023 (https://hl7.org/fhir/profiling.html, accessed 12 October 
2023).
6.	
Using FHIR in persistent stores. In: HL7.org [website]. HL7 FHIR Release 5; 2023 (http://hl7.org/fhir/storage.html, accessed 
12 October 2023).
7.	
The FHIR API. The Office of the National Coordinator for Health Information Technology (healthit.gov); undated (https://
www.healthit.gov/sites/default/files/page/2021-04/FHIR%20API%20Fact%20Sheet.pdf). 
World Health Organization
20 Avenue Appia
1211 Geneva 27
Switzerland
who.int
Department of Digital Health and Innovations
Email: digitalhealth@who.int 
Department of Sexual and Reproductive Health and Research
Email: srhhrp@who.int
