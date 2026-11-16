---
doc_id: 10665-360948
doc_title: "PERSON-CENTRED HIV STRATEGIC INFORMATION"
section_id: sec-148-625-data-use-and-exchange
section_title: "Data use and exchange"
section_number: 6.2.5
pages: 268-269
source_pdf: 10665-360948.pdf
source_sha256: 2647e4d36f0be148
toc_source: outline
---
It is important to be able to share data between facilities and between systems to provide 
continuous, person-centred services when, for example, an individual moves to a different 
location and clinical setting. Fast Health care Interoperability Resources (FHIR, pronounced 
“fire”) is a popular specification for data exchange maintained by HL7 (36). The FHIR 
specification is composed of 1) definitions of data models commonly used in a health care 
setting (termed “resources”), 2) data formats (for example, JSON and XML) and 3) protocols 
for exchanging data (for example, in the case of FHIR, a RESTful application programming 
interface). FHIR defines almost 150 resources, which highlights its wide-ranging intended use. 
These resources cover clinical, administrative and billing and research data that may arise in 
the context of health care. 
FHIR is growing in popularity for a number of reasons (19): FHIR is built upon commonly 
available and widely used web standards (OAuth, HTTPS). The specification is extensible and, 
therefore, applicable in a wide variety of health care contexts. Furthermore, FHIR has been 
designed to be straight-forward to implement and learn, and the full specification of FHIR is 
freely available1 to view and use. FHIR is used in several countries that are part of the Global 
Digital Health Partnership (22). As an example, Box 6.5 includes discussion of FHIR-compliant 
data exchange protocols for COVID-19 digital certificates for vaccination status and test 
results (10, 37).
1 The current specification is v4.0.1.
Box 6.5 Multi-layered interoperability in COVID-19 digital certificates
COVID-19 digital certificates are an example of the multi-faceted requirements for 
interoperability outlined in this section. 
Technical interoperability
WHO’s Digital documentation of COVID-19 certificates (DDCC) gives technical 
specifications and implementation guidance for describing vaccination status and 
test results (10, 37). It includes FHIR-compliant implementation guidance and is 
published in a publicly facing code repository (38). The technical specifications provided 
in the documents and associated annexes exemplify the semantic and syntactic 
interoperability standards and requirements. 
Organizational interoperability
The WHO DDCC technical specifications and implementation guidance provide 
generic business process workflows and present case examples of workflows. 
These outline, for instance, the different personas involved in the implementation 
of the digital vaccination certificates and the flow of data within common activities. 
The DDCC also includes a chapter on national governance, which provides critical 
considerations for determining how entities and organizations will work together to 
implement DDCC solutions. 
Chapter 6 – Digital health data
