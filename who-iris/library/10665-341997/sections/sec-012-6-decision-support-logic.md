---
doc_id: 10665-341997
doc_title: "Digital adaptation kit: family planning: operational requirements for implementing WHO recommendations in digital systems"
section_id: sec-012-6-decision-support-logic
section_title: "Decision-support logic"
section_number: 6
pages: 66-73
source_pdf: 10665-341997.pdf
source_sha256: 31e381afabc25132
toc_source: outline
---
Table 10 provides an overview of the decision-support tables and algorithms for the different family planning module business processes. The structure 
of the decision-support tables is based on an adaptation of the Decision Model and Notation (DMN), an industry standard for modelling and executing 
decision logic (27). These decision-support tables detail the business rules, data inputs and outputs to support family planning module business 
processes. 
Decision-
support logic
Component
recommendations
personas
indicators
workflows
data
scenarios
requirements
decisions
Table 10. Overview of decision-support tables for family planning module
Activity ID.  
Activity name
Decision-
support  
table ID
Decision-support table description
Reference/source
FP.B1.  
Determine reason 
for visit
FP.DT.01
Reason for visit
	» Family planning: a global handbook for providers (2018) (14)
FP.B4.  
Conduct risk 
assessment
FP.DT.02
HEADSS assessment for adolescents
	» Adolescent job aid (2010) (28)
	» WHO recommendations on adolescent sexual and reproductive health and rights (2018) (29)
FP.B4.  
Conduct risk 
assessment
FP.DT.03
STI risk assessment
	» Family planning: a global handbook for providers (2018) (14)
FP.B4.  
Conduct risk 
assessment
FP.DT.04
Intimate partner violence (IPV) 
assessment and first-line support
	» Health care for women subjected to intimate partner violence or sexual violence: a clinical 
handbook (2014) (30)
	» Responding to intimate partner violence and sexual violence against women (2013) (31)
	» Family planning: a global handbook for providers (2018) (14)
FP.B6.  
Discuss issues and 
concerns
FP.DT.05
Issues and concerns related to methods
	» Selected practice recommendations for contraceptive use (2016) (13)
	» Family planning: a global handbook for providers (2018) (14)
	» WHO consolidated guideline on self-care interventions for health (2019) (26)
FP.B11.1  
Method in mind
FP.DT.06
Method in mind
	» Family planning: a global handbook for providers (2018) (14)
FP.B6.  
Discuss issues and 
concerns
FP.DT.07
Client preferences
	» Family planning: a global handbook for providers (2018) (14)
recommendations
personas
indicators
workflows
data
scenarios
requirements
decisions
Activity ID.  
Activity name
Decision-
support  
table ID
Decision-support table description
Reference/source
FP.B11.4  
Screen for medical 
eligibility
Medical eligibility criteria (MEC)
	» Medical eligibility criteria for contraceptive use (2015) (12)
	» Family planning: a global handbook for providers (2018) (14)
FP.DT.08.1
MEC for copper-bearing intrauterine 
devices (Cu-IUDs)
FP.DT.08.2
MEC for levonorgestrel-releasing 
intrauterine device (LNG-IUD)
FP.DT.08.3
MEC for etonogestrel (ETG) one-rod and 
levonorgestrel (LNG) two-rod
FP.DT.08.4
MEC for DMPA-IM, DMPA-SC and  
NET-EN
	» Medical eligibility criteria for contraceptive use (2015) (12)
	» Family planning: a global handbook for providers (2018) (14)
	» Contraceptive eligibility for women at high risk of HIV (2019) (32)
FP.DT.08.5
MEC for progestogen-only pills (POPs)
	» Medical eligibility criteria for contraceptive use (2015) (12)
	» Family planning: a global handbook for providers (2018) (14)
FP.DT.08.6
MEC for combined oral contraceptives 
(COCs), combined contraceptive patch 
and combined contraceptive vaginal ring 
(CVR)
FP.DT.08.7
MEC for progesterone-releasing vaginal 
ring (PVR), lactational amenorrhoea 
method (LAM) and withdrawal
FP.DT.08.8
MEC for male condoms and female 
condoms
FP.DT.08.9
MEC for emergency contraceptive pills 
(ECPs)
FP.DT.08.10
MEC for fertility awareness-based 
methods (FABs)
FP.DT.08.11
MEC for male sterilization
FP.DT.08.12
MEC for female sterilization
FP.B14.  
Determine where 
services can be 
provided
FP.DT.09
Where services can be provided
	» Based on expert consultation
FP.C3.  
Use pregnancy 
checklist
FP.DT.10
Pregnancy checklist
	» Family planning: a global handbook for providers (2018) (14)
