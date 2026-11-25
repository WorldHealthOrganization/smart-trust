---
doc_id: 9789240093362-eng
doc_title: "Digital transformation handbook for primary health care Optimizing person-centred point of service systems"
section_id: sec-012-31-follow-key-requirement-gathering-methods
section_title: "Follow key requirement-gathering methods"
section_number: 3.1
pages: 28-33
source_pdf: 9789240093362-eng.pdf
source_sha256: 0d47d98390b1451d
toc_source: outline
---
CHAPTER 3
Understand user requirements

The adoption of a person-centred point of service system (PCPOSS) requires a solid understanding of what data health workers need for routine service delivery and bottom-up accountability.

This chapter describes the fundamental task of requirements gathering, in which user needs and constraints are documented. This process will rely on desk reviews, observations, workshops, and in-depth discussions and interviews with key stakeholders. Stakeholders include, but are not limited to, end-users of the system (e.g. appropriate health worker occupational group) and indirect beneficiaries (e.g. public health managers in the public health authority).

By the end of this chapter, the implementation team should have a clear understanding of the scope of the system, how the workflows and data flow may need to be optimized, and the relevant data that will need to be collected and accounted for at individual and aggregate levels. If a digital system already exists, the team should also have a clear understanding of the key functionalities and features of the present system, and how a PCPOSS would complement or upgrade the present system.

| Component | Details |
| --- | --- |
| **Who should be involved?** | • Targeted health worker occupational groups (e.g. physicians, nurses, midwives and community health workers), health service users and any other intended end-users, should guide the requirements for a PCPOSS.<br>• Business analysts, health informaticians and people trained in user research should lead the process of gathering requirements and ensuring that the solution will adhere to interoperability standards.<br>• Software engineers should be engaged so they understand the context of the solution they will be responsible for building.<br>• The public health authority should preferably be responsible for these tasks, or at least be consulted and involved throughout the entire process. |
| **Inputs** | • National health strategy, digital health strategy, health policies, and a strategic direction and scope for the PCPOSS<br>• Health information system, privacy, security and data use policies<br>• Digital health architecture blueprint and high-level requirements for meeting interoperability standards<br>• Infrastructure readiness assessment<br>• Unique identifier method<br>• List of anticipated outcomes against which to measure success<br>• World Health Organization (WHO) and national guidelines for the health area targeted, in addition to the standard operating procedures for care delivery, data and indicator definitions<br>• Existing paper records and register forms<br>• End user and key stakeholder interviews and insights |
| **Tools** | • Observation templates (Annex 3)<br>• User persona template (Annex 4)<br>• User stories template (Annex 5)<br>• Business process matrix template (Annex 6)<br>• WHO’s Digital adaptation kits<br>• Forms inventory template (Annex 7)<br>• Form data mapping template (Annex 8)<br>• Aggregate indicator mapping template (Annex 9)<br>• Decision table and scheduling matrix template (Annex 10)<br>• Decision table template (Annex 11)<br>• Service schedule template (Annex 12)<br>• Prioritization of requirements template (Annex 13) |
| **Outputs** | Requirements documentation that includes:<br>• User personas<br>• Use cases<br>• User stories<br>• As-is and to-be business processes<br>• Data dictionary and data model<br>• Documented health service schedule<br>• Documented decision logic algorithms<br>• List of indicators and calculation method<br>• Prioritized functional and non-functional requirements |

A combination of methods can be used to corroborate information and better guide the process 
outlined in this chapter for assessing needs and gathering requirements. Before outlining that 
process in the next sections of this chapter, this section provides an overview of some of these 
methods: desk review, semi-structured interviews, observations, follow-up interviews to verify 
observations, and requirements-gathering workshops.
3.1.1 	 Desk review
A review of all local documents pertaining to health worker 
health worker occupational groups can be a starting base for 
understanding their responsibilities and services provided. 
The desk review should prioritize national and context-specific 
guidelines. Desk reviews are critical to understanding the 
general context that end-users are operating in, hence it is 
beneficial to conduct these reviews before engaging with 
the stakeholders. Global resources that have previously 
documented health worker workflows should also be 
consulted since they provide valuable examples that may be 
applicable to other contexts. These resources include:
•	 existing paper registers and register books; 
•	 other tools that health workers use for service delivery; 
•	 tools used for reporting and surveillance, including 
health management information systems;
•	 extensive documentation in health domain-specific 
Digital adaptation kits (DAKs) being developed by WHO, 
such as the DAK for antenatal care (ANC) (29), the DAK 
for family planning (30) and the DAK for HIV (31); and 
the machine-readable implementation guides (layer 3 
of the SMART Guidelines); and
•	 SCORE for health data technical package (33). 
Review of Digital adaptation kits (DAKs)
DAKs are operational, software neutral, standardized documentation that distill clinical, 
public health and data use guidance into a format that can be transparently 
incorporated into digital systems. They provide the generic content 
requirements that should be housed within digital systems and define 
system requirements, including minimum datasets, decision-support 
logic and business processes. Such DAKs present as a generic starting 
point which can then be adapted according to specific context and 
policies (18,32).
TIP

