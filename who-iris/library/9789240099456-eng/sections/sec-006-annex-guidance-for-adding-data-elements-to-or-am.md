---
doc_id: 9789240099456-eng
doc_title: "Digital adaptation kit for immunizations"
section_id: sec-006-annex-guidance-for-adding-data-elements-to-or-am
section_title: "Annex. Guidance for adding data elements to or amending existing data elements in the data dictionary"
section_number: null
pages: 96-100
source_pdf: 9789240099456-eng.pdf
source_sha256: 6b0f603e2a792bb4
toc_source: inferred
---
When adapting the data dictionary, data elements may need to be modified or added as a result of the structure of existing paper registers or local reporting 
requirements. If starting from paper-based registers and forms, additional guidance can be found in the Digital transformation handbook for primary health care 
(1), and below is an overview of the data mapping to provide a template for standardizing the data dictionary. When amending the wording of data elements, it is 
important to ensure that the standard terminology codes still reflect the data element as originally intended.
What to note
Description
Activity ID 
The identification (ID) number of the task in the workflow in which the data element is collected. This will denote the point in time at which this data element is collected. 
Form ID 
If an existing paper register or forms have an existing ID number, it should be noted as the form ID. Indicate the form ID in which the data element appears. This is important for 
ensuring that the design of the digital system has taken into account all the required paper forms and data elements on those paper forms. 
Form data 
element label
List the label of the data element as written on the original form (or translated as closely as possible). This will be key in keeping track of which data elements from the original 
paper forms are duplicated. It is important to note that duplicate data fields could have been included purposely in multiple forms (e.g. name, date of birth, village) to identify an 
individual client.
Data element 
label
The label of the data element written in a way end users can easily understand (e.g. “education level”, “weight”, “height”, “reasons for coming into facility”). The data element label 
in this column will be used in the digital form as the digital register should not simply replace the paper registers, but it should also streamline processes and link duplicated data 
elements. 
Description 
and definition
The description and definition of the data element, including any units that define the field (e.g. weight in kilograms). Provide a clear explanation of what this data field is 
requesting. 
This definition will be key for streamlining to resolve duplicate data elements and how required calculations are documented. Although the data element labels could vary 
across paper forms, it is important to clearly note the definition of this specific data element as data elements with the same definition can be reconciled for one time data entry. 
Alternatively, it could also be discovered that data elements with the same data element labels are used to mean different things. This would require a change in the data element 
labels so that data entry is done accurately.
Multiple 
choice
If the data element is indicative of a multiple-choice question (e.g. symptoms), then indicate the type of multiple-choice question here. The types would be: 
	» Select one (i.e. only one input can be chosen) 
	» Select all that apply (i.e. more than one input option can be chosen)
Each individual answer option should be listed in the input options column and be classified with one of the data types listed below.
annexes
87
Annex
Data type
The data types (2) are:
	» Boolean (i.e. true/false, yes/no) 
	» String (i.e. a sequence of Unicode characters – e.g. name) 
	» Date (e.g. date of birth) – used when only the date is recorded 
	» Time (e.g. time of delivery) – used when only the time is recorded 
	» DateTime (e.g. appointment) – used when the date and time are recorded 
	» ID (e.g. unique identifier assigned to the health service user) 
	» Quantity – a number that is associated with a unit of measure outlined in the standard for Unified Code for Units of Measure; quantities include any number that is associated 
with a unit, such as “number of past pregnancies”, where “past pregnancies” is the unit of measure (3) (if the data type is a quantity, there should be an associated subtype listed 
in the quantity subtype column) 
	» Signature (e.g. supervisor’s approval) – an electronic representation of a signature that is either cryptographic or a graphical image that represents a signature or a signature 
process 
	» Attachment (e.g. image) – additional data content defined in other formats 
	» Coding (e.g. symptoms, reason for coming to the facility, danger signs) – multiple-choice data elements for which the input options are codes 
	» Codes (e.g. pregnant, HIV positive, combined pill) – data elements that are input options to multiple-choice data elements, which are none of the above data types.  
Input options
Input options are used for multiple-choice fields only. Write the list of responses from which the health worker may select. Each of these options should be labelled with a Data 
type as indicated above. For other fields, leave this column blank.
Calculation
If a calculation is needed to define the data element, write the formula here. Leave this column blank if no calculation is needed. Write the formula using standard mathematical 
symbols and the data element label included in the formula (e.g. for the body mass index calculation, “weight in kilograms/(height in meters)2”). 
Quantity 
subtype
Quantity data types can include any number that is associated with a unit of measure. However, there are many subtypes of Quantity that should be listed here:
	» Integer quantity – a whole number (e.g. number of past pregnancies, pulse, systolic blood pressure, diastolic blood pressure)
	» Decimal quantity – rational numbers that have a decimal representation (e.g. exact weight in kilograms, exact height in centimetres, location coordinates, percentages, 
temperature) 
	» Duration – duration of time associated with time units (e.g. number of minutes, number of hours, number of days).
