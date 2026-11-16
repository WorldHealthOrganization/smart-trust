---
doc_id: 10665-341997
doc_title: "Digital adaptation kit: family planning: operational requirements for implementing WHO recommendations in digital systems"
section_id: sec-010-4-business-processes-and-workflows
section_title: "Business processes and workflows"
section_number: 4
pages: 34-59
source_pdf: 10665-341997.pdf
source_sha256: 31e381afabc25132
toc_source: outline
---
personas
indicators
data
decisions
scenarios
requirements
workflows
A business process, or process, is a set of related activities or tasks performed together to achieve the objectives of the health programme area, such 
as registration, counselling and referrals (1,16). Workflows are a visual representation of the progression of activities (tasks, events and interactions) 
that are performed within the business process (16). The workflow provides a story for the business process being diagrammed and is used to enhance 
communication and collaboration among users, stakeholders and engineers.
This DAK focuses on key business processes conducted by the nurse midwife persona within family planning counselling and service provision. These 
business processes are described in Table 5. For each of these business processes, the corresponding business processes, data elements and decision-
support needs are detailed within the following sections of this document. 
Business  
processes and 
workflows
Component
recommendations
personas
indicators
data
decisions
scenarios
requirements
workflows
Table 5. Overview of key family planning module business processes
Process name
Process ID
Personas
Objectives
Task set
Title
ID used to 
reference this 
process throughout 
the DAK
Individuals interacting to 
complete the process
A concrete statement describing what the 
process seeks to achieve
The general set of activities performed within the 
process
A
Registration
FP.A
	» Client
	» Clerk or health-care 
provider
To ensure client is located in the system with 
updated personal details or, if not located, 
entered into the system to be put into a queue to 
await counselling
Starting point: Client arrives at facility and checks in 
with clerk
	» Search for client record
	» Review and update client record
	» Create a new client record
B
Family planning 
counselling
FP.B
	» Client
	» Health-care provider 
(clinician, nurse midwife 
or community health 
worker)
To discuss possible family planning methods with 
client and for client to select a method that they 
are medically eligible for
Starting point: Client has been registered at the 
health-care facility and called in for counselling. Family 
planning counselling can happen alongside other health 
services (e.g. nutrition counselling, child immunizations)
	» Take client history
	» Conduct a risk assessment
	» Discuss issues and concerns if a returning client or a 
client already on a method
	» Counsel on possible family planning methods and 
reproductive intentions
	» Check medical eligibility criteria
	» Select method
	» Check stock and skills for delivering method
	» If facility is not equipped to provide the method, refer
 C
Service provision
FP.C
	» Client
	» Health-care provider
To provide the method(s) or service(s) the client 
requires, if the client is medically eligible for them
Starting point: Client has selected a method and is 
medically eligible or eligible with clinical judgement
	» Obtain informed consent
	» Determine when to start method
	» Provide method and/or explain how to use method
	» Discuss dual protection
	» Determine follow-up requirements and schedule follow-
up, if needed
recommendations
personas
indicators
data
decisions
scenarios
requirements
workflows
Process name
Process ID
Personas
Objectives
Task set
D
Referral
FP.D
	» Client
	» Health-care provider
	» Referral facility
To direct clients to services that are not available 
within this facility
Starting point: Clinician determined client needs for 
services that are not available in this facility
	» Determine whether it is an emergency referral
	» Discuss referral locations
	» Contact destination facility
	» Provide information to destination facility
	» Discuss any questions with client
E
Aggregate 
reporting and 
data use
FP.E
	» Facility staff
	» Person in charge of 
facility
	» District health officer/
staff 
To aggregate client-level data into validated, 
aggregate reports, use the data, and submit 
reports at the facility level
Starting point: Time for periodic (usually monthly) 
reporting
	» Check data quality
	» Correct fixable errors
	» Generate and review aggregate reports
	» Submit for approval
	» Provide feedback and any changes required
