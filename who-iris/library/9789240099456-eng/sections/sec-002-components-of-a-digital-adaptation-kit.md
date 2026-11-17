---
doc_id: 9789240099456-eng
doc_title: "Digital adaptation kit for immunizations"
section_id: sec-002-components-of-a-digital-adaptation-kit
section_title: "Components of a digital adaptation kit"
section_number: null
pages: 18-21
source_pdf: 9789240099456-eng.pdf
source_sha256: 6b0f603e2a792bb4
toc_source: inferred
---
The WHO SMART guidelines DAK comprises eight interlinked components: (1) health interventions and recommendations; (2) generic personas; (3) user scenarios; 
(4) generic business processes and workflows; (5) core data elements; (6) decision-support logic; (7) indicators and performance metrics; and (8) functional and 
non-functional requirements. Table 1 provides an overview of each of the contributing components of the DAK, which this document elaborates. All information 
within the DAK represents a generic starting point, which can then be adapted according to the specific context.
Table 1. Components of the digital adaptation kit
 Component
Description
Purpose
Output/artifacts
Adaptation needed
1.
Health 
interventions and 
recommendations
Overview of the health interventions and WHO 
recommendations included within this digital 
adaptation kit (DAK). DAKs are meant to be a 
repackaging and integration of WHO guidelines 
and guidance documents in a particular health 
domain. The list of health interventions is 
drawn from the universal health coverage 
menu of interventions compiled by WHO (22).
Setting the stage – To 
understand how this 
DAK would be applied to 
person-centred point-of-
service systems (PCPOSS) 
in the context of specific 
health programmes and 
interventions. 
	» List of related health 
interventions based on WHO 
universal health coverage 
essential interventions; and 
	» List of related WHO 
recommendations based 
on guidelines and guidance 
documents. 
	» Contextualization to reflect current or 
planned national policies. 
2.
Generic 
personas
Depiction of the end users, supervisors and 
related stakeholders who would be interacting 
with the digital system or involved in the care 
pathway. 
Contextualization – To 
understand the wants, 
needs and constraints of 
the end users.
	» Description, competencies 
and essential interventions 
performed by targeted 
personas.
	» Greater specification and details on 
the end users based on real people 
(e.g. health workers) in a given context; 
and
	» High-level information to describe 
the provider of the health service 
(e.g. the general background, roles 
and responsibilities, motivations, 
challenges and environmental factors).
3.
User 
scenarios
Narratives that describe how the different 
personas may interact with each other. The 
user scenarios are only illustrative and are 
intended to give an idea of a typical workflow.
Contextualization – To 
understand how the system 
would be used and how 
it would fit into existing 
workflows. 
	» Example narrative of how 
the targeted personas may 
interact with each other during 
a workflow.
	» Greater specification and details on 
the real needs of end users in a given 
context. 
4.
Generic 
business 
processes and 
workflows
A business process is a set of related activities 
or tasks performed together to achieve the 
objectives of the health programme area, such 
as registration, counselling and referrals (1,23). 
Workflows are a visual representation of the 
progression of activities (tasks, decision points, 
interactions) that are performed within the 
business process (1,23).
Contextualization and 
system design – To 
understand how the digital 
system would fit into 
existing workflows and how 
best to design the system 
for that purpose.
	» Overview matrix presenting 
the key processes for 
immunization; and
	» Workflows for identified 
business processes with 
annotations.
	» Customization of the workflows 
that can include additional forks, 
alternative pathways or entirely new 
workflows. 
OVERVIEW
9
Overview
 Component
Description
Purpose
Output/artifacts
Adaptation needed
5.
Core data 
elements
Data elements are required throughout the 
different points of the workflow. 
These data elements are mapped to the codes 
of the International Classification of Diseases 
11th Revision (ICD-11) and other established 
concept mapping standards to ensure the data 
dictionary is compatible with other digital 
systems.
System design and 
interoperability – To 
know which data elements 
need to be logged and 
how they map to other 
standard terminologies 
(e.g. ICD and Systematized 
Nomenclature of 
Medicine [SNOMED]) for 
interoperability with other 
standards-based systems.
	» List of data elements. 
	» Link to data dictionary with 
detailed data specifications in 
spreadsheet format (available 
here).
	» Translation of “data labels” into the 
