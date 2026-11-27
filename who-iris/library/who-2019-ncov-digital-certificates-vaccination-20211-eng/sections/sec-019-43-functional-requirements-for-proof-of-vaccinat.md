---
doc_id: who-2019-ncov-digital-certificates-vaccination-20211-eng
doc_title: "DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021 SECTION 1"
section_id: sec-019-43-functional-requirements-for-proof-of-vaccinat
section_title: "Functional requirements for Proof of Vaccination scenario"
section_number: 4.3
pages: 54-57
source_pdf: WHO-2019-nCoV-Digital-certificates-vaccination-2021.1-eng.pdf
source_sha256: f57b14cb2acb728d
toc_source: inferred
---
scenario
High-level functional requirements for the activities described in Fig. 8 are presented in Table 9 as 
suggested features that any digital solutions that would facilitate DDCC:VS verification may have. 
These are written as guidance requirements only to be used as a starting point for Member States 
or other interested parties that need to develop their own specifications for a digital solution for 
DDCC:VS to take and adapt. 
Given non-functional requirements are common to both scenarios (Continuity of Care and Proof of 
Vaccination) (see Annex 5).
Table 9
Functional requirements for the Proof of Vaccination scenario1
Requirement ID
Functional requirement
UC004 
Manual
UC005 
Offline
UC006 
National
UC007 
International 
 DDCC.FXNREQ.037
Paper cards and the validation markings they bear 
SHOULD be designed to combat fraud and misuse. 
Any process that generates a paper vaccination 
card SHALL include elements on the card that 
support the Verifier in visually checking that the 
card is genuine (e.g. water marks, holographic 
seals etc.) without the use of any digital 
technology. 
 DDCC.FXNREQ.038
Paper vaccination cards SHALL display an HCID.
 DDCC.FXNREQ.039
Where paper cards are used, an authority SHALL 
put in place a process for the replacement of lost 
or damaged cards with the necessary supporting 
technology.
 DDCC.FXNREQ.040
If a paper vaccination card or electronic 
vaccination document bearing a 1D or 2D barcode 
is presented to a Verifier, then it SHALL be 
possible for the Verifier to scan the code and, as a 
minimum, read the HCID encoded in the barcode, 
to visually compare it with the HCID written on 
the paper card, if present.
Page
38
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Proof of Vaccination scenario
SECTION 4
Requirement ID
Functional requirement
UC004 
Manual
UC005 
Offline
UC006 
National
UC007 
International 
 DDCC.FXNREQ.041
If a paper vaccination card or electronic 
vaccination document bears a QR code and that 
2D barcode includes a digital signature, then 
it MAY be possible for the Verifier to check the 
signature, using information downloaded from a 
DDCC:VS Registry Service, to ensure it is genuine.
 DDCC.FXNREQ.042
It MAY be possible to log all offline verification 
operations so that, at a later stage, when an online 
connection is available, verification decisions 
can be reviewed and reconfirmed against data 
provided by the online DDCC:VS Registry Service. 
For example, this may be done to confirm that a 
certificate checked offline in the morning using 
public key and revocation data downloaded from 
the DDCC:VS Registry Service the day before has 
not been added to a public key revocation list 
issued that same day.
 DDCC.FXNREQ.043
It SHALL always be possible to perform some form of 
offline verification of vaccination cards; any solution 
should be designed so that a loss of connectivity to 
online components of the solution cannot force the 
verification work to stop.
 DDCC.FXNREQ.044
If, at the time of verification, a Verifier has online 
access/connectivity to a DDCC:VS Registry Service 
managed by a National PHA, then it SHALL be 
possible to query whether the HCID present in the 
barcode (and the public key, if also present) of the 
paper vaccination card are currently valid.
 DDCC.FXNREQ.045
When making the verification check, any solution 
SHALL send only the minimum information 
required for the verification to complete. The 
minimum information comprises the metadata 
(see section 5.2) and signature of the DDCC:VS.
 DDCC.FXNREQ.046