Processes that are a part of family planning service delivery but are not included in this DAK include: configuration, billing, dispensing, and how to follow up (although follow-up visits are part of the family 
planning counselling workflow). These processes may be required, although it is highly country and context specific. If applicable, the business process could include an insurance or coverage check, which could 
take place at any one of many points during a family planning visit.
4.1 Overview of key processes
This section illustrates the workflows of the identified processes, using standardized notation for business process mapping. Table 6 first provides an 
overview of this notation. Fig. 5 provides an overview of key family planning processes.
Table 6. Business process symbols used in workflows
Symbol
Symbol name
Description
Lane 1
Lane 2
Lane 3
Pool
Pool
A pool consists of multiple swim lanes that depict all the individuals or types of users that are involved in carrying out the business 
process or workflow. Diagrams should be clear and neat, and it should be easy for all viewers to understand the relationship across the 
different swim lanes. For example, a pool would depict the business process of conducting an outreach activity, which involves multiple 
stakeholders represented by different lanes in that pool. 
Lane 2
Lane 3
Pool
Lane 1
Swim lane 
Each individual or type of user is assigned to a swim lane, a designated area for noting the activities performed or expected by that 
specific actor. For example, an antenatal care health worker may have one swim lane; the supervisor would be in another swim lane; the 
clients/patients would be classified in another swim lane. 
recommendations
personas
indicators
data
decisions
scenarios
requirements
workflows
Symbol
Symbol name
Description
Start event or 
Trigger event
The workflow diagram should contain both a start and an end event, defining the beginning and completion of the task, respectively.
End event
There can be multiple end events depicted across multiple swim lanes in a business process diagram. However, for diagram clarity, 
there should only be one end event per swim lane. 
Activity, Process, 
Step or Task
Each activity should start with a verb, e.g. “Register client”, “Calculate risk”. Between the start and end of a task, there should be a 
series of activities noting the successive actions performed by the actor in that swim lane. There can also be subprocesses within each 
activity. 
+
Activity with 
subprocess
This denotes an activity that has a much longer subprocess to be detailed in another diagram. If the diagram starts to become too 
complex and unhelpful, the subprocess symbol should be used to reference another process depicted on another page.
Activity with 
business rule
This denotes a decision-making activity that requires the business rule, or decision-support logic, to be detailed in a decision-support 
table. This means that the logic described in the decision-support table will come into play during this activity, as outlined in the 
business process. This is usually reserved for complex decisions. 
Sequence flow
This denotes the flow direction from one process to the next. The end event should not have any output arrows. All symbols (except 
start event) may have an unlimited number of input arrows. All symbols (except end event and gateway) should have one, and only one, 
output arrow. All other symbols should have one output arrow leading to a new symbol or looping back to a previously used symbol or 
to the end event symbol. Connecting arrows should not intersect (cross) each other. 
Message flow 
This denotes the flow of data or information from one process to another. This is usually used for when data are shared across swim 
lanes or stakeholder groups. 
 Gateway 
This symbol is used to depict a fork, or decision point, in the workflow, which may be a simple binary (e.g. yes/no) filter with two 
corresponding output arrows or a different set of outputs.
There should only be two different outputs that originate from the decision point. If you find yourself needing more than two output 
or sequence flow arrows, you most likely are trying to depict decision-support logic or a business rule. This should be depicted as an 
activity with business rule (above) instead.
Throw – Link
The Throw – Link serves as the start of an off-page connector. It is the end of the process when there is no more room on your page for 
that workflow. It is the end of a process on your current page or the end of a subprocess that is part of a larger process. There will need 
to be a Catch – Link that follows the Throw – Link. 
Catch – Link
The Catch – Link serves as the end of an off-page connector. It is the start of the new process on a different page from the Throw – Link 
or the start of a subprocess that is part of a larger process. There needs to be a Throw – Link that is aligned to the Catch – Link. 
~
Ad hoc 
subprocess
An ad hoc subprocess can contain multiple tasks. One or more tasks in this shape should be performed, and they can be performed in 
any order. However, not all of these activities need to be finished before moving on to the next activity.
recommendations
personas
indicators
data
decisions
scenarios
requirements
workflows
Fig. 5. Overview of key family planning processesa
FP: family planning.
a For key, see Table 6 (page 28).
Health Facility
Pharmacy
Health Facility 
Management
Start
A. 
Registration
B. 
FP counselling
Referral 
needed?
C. 
FP service 
provision
D. 
Referral
End
No
Yes
Billing
Dispensing
Configuration
Aggregate 
reporting
Follow-up
Health facility
Health facility 
management
Pharmacy
recommendations
personas
indicators
data
decisions
scenarios
requirements
workflows
4.2 	Workflows
A. 	 Business process for registration
Objective: To ensure client is found in the system with up-to-date personal details or, if not located, entered into the system, and is ready for counselling.
Fig. 6. Workflow: Registration business processa
a For key, see Table 6 (page 28).
Source: Adapted from PATH (23).
Health-care facility
Client
Clerk
6. Validate client details
Start
2. Gather client 
details
3. Search for 
client
4. Match 
found?
Yes
7. Check in client
5. Create client 
record
No
6.1 
Review socio-
demographic data 
with client
6.2
Update 
needed?
6.3
Update client 
details
Yes
No
1. Arrive at facility
B. Counselling
Health facility
recommendations
personas
indicators
data
decisions
scenarios
requirements
workflows
REGISTRATION BUSINESS PROCESS NOTES AND ANNOTATIONS
General note
Registration may be conducted as a stand-alone process by a data clerk/
administrative persona ahead of the family planning encounter, or it 
may be conducted directly by the counsellor as part of the overall family 
planning encounter.
1.	 Arrive at facility
	»
