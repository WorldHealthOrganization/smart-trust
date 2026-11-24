---
doc_id: 10665-341997
doc_title: "Digital adaptation kit: family planning: operational requirements for implementing WHO recommendations in digital systems"
section_id: sec-009-3-user-scenarios
section_title: "User scenarios"
section_number: 3
pages: 31-34
source_pdf: 10665-341997.pdf
source_sha256: 31e381afabc25132
toc_source: outline
---
3.1 	User scenario for nurse
Key personas
Nurse: Aisha
Client: Hope
Hope is a 26-year-old woman who has brought her 6-week-old baby, Mosi, into a primary health care facility for routine immunizations.
While nurse Aisha is providing the immunizations for the child, they begin discussing Hope’s future and desire for more children. As she is looking to space out the next birth by more 
than a year, Aisha suggests they talk more about family planning.
Hope has not yet been registered in the electronic system. So, Aisha sets her up as a new client, gathers her contact and address information, and then provides her with a unique 
ID number. As Hope has yet to discuss the use of contraception with her husband, she is hesitant to provide her phone number as they sometimes share the phone. Aisha reassures 
her that the information is kept confidential, and she would only be contacted if she so wishes and can change her preferences at any time. Aisha instructs Hope to have a seat in the 
waiting area, and Aisha will be over shortly after finishing with a few more child immunizations.
Aisha calls in Hope as she heads into the family planning consultation room. They both sit down at the desk and Aisha gathers a few more details from their earlier conversation. Hope 
is breastfeeding her firstborn and does not have any other health concerns of note. She is excited about having a larger family, but just is a bit overwhelmed with being a new mother 
at this point. While they are having the conversation, Aisha checks Hope’s blood pressure and finds that it is within the normal range. When asked if she has a method in mind, Hope 
mentions she has heard about the new injectable contraceptives available and wonders if that would be right for her. Aisha discusses injectables (DMPA), progestogen-only pills (POPs) 
and intrauterine devices (IUDs). As she is currently breastfeeding Mosi, Hope decides to start with POP and monitor its effects, but she may switch to an injectable in the future.
As Hope is new to the method, Aisha informs her that she can start the pills at any time, and prescribes and provides her with one month’s supply of POP and promotes the use of 
dual protection, asking if she would also like a supply of condoms. Aisha suggests they schedule a follow-up around the time of the next immunization for Mosi in one month, to both 
review her selection of the POP and provide a full year’s supply if needed. Aisha asks if she would like a follow-up reminder to her mobile phone and reassures Hope that no confidential 
information would be shared, just that she has an appointment scheduled. Aisha asks if Hope has any other concerns or questions.
A few days prior to the scheduled follow-up visit, the system automatically sends out a series of SMS reminders to the clients with appointments who scheduled for the week and have 
consented to be contacted.
Corresponding 
business processes 
(see Component 4)
This scenario refers to the following business processes:
	» Registration
	» Family planning counselling
	» Family planning service provision.
User  
scenarios
Component
recommendations
personas
indicators
workflows
data
decisions
requirements
scenarios
3.2	 User scenario for an adolescent
Key personas
Nurse/Midwife: Maria
Client: Anna
Registration Clerk: Zeinab
An adolescent girl has come to the clinic with an accompanying person. Zeinab, the female registration clerk who has received training in provision of adolescent-friendly health 
services, moves her away from the crowd. Once away from the long line of clients, Zeinab asks her the reason for her visit. The young girl opens up to her and says, “I have come to 
discuss about birth control.” She gets to know this girl is a new client. Her name is Anna, and she is 16 years old and unmarried. Zeinab makes sure that the emergency contact number 
Anna gives the clinic does not belong to her parents or someone who may be judgemental of her. She tells Anna, who looks worried, “Don’t worry. All your information in the digital 
system is password protected, so no one else can access it.”
During counselling, the health worker, Maria, interviews Anna using the home, education, activities/employment, drugs, suicidality and sex (HEADSS) assessment. This sheds light 
on the fact that Anna lives alone, has a boyfriend, and that she is sexually active. She also explains that she has had other boyfriends. Anna makes Maria promise that she will not discuss 
any of this with her parents. On further probing, Anna tells Maria that she has come for advice as the condom slipped while having sex the previous night. Maria enquires whether she 
has any history of abnormal vaginal discharge. With Anna’s consent, Maria conducts a physical examination. Maria checks Anna’s body mass index (BMI), blood pressure, and abdomen 
for tenderness.
Maria tells Anna about the emergency contraceptive pill and that she should take it as soon as possible, preferably within 72 hours of the incident. However, she also explains that 
sometimes this may not work, so she would have to check for pregnancy if she misses her period. She discusses other contraceptive methods for long-term use. Anna wants to know 
whether the three-monthly hormone injection could be a good choice or the copper IUD. Maria explain to Anna that due to her age and the higher dose of hormone (progestogen) 
released in the intramuscular injectable, using the injectable for a longer period of time (e.g. two years or more) may lower her bone density. Again, as she has had many partners before 
(which Maria learnt during the HEADSS assessment), she is also prone to sexually transmitted infections (STIs).
Maria explains that combined oral contraceptive pills (COCs) along with condoms – dual protection – is a good choice for protecting her from both pregnancy and STIs. She provides 
Anna with three months’ worth of COCs, and then Maria schedules a follow-up visit after three months to check whether Anna remains comfortable using COCs or whether she would 
prefer a different method. Anna receives an SMS reminding her of her next visit.
Corresponding 
business processes 
(see Component 4)
This scenario refers to the following business processes:
	» Registration
	» Family planning counselling
	» Family planning service provision.
recommendations
personas
indicators
workflows
data
decisions
requirements
scenarios
User scenarios
3.3 	How to interpret user scenarios for functional requirements
User scenarios are helpful tools not only to better understand the context in which a digital tool would operate, but also for some insights into what key 
data elements would need to be recorded and accounted for in the database. Additionally, the context in which the tool would operate, illuminated by 
the user scenarios, provides insight into some functional and non-functional requirements that the system would also need. For example, highlighted 
in yellow are some key data elements that need to be recorded and/or calculated. Highlighted in blue is some decision-support logic that can be 
automated in the system. Highlighted in green are some key functional and non-functional requirements that should be included in the system, and 
bolded are some adolescent-specific considerations that should be accounted for.
For example, the interpretation of the user scenario for an adolescent is shown in Table 4.
Table 4. Interpretation of the adolescent user scenario
Data elements to be collected
Decision logic to be embedded
Functional and non-functional 
requirements
Adolescent-specific considerations that 
should be triggered if the client’s entered 
age is 19 years or younger
	» Date of birth
	» Age
	» New client or returning client
	» Marital status
	» Last menstrual period
	» Risk factors
	» Height
	» Weight
	» Calculation of age based on date of 
birth
	» Decision logic to trigger certain 
pop-ups and reminders based on the 
client’s age 
	» Calculation of BMI based on weight 
and height
	» Password protection
	» User management (login system)
	» Pop-up messages (so-called ‘toaster 
messages’and reminders
	» Information icon for more detailed 
information and guidance
	» Recording data for later use 
	» Home, education, activities/employment, 
drugs, suicidality and sex (HEADSS) assessment 
guidance
HPV: human papillomavirus.