When receiving a request for validation, a 
National PHA SHALL consult its DDCC:VS Registry 
Service and respond with a status to indicate that 
the signing key has not been revoked, that the key 
was issued by a certified authority, and that the 
DDCC has not otherwise been revoked.
 DDCC.FXNREQ.047
A PHA servicing a validation request MAY respond 
with basic details of the vaccination card holder 
(name, date of birth, sex, etc.), in accordance with 
PHA policies, so the Verifier can confirm that the 
vaccination card corresponds to the DDCC:VS 
Holder who has presented himself or herself for 
validation.
 DDCC.FXNREQ.048
A PHA SHALL maintain a PKI to underpin the signing 
and verification process. Lists of valid public keys 
and revocation lists will be held in such a system 
and be linked to the DDCC:VS Generation Service to 
associate public keys with HCIDs.
 DDCC.FXNREQ.049
A PHA MAY log the requests it receives for 
verification (even if rendered anonymous), so 
that it has a searchable history for the purposes 
of audit and fighting fraud, provided that such 
logging respects data protection principles.
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Page
39
SECTION 4
Proof of Vaccination scenario
Requirement ID
Functional requirement
UC004 
Manual
UC005 
Offline
UC006 
National
UC007 
International 
 DDCC.FXNREQ.051
A PHA SHALL be able to return a verification 
status, as defined by the implementer, to a 
requester, based on the information provided.
 DDCC.FXNREQ.052
A PHA MAY be able to service individual 
verification requests (i.e. details relating to 
one vaccination certificate) or requests sent in 
bulk (details of multiple certificates sent in one 
request).
 DDCC.FXNREQ.053
A PHA SHOULD be able to validate that the 
requestor making a verification request is an 
authorized agent, but MAY also allow anonymous 
verification requests.
 DDCC.FXNREQ.054
The certificate authority (or authorities) in each 
country SHALL maintain records of the DSCs 
issued for the purpose of signing vaccination 
certificates and expose any service(s) that allow a 
public key to be looked up and checked against its 
records to check for validity.
 DDCC.FXNREQ.055
Any communication between a Verifier and a 
DDCC:VS Registry Service or other data service 
managed by a PHA SHALL be secured to prevent 
interference with the data in transit and at rest.
 DDCC.FXNREQ.056
SMS-based verification of alphanumeric HCIDs 
MAY be provided by a PHA as a means of sending a 
verification request or receiving a response with a 
status code.
 DDCC.FXNREQ.057
If a verification request is made in country A 
for a certificate that was issued by country B 
or a supranational entity, then country A’s PHA 
SHOULD have a means of transferring the request/
querying the data held by that authority.
 DDCC.FXNREQ.058
A Member State SHOULD put in place bilateral or 
multilateral agreements with other countries or 
with a supranational entity or regional body for 
access to those entities’ vaccination certificate 
data and digital signatures.
 DDCC.FXNREQ.059
Communications between one country’s and 
another’s PHA or a supranational DDCC:VS Registry 
Service SHALL be secure and prevent interference 
with the data in transit and at rest.
 DDCC.FXNREQ.060
It SHALL be the ultimate responsibility of the 
country where verification is taking place to 
decide whether a vaccination claim is valid or not.
 DDCC.FXNREQ.061
There SHOULD be a mechanism for country A 
to notify country B if a suspected fraudulent 
certificate from country B’s jurisdiction comes to 
the attention of country A.
1D: one-dimensional; 2D: two-dimensional; DDCC: Digital Documentation of COVID-19 Certificates; DDCC:VS: Digital Documentation of 
COVID-19 Certificates: Vaccination Status; DSC: document signer certificate; HCID: health certificate identifier; ID: identifier; PHA: public 
health authority.
1	 The use case(s) to which each functional requirement applies are indicated with a 
.
Page
40
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