Client arrives at the health-care facility.
	»
Client could already be registered at the health-care facility for another 
service, e.g. a client could be receiving postpartum family planning 
counselling during an antenatal care visit.
2.	 Gather client details
	»
Ask the client whether they have previously been issued a unique ID.
	»
Does the client have a card/number/barcode?
	»
Does client say they are a returning or a referred client?
	»
If a referral, check for referral slip or data from the community.
	»
Determine whether the client is new to the health-care facility/health 
post.
	»
For returning clients, details will be retrieved from the registry of clients 
at this facility or, if possible, from a central client registry.
3.	 Search for client
	»
This search process can be done through a variety of means, 
depending on what mechanisms are available in country. For example, 
clients can be searched for by using their name, unique ID, a QR code 
or even biometrics.
4.	 Match found?
	»
If multiple records are found with no unique ID, provide option to 
merge records.
5.	 Create client record
	»
Issue a unique ID if used and possible at the facility.
6.	 Validate client details
Review an update client record.
6.1.	Review sociodemographic data with client
	»
Review client’s non-clinical information – name, address, contact 
information, etc.
6.2. Update needed?
	»
Has the client moved? Have they changed their contact 
information or has any other sociodemographic information 
changed?
6.3. Update client details
	»
Client can provide updated information if they have moved or 
changed their details recently.
Merge/update client records.
May also happen during counselling process.
NOTE:
Clients should be directed to an area where auditory privacy can be 
maintained while gathering client details, so that adults known to them 
cannot overhear.
recommendations
personas
indicators
data
decisions
scenarios
requirements
workflows
7.	 Check in client
	»
Record client’s updated details in the client registry.
	»
Add client to the relevant queue for counselling services.
	»
Send/share intake confirmation to/with referring facility, as warranted.
8.	 Counselling
	»
After a client is registered, move on to the counselling workflow.
For adolescents:
For adolescents, a few special things need to be noted here.
	»
Is the adolescent married?
	»
Is there an accompanying adult (e.g. parent, family member)?
	»
Does the accompanying adult know the reason of their visit?
	»
Can information about them be shared with the accompanying adult 
or their parents later?
	»
Any emergency contact number the adolescent provides apart from 
their own mobile phone should belong to someone the client is 
comfortable the clinic discussing their condition with, if required.
	»
Have there been any recent changes in the adolescent’s home 
situation?
	»
How does the adolescent feel at home?
recommendations
personas
indicators
data
decisions
scenarios
requirements
workflows
B. 	 Business process for counselling
Objective: To provide client with advice and consultation services, and to decide on a course of action.
Fig. 7. Workflow: Counselling business processa
a For key, see Table 6 (page 28).
Health-care facility
Client
Health-care provider
Follow-up visit
11. Method selection
Collect client details
3.
Capture or update 
client history
5.
New or follow-
up?
New or 
referral
Follow-up
9.
Need 
resupply?
No
End
7.
Keep method?
11.2 Discuss 
methods & 
options
11.3
Select methods of 
interest
11.4
Screen for 
medical eligibility
Yes
6.
Discuss issues and 
concerns
2.
Take vital signs
1. Determine 
reason for visit
Switch method
Stop using
 method
Continue 
with method
A. Registration      
11.1
Method in mind
10.
Procedure 
required?
No
Yes
4. 
Conduct risk 
assessment
8.
Provide 
reinforcing 
messages
Health facility
recommendations
personas
indicators
data
decisions
scenarios
requirements
workflows
D. Referral
C. Service 
provision
11.5
Medically 
eligible?
11.6
Choose method
Yes
No
14. 
Determine where 
service can be 
provided
No,
Select alternative 
method.
Provide service 
at current
health facility  
~
12.
Check stock
13.
Validate skills
15. 
Client wants to 
keep chosen 
method?
Referral
needed
Yes
recommendations
personas
indicators
data
decisions
scenarios
requirements
workflows
COUNSELLING BUSINESS PROCESS NOTES AND ANNOTATIONS
General notes
Counselling should happen in a private place.
Group information sharing may happen in the waiting room before 
counselling.
The essential elements of counselling reminders that can be built into your 
tool as counselling tips include reminders to explain the following.
	»
What is the method?
	»
How does the method work?
	»
How effective is the method?
	»
How is the method used? / When do you take the method?
	»
What are possible side-effects from the method? / What are possible 
adverse events from the method?
	»
