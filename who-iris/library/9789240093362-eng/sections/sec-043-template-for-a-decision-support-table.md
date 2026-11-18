---
doc_id: 9789240093362-eng
doc_title: "Digital transformation handbook for primary health care Optimizing person-centred point of service systems"
section_id: sec-043-template-for-a-decision-support-table
section_title: "Template for a decision-support table"
section_number: null
pages: 92-93
source_pdf: 9789240093362-eng.pdf
source_sha256: 0d47d98390b1451d
toc_source: outline
---
ANNEX 11.
Template for a decision-support table

The decision-support table template provides a structured way of parsing out the logic into clear “if/then” statements with a clear list of inputs and action, and outputs. It has been adapted from the Decision Model and Notation (DMN) standard.

| Field | Description |
| --- | --- |
| **Decision-support table ID** | The Decision support table ID should correspond to the number in the overview matrix (Annex 10). |
| **Decision name** | The name of the “decision” describing what algorithm or logic is represented (e.g. pre-eclampsia risk counselling). |
| **Business rule** | The description of the decision that needs to be made based on IF/THEN statements with the appropriate data element name for the variables. The rule demonstrates the relationship between the input variables and the expected outputs and actions within the decision-support logic, for example, if blood pressure is higher than 140 SBP/90 DBP for a pregnant client, then the client is flagged as a high-risk pregnancy |
| **Trigger** | The event that would indicate when this decision-support logic should appear within the workflow, such as the activity that would trigger this decision to be made |
| **Hit Policy Indicator** | Displays the hit policy selected for the table. The hit policy determines how to interpret the output of a decision-support table.<br>• **Unique (U)**: a “Unique” hit policy indicator applies, where no overlap is possible and all “rules” are mutually exclusive. Only a single rule can be applied, and only the outputs of one rule would be relevant.<br>• **Rule order (R)**: a “Rule order” hit policy indicator applies when multiple “rules” can apply at the same time, and the “rules” are not mutually exclusive. The result of the decision-support table depends on the sequence in which these rules are presented. The first rule in which conditions are met will be executed, then the following rules in which conditions are met would be executed in sequential order.<br>• **First (F)**: a “First” hit policy indicator applies when multiple “rules” can apply at the same time, and the “rules” are not mutually exclusive. However, unlike “Rule order”, only the first rule in which conditions are met will be executed, and the following rules in which conditions are met would not be executed. The result of the decision-support table depends on the sequence in which these rules are presented. |

| U or R or F | Input Expression 1 | Input Expression 2 | Output(s): System action | Output(s): Output that references data element(s) | Output(s): Guidance displayed to the health worker | Annotation(s) | Reference(s) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Rule ID:** “Process ID” “activity number”.“DT”.“Rule number” | **Input entry 1:** The value of the input expression; The data type of input entry cells is determined by the data type of the input expression. | **Input entry 2:** If there are multiple input entries in the same row (such as here), these different inputs are considered as “AND” – conditions that need to be in place at the same time. | Output entry 1 | Output entry 2 | Output entry 3 | This column is used for any other notes, annotations or for stating explicitly any assumptions. This can also include any additional information that does not fit into the other columns | Reference to appropriate guidance document(s) |
| **Rule ID:** “Process ID” “activity number”.“DT”.“Rule number” | **Input entry 3:** Inputs placed in different rows are considered as “OR” conditions that can be considered independently of the inputs on other rows. | | Output entry 4 | Not all rules will have output(s) that references data element(s) | Output entry 5 | | Reference to appropriate guidance document(s) |

DBP: diastolic blood pressure; SBP: systolic blood pressure.

Detailed examples of a decision-support table can be found in the following resources:
• Digital adaptation kit for antenatal care: operational requirements for implementing WHO recommendations in digital systems. Geneva: World Health Organization; 2021 (https://iris.who.int/handle/10665/339745).
• Digital adaptation kit for family planning: operational requirements for implementing WHO recommendations in digital systems. Geneva: World Health Organization; 2021 (https://iris.who.int/handle/10665/341997).
• Digital adaptation kit for HIV: operational requirements for implementing WHO recommendations and standards within digital systems, 2nd edition. Geneva: World Health Organization; 2023 (https://iris.who.int/handle/10665/375230).
• Digital adaptation kit for tuberculosis: operational requirements for implementing WHO recommendations in digital systems. Geneva: World Health Organization; 2024 (https://iris.who.int/handle/10665/376631).
• Digital adaptation kit for child health (0-59 months) in humanitarian emergencies: operational requirements for implementing WHO recommendations in digital systems. Geneva: World Health Organization; 2024 (https://iris.who.int/handle/10665/376626).
