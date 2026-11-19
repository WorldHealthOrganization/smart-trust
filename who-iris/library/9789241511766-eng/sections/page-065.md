---
doc_id: 9789241511766-eng
doc_title: "9789241511766-eng"
section_id: page-065
section_title: "Page 65"
pages: 65-65
pdf_page: 65
source_pdf: 9789241511766-eng.pdf
source_sha256: 934bdf1193c16ee5
text_source: embedded
granularity: page
---
55
Functionality
In this section we discuss how to assess the functionality of technical systems.
Before launching any digital health system, extensive testing should first be carried out to ensure that the system is 
operating as intended and is free of bugs. A logical place to start is by defining what it means to be “operating as intended”. 
If the system has an SMS application, use this as the starting point to create a guided testing document, also referred to 
as QA test cases (see Part 3b). Based on findings from usage of these QA test cases, an iterative process of feedback to 
developers, additional development and re-testing will likely be necessary before arriving at a “final” or field-ready system 
that contains the necessary ingredients to deliver the intended intervention. Both front-end (user) and back-end (data and 
process) systems need to be tested to ensure adequate system functionality. 
What to monitor: Depending on the type of application and system that has been developed, first consider 
testing and providing feedback on skip patterns, validation checks, form schedules, form content, user interface 
(UI) design, data export functionality, data accuracy and dashboard calculations. Flow diagrams developed for the 
SRS will be useful in testing skip patterns, validation checks and form schedules, while mock-ups of application 
interfaces can be useful in providing feedback on UIs and in-application functionality and flow. The key questions to ask are:
■
■
Does the system meet the requirements outlined in the SRS?
■
■
Does the system meet the needs of the health intervention?
How to monitor: As shown using an example in Table 3.2, QA test cases can help coordinate the testing 
process between developers, project managers and field staff, outlining what is expected to occur (e.g. 
“New Woman Registration Form v1.0” is launched) when the user does a specific action (e.g. user clicks “Add 
new woman” button), and systematically recording the test case’s status (pass or fail) on whether or not the 
expected outcome actually occurs (e.g. Fail: user clicks “Add new woman” button and system launches “New Child Form v2.0”). 
Creating these QA test cases in advance for all functions of the system or application helps ensure that no blocks of functionally 
are accidentally left out during this important testing phase.
Table 3.2. Example QA test cases for two functions
Test case
Scenario
Expected output
Actual output
Status
New woman 
(client) is found 
by health worker 
Health worker user 
clicks “Add new woman” 
button
New Woman Registration Form 
(v1.0) is launched
New Child Form (v2.0) is launched
Fail
Polio-1 vaccine 
given
Health worker user 
clicks “Administered 
Polio-1 vaccine”
■
■Polio-1 vaccine displays as 
“given” with date given
■
■Polio-2 vaccine is scheduled 
at polio-1 date + 4 weeks
■
■Polio-1 vaccine displays as 
“given” with date given
■
■Polio-2 vaccine is scheduled at 
polio-1 date + 4 weeks
Pass
Who will monitor: Successful functionality monitoring will depend on having the human resources available 
to assign to this task, and this will be partially dictated by the intervention’s stage of maturity. In early stages, 
the project manager may conduct the bulk of this monitoring, whereas in later maturity stages he or she may 
be able to delegate this task to other staff members who are familiar with the expected functionality of the 
system and comfortable using the QA test cases. Individuals with a strong field presence, such as field supervisors, may test the 
content of the intervention for accuracy, including skip patterns and logic, SMS content or schedules.
When to monitor: The first push towards system finalization, comprising iterative feedback and 
development loops between the testing team and developers, should be completed before the launch, 
always keeping in mind that it is usually easier to make changes to a digital health system before it goes live. 
Continued functionality monitoring, under the umbrella of fidelity monitoring, should continue even after a 
system is deemed functional and launched, especially during the first weeks and months of implementation, as problems 
may arise in real-world usage that didn’t surface during desk-based or preliminary testing.
C H A P T E R 3 : M O N I T O R I N G D I G I T A L H E A L T H I N T E R V E N T I O N S
