---
doc_id: who-2019-ncov-digital-certificates-vaccination-20211-eng
doc_title: "DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021 SECTION 1"
section_id: sec-015-33-functional-requirements-for-continuity-of-car
section_title: "Functional requirements for Continuity of Care scenario"
section_number: 3.3
pages: 41-44
source_pdf: WHO-2019-nCoV-Digital-certificates-vaccination-2021.1-eng.pdf
source_sha256: f57b14cb2acb728d
toc_source: inferred
---
scenario
High-level functional requirements for the elements described in Fig. 3 are presented in Table 5 as 
suggested features that any digital solutions that would facilitate DDCC:VS issue or usage may have. 
These are written as guidance requirements only, to be used as a starting point for Member States or 
other interested parties who need to develop their own specifications for a DDCC:VS to take and adapt.
Non-functional requirements are applicable to both scenarios of use (Continuity of Care and Proof of 
Vaccination) and are included in Annex 5.
Table 5
Functional requirements for the Continuity of Care scenario1 
Requirement ID
Functional requirement
UC001
Paper First
UC002
Offline Digital
UC003 
Online Digital
 DDCC.FXNREQ.001
It SHALL be possible for the Vaccinator to identify the 
Subject of Care as per the norms and policies of the PHA 
under whose authority the vaccination is administered.
 DDCC.FXNREQ.002
It SHOULD be possible to verify the identity of the Subject 
of Care against existing records, if such a check is mandated 
by local procedures, and to retrieve any pertinent health 
history.
 DDCC.FXNREQ.003
It SHALL be possible to register a new Subject of Care if the 
person is presenting for the first time.
 DDCC.FXNREQ.004
It SHALL be possible to issue a new paper card to the 
Subject of Care for the purpose of recording the vaccination.
 DDCC.FXNREQ.005
It SHALL be possible to update an existing paper card held 
by the Subject of Care if the card is presented during the 
vaccination and there is space available on the card.
 DDCC.FXNREQ.006
Where paper cards are used, a PHA SHALL put in place a 
process to replace lost or damaged cards with the necessary 
supporting technology.
 DDCC.FXNREQ.007
It SHALL be possible to associate a globally unique HCID 
with a paper vaccination card recording each vaccination 
administered to the Subject of Care.
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Page
25
SECTION 3
Continuity of Care scenario
Requirement ID
Functional requirement
UC001
Paper First
UC002
Offline Digital
UC003 
Online Digital
 DDCC.FXNREQ.008
It SHALL be possible to enter or attach the HCID as a 1D 
barcode to any paper vaccination card issued to the Subject 
of Care (or the HCID card holder).
 DDCC.FXNREQ.009
It SHOULD be possible to prepare pre-printed cards with a 
previously generated HCID that is encoded in (at minimum) 
a 1D barcode. 
 DDCC.FXNREQ.010
It SHALL be possible to record the core data set content on a 
paper vaccination card issued to the Subject of Care (or the 
DDCC:VS card holder).
 DDCC.FXNREQ.011
It SHALL be possible to manually sign the paper card and 
include the official stamp of the administering centre as a 
non-digital means of certifying that the content has been 
recorded by an approved authority.
 DDCC.FXNREQ.012
The data concerning the vaccination (at minimum, the HCID 
and the core data set content) SHOULD be entered into an 
electronic format as soon as reasonably possible after the 
vaccine is administered. This will most likely be into a Digital 
Health Solution, if one exists, at the point of care.
 DDCC.FXNREQ.013
It SHALL be possible to retrieve information about the 
vaccination(s) administered to the Subject of Care from the 
content in the DDCC:VS.
 DDCC.FXNREQ.014
All data concerning the vaccination SHALL be handled in 
a secure manner to respect confidentiality between the 
health worker and Subject of Care.
 DDCC.FXNREQ.015
Digital technology SHALL NOT be needed for any aspect of 
paper card issue/update – the process SHALL function in an 
entirely offline and non-electronic manner.
 DDCC.FXNREQ.016
Paper cards and the validation markings they bear SHALL be 
designed to combat fraud and misuse.
 DDCC.FXNREQ.017
Where an offline (disconnected) Digital Health Solution 
exists, the Data Entry Personnel SHALL securely log in to 
record all pertinent information about the vaccination.
 DDCC.FXNREQ.018
Any offline Digital Health Solution for vaccination 
registration SHALL include required content defined in the 
DDCC:VS core data set.
 DDCC.FXNREQ.019
