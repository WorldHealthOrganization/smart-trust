---
doc_id: 10665-341997
doc_title: "Digital adaptation kit: family planning: operational requirements for implementing WHO recommendations in digital systems"
section_id: sec-011-5-core-data-elements
section_title: "Core data elements"
section_number: 5
pages: 59-66
source_pdf: 10665-341997.pdf
source_sha256: 31e381afabc25132
toc_source: outline
---
Table 7 provides a simplified list of core data elements and is merely a snapshot of the comprehensive data dictionary found in Web Annex A. As with 
the workflows, we view this data dictionary as 80% generic, with the expectation that the other 20% will be supplemented and modified through country 
adaptation.
Core data 
elements
Component
recommendations
personas
indicators
workflows
decisions
scenarios
requirements
data
Table 7. Workflow core data elements for identified business processes
Activity ID.  
Activity name
Data element 
ID
Data element name
Description and definition
Business process FP.A: Registration
FP.A1.  
Arrive at facility
N/A – No data is recorded during this activity
FP.A2.  
Gather client details
FP.A.DE1
Visit date
The date and time of the client’s visit
FP.A.DE2
Administrative Area
This should be a context-specific list of administrative areas – villages, districts, etc. to allow for grouping and 
flagging of client data to a particular facility's catchment area. 
FP.A.DE3-6
Referral 
If client was referred for care
FP.A.DE7
Unique identification
Unique identifier generated for new clients or a universal ID, if used in the country
FP.A.DE8
First name
Client’s first name
FP.A.DE9
Last name
Client’s family name or last name
FP.A.DE10
Date of birth 
The client’s date of birth (DOB), if known
FP.A.DE11-15
Age
Age (number of years) of the client calculated based on the DOB; if DOB is unknown, enter the client’s 
estimated age
FP.A.DE16-19
Sex
Sex of the client
FP.A.DE20
Address
Client's home address or address that the client is consenting to disclose
FP.A.DE21-32
Marital Status
Client’s current marital status 
FP.A.DE33-39
Co-habitants
Who the client lives with (e.g. parents, other family members, partner, friends, no one)
FP.A.DE40-45
Highest level of 
education achieved
The highest level of education the client has reached
FP.A.DE46-52
Occupation
The client's primary occupation
FP.A.DE53-55
Mobile phone number
Mobile phone number (and consent for being contacted)
FP.A.DE56-63
Communication 
preferences
How the client would like to receive family planning communications
FP.A.DE64-68
Payment 
How will the client pay for health services and commodities
FP.A3.  
Search for clients
N/A – No data is recorded during this activity, can be based off previous activity FP.A2.Gather client details
FP.A4.  
Match found
N/A – No data is recorded during this activity, can be based off previous activity FP.A2.Gather client details
FP.A5.  
Create client record
N/A – No data is recorded during this activity, can be based off previous activity FP.A2.Gather client details
recommendations
personas
indicators
workflows
decisions
scenarios
requirements
data
Activity ID.  
Activity name
Data element 
ID
Data element name
Description and definition
FP.A6.  
Validate client details
N/A – No data is recorded during this activity, can be based off previous activity FP.A2.Gather client details
FP.A7.  
Check in client
N/A – No data is recorded during this activity, can be based off previous activity FP.A2.Gather client details
Business process FP.B: Counselling
FP.B1.  
Determine reason for 
visit
FP.B.DE1-11
Reason for visit
Establish reason for visit
FP.B.DE12-15
Reason for stopping 
contraception or 
method
If stopping a method, the reason why
FP.B.DE16-19
Pregnancy intention
Client's intention or desire in the next year is either to become pregnant or to prevent a future pregnancy
FP.B2.  
Take vital signs
FP.B.DE20-22
Height/weight
Client’s current height in centimetres and weight in kilograms
FP.B.DE23-25
Blood pressure
Client's blood pressure, if possible, to be taken 
FP.B3.  
Capture or update client 
history
FP.B.DE26-29
Sexual history
If the client has been or is sexually active and days since unprotected sex
FP.B.DE30-35
Pregnancy history
The number of pregnancies (gravidity), current and past, regardless of pregnancy outcome, number of 
pregnancies reaching parity, and time postpartum 
FP.B.DE36-40
Breastfeeding status
The client’s breastfeeding status
FP.B.DE41-46
Miscarriage or abortion 
stage of pregnancy
If the woman recently had a miscarriage or abortion, stage of pregnancy when the abortion took place
FP.B.DE47-50
Start date of last normal 
menses
The date when the client had her first day of her last normal menses
FP.B.DE51-78
Method at intake
Family planning method the client reports currently using at intake
FP.B.DE79-82
Date method 
administered
Date of IUD insertion, implant, injection, or sterilization—as appropriate
FP.B.DE83-104
Reason for no 
contraceptive method
If client is not currently using a method, the reason should be recorded
FP.B.DE105-132
Methods previously 
used
Record all the contraceptive methods the client has a history of using
FP.B4.  
Conduct risk assessment
FP.B.DE133-148
STI risk assessment 
Whether or not an assessment was conducted to determine if the client is at high risk of sexually transmitted 
infections (STIs)
See decision-support tables in Component 6 and Web Annex C.
FP.B6.  
Discuss issues and 
concerns
FP.B.DE149-208
Issues and concerns
Side-effects or symptoms with current method, administration, missed pills and late injections
recommendations
personas
indicators
workflows
decisions
scenarios
requirements
data
Activity ID.  
Activity name
Data element 
ID
Data element name
Description and definition
FP.B7.  
Keep method?
FP.B.DE209-214
Keep method?
Whether client wants to continue with current method OR stop using current method AND/OR switch method, 
and if resupply or procedure needed
FP.B8.  
Provide reinforcing 
messages
See decision-support tables in Component 6 and Web Annex C.
FP.B11.1.  
Method in mind
FP.B.DE215
Method in mind
Whether the client has a method in mind coming into the visit 
FP.B11.3.  
Select methods of 
interest
FP.B.DE216-241
Method requested
The first pick of method desired by the client, prior to medical eligibility tests. This may be the method in 
mind, or the method selected after discussing the full range of methods.
FP.B11.4  
Screen for medical 
eligibility
FP.B.DE242-254
Current medications
Medications the client is currently taking
FP.B.DE255-410
Health condition(s)
Health conditions that are relevant to determining medical eligibility for contraceptive methods,
FP.B.DE411-420
Medical eligibility 
category
System-generated medical eligibility value for numerical ratings based on medical eligibility criteria (MEC) 
decision-support logic
FP.B.DE421-428
Client preferences and 
considerations
Client preferences based on values and preferences
FP.B11.6  
Choose method
FP.B.DE429-450
Chosen method
The client’s chosen method given the discussion of methods and options with the health worker as well as the 
client’s medical eligibility for requested methods
FP.B12  
Check stock
N/A – No data is recorded during this activity; this is be recorded under service provision if stock-out is a reason why method was not provided
FP.B13  
Validate details
N/A – No data is recorded during this activity
FP.B14  
Determine where service 
can be provided
FP.B.DE451-454
Where method will be 
provided
Where the client will be receiving the method – this depends on the available stock and the skill of the health 
worker present
Business process FP.C: Service provision
FP.C1.  
Review client record
N/A – No data is recorded during this activity
FP.C2.  
Chosen method
N/A – No data is recorded during this activity, based on output from Workflow B: Counselling
FP.C3–5  
Pregnancy diagnosis
FP.C.DE1-8
Reasonably certain a 
woman is not pregnant
Given the answers from the client on the pregnancy checklist, are you able to determine that the client is not 
pregnant with reasonable certainty?
FP.C.DE9-11
Pregnancy test result
Result of a pregnancy test
recommendations
personas
indicators
workflows
decisions
scenarios
requirements
data
Activity ID.  
Activity name
Data element 
ID
Data element name
Description and definition
FP.C6.  
Get informed consent
FP.C.DE12
Informed consent
Does the client give informed consent to receiving the services? 
FP.C7.  
Perform exams and tests
FP.C.DE13-16
Exams and tests 
performed
Whether a pelvic/genital examination and STI/HIV laboratory tests were conducted, if needed
FP.C9.  
Provide method
FP.C.DE17-46
Method or service 
provided
Contraceptive method that was provided to the client; including supplies, and whether she was told/shown 
how to use the method?
FP.C.DE47-53
Reason for no method 
at exit
Reason for no contraceptive method use reported at exit (as the client leaves the health service provider)
FP.C.DE54-59
Reason client did not 
receive chosen method
If the client had a chosen method, but was not able to receive that chosen method, the reason should be 
documented here
FP.C10.  
Discuss dual protection 
and back-up method
FP.C.DE60-67
Back-up method 
needed
Whether a back-up method is advised given client history, choice of primary method and start date of primary 
method
FP.C11. 
Discuss any questions 
with client
N/A – No data is recorded during this activity
FP.C12.  
Determine follow-up 
requirements
FP.C.DE68
Follow-up 
recommended
Whether a follow-up appointment is recommended 
FP.C13.  
Determine follow-up 
requirements
FP.C.DE69
Recommended follow-
up date
Date when follow up is recommended based on follow-up requirements
Business process FP.D: Referral 
FP.D1.  
Emergency referral? 
Emergency referral 
Whether the referral is for urgent care 
FP.D2.  
Emergency referral
N/A – No data is recorded during this activity
FP.D3.  
Identify and discuss 
referral local and 
options
N/A – No data is recorded during this activity
FP.D4.  
Contact referral facility
N/A – No data is recorded during this activity
FP.D5.  
Can facility 
accommodate?
N/A – No data is recorded during this activity
recommendations
personas
indicators
workflows
decisions
scenarios
requirements
data
Activity ID.  
Activity name
Data element 
ID
Data element name
Description and definition
FP.D6.  
Provide information to 
referral facility 
FP.D.DE2-5
Reason for referral 
Reason why the client is being referred; if diagnosed, this may include the diagnosis 
FP.D.DE6-8
Date of scheduled 
referral and location
When the referral is scheduled and where the client is being referred to 
FP.D.DE9-11
Provider who made 
referral 
The name of the provider who made the referral 
FP.D.DE12-13
Referral notes 
Any additional relevant details of clinical significance for the referral facility to provide continuity of care 
FP.D7.  
Discuss any questions 
with client
N/A – No data is recorded during this activity
FP.D8.  
Provide back-up method
N/A – No data is recorded during this activity
FP.D9.  
Receives client
N/A – No data is recorded during this activity
5.2 List of calculated data elements
The section above outlines the core data elements that should be included within digital systems to facilitate the decision-support logic or indicators. 
There are additional derived data elements that are based on calculations from core data elements.
Table 8. Calculated data elements
Calculated data element label
Core data elements used for calculation  
(i.e. the variables)
Calculation
Body mass index (BMI)
Body weight
Height
“Body weight (kg)”/[(“Height (cm)”/100)^2]
Postpartum
Date of delivery
Visit date
IF “Visit date” – “Date of delivery” ≤ 6 weeks, THEN “Postpartum” = TRUE
Recent miscarriage or abortion
Date of miscarriage or abortion
Visit date
IF “Visit date” – “Date of miscarriage or abortion” ≤ 4 weeks, THEN “Recent miscarriage 
or post-abortion” = TRUE
recommendations
personas
indicators
workflows
decisions
scenarios
requirements
data
5.3 Additional considerations for adapting the data dictionary
Some settings may require the inclusion of additional data elements into the full data set or changes to response options based on contextual 
differences. Additionally, the transition from paper-based forms to digital systems may require some reflection on whether data elements currently on the 
paper forms should be incorporated into the digital system. Table 9 is an initial list of considerations anticipated for each implementation to review and 
customize based on the national guidelines and local context.
Table 9. Characteristics for local customization and configuration
Points of customization 
and configuration
Description
Unique ID 
Unique ID of the client can be based on a national unique ID, a national health ID, biometrics, a system-generated unique ID or something else.
Services provided
Services provided at the facility. These workflows primarily focus on family planning services. However, other services and linkages to them likely need to be 
included as well, e.g. STI testing, antenatal care, postnatal care. 
Counselling provided
Beyond the counselling provided for family planning services, there might be other counselling mechanisms that are built in. This could include, but is not 
limited to, other reproductive health counselling, nutrition counselling and HIV counselling. In some contexts, counselling for family planning is also conducted 
in a group setting. This would also affect the workflows that should be considered in the digital tracking and decision-support system. 
Methods provided
List of methods available in the country, with further customization of list of methods available at the facility.
Facility ID 
Unique ID of the facility. A reference to a facility registry or a reporting system (e.g. DHIS2) should be included where possible. 
Facility name
Name of the different health-care facilities, based on a facility registry or a reporting system (e.g. DHIS2), should be included where possible.
Ownership
Denoting whether the facility is public or private, where relevant.
Type of health-care facility
Type of facility, based on country terminology (e.g. health centre, health post, dispensary, hospital).
GPS coordinates
Latitude and longitude coordinates can be included if relevant for mapping purposes. This can be helpful, especially in the context of community health 
workers who could be given family planning tasks based on their catchment area and client’s visit history.
Administrative areas
Administrative areas can be based on geographic location, catchment area or another mechanism the country uses for managing health-care facilities.
Catchment population
If known, the catchment population would be useful to include in automated calculation of indicators.
Lab tests available
Whether or not certain lab tests (e.g. haemoglobin tests, STI/HIV screening, blood pressure measurement, other rapid diagnostic tests) were available at the 
health-care facility could impact the health worker’s workflow as well as the client’s family planning service experience.
Sensitivity of pregnancy test
Depending on the pregnancy tests that are procured at the national level and those that are available at the health-care facility, the sensitivity of the pregnancy 
test could affect the follow-up scheduling and workflow. The guidance provided regarding sensitivity of pregnancy test is as follows.
While determining if a woman is not pregnant: “if using a highly sensitive pregnancy test (e.g. 25 mIU/ml) and it is negative, provide her desired method. If 
using a test with lower sensitivity (e.g. 50 mIU/ml) and it is negative during the time of her missed period, wait until at least 10 days after expected date of 
menses and repeat the test. Advise the woman to use condoms or abstain in the meantime. If the test is still negative, provide her desired method. If test 
sensitivity is not specified, assume lower sensitivity” (14).
recommendations
personas
indicators
workflows
data
scenarios
requirements
decisions
The decision-support logic component of the DAK provides the decision logic and algorithms, as well as the scheduling of services, in accordance with 
WHO guidelines. In this DAK, the decision logic and algorithms deconstruct the recommendations within the family planning guidelines and guidance 
into a format that clearly labels the inputs and outputs that would be operationalized in a digital decision-support system.