What are the method’s other benefits?
	»
Is the method compatible with breastfeeding?
	»
Does the method protect against STIs and HIV/AIDS?
Guidelines and guidance:
	»
Selected practice recommendations for contraceptive use (13)
	»
Family planning: a global handbook for providers – “Successful 
counseling”, page 370 (14)
	»
Family planning/contraception methods fact sheet (24).
1.	 Determine reason for visit
	»
Search for client details in the system and determine reason for visit.
	»
Decision-support table to guide workflow:
	–
FP.DT.01 “Reason for visit”.
Note: Steps 2, 3, 4 and 5 may occur in parallel. Not all steps may be 
completed.
2.	 Take vital signs
	»
Vital signs, e.g. blood pressure and weight, may be taken and 
recorded.
	»
Additional physical information might need to be taken as part of the 
method selection.
3.	 Capture or update client history
	»
Discuss medical history with client and review available records.
	»
Include an investigation of contraceptive history, i.e. past methods 
used.
4.	 Conduct risk assessment
	»
Not required but may be done, depending on the national policies and 
existing support systems, and at the health worker’s discretion.
	»
Some risk assessments that can be conducted include determining 
whether a client has a high risk of STI and whether they have been 
subjected to intimate partner or sexual violence.
	»
Possible risk assessments to be included:
	–
FP.DT.03 “STI risk assessment”
	–
FP.DT.04 “Intimate partner violence (IPV) assessment and  
first-line support”.
	»
Provide general sexual and reproductive health education.
For adolescents:
	»
Establish rapport with the adolescent.
	»
If accompanied by an adult, explain that the adult may need to step 
out.
	»
Ask non-threatening questions.
	»
Conduct HEADSS assessment throughout the counselling process.
recommendations
personas
indicators
data
decisions
scenarios
requirements
workflows
5.	 New or follow-up?
	»
Based on reason for visit, determine the counseling and services 
needed.
6.	 Discuss issues and concerns
	»
Investigate problems, such as side-effects the client is experiencing or 
has concerns about.
	»
Additional tests or even referral may be required for this, depending on 
the complexity and seriousness of the health condition.
	»
Guidelines and guidance:
	–
Selected practice recommendations for contraceptive use (13)
	–
Family planning: a global handbook for providers – “Managing any 
problems: problems reported as side effects”, “New problems that 
may require switching methods” and “Helping continuing users” 
(14).
7.	 Keep method?
	»
Is the client satisfied with the method being used?
	»
Does the client want to continue using their current method?
	»
Does the client want to switch to a different contraceptive method?
	»
Or does the client want to stop using contraceptive methods 
completely?
8.	 Provide reinforcing messages
	»
Provide reinforcing messages regarding the client’s method of choice.
9.	 Need resupply?
	»
Does the client need a resupply to continue with their method?
10.	Is a procedure required?
	»
Is a procedure required for the client to continue using the method, 
to stop using the method, or to switch methods? For example, not all 
providers may be able to provide or remove certain methods, such as 
implants and IUDs.
11.	Method selection
11.1. Method in mind
	»
Discuss whether the client has a method in mind.
	»
Decision-support table to guide counselling:
	–
FP.DT.06 “Method in mind”.
	»
Regardless of the answer, move on to 11.2 “Discuss methods and 
options”.
11.2. Discuss methods and options
	»
If the client had a method in mind, check:
	–
If the method suits the client’s needs and preferences
	–
The client’s understanding of the method and whether 
they need more information; if the client’s answers suggest 
misunderstanding or incorrect information, discuss the method 
and ensure clear understanding.
For adolescents:
For female adolescents it is mandatory to assess the risk of pregnancy. If 
there is a risk, the contraceptive method provided should be something 
they are able to control. The HEADSS assessment can help with this.
Counselling has succeeded when:
	»
Client feels they received the help they wanted
	»
Client knows what to do and feels confident that they can do it
	»
Client feels respected and appreciated
	»
Client comes back when they need to
	»
Client uses their methods effectively and with satisfaction.
recommendations
personas
indicators
data
decisions
scenarios
requirements
workflows
	»
If the client has no method in mind, discuss possible methods 
based on client’s needs/preferences and review method options.
	»
The health-care provider should provide client education and 
inform the client of what the method is, how effective it is, how to 
use it properly, when to start, what to remember when using the 
method, possible side-effects and how to manage them, possible 
health risks and health benefits, correct misunderstandings, explain 
how certain methods compare with other methods, and more. 
Additional information can be found in:
	–
Family planning: a global handbook for providers (14)
	–
Decision-making tool for family planning clients and providers 
(25).
11.3. Select methods of interest
	»
