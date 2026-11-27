---
doc_id: 9789240093362-eng
doc_title: "Digital transformation handbook for primary health care Optimizing person-centred point of service systems"
section_id: sec-014-33-map-business-processes-and-workflows
section_title: "Map business processes and workflows"
section_number: 3.3
pages: 35-39
source_pdf: 9789240093362-eng.pdf
source_sha256: 0d47d98390b1451d
toc_source: outline
---
Business processes are sets of related activities and tasks performed to achieve a specific objective 
(6–9). In health care, business processes include, among many other things, health service user 
registration, counselling, service provision and referral.
Workflows are a visual representation of the progression of activities (tasks, events, interactions) 
performed within a business process (45). The specific activities or tasks depicted in a workflow 
include manual and machine-automated activities. 
Understanding the experiences of intended users and their 
daily interactions is an essential step to the development 
of a PCPOSS, as each health worker occupational group’s 
roles and responsibilities will greatly affect their workflows. 
Visualizing the workflow in a structured manner will allow 
designers of the system to easily drill down on “pain points” 
and redundancies.
Prior to mapping and creating these workflows, it is 
recommended that a full inventory of the business processes that 
will be involved with the PCPOSS is taken. This should include 
processes that reflect care pathways involving integrated services 
across different levels of the health system, different health 
worker occupational groups, and health domains. 
A business process matrix (see Fig. 9 for example and see 
Annex 6 for a guide) is useful for:
•	 taking stock of the business processes that need to be 
mapped; 
•	 gaining clarity about who the key stakeholders are and how 
they will interact with the PCPOSS;
•	 gaining clarity on the linkages across different levels of the 
health system that enable integrated service delivery of 
care pathways;
•	 determining a clear start and endpoint for each business 
process based on previous desk reviews, interviews and 
service-delivery observations.
Fig. 9	
Example business process matrix from family planning DAK

| # | Process name | Process ID | Personas | Objectives | Task set |
| --- | --- | --- | --- | --- | --- |
| — | *Title* | *ID used to reference this process throughout the DAK* | *Individuals interacting to complete the process* | *A concrete statement describing what the process seeks to achieve* | *The general set of activities performed within the process* |
| **A** | Registration | FP.A | • Client<br>• Clerk or health-care provider | To ensure client is located in the system with updated personal details or, if not located, entered into the system to be put into a queue to await counselling | Starting point: Client arrives at facility and checks in with clerk<br>• Search for client record<br>• Review and update client record<br>• Create a new client record |
| **B** | Family planning counselling | FP.B | • Client<br>• Health-care provider (clinician, nurse midwife or community health worker) | To discuss possible family planning methods with client and for client to select a method that they are medically eligible for | Starting point: Client has been registered at the health-care facility and called in for counselling. Family planning counselling can happen alongside other health services (e.g. nutrition counselling, child immunizations)<br>• Take client history<br>• Conduct a risk assessment<br>• Discuss issues and concerns if a returning client or a client already on a method<br>• Counsel on possible family planning methods and reproductive intentions<br>• Check medical eligibility criteria<br>• Select method<br>• Check stock and skills for delivering method<br>• If facility is not equipped to provide the method, refer |
| **C** | Service provision | FP.C | • Client<br>• Health-care provider | To provide the method(s) or service(s) the client requires, if the client is medically eligible for them | Starting point: Client has selected a method and is medically eligible or eligible with clinical judgment<br>• Obtain informed consent<br>• Determine when to start method<br>• Provide method and/or explain how to use method<br>• Discuss dual protection<br>• Determine follow-up requirements and schedule follow-up, if needed |

