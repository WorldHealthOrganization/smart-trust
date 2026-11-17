---
doc_id: who-2019-ncov-digital-certificates-vaccination-20211-eng
doc_title: "DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021 SECTION 1"
section_id: sec-018-42-proof-of-vaccination-workflows-and-use-cases
section_title: "Proof of Vaccination workflows and use cases"
section_number: 4.2
pages: 46-54
source_pdf: WHO-2019-nCoV-Digital-certificates-vaccination-2021.1-eng.pdf
source_sha256: f57b14cb2acb728d
toc_source: inferred
---
In order to sign a digital document, PKI technology is required. Each Member State would be 
responsible for managing its own PKI through its PHA or another national delegated authority. PKI is 
described in further detail in section 6 and Annex 4. This document assumes that a PKI has already 
been deployed or is available within a country to support the DDCC:VS workflows described in this 
section. This PKI supports the sharing of public keys that correspond to the private keys that have 
been used to cryptographically sign DDCC:VS and may support the sharing of public keys from trusted 
International PHAs so that signed DDCC:VS issued by these parties may be cryptographically verified.
Figure 7
The relationships between digital services for Proof of Vaccination 
Digital 
Health 
Solution
DDCC:VS 
Generation 
Service
DDCC:VS 
Repository
(optional)
DDCC:VS 
Registry 
Service
Status 
Checking 
Application 
(optional)
Submit vaccination 
event
HCID provided by existing National System or 
issued by DDCC:VS Generation Service 
Return 
DDCC:VS
Store DDCC:VS 
(optional)
Online 
status 
check
 (optional)
Register 
DDCC:VS
Online verification DDCC:VS 
(optional)
The digital services for Proof of Vaccination and the relationships between them are shown in Fig. 7.
Note the use of the HCID throughout these services. As the unique identifier included in a DDCC:VS, it can be provided by an existing 
national system, generated at the point of care or issued by DDCC:VS Generation Service (as illustrated in Figure 7). Subsequent vaccinations 
may also be added to the digital record associated to the HCID. HCID can allow verifiers to search for, and retrieve a DDCC:VS for the purposes 
of verification.
Page
30
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Proof of Vaccination scenario
SECTION 4
The verification of a claim of vaccination is illustrated in Fig. 8. The workflow’s actors and settings, 
and its related high-level requirements, may be described as follows.
1.	 A DDCC:VS Holder presents a DDCC:VS to a Verifier in support of a claim of vaccination status.
2.	 To verify the COVID-19 vaccination claim of a verifiable DDCC:VS Holder, there are four separate 
pathways (Manual Verification, Offline Cryptographic Verification, Online Status Check [national 
DDCC:VS] and Online Status Check [international DDCC:VS]) that a Verifier could take to check the 
COVID-19 vaccination claim at Point C, elaborated as Proof of Vaccination use cases in Table 8. A 
Verifier may visually verify a DDCC:VS, or scan a machine-readable version of the DDCC:VS’s HCID 
and use that when accessing a verification service or verify using a digitally signed, machine-
readable representation of the core data set content (e.g. as a 2D barcode). 
Note that, regardless of the use case, a DDCC:VS Generation Service is required. The DDCC:VS Registry 
Service is also required. However, the DDCC:VS Repository Service is optional depending on which 
use case is being implemented, but it is required for the online verification use cases. See Table 7 
for descriptions of the DDCC:VS services noted; the DDCC:VS Registry Service is not equivalent to a 
registry.
4.2.1.	Proof of Vaccination use cases
Navigating through the workflow diagram shown in Fig. 8, there are four possible verification 
pathways (illustrated separately in Fig. 9, Fig. 10, Fig. 11 and Fig. 12), which are the use cases of the 
Proof of Vaccination scenario listed in Table 8.
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Page
31
SECTION 4
Proof of Vaccination scenario
Figure 8
Proof of Vaccination scenario1
Verification of a claim of vaccination
DDCC Holder
Verifier
National PHA
International PHA
(3) 
Uses a 
Status 
Checking 
Application
Perform 
check 
online? 
Check with 
International 
PHA? 
(1) 
Presents 
DDCC:VS
(2) 
Receives 
claim of 
vaccination 
status
(4) 
Performs 
an online 
check with 
the National 
PHA DDCC 
Registry 
Service
(5) 
Performs an 
online check 
with the 
international 
PHA DDCC 
Registry 
Service
POINT C: 
Decision 
on the 
verification 
of claim of 
vaccination 
status
(6)
Communicates 
results back to 
the verifier
Start
End
Is 
cryptographic 
verification 
required?
Yes
No
No
No
Yes
Yes
DDCC:VS: Digital Documentation of COVID-19 Certificates: Vaccination Status; PHA: public health authority.
1	 The business process symbols used in the workflows are explained in Annex 2.
Page
32
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Proof of Vaccination scenario
SECTION 4
Table 8
Proof of Vaccination use cases
Use case ID
UC004
UC005
UC006
UC007 
Use case name
Manual Verification
Offline Cryptographic 
Verification
Online Status Check 
(National DDCC:VS)
Online Status Check (International 
DDCC:VS)
Figure
Figure 9
Figure 10
Figure 11
Figure 12
Use case 
description
A Verifier verifies 
a DDCC:VS using 
purely visual means, 
based on his or 
her subjective 
judgement, as is 
currently done 
with International 
Certificate of 
Vaccination or 
Prophylaxis. This 
type of check is 
currently well 
accepted, is quick 
and easy to do, and 
requires no digital 
technology.
A Verifier verifies 
a DDCC:VS using 
digital cryptographic 
processes in an offline 
mode.
This pathway is used 
when the DDCC:VS is 
being verified in the same 
jurisdiction as it was 
issued. A Verifier verifies 
a DDCC:VS using digital 
cryptographic processes 
in an online mode that 
includes a status check 
against the PHA’s DDCC:VS 
Registry Service and, 
optionally, the DDCC:VS 
Repository.
This pathway is used when the 
DDCC:VS is being verified in a 
foreign jurisdiction to where it 
was issued. A Verifier verifies an 
internationally issued DDCC:VS 
using digital cryptographic 
processes in an online mode that 
includes a status check against the 
National PHA’s DDCC:VS Registry 
Service, which in turn accesses 
an International PHA’s DDCC:VS 
Registry and DDCC:VS Repository, if 
such services exist and such access 
is authorized by the issuing PHA. 
It is assumed in this workflow that 
a Verifier does not directly access 
an International PHA’s DDCC:VS 
Registry or Repository Service. 
Connectivity 
required
Offline
Offline
Online
Online
Level of 
verification
	