Support client in making an informed choice.
11.4. Screen for medical eligibility
	»
Check client’s medical eligibility for method of interest.
	»
This may require additional laboratory testing, depending on the 
complexity of the health condition and the method.
	»
Decisions to be made:
	–
FP.DT.08 “Medical eligibility criteria (MEC)”.
	»
Guidelines and guidance:
	–
Medical eligibility criteria for contraceptive use (12)
	–
Family planning: a global handbook for providers – “Using 
clinical judgement in special cases” (14)
	–
Selected practice recommendations for contraceptive use (13).
11.5. Medically eligible?
	»
Depending on the results of FP.DT.08, the client may or may not be 
medically eligible for a method.
	»
If the client is not medically eligible for that selected method, 
continue counselling and provide alternative options for 
contraceptive methods.
11.6. Choose method
	»
Once the client has received enough counselling, and medical 
eligibility has been determined, the client decides on their method 
of choice.
	»
The method of choice is the contraceptive method that the client 
chooses based on their contraceptive preferences and their 
medical eligibility.
12.	Check stock
	»
Does the facility have the necessary supplies to provide the chosen 
method?
	»
Is the method in stock?
	»
Are the related supplies required to provide the method (e.g. forceps, 
speculum, gloves) in stock?
13.	Validate skills
	»
Are there health workers at the facility who are trained to provide the 
selected method (e.g. IUD insertion) or service (e.g. IUD removal)?
	»
Is provision of this method within the roles and responsibilities of the 
nurse midwife?
14.	Determine where service can be provided
	»
Depending on the availability of stock and the skills of the health-care 
provider, determine whether the method or service can be provided on 
site or a referral is needed:
	–
FP.DT.09 “Where services can be provided”.
For adolescents:
	»
In general, adolescents are eligible to use any contraceptive method 
and must have access to a variety of contraceptive choices.
	»
Age alone does not constitute a medical reason for denying any 
contraceptive method to adolescents.
	»
Also consider asking, “Do you smoke, consume alcohol or take 
recreational drugs on a regular basis?”
recommendations
personas
indicators
data
decisions
scenarios
requirements
workflows
15.	Client wants to keep chosen method?
	»
If the method is not in stock, regardless of the health-care provider’s 
skillset, the client can decide to choose an alternative method.
	»
If the health-care provider does not have the skillset to provide that 
method, then the client can decide to choose an alternative method.
	»
However, if the client does not want to choose an alternative method, 
then refer to another facility or schedule follow-up visit.
16.	Service provision
	»
If the method is in stock and the health-care provider has the skill to 
provide that method, then move to service delivery workflow.
17.	Referral
	»
If the client is not able to receive the chosen method at the current 
health-care facility, and the client does not want to choose an 
alternative method, then refer them to another facility.
FIG. 8
Comparison of effectiveness of contraceptive methods 
Source: WHO/RHR and CCP (14).
recommendations
personas
indicators
data
decisions
scenarios
requirements
workflows
C. 	 Business process for service provision
Objective: To provide services, with instruction and methods, if the client is medically eligible for them.
Fig. 9. Workflow: Service provision business processa
FAB: fertility awareness-based method; IUD: intrauterine device; LAM: lactational amenorrhoea method.
a For key, see Table 6 (page 28).
Health-care facility
Health-care provider
Client
Pregnancy diagnosis
Stopping method
1.
Review client 
record
2. 
Chosen 
method?
B. Counselling
6.
Get informed 
consent
8.
Determine when 
to start
3.
Use pregnancy 
checklist
4. 
Pregnancy 
ruled out?
5. Perform 
pregnancy test
Refer to Antenatal care
Yes
No
Yes
Barrier, LAM, FAB, Withdrawal Methods, Sterilization
7. 
Perform exams & 
tests
Hormonal 
contraceptive, 
IUD
No
No
1.1 
Stopping 
method?
Yes
6.1
Get informed 
consent
Health facility
recommendations
personas
indicators
data
decisions
scenarios
requirements
workflows
9.
Provide method
End
13.
Follow up  
required?
No
12.
Determine follow 
up requirements
Yes
11.
Discuss any 
questions with 
client
15.
Encourage follow 
up as needed
14.
Schedule follow 
up visit
10.
Discuss dual 
protection & 
backup method
9.1
Provide removal 
procedure
recommendations
personas
indicators
data
decisions
scenarios
requirements
workflows
SERVICE PROVISION BUSINESS PROCESS NOTES AND ANNOTATIONS
General notes
Depending on where the client received counselling, the client could receive 
service provision at the same time, in the same place. The client could also 
receive services at a referral facility. Alternatively, service provision could also 
happen at the same place of counselling, but at a later date.
1.	 Review client record
	»
