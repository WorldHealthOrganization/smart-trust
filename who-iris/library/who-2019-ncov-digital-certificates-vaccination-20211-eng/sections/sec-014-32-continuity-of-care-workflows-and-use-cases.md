---
doc_id: who-2019-ncov-digital-certificates-vaccination-20211-eng
doc_title: "DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021 SECTION 1"
section_id: sec-014-32-continuity-of-care-workflows-and-use-cases
section_title: "Continuity of Care workflows and use cases"
section_number: 3.2
pages: 35-41
source_pdf: WHO-2019-nCoV-Digital-certificates-vaccination-2021.1-eng.pdf
source_sha256: f57b14cb2acb728d
toc_source: inferred
---
The Continuity of Care scenario is summarized in Fig. 3. The workflow’s actors and settings, and its 
related high-level requirements, may be described as follows.
1.	 A Subject of Care presents at a care site. The identity of the Subject of Care is established as per 
Member State processes and norms. The Subject of Care MAY present an existing DDCC:VS card to 
inform the care delivery process. The Vaccinator MAY retrieve existing health history data about 
the Subject of Care if authorized to do so.
2.	 A Vaccinator administers a COVID-19 vaccination.
3.	 Elements of the DDCC:VS core data set content SHALL be entered onto the DDCC:VS paper card, 
which SHALL have an HCID. The DDCC:VS paper card SHALL be provided to the DDCC:VS Holder at 
Point A. The HCID SHALL be used to establish a globally unique identifier (ID) for the DDCC:VS or to 
reference the ID of a previously established DDCC:VS.
4.	 The care site MAY have a local Digital Health Solution with data entered at the point of care. If so, 
the Vaccinator and/or Data Entry Personnel directly record details of the vaccination event, which 
SHALL be persisted based on the DDCC:VS core data set.
5.	 The care site MAY have a local Digital Health Solution with data entered after the vaccine 
administration event. If so, Data Entry Personnel can record details of the vaccination event, which 
SHALL be persisted according to the DDCC:VS core data set.
If a Digital Health Solution does not exist at the care site, details of the vaccination event SHALL be 
recorded and persisted in a paper record (e.g. immunization registry book), according to the required 
DDCC:VS core data set. Details of the vaccination event can then be electronically recorded into a 
Digital Health Solution available at another site, by Data Entry Personnel. 
Health data captured during the vaccination event SHALL be recorded as coded content using the FHIR 
standard. If the data represent a subsequent vaccination event (e.g. second dose), this content SHALL 
be added as another event to the Subject of Care’s existing FHIR composition. 
Once the DDCC:VS content is digitally recorded and persisted, either by the Vaccinator or Data Entry 
Personnel at the point of care or after the vaccination has been administered, and the DDCC:VS has 
been digitally signed using PKI technology and created by the DDCC Generation Service, the record of 
the vaccination event is available in a digital format, as a DDCC:VS, to the DDCC:VS Holder at Point B. 
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Page
19
SECTION 3
Continuity of Care scenario
Figure 3
Continuity of Care scenario1
The vaccine is administered, the core data set is recorded on the DDCC paper certificate, and the 
record is then made available in digital form. 
Subject of Care
Vaccinator
Data Entry Personnel
DDCC Holder
(1) 
Arrives at 
the care 
site
(2) 
Vaccinates 
the Subject 
of Care
(3) 
Records 
core data 
set data 
elements 
on paper 
certificate
(4) 
Records 
core data 
set data 
elements 
in a Digital 
Health 
Solution
(5) 
Records 
core data 
set data 
elements 
in a Digital 
Health 
Solution
POINT A: 
Receives 
paper 
record of 
DDCC:VS
POINT B: 
Record of 
vaccination 
status is 
available 
in a digital 
form
Start
End
Is there 
a Digital 
Health 
Solution at 
the care 
site? 
Does the 
care site 
have Internet 
connectivity? 
No
No
Yes
Yes
1	 The business process symbols used in the workflows are explained in Annex 2.
Page
20
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Continuity of Care scenario
SECTION 3
3.2.1.	Continuity of Care use cases
Navigating through the workflow diagram shown in Fig. 3, there are three pathways for the Continuity 
of Care scenario, which are illustrated through the three workflow navigation paths in Fig. 4, Fig. 5 
and Fig. 6. These three different pathways can be described as use cases, as outlined in Table 4. 
Table 4
Continuity of Care use cases
Use case ID
UC001
UC002
UC003 
Use case name
Paper First
Offline Digital
Online Digital
Figure
Figure 4
Figure 5
Figure 6
Use case description 
A guideline-based vaccine 
administration is recorded on 
paper. After the vaccination 
event, data about it can be 
entered into a Digital Health 
Solution.
A guideline-based vaccine 
administration is recorded 
using an offline secure 
Digital Health Solution, 
with the content uploaded, 
subsequently, to an online 
Digital Health Solution.
A guideline-based vaccine 
administration is recorded 
using an online secure Digital 
Health Solution that updates 
the content in real time.
Time between receipt of DDCC:VS 
paper card (Point A in Fig. 3) and 
record of vaccination status being 
available in a digital form (Point B 
in Fig. 3)
Time delay until digital format 
is available.
Time delay until digital format 
is available.
No delay if digital system is 
available.
Recording of vaccination event
Vaccination event data are 
recorded in paper register 
and/or patient file.
Some steps are executed in 
the Digital Health Solution, 
rather than in the paper 
immunization register or 
patient file.
Some steps are executed in 
the Digital Health Solution 
rather than in the paper 
immunization register or 
patient file.
Barcode generation for DDCC:VS 
paper card given at care site
Relies on the HCID barcode 
being pre-printed on the card 
or pre-printed on a sticker to 
affix to the paper card.
HCID barcode must be pre-
printed on the card or pre-
printed on a sticker to affix to 
the paper card.
It is possible to print the HCID 
barcode on the DDCC:VS card 
at the time of the vaccination 
event.
Method for adding the DDCC:VS 
core data set content to the paper 
card during the care visit
Content other than the HCID 
barcode is expected to be 
handwritten.
If a printer is available, it is 
possible to print the core data 
set content onto the card; 
or else the content can be 
handwritten.
If a printer is available, it is 
possible to print the core data 
set content onto the card; 
or else the content can be 
handwritten.
DDCC:VS: Digital Documentation of COVID-19 Certificates: Vaccination Status; HCID: health certificate identifier; ID: identifier.
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Page
21
SECTION 3
Continuity of Care scenario
Figure 4 
Continuity of Care scenario: Paper First use case (UC001)1
The vaccine is administered, the core data set is recorded on the DDCC paper certificate, and the 
record is then made available in digital form. 
Subject of Care
Vaccinator
Data Entry Personnel
DDCC Holder
(1) 
Arrives at 
the care 
site
(2) 
Vaccinates 
the Subject 
of Care
(3) 
Records 
core data 
set data 
elements 
on paper 
certificate
(4) 
Records 
core data 
set data 
elements 
in a Digital 
Health 
Solution
(5) 
Records 
core data 
set data 
elements 
in a Digital 
Health 
Solution
POINT A: 
Receives 
paper 
record of 
DDCC:VS
POINT B: 
Record of 
vaccination 
status is 
available 
in a digital 
form
Start
End
Is there 
a Digital 
Health 
Solution at 
the care 
site? 
Does the 
care site 
have Internet 
connectivity? 
No
No
Yes
Yes
1	 The business process symbols used in the workflows are explained in Annex 2.
Page
22
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Continuity of Care scenario
SECTION 3
Figure 5
Continuity of Care scenario: Offline Digital use case (UC002)1
The vaccine is administered, the core data set is recorded on the DDCC paper certificate, and the 
record is then made available in digital form. 
Subject of Care
Vaccinator
Data Entry Personnel
DDCC Holder
(1) 
Arrives at 
the care 
site
(2) 
Vaccinates 
the Subject 
of Care
(3) 
Records 
core data 
set data 
elements 
on paper 
certificate
(4) 
Records 
core data 
set data 
elements 
in a Digital 
Health 
Solution
(5) 
Records 
core data 
set data 
elements 
in a Digital 
Health 
Solution
POINT A: 
Receives 
paper 
record of 
DDCC:VS
POINT B: 
Record of 
vaccination 
status is 
available 
in a digital 
form
Start
End
Is there 
a Digital 
Health 
Solution at 
the care 
site? 
Does the 
care site 
have Internet 
connectivity? 
No
No
Yes
Yes
1	 The business process symbols used in the workflows are explained in Annex 2.
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Page
23
SECTION 3
Continuity of Care scenario
Figure 6
Continuity of Care scenario: Online Digital use case (UC003)1
The vaccine is administered, the core data set is recorded on the DDCC paper certificate, and the 
record is then made available in digital form. 
Subject of Care
Vaccinator
Data Entry Personnel
DDCC Holder
(1) 
Arrives at 
the care 
site
(2) 
Vaccinates 
the Subject 
of Care
(3) 
Records 
core data 
set data 
elements 
on paper 
certificate
(4) 
Records 
core data 
set data 
elements 
in a Digital 
Health 
Solution
(5) 
Records 
core data 
set data 
elements 
in a Digital 
Health 
Solution
POINT A: 
Receives 
paper 
record of 
DDCC:VS
POINT B: 
Record of 
vaccination 
status is 
available 
in a digital 
form
Start
End
Is there 
a Digital 
Health 
Solution at 
the care 
site? 
Does the 
care site 
have Internet 
connectivity? 
No
No
Yes
Yes
1	 The business process symbols used in the workflows are explained in Annex 2.
Page
24
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Continuity of Care scenario
SECTION 3
3.2.2.	Operationalizing the Continuity of Care use cases
In order to operationalize the Continuity of Care use cases, as the specification is intended to 
be implementable, an HL7 FHIR implementation guide has been created (available at:
https://WorldHealthOrganization.github.io/ddcc). HL7 FHIR is a free and open data exchange 
standard that can be used to establish interoperability across systems. The implementation guide 
is to ensure that data for the DDCC:VS is captured in a consistent and interoperable way. The HL7 
FHIR implementation guide for DDCC:VS contains a standards-compliant specification that explicitly 
encodes computer-interoperable logic, including data models, terminologies and logic expressions, in a 
computable language sufficient for implementation of the Continuity of Care use cases.