→Verification 
is visually 
performed by 
the Verifier. As 
judgement can 
be subjective, it 
relies on policies 
to protect against 
discrimination.
	
→Can confirm that the 
HCID barcode on the 
paper card is valid 
and has not been 
altered. 
	
→Can confirm whether 
the DDCC:VS has 
been issued by an 
authorized PHA. 
	
→Can confirm that 
the hash of any 
signed 2D barcodes 
matches the health 
content represented 
therein.
	
→Can confirm that the 
HCID barcode on the 
paper card is valid and 
has not been altered.
	
→Can confirm whether the 
DDCC:VS has been issued 
by an authorized PHA. 
	
→If authorized to do so, 
can confirm that the 
content on a DDCC:VS 
paper card matches the 
DDCC:VS digital content.
	
→Can confirm that the 
hash of any signed 
2D barcodes matches 
the health content 
represented therein.
	
→Can check whether 
signed 2D barcodes 
containing DDCC:VS 
content have been 
revoked or updated.
	
→Can confirm that the HCID 
barcode on the paper card is valid 
and has not been altered. 
	
→Can confirm whether the DDCC:VS 
has been issued by an authorized 
International PHA. 
	
→If authorized to do so, can confirm 
that the content on a DDCC:VS 
paper card matches the DDCC:VS 
digital content.
	
→Can confirm that the hash of 
any signed 2D barcodes matches 
the health content represented 
therein.
	