Search for client details in the system and review the client’s record, 
including medically eligibility.
1.1 Stopping method?
	»
If the client is stopping the method (e.g. having the IUD or implant 
removed) go straight to 6.1 “Get informed consent” and 9.1 
“Provide removal procedure”.
2.	 Chosen method?
	»
Depending on the chosen method, the health-care provider must first 
determine whether the client is not pregnant – through the use of the 
pregnancy checklist, or, if needed, a pregnancy test.
3.	 Use pregnancy checklist
	»
The pregnancy checklist is needed for clients starting hormonal 
contraceptives and/or an IUD.
	»
Decision-support logic to calculate pregnancy status:
	–
FP.DT.10 “Pregnancy checklist”.
4.	 Pregnancy ruled out?
	»
If pregnancy can be ruled out using the pregnancy checklist, move on 
to 6 “Get informed consent”.
	»
If pregnancy cannot be ruled out, perform a pregnancy test (step 5).
5.	 Perform a pregnancy test
	»
Depending on the sensitivity of the pregnancy test, a follow-up visit 
may be required.
	»
Guidelines and guidance:
	–
Family planning: a global handbook for providers – “Pregnancy 
checklist” (14).
6.	 Get informed consent
	»
Special counselling may be required.
	»
Local policies and requirements for informed consent should be used 
here.
7.	 Perform examinations and tests
	»
Depending on the method, some additional examinations and tests 
would be needed to determine whether or not the client would be able 
to receive the method and/or determine when the most appropriate 
time would be to start the method. Alternatively, some examinations 
and tests are done to ensure safety of method provision.
	»
The examinations or tests that are considered for each type of 
contraceptive apply to persons who are presumed to be healthy. Those 
with known medical problems or other special conditions may need 
additional examinations or tests.
	»
Whether the exam or test could be done needs to also be evaluated. 
For example, if the health-care facility does not have a means to 
conduct a haemoglobin test, then a haemoglobin test may not be 
required and its absence should not be used to prevent a client from 
receiving contraceptive methods.
	»
Decision-support logic to determine whether exams and/or tests are 
needed:
	–
FP.DT.11 “Examinations and tests”.
recommendations
personas
indicators
data
decisions
scenarios
requirements
workflows
8.	 Determine when to start
	»
Decision-support logic to determine when to start, based on method 
and health condition:
	–
FP.DT.12 “When to start”.
9.	 Provide method
	»
Explain to the user how the method works; discuss how to use the 
method, when to start, and how to recognize and cope with any 
side-effects. Also, certain methods, such as subcutaneous depot 
medroxyprogesterone acetate (DMPA-SC), may require guided training 
if being self-administered (26).
	»
In the case of long-acting and permanent methods, a procedure will be 
performed.
	»
Guidelines and guidance:
	–
Selected practice recommendations for contraceptive use (13)
	–
Family planning: a global handbook for providers (14).
	»
Certain methods, such as IUDs and implants, may require an in-clinic 
observation and rest period.
10.	Discuss dual protection
	»
Promote dual protection to prevent STIs, reproductive tract infection 
and pregnancy.
	»
Decision-support logic to determine if back-up method is needed:
	–
FP.DT.13 “Back-up method”.
	»
If a back-up method is needed, the user should use condoms or abstain 
from sex for the recommended number of days.
	»
Where appropriate, provide condoms, promote use of condoms, and 
counsel about reducing number of partners or delaying sexual activity 
to reduce STI risk.
11.	Discuss any questions with client
	»
Provide reinforcing messages.
	»
For a method a client plans to self-administer, ensure client has 
received guidance and knows that they can come back at any time.
	»
Where appropriate, recommend referral to other services (e.g. STI or 
HPV screening).
	»
Guidelines and guidance:
	–
Family planning: a global handbook for providers – “‘Come back 
any time’: reasons to return” (14).
12.	Determine follow-up requirements
	»
Although clients are encouraged to come back at any time, some 
methods require more regular follow-up.
	»
Follow-up decision-support logic:
	–
FP.DT.14 “Follow-up requirements”
	–
FP.S.1 “Schedule follow-up visit”.
	»
Guidelines and guidance:
	–
Selected practice recommendations for contraceptive use (13)
	–
Family planning: a global handbook for providers (14).
	»
Update client’s digital record.
	»
Update blue card or book, if used in the country. Information written in 
the book should consider privacy needs.
For adolescents:
It is especially important for adolescents to receive appropriate 
counselling on dual protection for prevention of STIs.
recommendations
personas
indicators
data
decisions
scenarios
requirements
workflows
13.	Follow-up required?
	»
If follow-up is required, schedule follow-up.
	»
