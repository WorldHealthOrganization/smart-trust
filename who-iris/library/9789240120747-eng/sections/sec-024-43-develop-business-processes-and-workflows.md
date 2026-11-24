---
doc_id: 9789240120747-eng
doc_title: "Digital transformation handbook for reporting substandard and falsified medical products"
section_id: sec-024-43-develop-business-processes-and-workflows
section_title: "Develop business processes and workflows"
section_number: 4.3
pages: 41-42
source_pdf: 9789240120747-eng.pdf
source_sha256: c710f7cf4a432221
toc_source: inferred
---
## 4.3 Develop business processes and workflows

A business process is a set of related activities or tasks performed together to achieve specific objectives, such as reporting substandard and falsified medical products in this case (35). Workflows are a visual representation of the progression of activities (tasks, interactions, decision points) that are performed within the business process (35). The activities in a workflow include those that are manual and machine automated.

A business process matrix (see Table 10 for example) is useful for:

- taking stock of the business processes that need to be mapped;
- gaining clarity about who the key stakeholders are and how they will interact with the substandard and falsified reporting tool;
- gaining clarity on the linkages across different levels of the health system that enable integrated service delivery of care pathways; and
- determining a clear start and endpoint for each business process based on previous desk reviews, interviews and service-delivery observations (4).

Develop workflows to illustrate the various activities required to achieve each business process. Create as-is workflows to identify gaps and develop to-be workflows to address these deficiencies. Conventional diagramming techniques should be employed to ensure that the workflow is universally comprehensible. It may be necessary to generate multiple maps, with connectors indicating their linking points. Business Process Model and Notation (BPMN) version 2.0 (36) is a widely adopted set of diagramming conventions. Adhering to this standard documentation convention is crucial to facilitate collaboration and comparisons across systems. See Annex 3 for BPMN symbols.

**Table 10. Business process matrix example**

| Process name | Process ID | Personas | Objectives | Task set |
| --- | --- | --- | --- | --- |
| *Title* | *ID used to reference this process* | *Individuals interacting to complete the process* | *A concrete statement describing what the process seeks to achieve* | *The general set of activities performed within the process* |
| Suspect product detection and reporting by pharmacist | SF-REP-001 | Pharmacist, patient (optional), supplier/manufacturer, regulatory authority | To enable pharmacists to promptly identify, isolate, document and report suspected substandard or falsified medical products to regulatory authorities using a digital system. | 1. Identify anomalies in medication appearance, packaging, or reported effectiveness.<br>2. Isolate the product and verify with supplier/manufacturer if needed.<br>3. Advise the patient, if applicable.<br>4. Log into the digital reporting tool.<br>5. Enter product and incident details, including optional patient info and photos.<br>6. Submit the report and receive confirmation.<br>7. Receive tracking number and follow-up communication from the authority. |

**Fig. 4. Example workflow depicting the process of reporting substandard and falsified medical products**

| Step | Actor | Activity / Decision | Pathway / Next step |
| --- | --- | --- | --- |
| 1 | Health care professional | **START** → Select type of report | Proceed to Step 2 |
| 2 | Health care professional | Search for and select the correct product | Proceed to Step 3 |
| 3 | Health care professional | Provide/capture batch number and expiry date | Proceed to Step 4 |
| 4 | Health care professional | **Exclusive gateway:** Select type of report | • **Falsified** → Step 6 (Falsified branch)<br>• **Substandard** → Step 6 (Substandard branch) |
| 6 (Falsified branch) | Health care professional | Indicate that the product is suspected to be falsified | Proceed to Step 7 |
| 6 (Substandard branch) | Health care professional | Indicate that the product is suspected to be substandard | Proceed to Step 7 |
| 7 | Health care professional | Capture details of adverse effects or lack of efficacy or defect | Proceed to Step 8 |
| 8 | Health care professional | Submit report to NMRA → **END** | Report submitted |