→Can check whether signed 2D 
barcodes containing DDCC:VS 
content have been revoked or 
updated.
Verify whether 
the DDCC:VS 
has been 
revoked?
Not possible
Possible if a cache of 
revoked certificates 
is maintained by the 
Verifier
Possible
Possible 
DDCC:VS 
Registry 
Service
Not required
Required
Required
Required
DDCC:VS 
Repository
Optional
Optional
Required
Required
DDCC:VS: Digital Documentation of COVID-19 Certificates: Vaccination Status; HCID: health certificate identifier; ID: identifier; PHA: public 
health authority.
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Page
33
SECTION 4
Proof of Vaccination scenario
Figure 9
Proof of Vaccination scenario: Manual Verification use case (UC004)1
Verification of a claim of vaccination
DDCC Holder
Verifier
National PHA
International PHA
(3) 
Uses a 
Status 
Checking 
Application
Perform 
check 
online? 
Check with 
International 
PHA? 
(1) 
Presents 
DDCC:VS
(2) 
Receives 
claim of 
vaccination 
status
(4) 
Performs 
an online 
check with 
the National 
PHA DDCC 
Registry 
Service
(5) 
Performs an 
online check 
with the 
international 
PHA DDCC 
Registry 
Service
POINT C: 
Decision 
on the 
verification 
of claim of 
vaccination 
status
(6)
Communicates 
results back to 
the verifier
Start
End
Is 
cryptographic 
verification 
required?
Yes
No
No
No
Yes
Yes
DDCC:VS: Digital Documentation of COVID-19 Certificates: Vaccination Status; PHA: public health authority.
1	 The business process symbols used in the workflows are explained in Annex 2.
Page
34
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Proof of Vaccination scenario
SECTION 4
Figure 10
Proof of Vaccination scenario: Offline Cryptographic Verification use case 
(UC005)1
Verification of a claim of vaccination
DDCC Holder
Verifier
National PHA
International PHA
(3) 
Uses a 
Status 
Checking 
Application
Perform 
check 
online? 
Check with 
International 
PHA? 
(1) 
Presents 
DDCC:VS
(2) 
Receives 
claim of 
vaccination 
status
(4) 
Performs 
an online 
check with 
the National 
PHA DDCC 
Registry 
Service
(5) 
Performs an 
online check 
with the 
international 
PHA DDCC 
Registry 
Service
POINT C: 
Decision 
on the 
verification 
of claim of 
vaccination 
status
(6)
Communicates 
results back to 
the verifier
Start
End
Is 
cryptographic 
verification 
required?
Yes
No
No
No
Yes
Yes
DDCC:VS: Digital Documentation of COVID-19 Certificates: Vaccination Status; PHA: public health authority.
1	 The business process symbols used in the workflows are explained in Annex 2.
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Page
35
SECTION 4
Proof of Vaccination scenario
Figure 11
Proof of Vaccination scenario: Online Status Check (National DDCC:VS) use case 
(UC006)1
Verification of a claim of vaccination
DDCC Holder
Verifier
National PHA
International PHA
(3) 
Uses a 
Status 
Checking 
Application
Perform 
check 
online? 
Check with 
International 
PHA? 
(1) 
Presents 
DDCC:VS
(2) 
Receives 
claim of 
vaccination 
status
(4) 
Performs 
an online 
check with 
the National 
PHA DDCC 
Registry 
Service
(5) 
Performs an 
online check 
with the 
international 
PHA DDCC 
Registry 
Service
POINT C: 
Decision 
on the 
verification 
of claim of 
vaccination 
status
(6)
Communicates 
results back to 
the verifier
Start
End
Is 
cryptographic 
verification 
required?
Yes
No
No
No
Yes
Yes
DDCC:VS: Digital Documentation of COVID-19 Certificates: Vaccination Status; PHA: public health authority.
1	 The business process symbols used in the workflows are explained in Annex 2.
Page
36
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Proof of Vaccination scenario
SECTION 4
Figure 12
Proof of Vaccination scenario: Online Status Check (International DDCC:VS) 
use case (UC007)1
Verification of a claim of vaccination
DDCC Holder
Verifier
National PHA
International PHA
(3) 
Uses a 
Status 
Checking 
Application
Perform 
check 
online? 
Check with 
International 
PHA? 
(1) 
Presents 
DDCC:VS
(2) 
Receives 
claim of 
vaccination 
status
(4) 
Performs 
an online 
check with 
the National 
PHA DDCC 
Registry 
Service
(5) 
Performs an 
online check 
with the 
international 
PHA DDCC 
Registry 
Service
POINT C: 
Decision 
on the 
verification 
of claim of 
vaccination 
status
(6)
Communicates 
results back to 
the verifier
Start
End
Is 
cryptographic 
verification 
required?
Yes
No
No
No
Yes
Yes
DDCC:VS: Digital Documentation of COVID-19 Certificates: Vaccination Status; PHA: public health authority.
1	 The business process symbols used in the workflows are explained in Annex 2.
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Page
37
SECTION 4
Proof of Vaccination scenario
4.2.2.	Operationalizing the Proof of Vaccination use cases
Similar to supporting operationalization of the Continuity of Care use cases, the FHIR implementation 
guide includes implementable specifications for the Proof of Vaccination use cases described in this 
document, (available at https://WorldHealthOrganization.github.io/ddcc). The FHIR implementation 
guide for DDCC:VS contains a standards-compliant specification that explicitly encodes computer-
interoperable logic, including data models, terminologies and logic expressions, in a computable 
language sufficient for implementation of Proof of Vaccination use cases.
