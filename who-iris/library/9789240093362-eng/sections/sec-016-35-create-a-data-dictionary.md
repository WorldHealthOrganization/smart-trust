---
doc_id: 9789240093362-eng
doc_title: "Digital transformation handbook for primary health care Optimizing person-centred point of service systems"
section_id: sec-016-35-create-a-data-dictionary
section_title: "Create a data dictionary"
section_number: 3.5
pages: 42-44
source_pdf: 9789240093362-eng.pdf
source_sha256: 0d47d98390b1451d
toc_source: outline
---
The final step in streamlining data collection and indicator reporting is to create a data dictionary, 
which (in this context) is a repository of all the data elements essential for individual and aggregate 
levels, including some metadata components, that will be included in the PCPOSS. 
For the purposes of designing the solution and facilitating 
understanding across multiple stakeholders, the data 
dictionary will also include the data elements’ related 
attributes, plus a mapping to standard classifications and 
terminology concepts. Data dictionaries should utilize 
interoperability standards. Continuity of care can only 
be sustainably achieved through the adoption and use of 
standardized data models connected to health-specific, 
person-centred semantic classifications and terminology 
standards (e.g., ICD-11, SNOMED-GPS) and syntactic 
interoperability standards (e.g., HL7 FHIR). These standards 
ensure consistent and high-quality data exchange across 
various digital systems, regardless of the time, health topics, or 
different healthcare providers and facilities involved.
3.5.1 	 Define data elements for inclusion in 
data dictionary
The data elements that health workers will collect, as well as 
the indicator elements that are calculated using these, will be 
given related attributes in the data dictionary that include the 
definition of the data element, the data type and possible data 
labels. For example, data elements for family planning include 
visit date, unique identification, address, reason for visit and 
medical eligibility category (30).
It is important that the data dictionary is streamlined, to 
consolidate the data elements that will be included in the 
PCPOSS. As a result of the work already completed, all the 
data elements included in the data dictionary should now 
serve only the essential purposes of service delivery and 
accountability.
In practical terms, this means work on finalizing the data 
dictionary can begin by using a copy of the spreadsheet from 
which duplicated, orphaned and non-essential data elements 
have been removed. Noting multiple iterations will still need to 
be made, this is the base for the final data dictionary.
The data elements included in a finalized data dictionary 
can vary depending on its purpose, even though the data 
dictionary reflects all the essential data elements in a PCPOSS. 
The essential data elements that would be outlined in a data 
dictionary will vary based on the following types of data 
dictionaries:
1. Data dictionary for database design: During the 
requirements gathering phase, the data dictionary focuses 
on capturing the data model that needs to be persisted and 
used for reporting, auditing, aggregation and information 
exchange. It focuses on the underlying data structure, rules 
and relationships necessary for implementing the system’s 
functional requirements. The data dictionary component of 
the Digital adaptation kits (DAKs) serve as a starting point 
for database design and provide a template for possible data 
elements, data types and mappings based on the health area. 
2. Data dictionary for user interface (UI) design: A data 
dictionary used for UI design reflects the content of a digitized 
form, focusing on the visual representation, interaction and 
usability aspects of the system, enabling consistency and 
coherence in the UI design and implementation. This type 
of data dictionary may be used to create the prototype and 
mock-up design, ultimately creating a well-defined and 
effective UI during the early stages of system development. 
However, this may result in a data dictionary that requires 
additional effort to map to interoperability standards (53). 
Choosing between the data dictionary for database design 
and a data dictionary for UI depends on the needs and 
objectives of the PCPOSS. In some cases, it may be beneficial 
to have both a data dictionary for database design and a data 
dictionary for the UI, as they serve different purposes and 
cater to different stakeholders. 
3.5.2 	 Map data elements to standardized 
classifications and terminologies
The use of standardized classifications and terminologies 
– such as WHO’s International Classification of Diseases, 
11th Revision (ICD-11) or Regenstrief Institute’s LOINC, 
among other standardized concepts – is critical for enabling 
interoperability across systems. A standards-based approach 
also means continuity and facilitated knowledge transfer when 
implementation teams change. 
This would involve mapping the required data elements in 
the data dictionary to ICD-11 or any other WHO Family of 
International Classifications (WHO-FIC). 
This mapping exercise can either be carried out using a 
spreadsheet, or more efficiently by using a terminology service 
or metadata registry, such as Open Concept Lab. Engaging 
individuals with expertise in health informatics, classifications 
and terminologies in order to map data elements to 
standardized concepts is highly recommended. Note that the 
process of mapping to standard concepts can take significant 
time, effort and resources. Unlike the earlier steps to 
streamline data collection and indicator reporting, and to build 
most of the data dictionary, this step is often done by health 
informaticians. They are familiar with the relevant standards 
and have a strong understanding of the clinical information 
being collected. If any widely used mappings already exist, it is 
highly recommended to simply adopt these. 
Reference guidance on core data 
elements
Depending on the health area the PCPOSS is being 
developed for, a reference data dictionary and mappings 
to standard terminologies may already exist. WHO’s 
Digital adaptation kits (DAKs) provide an adaptable and 
customizable list of data elements required throughout 
the different points of workflows for various health 
areas. For example, WHO’s DAK for HIV outlines the 
core data elements in a comprehensive data dictionary 
which details the input options, calculations, validation 
checks and links to standardized terminology codes 
(31). Adaptation of WHO’s DAKs may require translation 
of data labels into the local language and creation of 
additional data elements depending on the context.
TIP