Source: WHO (30)
3.3.1 	 Workflow mapping conventions 
Once the requirements-gathering team has taken an inventory 
of the key business processes using the business process 
matrix, the relevant workflows should  be created. This step 
should allow for the creation of a visual map of the current 
(as-is) service delivery, data collection, coordination and 
referral activities performed by the health worker occupational 
group(s) of interest. The workflow diagram should note the 
different steps or tasks to achieving a business process (46).
As-is workflows should depict what actually happens, not 
what should happen. As-is workflows are depicted at this 
stage to ensure that the PCPOSS implemented will be built for 
usability – there will always be reasons why certain tasks that 
should be happening now are not happening. Lack of supplies, 
time or health worker training are some examples. Standard 
workflow guidelines, if available, can be used as a reference 
on what should happen, which can be depicted in “to-be” 
workflows. A PCPOSS can help health workers to follow the 
to-be workflows.
Conventional diagramming techniques should be used so that 
the workflow can be universally understood. Multiple maps 
may need to be generated, with connectors indicating their 
linking points. 
Business Process Model and Notation (BPMN) version 2.0 
(47) is a widely used set of diagramming conventions. It is 
important to use this standard documentation convention 
to facilitate collaboration and comparisons across systems. 
For a simplified and shortened version of BPMN, Table 1 is an 
overview of key symbols (48,49). There are many commonly 
used workflow-mapping software programmes available, 
including diagrams.net, Cawemo, Microsoft PowerPoint, 
Microsoft Visio and SmartDraw. 
Table 1. Key Business Process Model and Notation (BPMN) symbols

| Symbol | Symbol name | Description |
| --- | --- | --- |
| Pool (Lane 1, Lane 2, Lane 3) | **Pool** | A pool consists of multiple “swim lanes” that depict all the individuals or types of users involved in carrying out the business process or workflow. Diagrams should be clear, neat and easy for all viewers to understand the relationships across the different swim lanes. For example, a pool would depict the business process of conducting an outreach activity, which involves multiple stakeholders represented by different lanes in that pool. |
| Pool — Lane 1 (highlighted), Lane 2, Lane 3 | **Swim lane** | Each individual or type of user is assigned to a swim lane, a designated area for noting the activities performed or expected by that specific actor. For example, a nurse may have one swim lane; the supervisor would be in another swim lane; the health service users would be classified in another swim lane. |
| Thin circle | **Start event or trigger event** | The workflow diagram should contain both a start and an end event, defining the beginning and completion of the task, respectively. |
| Thin circle with envelope | **Start event message** | This is a type of start event. In some instances, the workflow can start with a start event “message”. A “message” in BPMN does not mean only letters, emails or calls, but also information exchanged between two different systems, such as data exchange, notifications, etc. Any action that refers to a specific addressee, and represents or contains information for the addressee, is a message. |
| Thick circle | **End event** | There can be multiple end events depicted across multiple swim lanes in a business process diagram. However, for diagram clarity, there should only be one end event per swim lane. |
| Rounded rectangle | **Activity, process, step or task** | Each activity should start with a verb, for example, “register client”, “calculate risk”. Between the start and end of a workflow, there should be a series of activities noting the successive actions performed by the actor in that swim lane. There can also be subprocesses of each activity. |
| Rounded rectangle with `[+]` | **Activity with subprocess** | This denotes an activity that has a much longer subprocess to be detailed in another diagram. If the diagram starts to become too complex and unhelpful, the subprocess symbol should be used to reference another process depicted on another page. |
| Rounded rectangle with table icon | **Activity with business rule** | This denotes a decision-making activity that requires the business rule, or decision-support logic, to be detailed in a decision-support table. This means that the logic described in the decision-support table will come into play during this activity, as outlined in the business process. This is usually reserved for complex decisions. |
| Rounded rectangle with loop arrow | **Loop activity** | This loop activity or loop task symbolizes an activity or task that is repeated until it no longer needs to be repeated. For example, vaccine administration can happen as many times as the number of vaccines that need to be given. |
| Rounded rectangle with `[+] ~` | **Ad hoc subprocess** | An ad hoc subprocess can contain multiple tasks. One or more tasks in this shape should be performed, and they can be performed in any order. However, not all of these activities need to be finished before moving on to the next activity. |
| Solid arrow | **Sequence flow** | This denotes the flow direction from one process to the next. The end event should not have any output arrows. All symbols (except for start event) may have an unlimited number of input arrows. All symbols (except for end event and gateway) should have one and only one output arrow, leading to a new symbol, looping back to a previously used symbol or to the end event symbol. Connecting arrows should not intersect (cross) each other. |
| Dashed arrow | **Message flow** | This denotes the flow of data or information from one process to another. This is usually used for when data are shared across swim lanes or stakeholder groups. |
| Diamond with `X` | **Exclusive gateway** | This exclusive gateway symbol is used to depict a split in the workflow into two mutually exclusive, binary pathways. There should only be two different outputs that originate from the decision point. If you find yourself needing more than two output or sequence flow arrows, you most likely are trying to depict decision-support logic or a business rule. This should be depicted as an activity with business rule (above) instead. |
| Diamond with `+` | **Parallel gateway** | The parallel gateway symbol is used to depict a split in the workflow into more than one concurrent activities and pathways in a workflow. It can also be used to depict when concurrent pathways join together into a single pathway. |
| Double circle with filled right arrow | **Throw – link event** | The throw – link event serves as the start of an off-page connector. It is the end of the process when there is no more room on the page for that workflow or the end of a subprocess that is part of a larger process. There will need to be a catch link that follows the throw link. |
| Double circle with outline right arrow | **Catch – link event** | The catch – link serves as the end of an off-page connector. It is the start of the new process on a different page from the throw link or the start of a subprocess that is part of a larger process. There needs to be a throw link that is aligned to the catch link. |