local language and additional data 
elements created depending on the 
context.
6.
Decision-
support 
logic
Decision-support logic and algorithms to 
support appropriate service delivery in 
accordance with WHO clinical, public health 
and data use guidelines. 
System design 
and adherence to 
recommended clinical 
practice – To know what 
underlying logic needs to 
be coded into the system. 
	» List of decisions that need 
to be made throughout the 
encounter.
	» Link to decision-support logic 
and contraindications tables 
in a spreadsheet format with 
inputs, outputs and triggers for 
each decision logic (available 
here).
	» Scheduling logic for services 
(available here).
	» Change of specific thresholds 
or triggers in a logic (IF/THEN) 
statement; and 
	» Additional decision-support logic 
formulas depending on the context. 
7.
Indicators 
and 
performance 
metrics
Core set of indicators that need to be 
aggregated for decision-making, performance 
metrics and subnational and national 
reporting. These indicators and metrics are 
based on data that can feasibly be captured 
from a routine digital system, rather than 
survey-based tools.
System design 
and adherence to 
recommended health 
monitoring practices – To 
know what calculations 
and secondary data use 
are needed for the system, 
based on the principle of 
“collect once, use many” 
(17).
	» Indicators table with 
numerator and denominator of 
data elements for calculation, 
along with appropriate 
disaggregation (available here).
	» Changing calculation formulas of 
indicators;
	» Adding indicators; and
	» Changing the definition of the primary 
data elements used to calculate the 
indicator based on data available.
8.
Functional 
and non-
functional 
requirements
A high-level list of core functions and 
capabilities that the system must have to meet 
the end users’ needs and achieve tasks within 
the business process.
System design – To know 
what the system should be 
able to do.
	» Table of functional and non-
functional requirements 
with the intended end user 
of each requirement, as well 
as why that user needs that 
functionality in the system 
(available here).
	» Adding or reducing functions and 
system capabilities based on budget 
and end user needs and preferences. 
OVERVIEW
10
Digital adaptation kit for immunizations
Throughout the DAK, there are identification (ID) numbers to simplify tracking and referencing of each of the components. Note that the DAK represents an overview 
across the different components, while the comprehensive and complete outputs of each component (e.g. data dictionary and decision-support tables) are included 
in appended spreadsheets. Box 3 provides an overview of the notation guidance.
Box 3
ID notation guidance
Component 1: Health interventions and recommendations
No notations used.
Component 2: Generic personas
No notations used.
Component 3: User scenarios
No notations used.
Component 4: Business processes and workflows
	»
Each workflow will have a “Process name” and a corresponding letter. Each 
workflow will also have a “Process ID” that is structured: “Abbreviated 
health domain” (e.g. immunization [IMMZ]) “Corresponding letter for the 
process” (e.g. A), i.e. IMMZ.A
	»
Each activity in the workflow will be numbered with an “Activity ID” that is 
structured: “Process ID” from above “Activity number”, i.e. IMMZ.B7
Component 5: Core data elements (data dictionary)
	»
Each data element will have a running number and a “Data element (DE) ID” 
that is structured: “Activity ID” (e.g. IMMZ.B7).“DE”.“Sequential number of the 
data element” (i.e. IMMZ.B7.DE.1, IMMZ.B7.DE.2)
Component 6: Decision-support logic
	»
Each decision-support logic table will have a running number and a 
“Decision-support table (DT) ID” that is structured: “Activity ID” (e.g. IMMZ.
D2).“DT”.“Antigen name” (i.e. IMMZ.D2.DT.Measles, IMMZ.D2.DT.Cholera)
Component 7: Indicators and performance metrics
	»
Each indicator will have an “Indicator (IND) ID” that is structured: 
“Abbreviated health domain” (e.g. IMMZ).“IND”.“Sequential number of the 
indicator”(i.e. IMMZ.IND.1, IMMZ.IND.2)
Component 8: High-level functional and non-functional requirements
	»
Each functional requirement will have a “Functional requirement 
(FXNREQ) ID” that is structured: “Abbreviated health domain” 
(e.g. IMMZ).“FXNREQ”.“Sequential number of the functional requirement”
(i.e. IMMZ.FXNREQ.1, IMMZ.FXNREQ.1)
	»
Each non-functional requirement will have a “Non-functional 
requirement (NFNREQ) ID” that is structured: “Abbreviated health domain” 
(e.g. IMMZ).“NFXNREQ”.“Sequential number of non-functional requirement” 
(i.e. IMMZ.NFXNREQ.1, IMMZ.NFXNREQ.2)
OVERVIEW
11
Overview