3.1.2 	 Observations
As a complement to interviews, observing or shadowing 
health workers at their place of work can be a way to capture 
their interactions with health service users and their workflow 
in real time. Annex 3 provides a worksheet that can help 
structure the information captured. These observations 
can be used to document inconsistencies in workflows, 
irregularities or deviations from the set schedule, the type and 
frequency of the data being recorded, and the supervisory 
relationships between health workers. It is important to 
schedule observations during various times, including when 
a health worker is extremely busy and when they are not, so 
that a PCPOSS can be integrated into, and complement, varied 
daily activities and routines. Note that strict health service 
user confidentiality must always be respected while observing 
interactions between health workers and health service users, 
and all the necessary consent should also be obtained.
Observing end-users
If possible, try to observe end-users in such a way that they will not notice they are being observed, to avoid the possible 
Hawthorne effect. The Hawthorne effect is when people change their behaviour when they realize, or they know, they are 
being observed (34). When observing end-users in their current work, be sure to note (35):
•	 what they are doing;
•	 how they are doing it;
•	 why they are doing it; 
•	 interesting comments by end-users (e.g. health workers) 
and others (e.g. health service users);
•	 problems faced by end-users;
•	 possible ideas and opportunities that arise when 
observing end-users;
•	 any additional insights, including insights from body 
language and emotion;
•	 potential questions for a follow-up interview;
•	 anything unexpected; and
•	 workflow patterns that differ across health workers.
TIP

3.1.3 	 Semi-structured and follow-up interviews 
Interviews with health workers, their supervisors and other 
selected key informants are crucial, as they can help to 
inform the implementation team about details such as 
the health interventions being provided (and where), the 
informal workflows in use, how data are recorded, and the 
accountability practices being applied across the health 
system. The interviews can also inform the team about the 
daily challenges faced by end-users, and how additional 
functionality in the PCPOSS could address these. 
Interviewers should agree on a minimum set of questions 
to provide structure, but this should neither limit possible 
follow-up nor further questions being asked for clarification. 
Interviews should ideally take place at the end-user’s place of 
work (e.g. in the health-care facilities and external locations 
where health services are provided), to allow the team to have 
an in-depth understanding of the context in which systems will 
be implemented. 
Semi-structured interviews can also help gain an 
understanding of the daily practices and motivations of the 
health workers. Aligned with the first principle of the Principles 
for Digital Development (see Annex 1), to “design with 
people”, these interviews will help gain key insights on how 
the PCPOSS will be used and give end-users a part to play in 
the development of the tool – essential for building a sense of 
ownership. Annex 2 provides an example interview guide for 
interviewing a health worker.
Semi-structured interviews (36)
•	
Avoid bias. Interviews are not for confirming our 
biases or preconceived hypotheses of what a system 
should do, and questions should be structured 
accordingly.
•	
Start interviews with broad questions to build 
rapport and gain trust. Then drill down and ask 
prying questions to find out the information needed. 
It might be helpful, if consent is given, to record 
interviews. Fig. 8 illustrates this approach. 
•	
Allow time for the interviewee to provide answers. 
Do not try to fill in silences. The interviewee might 
need time to provide rich and insightful answers. 
•	
Do not correct, judge or challenge the interviewee. 
It is important to remain unbiased so that the PCPOSS 
can be designed for end-users, not for the interviewer. 
•	
Do not ask leading questions (e.g. “What problems 
do you have?”) or imply answers (e.g. “Don’t you think 
a digital system would be great?”). 
•	
Do not ask hypothetical questions (e.g. “Would you 
use this system?”) because the interviewee might just 
try to be polite and say yes. 
•	
Interview with another member of the team so one 
person can ask questions while another takes notes. 
•	
Ask “why?” even if you think you know why.
•	
Ask for specific stories from the past (e.g. “Tell me 
about the last time you provided antenatal care”).
•	
To help capture nuance, try not to use broad terms 
like “usually” and “generally”. 
•	
Look for inconsistencies between what you have 
observed and what the interviewee is telling you – 
for insights into any tensions in policy versus practice.
•	
Pay attention to non-verbal cues such as body 
language and emotions for extra insight.
TIP
Fig. 8	
Example prompts and questions for starting broad and narrowing down
BROAD
(Start here)
Intent & Introductions
“Tell me about your background…
“Tell me about the last time you…
“Can you tell me more…
…about how you check for malaria?”
“Can you show me how you…
…would fill out a paper register now?”
5 Why’s 
“Why do you…
…wait until the end of the day to fill out your records?” 
Based on answer, continue to ask why until a root cause is revealed.
NARROW
(End here)
TRUST BUMP
BIRD’S EYE VIEW
MAGNIFYING
GLASS
MICRO-
SCOPE
…as a health worker.”
…registered a new client.” 
…provided antenatal care.”
…provided a routine immunization to a child.”
Source: Tran, 2018 (35). The work was adapted with the addition of questions under each section of the pyramid for contextualization to health care and 
is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License (CC BY-NC-SA 4.0 DEED. To view a copy of this 
license, visit https://creativecommons.org/licenses/by-nc-sa/4.0/).  
After the health workers have been shadowed, follow-up 
interviews with the same health workers should follow. 
Questions should cover any issues about:
•	 inconsistencies noted in workflows;
•	 irregularities or deviations from the set schedule;
•	 the manner and frequency with which data were 
recorded;
•	 supervisory functions;
•	 any special circumstances that led to variations in 
workflow, scheduling, reporting, etc.;
•	 any workload redundancy, or overlap or integration 
with other health workers; and
•	 any other issues relevant to understanding the health 
worker roles.
These follow-up interviews are crucial both to ensure a correct 
understanding of observations and to allow understanding of 
the root causes of observed actions. It is important to remove 
personal and observational biases, as far as possible.
3.1.4 	 Requirements-gathering workshops 
The size of a requirements-gathering workshop will depend 
on the scale of the solution, but workshops should include key 
stakeholders, including the end-users and secondary users 
(such as supervisors), to gather the necessary requirements 
for the system, such as whether the solution will be deployed 
on mobile devices, desktop computers, or both; and whether 
the platform operates online, offline, or both. Workshops can 
be reserved for the end of the requirements-gathering process 
to validate requirements gathered through other methods (i.e. 
semi-structured interviews and observations). 
Express gratitude for health worker’s time
