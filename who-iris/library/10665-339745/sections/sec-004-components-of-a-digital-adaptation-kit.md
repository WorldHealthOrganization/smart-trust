---
doc_id: 10665-339745
doc_title: "Digital Adaptation Kit for Antenatal Care"
section_id: sec-004-components-of-a-digital-adaptation-kit
section_title: "Components of a digital adaptation kit"
section_number: null
pages: 15-19
source_pdf: 10665-339745.pdf
source_sha256: 27dcd2fc950be021
toc_source: outline
---
The DAK comprises eight interlinked components: (1) health interventions and associated recommendations; (2) generic personas; (3) user scenarios; 
(4) generic business processes and workflows; (5) core data elements; (6) decision-support logic; (7) indicators and reporting requirements; and (8) high-
level functional and non-functional requirements. Table 1 provides an overview of each of the contributing components of the DAK, which this document 
elaborates. All information within the adaptation kit represents a generic starting point, which can then be adapted according to the specific context. 
Furthermore, this DAK builds on previous requirements, gathering work conducted by PATH in Common requirements for maternal health information 
systems (13) by leveraging the developed workflows and elaborating on the data and decision-support requirements.
Table 1. Components of a digital adaptation kit
 Component
Description
Purpose
Outputs
Adaptation needed
1.	Health 
interventions and 
recommendations
Overview of the health interventions and WHO 
recommendations included within this digital 
adaptation kit (DAK). DAKs are meant to be a 
repackaging and integration of WHO guidelines 
and guidance documents in a particular health 
domain. The list of health interventions is drawn 
from the universal health coverage (UHC) menu of 
interventions compiled by WHO (14).
Setting the stage –  
To understand how 
this DAK would 
be applied to a 
digital tracking and 
decision-support 
system in the context 
of specific health 
programmes and 
interventions
	» List of related 
health 
interventions 
based on WHO’s 
UHC essential 
interventions
	» List of 
related WHO 
recommendations 
based on 
guidelines 
and guidance 
documents 
	» Contextualization 
to reflect current or 
planned national 
policies 
2.	Generic personas
Depiction of the end-users, supervisors and related 
stakeholders who would be interacting with the 
digital system or involved in the care pathway.
A local adaptation of the personas should contain 
high-level information to describe the provider of 
the health service (e.g. the general background, 
roles and responsibilities, motivations, challenges, 
and environmental factors).
Contextualization –  
To understand the 
wants, needs and 
constraints of the 
end-users
	» Description, 
competencies 
and essential 
interventions 
performed by 
targeted personas
	» Greater 
specification and 
details on the end-
users based on real 
people (i.e. health 
workers) in a given 
context
overview
 Component
Description
Purpose
Outputs
Adaptation needed
3.	User scenarios
Narratives that describe how the different 
personas may interact with each other.
The user scenarios are only illustrative and 
intended to give an idea of a typical workflow.
Contextualization –  
To understand how 
the system would 
be used, and how it 
would fit into existing 
workflows
	» Example narrative 
of how the 
targeted personas 
may interact with 
each other during 
a workflow
	» Greater 
specification and 
details on the real 
needs of end-users 
in a given context 
4.	Generic  
business 
processes and 
workflows
A business process is a set of related activities or 
tasks performed together to achieve the objectives 
of the health programme area, such as registration, 
counselling, referrals (1,15).
Workflows are a visual representation of the 
progression of activities (tasks, decision points, 
interactions) that are performed within the 
business process (1,16).
Contextualization 
and system design – 
To understand how 
the digital system 
would fit into existing 
workflows and how 
best to design the 
system for that 
purpose
	» Overview matrix 
presenting the 
key processes 
in antenatal care 
(ANC)
	» Workflows for 
identified business 
processes with 
annotations
	» Customization 
of the workflows 
that can include 
additional forks, 
alternative 
pathways or 
entirely new 
workflows
5.	Core data 
elements
Data elements required throughout the different 
points of the workflow.
These data elements are mapped to the 
International Classification of Diseases version 
11 (ICD-11) codes and other established concept 
mapping standards to ensure the data dictionary is 
compatible with other digital systems.
System design and 
interoperability 
– To know which 
data elements 
need to be logged 
and how they map 
to other standard 
terminologies (e.g. 
ICD, Systematized 
Nomenclature of 
Medicine [SNOMED]) 
for interoperability 
with other standards-
based systems
	» List of data 
elements
	» Link to data 
dictionary with 
detailed data 
specifications in 
spreadsheet format 
(see Web Annex 
A). 
	» Translation of 