Any offline Digital Health Solution for vaccination 
registration SHOULD be designed for quality data capture, 
including enforcement of data validation rules at the point 
of data entry.
 DDCC.FXNREQ.020
If patients’ records are held in an offline Digital Health 
Solution available at the time of vaccination, then it 
SHOULD be possible for an authorized user to view the 
record for the Subject of Care, including pertinent medical 
history, per PHA policies.
 DDCC.FXNREQ.021
If an offline Digital Health Solution for vaccination 
registration is available, then it SHOULD be possible 
to search, list, filter, reorder and export the history of 
vaccinations administered.
 DDCC.FXNREQ.022
If an offline Digital Health Solution for vaccination 
registration is available, then it MAY be possible to schedule 
a regular, recurring export/dispatch of data, based on 
availability of a connection, to send them to another public 
health record system.
 DDCC.FXNREQ.023
If an offline Digital Health Solution for vaccination registration 
is available, then it SHALL validate that HCIDs entered are 
confirmed to be unique, based on its own data set.
Page
26
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Continuity of Care scenario
SECTION 3
Requirement ID
Functional requirement
UC001
Paper First
UC002
Offline Digital
UC003 
Online Digital
 DDCC.FXNREQ.024
If an offline Digital Health Solution for vaccination 
registration is available, then it MAY be responsible for 
outputting the vaccination data using the FHIR standard.
 DDCC.FXNREQ.025
If an offline Digital Health Solution for vaccine registration 
is available, and is part of the national PKI trust framework, 
and is authorized by the PHA to sign vaccination content as 
a DDCC:VS, then it SHALL register the DDCC:VS through the 
DDCC:VS Registry Service. 
 DDCC.FXNREQ.026
For each care delivery session, the facility, organization 
and care delivery health worker context of the vaccine 
administration event SHALL be established.
 DDCC.FXNREQ.027
If an online/connected public health DDCC:VS Generation 
Service is available at the time of vaccination, then it SHALL 
be possible to register the vaccination as soon as possible 
after it is administered.
 DDCC.FXNREQ.028
The DDCC:VS Generation Service involved in the vaccination 
SHALL ensure encryption of data, in transit and at rest, to 
provide end-to-end security of personal data.
 DDCC.FXNREQ.029
The DDCC:VS Generation Service MAY be the agent 
responsible for issuing the HCID, provided that the HCID can 
be associated at the time of vaccination in a timely manner. 
If the DDCC:VS Generation Service is responsible for issuing 
HCIDs, it SHALL only issue unique HCIDs, i.e. the same HCID 
should never appear on two different paper vaccination 
cards. 
 DDCC.FXNREQ.030
If pre-generated HCIDs and pre-printed vaccination 
cards are used, the generation of the HCIDs, along with 
any supporting technology to ensure HCIDs will not be 
duplicated within or across care sites, SHALL be managed by 
PHA policy. 
 DDCC.FXNREQ.031
It SHALL be possible for the DDCC:VS Generation Service to 
accept data from an authorized, connected point-of-care 
system, where such a system exists, i.e. to be able to accept 
data transferred from local data stores at sites where 
vaccinations are administered.
 DDCC.FXNREQ.032
It SHALL be possible for the DDCC:VS Generation Service to 
represent vaccination data using the FHIR format.
 DDCC.FXNREQ.033
It SHALL be possible for the DDCC:VS Generation Service to 
perform digital signing of vaccination data.
 DDCC.FXNREQ.034
It MAY be possible for the solution to generate a machine-
readable 2D barcode that, in addition to the HCID, contains 
further useful technical information, such as a web end--
point for validating the HCID, or a public key. 
 DDCC.FXNREQ.035
It MAY be possible for the DDCC:VS Generation Service 
to generate a 2D barcode that includes the unencrypted 
minimum core data set content (in FHIR standard) of the 
vaccination, thus providing a machine-readable version of 
the vaccination certificate.
DDCC.FXNREQ.036
The DDCC:VS Generation Service SHALL maintain a connection 
between an HCID, the vaccination data associated with it in 
a DDCC:VS, any 2D barcode generated from the data, and the 
private/public key used to sign the data.
 1D: one-dimensional; 2D: two-dimensional; DDCC: Digital Documentation of COVID-19 Certificates; DDCC:VS: Digital Documentation of 
COVID-19 Certificates: Vaccination Status; HCID: health certificate identifier; ID: identifier; PHA: public health authority.
1 The use case(s) to which each functional requirement applies are indicated with a 
.
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Page
27
SECTION 4