Source: Object Management Group (47).
Note: The BPMN standard outlines additional conventions and nuanced symbols that can be used. The above selection of 
symbols should be sufficient, though, for the purposes of illustrating the business process workflows in a clear, standardized way.
3.3.2 	 Process labelling and annotations
Examples of workflows with annotations can be found in 
WHO’s Digital adaptation kits (DAKs). Each workflow diagram 
should be clearly named with the service title and given a 
process ID number – for example, “1. Registration” or “A. 
Registration”; “2. Antenatal care first encounter” or “B. 
Antenatal care first encounter” (49-52).
Additionally, each task, or activity, should be numbered with 
an activity ID, and consistent language should be used across 
processes. Continuing with the above example, the “register 
health service user” activity within the workflow diagram for 
process 1 can be labelled “Activity 1.1” or “Activity A1”, and 
the same activity in process 2 can be labelled “Activity 2.1” or 
“Activity B1”, depending on how the process and activities are 
numbered. 
Regardless, proper and consistent labelling is crucial for later 
data mapping and requirements gathering. See Fig. 10 for an 
example registration business process workflow to identify 
and register a pregnant woman in order to proceed to the ANC 
consultation from ANC DAK.
Fig. 10	 Workflow A: Registration business process
Fig. 11	 Notes and annotations for Workflow A: Registration business process l
Health facility
Client
Health worker or Clerk
8. Validate client details
Start
4. 
Gather client 
details
5. 
Search for 
client
6. 
Match 
found?
Yes
9. 
Check-in 
client
7. 
Create client 
record
No
8.1 
Review 
socio-
demographic 
data with 
client
8.2
Update 
needed?
8.3
Update client 
details
Yes
No
1. 
Arrive at 
facility
B. ANC 
contact
No
2. Rapid 
assessment 
and 
management 
(RAM)
3. Urgent 
referral 
necessary
?
C. ANC referral
Yes
Health facility
Beyond simply labelling each activity within a workflow, it is 
also important to add annotations to the activities, describing, 
for example, a list of forms to be filled out or other nuances 
that it may not be possible to capture in a workflow diagram. 
For example, if it is known that a certain activity requires 1 
hour of the health worker’s time every day, that should be 
recorded as an annotation. Activities that cannot be digitized 
should also be labelled as such. Annotations are also a useful 
way to take note of any national or global guidelines and 
recommendations that might have shaped a specific workflow. 
Fig. 11 provides an example of annotations from the ANC 
registration workflow.
If there are any updates to the guidelines, this reference can 
be a useful prompt to update the next iteration of the solution. 
Noting any relevant guidelines could also serve as a reference 
for any deviations from them in the workflow and could help 
to highlight any roadblocks or challenges preventing health 
workers from adhering to guidelines. 
Reference business processes and workflows
Depending on the target health area for this PCPOSS, 
reference business processes and workflows may already 
exist. WHO’s Digital adaptation kits (DAKs) provide a 
customizable starting point for generic business processes 
and associated workflows that are performed within 
the business processes. For example, the DAK for family 
planning, a part of SMART Guidelines, focuses on key 
business processes conducted by the nurse midwife 
persona within family planning counselling and service 
provision such as registration and counselling. For each 
of the business processes, data elements and decision-
support needs are noted and provided (30).
TIP
REGISTRATION BUSINESS PROCESS NOTES AND ANNOTATIONS
General note
Registration may be conducted as a stand-alone process by a data 
clerk/administrative persona ahead of the ANC encounter with a 
clinical health-care provider or it may be conducted directly by the 
health-care provider as part of the overall ANC encounter.
1.	Arrive at facility
	» Woman arrives at the facility.
	» She may or may not have an identification card with her.
	» Client could already be registered at the health-care facility for 