“data labels” into 
the local language 
and additional data 
elements created 
depending on the 
context
overview
 Component
Description
Purpose
Outputs
Adaptation needed
6.	Decision-support 
logic
Decision-support logic and algorithms to support 
appropriate service delivery in accordance 
with WHO clinical, public health and data use 
guidelines.
System design 
and adherence 
to recommended 
clinical practice 
– To know what 
underlying logic 
needs to be coded 
into the system 
	» List of decisions 
that need to be 
made throughout 
the encounter
	» Link to decision-
support tables 
in a spreadsheet 
format with inputs, 
outputs and 
triggers for each 
decision-support 
logic (see Web 
Annex B)
	» Scheduling logic 
for services
	» Change of specific 
thresholds or 
triggers in a 
logic (IF/THEN) 
statement, e.g. 
body mass index 
(BMI) cut-off, age 
trigger for “youth 
friendly” services
	» Additional 
decision-support 
logic formulas 
depending on the 
context
7.	Indicators and 
performance 
metrics
Core set of indicators that need to be aggregated 
for decision-making, performance metrics, and 
subnational and national reporting.
These indicators and metrics are based on data 
that can feasibly be captured from a routine digital 
system, rather than survey-based tools.
System design 
and adherence 
to recommended 
health monitoring 
practices – To know 
what calculations 
and secondary data 
use is needed for the 
system, based on the 
principle of “collect 
once, use many” (10)
	» Indicators table 
with numerator and 
denominator of 
data elements for 
calculation, along 
with appropriate 
disaggregation 
(See Web Annex C)
	» Changing 
calculation 
formulas of 
indicators
	» Adding indicators
	» Changing the 
definition of the 
primary data 
elements used 
to calculate the 
indicator based on 
data available
8.	Functional and 
non-functional 
requirements
List of core functions and capabilities the system 
must have to meet the end-users’ needs and 
achieve tasks within the business process.
System design – 
To know what the 
system should be 
able to do
	» Table of functional 
and non-functional 
requirements 
with the intended 
end-user of each 
requirement, as 
well as why that 
user needs that 
functionality in the 
system (See Web 
Annex D)
	» Adding or reducing 
functions and 
system capabilities 
based on budget 
and end-user 
needs and 
preferences 
overview
Notation guidance
Throughout the DAK, there are identification (ID) numbers to simplify tracking and referencing of each of the components. Note that the DAK represents 
an overview across the different components, while the comprehensive and complete outputs of each component (e.g. data dictionary, decision-support 
tables) are included in appended spreadsheets. The notation guidance is as follows.
Component 1: Health interventions and recommendations
No notations used
Component 2: Generic personas
No notations used
Component 3: User scenarios
No notations used
Component 4: Business processes and workflows
Each workflow should have a “Process name” and a corresponding letter
	»
Each workflow should also have a “Process ID” that should be 
structured “Abbreviated health domain” (e.g. ANC). “Corresponding 
letter for the process” (e.g. A)
	»
Each activity in the workflow should be numbered with an “Activity ID” 
that should be structured “Process ID” from above “Activity Number” 
e.g. ANC.B7
Component 5: Core data elements (data dictionary)
Each data element should have a running number and a “Data Element 
(DE) ID” that should be structured “Abbreviated health domain” (e.g. 
ANC).“DE”.“Sequential number of the data element” (e.g. ANC.B7.DE.1, 
ANC.B7.DE.2)
Component 6: Decision-support logic
Each decision-support logic table should have a running number and a 
“Decision-support table (DT) ID” that should be structured 
“Abbreviated health domain” (e.g. ANC).“DT”.“Sequential number of the 
decision-support table” (e.g. ANC.DT.1, ANC.DT.2)
Component 7: Indicators and performance metrics
Each indicator should have an “Indicator ID” that should be structured 
“Abbreviated health domain” (e.g. ANC).“IND”.“Sequential number of the 
indicator”(e.g. ANC.IND.1, ANC.IND.2)
Component 8: High-level system requirements
	»
Each functional requirement should have a “Functional requirement 
ID” that should be structured “Abbreviated health domain” (e.g. 
ANC).“REQ”.“Sequential number of the functional requirement”(e.g. 
ANC.REQ.1, ANC.REQ.1)
	»
Each non-functional requirement should have a “Non-functional 
requirement ID” that should be structured “Abbreviated health 
domain” (e.g. ANC).“NFXNREQ”.“Sequential number of non-functional 
requirements” (e.g ANC.NFXNREQ.1, ANC. NFXNREQ.2)
BOX 2
overview