recommendations
personas
indicators
workflows
data
scenarios
requirements
decisions
Activity ID.  
Activity name
Decision-
support  
table ID
Decision-support table description
Reference/source
FP.C7.  
Perform exams  
and tests
FP.DT.11
Examinations and tests
	» Selected practice recommendations for contraceptive use (2016) (13)
	» Family planning: a global handbook for providers (2018) (14)
FP.C8.  
Determine when to 
start
FP.DT.12
When to start 
	» Selected practice recommendations for contraceptive use (2016) (13)
	» Family planning: a global handbook for providers (2018) (14)
FP.C10.  
Discuss dual 
protection and  
back-up method
FP.DT.13
Back-up method
	» Selected practice recommendations for contraceptive use (2016) (13)
	» Family planning: a global handbook for providers (2018) (14)
FP.C12.  
Determine follow-up 
requirements
FP.DT.14
Follow-up requirements
	» Family planning: a global handbook for providers (2018) (14)
	» Selected practice recommendations for contraceptive use (2016) (13)
DMPA-IM: intramuscular depot medroxyprogesterone acetate; DMPA-SC: subcutaneous depot medroxyprogesterone acetate; HEADSS: home, education, activities/employment, drugs, suicidality and sex;  
STI: sexually transmitted infection.
6.2 	Decision-support tables
The decision logic listed in the overview table is elaborated in Web Annex B. These decision-support tables comprise the components described in  
Table 11.
Note that the decision-support logic here is translated directly from the WHO guidelines and guidance documents, and has been reviewed by the 
panel of experts who have created those guidelines documents. We do not anticipate the decision-support logic to change much, as the logic has been 
created and reviewed by clinical experts. However, some level of adaptation may be needed depending on changes to the workflow and/or changes to 
the data dictionary.
Any changes to the decision-support logic should be considered carefully, as an embedded decision-support system can greatly affect the quality of care 
at the point of care. As helpful as decision-support logic can be to the health worker, incorrect decision-support logic can also be detrimental. Thus, any 
new decision-support logic should be carefully reviewed and agreed upon by in-country clinical experts.
recommendations
personas
indicators
workflows
data
scenarios
requirements
decisions
Table 11. Components of the decision-support tables
Decision ID 
The name of the decision, describing what algorithm or logic is represented (e.g. pre-eclampsia risk counselling). The decision ID should 
correspond to the number in the overview table (Table 10). 
Business rule
The description of the decision that needs to be made, based on IF/THEN statements with the appropriate data element name for the 
variables. The rule should demonstrate the relationship between the input variables and the expected outputs and actions within the 
decision-support logic – e.g. if blood pressure is higher than 140 systolic/90 diastolic then the client should be flagged as a high-risk 
pregnancy. 
Trigger
The event that would indicate when this decision-support logic should appear within the workflow, such as the activity that would trigger 
this decision to be made. 
Inputs
Output
Action
Annotations
These are the 
variables or 
conditions that need 
to be considered 
to determine the 
consequent actions 
or outputs.
If there are multiple 
input entries on the 
same row, these 
different inputs 
are considered as 
“AND” – conditions 
that need to be in 
place at the same 
time.
The resulting action or decision, based on 
the combination of input entries. This is 
the statement that immediately follows the 
“THEN”. Examples of outputs may include  
a diagnosis or alerts/prompts for referral 
and/or counselling.
Concrete measures to be taken based on 
the output (refer, provide treatment and/
or counselling, conduct test, etc.). In some 
cases, output and action may be the same.
Additional explanations or descriptions, 
including possible pop-up alert messages 
and relevant background information.
This section can also include the written 
content which would appear in the pop-up 
messages notifying the health worker of the 
appropriate next steps, which can include 
counselling, case management approach, 
or referral.
Inputs placed on different rows are 
considered as “OR” conditions that can be 
considered independently of the inputs on 
other rows. 
recommendations
personas
indicators
workflows
data
scenarios
requirements
decisions
Table 12. Example decision-support logic table for medical eligibility for copper-bearing intrauterine devices (Cu-IUDs)
Decision ID
FP.DT.08.1 Medical eligibility criteria for copper-bearing intrauterine devices (Cu-IUDs)
Business rule
FP.B11.4 Screen for medical eligibility
Trigger
IF “Method requested” = “Copper-bearing intrauterine device (Cu-IUD)”
Inputs
Output
Action
Annotations
References
“Method 
requested” = 
“Copper-bearing 
intrauterine devices 
(Cu-IUDs)”
“Health 
condition(s)” = 
“Irregular vaginal 
bleeding patterns”
“Medical 
eligibility 
category” = 1
“Medically 
eligible” = TRUE
Counsel client that she 
is medically eligible for 
this method.
Client is medically 
eligible for this 
method, with a medical 
eligibility category of 
1 – Use method in any 
circumstance.
Medical eligibility 
criteria for contraceptive 
use (2015) (12)
Family planning: a 
global handbook for 
providers (2018) (14)
“Method 
requested” = 
“Copper-bearing 
intrauterine devices 
(Cu-IUDs)”
“Health 
condition(s)” 
= “Heavy or 
prolonged vaginal 
bleeding patterns”
“Medical 
eligibility 
category” = 2
“Medically 
eligible” = TRUE
Counsel client that she 
is medically eligible for 
this method.
Client is medically 
eligible for this method, 
with a medical eligibility 
category of 2 - Generally 
use method.
“Method 
requested” = 
“Copper-bearing 
intrauterine devices 
(Cu-IUDs)”
“Health 
condition(s)” = 
“Unexplained 
vaginal bleeding”
“Method at intake” 
≠ “Copper-bearing 
intrauterine devices 
(Cu-IUDs)”
“Medical 
eligibility 
category” = 4
“Medically 
eligible” = 
FALSE
Counsel client that 
she is NOT medically 
eligible for this method 
if this is for initiation.
Discuss methods 
and options to find 
alternative options for 
the client.
Client is NOT medically 
eligible for this method, 
with a medical eligibility 
category of 4 - Method 
NOT to be used.
For all the decision-support tables that are available for the family planning DAK, please refer to this linked spreadsheet: Web Annex B.
6.3 	Scheduling logic overview
In addition to specific decision-support logic that needs to be detailed, there is also scheduling logic that can be used to facilitate the digital tracking of 
clients. For example, it will be important for the health worker to know when the client’s next visit is due based on the recommendations for follow-up. 
The follow-up schedule is based on the client’s method at exit or the service that was provided. The overview of the follow-up schedules is provided in 
Table 13 and the corresponding logic is elaborated in Web Annex B.
recommendations
personas
indicators
workflows
data
scenarios
requirements
decisions
Table 13. Overview of scheduling logic
Scheduling logic ID
Scheduling logic description
Reference/source
FP.S.1-1
Copper-bearing intrauterine device (Cu-IUD) insertion follow-up
Family planning: a global handbook for providers (2018) (14)
FP.S.1-2
Levonorgestrel-releasing intrauterine device (LNG-IUD) insertion follow-up
Family planning: a global handbook for providers (2018) (14)
FP.S.1-3
Copper-bearing intrauterine device (Cu-IUD) removal 
Family planning: a global handbook for providers (2018) (14)
FP.S.1-4
Levonorgestrel-releasing intrauterine device (LNG-IUD) removal
Family planning: a global handbook for providers (2018) (14)
FP.S.1-5
Etonogestrel (ETG) one-rod implant insertion follow-up
Family planning: a global handbook for providers (2018) (14)
FP.S.1-6
Levonorgestrel (LNG) two-rod implant insertion follow-up
Family planning: a global handbook for providers (2018) (14)
FP.S.1-7
ETG one-rod implant removal
Family planning: a global handbook for providers (2018) (14)
FP.S.1-8
LNG two-rod implant removal
Family planning: a global handbook for providers (2018) (14)
FP.S.1-9
Intramuscular depot medroxyprogesterone acetate (DMPA-IM) injection follow-up
Family planning: a global handbook for providers (2018) (14)
FP.S.1-10
Subcutaneous DMPA (DMPA-SC) injection follow-up
Family planning: a global handbook for providers (2018) (14)
FP.S.1-11
Norethisterone enanthate (NET-EN) injection follow-up
Family planning: a global handbook for providers (2018) (14)
FP.S.1-12
Progestogen-only pills (POPs) follow-up
Family planning: a global handbook for providers (2018) (14)
FP.S.1-13
Combined oral contraceptives (COCs) follow-up
Family planning: a global handbook for providers (2018) (14)
FP.S.1-14
COCs – annual visit
Family planning: a global handbook for providers (2018) (14)
FP.S.1-15
Combined contraceptive patch follow-up
Selected practice recommendations for contraceptive use (2016) (13)
FP.S.1-16
Combined contraceptive patch – annual visit
Selected practice recommendations for contraceptive use (2016) (13)
FP.S.1-17
Combined contraceptive vaginal ring (CVR) follow-up
Selected practice recommendations for contraceptive use (2016) (13)
FP.S.1-18
CVR – annual visit
Selected practice recommendations for contraceptive use (2016) (13)
FP.S.1-19
Progesterone-releasing vaginal ring (PVR) follow-up
Selected practice recommendations for contraceptive use (2016) (13)
FP.S.1-20
Male sterilization follow-up
Selected practice recommendations for contraceptive use (2016) (13)
FP.S.1-21
Female sterilization follow-up
Family planning: a global handbook for providers (2018) (14)
recommendations
personas
workflows
data
decisions
scenarios
requirements
indicators