If follow-up is not required, encourage follow-up as needed.
14.	Schedule follow-up
	»
Explain importance of follow-up.
	»
If client consents to being contacted, confirm client’s contact data and 
set to allow follow-up.
	»
Guidelines and guidance:
	–
Family planning: a global handbook for providers – “‘Come back 
any time’: reasons to return” (14).
15.	Encourage follow-up as needed
	»
Although a routine follow-up might not be needed for the client’s 
chosen method, the health-care provider should state that the client is 
welcome back at any time to discuss any side-effects or complications, 
if they want to change methods, and/or if she thinks she is pregnant.
	»
Where appropriate, recommend referral to other services (e.g. STI or 
HIV screening).
	»
Guidelines and guidance:
	–
Family planning: a global handbook for providers – “‘Come back 
any time’: reasons to return” (14).
recommendations
personas
indicators
data
decisions
scenarios
requirements
workflows
D. 	 Business process for referral
Objective: To direct clients to services they need which are not available at this point of service.
Fig. 10. Workflow: Referral business processa
a For key, see Table 6 (page 28).
Health-care facility
Referral health-
care facility
Client
Health-care 
provider
Healthcare provider
2. Emergency referral
1. 
Emergency 
referral?
3. 
Identify & discuss 
referral location 
options
4.
Contact referral 
facility
5.
Can facility 
accommodate?
6. 
Provide 
information to 
referral facility
7.
Discuss any 
questions with 
client
No
2.1 
Stabilize client & 
give pre-referral 
treatment
2.3
Organize 
transport
Yes
B. Counselling
9.
Receives 
client
C. Service 
provision
Yes
2.2 Client 
stable enough 
to transport?
No
Yes
End
Client goes to 
referral facility
8.
Provide backup 
method
No
Health Facility
Referral  
Health Facility
recommendations
personas
indicators
data
decisions
scenarios
requirements
workflows
REFERRAL PROCESS NOTES AND ANNOTATIONS
General notes
Examples of reasons why a referral may be needed include:
	»
Health worker cannot provide the method due to lack of training and 
skills
	»
Facility does not have method in stock or supplies needed to provide 
method in stock
	»
The facility cannot perform the service for some reason
	»
There is an emergency, and the client needs immediate referral.
1.	 Emergency referral?
	»
If client needs an immediate referral due to an emergency situation, 
bypass standard referral steps.
	»
In the case of an emergency, a referral can be made at any time, 
including during registration, counselling or service provision.
2.	 Emergency referral
2.1 Stabilize client and give prereferral treatment
	»
The client is assumed to need emergency referral if their condition 
requires immediate medical attention. Thus, stabilize the client’s 
condition and provide any necessary treatment.
2.2 Client stable enough to transport?
	»
Once the client is stable enough to transport, then immediately 
transport.
	»
If the client is still not stable, provide prereferral treatment for 
stabilization.
2.3 Organize transport
	»
Organize emergency transport for the client.
	»
For emergency referrals, the health-care facility arranges transport, 
usually by phoning for an ambulance or other vehicle.
3.	 Identify and discuss referral location options
	»
In discussion with the client and their relatives, decide on where the 
client will be referred. Discussions include:
–	
How to get to the referral facility, including location and 
transportation options
–	
Who to see and what is likely to happen
–	
Follow-up on return, if needed.
	»
If there are various possible referral facilities, either the client or their 
relatives should indicate their and referred referral location.
4.	 Contact referral facility
	»
Health workers should contact the referral facility to determine whether 
that facility can accommodate such a referral.
5.	 Can facility accommodate?
	»
Check whether the facility can accommodate the client and provide the 
services they need.
	»
If the facility can accommodate the client, move on to step 6 “Provide 
information to referral facility”.
	»
Otherwise, find a different facility that is able to accommodate the 
client.
	»
A system can be set up to validate that a facility has both supplies and 
skills to accommodate the client.
6.	 Provide information to referral facility
	»
Make appointment, if necessary.
	»
Client or family arranges own transport.
	»
For emergency referrals, the health-care facility arranges transport – 
usually by phoning for an ambulance or other vehicle.
	»
Complete referral form, which can include notification of the referral 
destination.
recommendations
personas
indicators
data
decisions
scenarios
requirements
workflows
	»
Provide the necessary clinical, sociodemographic and identity 
information to the referral facility.
	»
This can be done digitally if the appropriate systems are in place.
7.	 Discuss any questions with client
	»
Discuss any questions or concerns the client may have.
8.	 Provide back-up method and discuss dual protection
	»
Provide back-up method based on chosen method and initiation date 
as well as discussing dual protection with condoms. 
9.	 Receipt of client
	»
