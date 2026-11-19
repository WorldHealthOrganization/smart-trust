---
doc_id: 10665-341997
doc_title: "Digital adaptation kit: family planning: operational requirements for implementing WHO recommendations in digital systems"
section_id: sec-017-annex-3-guidance-for-adding-data-elements-to-or
section_title: "Guidance for adding data elements to or amending existing data elements in the data"
section_number: Annex 3
pages: 86-89
source_pdf: 10665-341997.pdf
source_sha256: 31e381afabc25132
toc_source: outline
---
dictionary
When adapting the data dictionary, data elements may need to be modified or added as a result of the structure of existing paper registers or local 
reporting requirements. If starting from paper-based registers and forms, you can find additional guidance in the Handbook for digitizing primary health 
care (17), and below is an overview of the data mapping to provide a template for standardizing the data dictionary. When amending the wording of 
data elements, it is important to ensure that the standard terminology codes still reflect the data element as originally intended.
What to note
Description
Activity ID 
The ID number of the task in the workflow in which the data element is collected. This will denote the point in time at which this data element is collected. 
Data element code 
Each data element should have an ID number or code that is unique across the entire project. Use existing serial or ID numbers when available. If no 
identifiers exist, fields should be enumerated in a logical format. 
Form ID and form 
data element label
The Form ID is important for ensuring that the design of the digital system has taken into account all the required paper forms and data elements on those 
paper forms. Also list the label of the data element as written on the original form (or translated as closely as possible). This will be key in keeping track of 
which data elements from the original paper forms are duplicated. Note that duplicate data fields can be included purposely (patient identifiers, such as 
name, date of birth, village, ID number, etc., would be included in multiple data instruments to identify an individual patient).
Data element label
The label of the data element written in a way in which the end-users can easily understand, e.g. “education level”, “weight”, “height”, “reasons for coming 
into facility”, “which medication(s) is your client taking?” The data element label is what will be used in the digital form. The digital register should not simply 
replace the paper registers, but it should also streamline processes and link duplicated data elements; thus the data element label listed here should be what 
will be used in the digital system. 
Data element name 
The shorthand name for the data element (e.g. “educ_level” for “education level”. This will be key when coding the system and determining calculations 
required. This data element name is what will reconcile any duplicate data elements in the digital system. 
Description and 
definition
The description of the data field, including any units that define the field (e.g. “weight in kilograms (kg)”). Provide a clear explanation of what this data point 
is requesting, assuming the reader has never seen the form. Be sure to use consistent and easy-to-understand terminology across all forms. This is particularly 
important if the data element name differs across forms but requires the same input. 
annexes
What to note
Description
Data type
The data type should be aligned with data types outlined by Fast Healthcare Interoperability Resources (FHIR) standards. Some common data types are:
	» Boolean (e.g. True/False, Yes/No)
	» String (a sequence of Unicode characters, e.g. name)
	» Date (e.g. date of birth)
	» Time (e.g. time of appointment)
	» ID (e.g. unique identifier assigned to the client)
	» Integer (a whole number, e.g. number of previous appointments)
	» Decimal (rational numbers that have a decimal representation, e.g. exact duration of time, location coordinates, all percentages)
	» Observation (health status observations collected from the client, e.g. height, weight, eye colour, pulse, blood pressure, temperature, glucose level)
	» Codeable concept (a value that is usually supplied by providing a reference to one or more data points, e.g. body mass index [BMI], contraceptive 
prevalence rate)
	» Signature (an electronic representation of a signature that is either cryptographic or a graphical image that represents a signature or a signature process, 
e.g. supervisor’s approval)
	» Attachment (additional data content defined in other formats, e.g. images)
	» Note that if there are multiple-choice data fields, the “parent” data field should be labelled “Multiple choice – Select one” or “Multiple choice – Select all 
that apply”. Then each individual option should be listed in the “Input” options column and be classified with one of the data types listed above.
Although the list above should be sufficient to relay this information to a health informaticist or technology vendor, there are many more data codes that can 
be applied to achieve a more precise classification. For other possible data types, please refer to the HL7 FHIR guide on data types (40).
Input options
For multiple-choice fields only; otherwise leave this column blank. Write the list of responses from which the health worker may select. Each of these input 
options should be in a separate row. Each of these options should be labelled with a data type as indicated above. 
Calculation
For “codeable concept” data type fields, write the formula that defines the field. Leave this column blank for all other data types. Use standard mathematical 
symbols and the data element label of the data element names included in the formula (e.g. for the BMI calculation: “weight_kg/([height_m]^2)”).
Validation required
“Yes” or “No” to indicate whether there needs to be some form of validation given the constraints provided by a range of acceptable responses. 
Validation condition
The range of acceptable responses, if validation is required (e.g. for a phone number, only 10 digits allowed; for a birthday, only past dates allowed).
Editable
“Yes” or “No” to indicate whether the end-user, or health worker, would be able to edit the field after it has been input to the system. 
Required
Note whether this field is:
	» Required – R
	» Required, but can be left empty – RE
	» Optional – O
	» Conditional on answers from other data fields – C
	» Conditional, but can be left empty – CE
annexes
What to note
Description
Reason for required 
data
If this field is required (R), state the reason here – whether for:
	» Accountability for national-level reporting
	» Service delivery or clinical decision-making 
	» Client identification.
The digital system should not simply replace paper registers, but it should also streamline processes; thus, it is important to understand why a certain data 
field is actually required and seek opportunities to optimize data flows. 
Given the high volume of data collection required of health service providers, it might be better to remove a data entry field if it serves no real purpose for 
the clinician, public health reporting, or any other identified purpose.
Skip logic
If this field is conditional on answers from other data fields (C) or conditional but can be left empty (CE), denote what the skip logic is here. This is common 
for data elements that are a part of follow-up questions. If the input of one data element field has a value lower than a certain threshold, then some data 
inputs can be skipped. Those data elements will have skip logic that is defined by a preset threshold.
Linked to aggregate 
indicator
Aggregate indicators should be called out and specified. If this data element is linked to an aggregate reporting indicator, then indicate accordingly.
Notes
If there is an issue or inconsistency in how a data field is defined, make a note of the issue here.
Irregularities and inconsistencies will need to be resolved at a later stage through a process of team discussion and triangulation. This column should also be 
used for any other notes, annotations or communication messages within the team.
Concept mappings
Depending on which systems the system is planned to interoperate with, other columns will most likely need to be added to map to the concepts used in the 
other system (e.g. ICD-11, SNOMED). One column should be used for each concept dictionary. 
annexes