another service.
2.	Rapid assessment and management (RAM)
	» The registration clerk or the first health worker the woman 
encounters assesses for any possible visible danger signs.
	» Note: there could be decision-support logic input here as well, but 
for the reference content we have determined that RAM is outside 
of the scope of this ANC DAK.
3.	Urgent referral necessary?
	» Determine whether urgent referral is required based on the RAM.
	» If yes, initiate referral (see Business process C: ANC referral).
4.	Gather client details
	» The health worker or data clerk searches for the woman’s name 
using available identifiers.
	» Ask the client whether they have previously been issued a unique 
identifier.
	» Does the client have an identification card/number/barcode?
	» Does client say whether she is a returning or a referred client?
	» If a referral, check for referral slip or data from the community.
	» Determine whether the client is new to the health-care facility/
health post.
	» For returning clients, details will be retrieved from the registry of 
clients at this facility or, if possible, from a central client registry.
5.	Search for client
	» This search process can be done through a variety of means 
depending on what mechanisms are available in country. For 
example, clients can be searched for by using their name, unique 
identifier, a QR code or even biometrics.
6.	Match found?
	» If multiple records are found and no unique ID, provide option 
to merge records.
7.	Create client record
	» Issue a unique identifier, if used and possible at the facility.
8.	Validate client details
	» Review and update client record.
8.1. 	 Review sociodemographic data with client
Review client’s non-clinical information – name, address, 
contact information, etc.
8.2. 	 Update needed?
Has the client moved? Has she changed her contact 
information or has any other sociodemographic 
information changed?
8.3. 	 Update client details
Client can provide updated information if she has recently 
moved or changed other details.
	» Merge/update client records.
	» May also happen during counselling process.
	» In some contexts, this may be linked to billing needs.
9.	Check in client
	» The pregnant woman waits in line to be called by the health 
worker for the ANC contact.
Source: WHO (29)
Source: WHO (29)
3.3.3 	 As-is and to-be analysis
When developing the as-is workflow for each of the relevant 
processes, it should become clear which activities are 
redundant (as they are unnecessarily repeated across multiple 
workflows). Redundant activities in paper-based systems 
could include health service user registration. If a health 
service user has already registered (i.e. provided their name, 
age, address and other demographic information) for the 
purposes of immunization, they should not have to give the 
same information again for the purposes of ANC. Reporting 
activities can also be seen to take up significant time, which 
can be reduced through automated reporting systems. These 
redundancies and bottlenecks within individual workflows 
aggregate to become pain points across the health system. An 
initial set of pain points should already have been gathered 
through observations and interviews, but this analysis will 
systematically depict them.
Once the as-is workflows are mapped, the to-be workflows 
should be mapped to depict how the PCPOSS can automate 
certain activities, remove redundancies and improve the 
overall workflow, by increasing efficiencies, or improving 
effectiveness and overall quality of care. 
These workflows also represent the functional requirements 
of the solution. If the as-is workflows reveal persistent gaps in 
adhering to service-delivery protocols, for example, the to-be 
workflows should address those gaps by either providing 
a more usable solution (e.g. a pre-filled form or facilitated 
calculation) or simply eliminating the need to follow that 
specific step (e.g. through an automated functionality in 
the system). Using the same BPMN standard described in 
section 3.3.1 (workflow mapping conventions), the to-be 
workflows should:
•	 eliminate redundant tasks;
•	 eliminate unnecessary data collection;
•	 reduce bottlenecks;
•	 consolidate related tasks if possible;
•	 create more linkages to data across health worker 
occupational groups;
•	 attempt to improve the quality-of-service delivery and 
the accountability mechanisms overall; and
•	 integrate service delivery across different levels of the 
health system along care pathways.
Conducting an as-is and to-be analysis will allow the 
implementation team to communicate effectively to key 
stakeholders what the process changes will be once the new 
system is implemented. Furthermore, because the workflows 
(both manual and digital) will affect the usability of the digital 
system, it is important to gain consensus among the key 
stakeholder groups on what the to-be workflows should be.
At the end of this exercise, 
there should be:
	
❑
an inventory of business processes
	
❑
as-is workflows for each business process 
with points of data collection, bottlenecks and 
redundancies clearly labelled
	
❑
to-be workflows for each business process, clearly 
labelling where the PCPOSS would facilitate or 
entirely replace certain tasks.