Referral facility receives client along with all the necessary clinical, 
sociodemographic and identification information.
	»
Once the referral facility receives the client, move to provide services at 
the receiving referral facility (C. Business process for service provision).
For adolescents:
If an unaccompanied adolescent needs a referral, ensure that a 
responsible adult is sent as an accompanying person.
recommendations
personas
indicators
data
decisions
scenarios
requirements
workflows
E. 	 Business process for aggregate reporting and data use 
Objective: To aggregate client-level data into validated, aggregate reports, use the data and submit reports.
Fig. 11. Workflow: Aggregate reporting business processa
a For key, see Table 6 (page 28).
Health Facility
Facility staff
District Health Officer/Staff
Facility in Charge
6.
Review report
Yes
Yes
No
10.
Review 
submitted data
12.
Provide 
feedback to 
facility
Yes
8.
Provide 
feedback
No
9.
Submit data 
electronically    
No
End
Start
3.
Generate 
aggregate 
reports
1.
Check data 
quality
2.
Correct fixable 
data quality 
issues
4.
Check 
aggregate 
reports
11.
Any 
feedback?
5.
In-charge 
review 
needed?
7.
Changes 
needed?
Health facility
recommendations
personas
indicators
data
decisions
scenarios
requirements
workflows
REPORTING AND DATA USE BUSINESS PROCESS NOTES AND ANNOTATIONS
1.	 Check data 
	»
Health-care facility reviews accuracy, validity and completeness of data 
in system.
	»
This can be automated and done digitally.
2.	 Correct fixable data quality issues
	»
Depending on local policy this step might not be required.
3.	 Generate aggregate reports
	»
This can be automated and done digitally.
4.	 Check aggregate reports
	»
Depending on local policy this step might not be required.
5.	 Facility supervisor/in-charge review needed?
	»
Determine whether the report needs to be reviewed by the person in 
charge of the facility.
	»
Some facility in-charges do not review reports.
6.	 Review report
	»
The reports are reviewed by person in charge.
	»
This can be done digitally.
7.	 Changes needed?
	»
Determine whether the report is accurate or has any issues.
8.	 Provide feedback
	»
If there is any issue with the report, the person in charge will provide 
feedback for the responsible person to make corrections to client-level 
data.
	»
This can be done digitally.
9.	 Submit data electronically
	»
Reports and data may be used by the facility at multiple points during 
the business process, such as here, earlier in the process or outside the 
business process.
	»
This can be automated and done digitally.
	»
Depending on the local policies, an active submission may not be 
needed, and the district-, provincial- and national-level MOH would be 
able to access data directly for reporting purposes.
10.	Review submitted data
	»
Use data in report to review progress and make decisions on 
improvements and actions to take.
11.	Any feedback?
	»
Determine whether there is any feedback after review of the data.
12.	Provide feedback to facility
	»
If there is any feedback, the focal person will provide the feedback to 
the facility. If there are errors, the facility may be required to restart the 
process and resubmit.
recommendations
personas
indicators
data
decisions
scenarios
requirements
workflows
4.3	 Additional considerations for adapting workflows
As a reminder, these workflows are meant to be generic and high level. They will require a level of customization and adaptation as they are being 
translated into a digital system for a specific context. These workflows are considered to be 80% complete, whereby the other 20% will need to be done 
through a series of human-centred design methods and mechanisms to complete the workflows for an implementation. For example, there might be 
additional workflows that need to be drawn out, or there might be additional activities expected of a health worker in the facility. Some workflows are not 
included due to the high level of contextualization required, including: billing, dispensing (if separate from service provision), configuration (of facility-
level specifics) and follow-up (which can be automated). Alternatively, there might be some activities and tasks a health worker would not be expected 
to do. Although these workflows can be considered as a starting point, it is helpful to conduct further validation through interviews with the targeted 
personas or shadowing their work to obtain a better sense of the differences that would need to be reflected in the digital system. 
recommendations
personas
indicators
workflows
decisions
scenarios
requirements
data
This section outlines the minimum set of data corresponding to different points of the workflow within the identified business processes. This data 
set can be used on any software system and lists the data elements relevant for service delivery and executing decision-support logic, as well as for 
populating indicators and performance metrics. Although this section provides a high-level overview of the data elements, a more complete data 
dictionary in spreadsheet form detailing the input options, validation checks and concept dictionary codes is available in Web Annex A.
Inclusion of a data element in the table does not by itself indicate that collection of the data is required. Additionally, some data elements are dependent 
on other data elements (e.g. test results are only entered when a test has been performed). Collection of data should not prevent clients from accepting 
a contraceptive method or affect clinical care. This will require review and adaptation.