Required
Note whether this field is:
	» Required (R)
	» Optional (O)
	» Conditional on answers from other data fields (C).
Reason for 
requiring data
If this field is required (R), state the reason here:
	» Accountability for national-level reporting
	» Service delivery or clinical decision-making 
	» Client ID.
The digital system should not only replace paper registers, but also streamline processes; thus, it is important to understand why a certain data field is actually required and seek 
opportunities to optimize data flows. Given the high volume of data collection required of health service providers, it might be better to remove a data entry field if it serves no real 
purpose for the clinician, public health reporting or any other identified purpose.
annexes
88
Digital adaptation kit for immunizations
Explain 
conditionality
If this field is conditional on answers from other data fields (C), denote what the conditionality is here. Conditionality helps to define the rules that govern the presence or absence 
of a data element based on certain criteria. This is common for data elements that are a part of follow-up questions. For example, if the input of one data element field is true, then 
some additional data inputs may be required. 
Linkages 
to decision 
support tables
List the decision support tables here if this data element contributes to decision logic.
If it does not contribute to decision logic, and it is not needed for service delivery, consider removing it as a data field when designing the digital system. This would reduce the 
burden of data collection for health workers.  
Linkages to 
aggregate 
indicator
List the indicators here if this data element contributes to an aggregate indicator. If the data element does not contribute to calculation of an aggregate indicator, leave this column 
blank. If the data element does not contribute to an aggregate indicator and is not needed for service delivery, consider removing it as a data field when designing the digital 
system. This would reduce the burden of data collection for health workers.  
Annotations
If there is an issue or inconsistency in how a data field is defined, make a note of the issue here. Irregularities and inconsistencies will need to be resolved at a later stage through a 
process of team discussion and triangulation. This column should also be used for any other notes, annotations or communication messages within the team.
Mapping to 
standardized 
classifications 
and 
terminologies 
(3)
A column should be added to each classification or terminology code system (e.g. International Classification of Diseases 11th Revision [ICD-11], Systematized Nomenclature 
of Medicine [SNOMED], Logical Observation Identifiers Names and Codes [LOINC]) that the digital system is planned to use and interoperate with. The code used for each data 
element should be logged in these columns.  
This is a highly resource-intensive, but necessary, task. Any existing standardized code systems that can be used, should be used for the purposes of interoperability so data can be 
exchanged with any other critical health information systems (e.g. laboratory systems, supply chain systems). This part can also be done through a terminology service. 
Mapping 
comments and 
considerations
Any comments and considerations related to the mapping of data elements to standardized classification and terminology code systems should be noted here.
Mapping 
Relationship 
(4)
For each classification and terminology code system that a data element that can be mapped to, this column should be used to identify the relationship between the original intent 
of the data element (i.e. “source concept”) with the classification or terminology mapping available in the existing code systems (i.e. “target concept”). The field should indicate:
	» Related to – The concepts are related to each other, but the exact relationship is not known
	» Equivalent – The definitions of the concepts mean the same thing.
	» Source is narrower than target – The source concept is narrower in meaning than the target concept
	» Source is broader than target – The source concept is broader in meaning than the target concept.
3	
 All references were accessed on 10 July 2024.
ANNEX REFERENCES3
1.	 Digital transformation handbook for primary health care: optimizing person-centred point of service systems. Geneva: World Health Organization; 2024. (https://iris.who.int/handle/10665/379452).
2.	 HL7 FHIR Release 5 [website]. 2.1.28.0 Data types. Ann Arbor (MI): Health Level 7 International; 2023 (http://hl7.org/fhir/datatypes.html). 
3.	 International Statistical Classification of Diseases and Related Health Problems (ICD). Geneva: World Health Organization; 2023 (https://www.who.int/standards/classifications/classificationof-diseases).
4.	 Codesystem concept map relationship. In: HL7 FHIR Release 5 [website]. HL7.org; 2023 (https://hl7.org/fhir/codesystem-concept-map-relationship.html).
World Health Organization 
Avenue Appia 20
1211 Geneva
Switzerland
www.who.int
digitalhealth@who.int
