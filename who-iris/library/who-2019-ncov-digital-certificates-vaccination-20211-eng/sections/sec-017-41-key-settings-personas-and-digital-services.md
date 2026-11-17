---
doc_id: who-2019-ncov-digital-certificates-vaccination-20211-eng
doc_title: "DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021 SECTION 1"
section_id: sec-017-41-key-settings-personas-and-digital-services
section_title: "Key settings, personas and digital services"
section_number: 4.1
pages: 44-46
source_pdf: WHO-2019-nCoV-Digital-certificates-vaccination-2021.1-eng.pdf
source_sha256: f57b14cb2acb728d
toc_source: inferred
---
For the Proof of Vaccination scenario, there is one additional setting to consider: the verification 
site, where it is necessary for people to prove their COVID-19 vaccination status (such as a care site, a 
school, or an airport). How, when, where, and by whom the DDCC:VS can be verified should be defined 
by the Member State. The relevant policies, including data protection policies, should be put in place 
accordingly. 
These key personas (see Table 6) are anticipated to interact with digital services (see Table 7). Not 
all of these digital services will have a user interface that the key personas directly interact with, but 
they are still critical building blocks of the reference architecture.
Page
28
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Proof of Vaccination scenario
SECTION 4
Table 6
Key personas for Proof of Vaccination
Role
Description
DDCC:VS Holder
In the context of Proof of Vaccination, the DDCC:VS Holder is the person who wants to assert 
a claim related to a COVID-19 vaccination status. This person could be the same as the Subject 
of Care or, for example, could be a caregiver who may hold the DDCC:VS for a child or other 
dependant. 
Verifier
The person or entity that wants to verify the vaccination status claim,  i.e. verify the 
vaccination status shown on a DDCC:VS.
National Public Health 
Authority (PHA)
The entity that has overall responsibility for vaccinating the country’s population. The 
National PHA is also responsible for the DDCC:VS Generation Service and the DDCC:VS Registry 
Service.
International PHA 
Any external PHA to which the National PHA might defer to verify certificates not issued by 
the National PHA. This could be a PHA in another country, but it could also be any regional-
level or international organization.
Table 7
Digital services for Proof of Vaccination
Digital service
Description
Health Certificate 
Identifier (HCID)
HCID is the key identifier which is present in the DDCC:VS. The HCID may be provided by an 
existing national system or alternatively, it could also be issued directly by the DDCC:VS 
Generation Service which will then encode the ID in the DDCC:VS.
An index that associates the HCID with metadata about the DDCC:VS is stored in the DDCC:VS 
Registry Service. 
Status Checking 
Application
A digital solution that can inspect and cryptographically verify the validity of the DDCC:VS. 
This can be an application on a mobile phone or another device. 
DDCC:VS 
Generation Service
The service that is responsible for taking data about a vaccination event, converting that 
data to use the FHIR standard, signing that HL7 FHIR document, and returning it to the Digital 
Health Solution. The signed HL7 FHIR document is the DDCC:VS. The Digital Health Solution 
is in turn responsible for distributing the DDCC:VS and any associated representation of the 
data, such as a QR code, to the DDCC:VS Holder based on PHA policy.
DDCC:VS 
Registry Service
A service that is an index that is able to return metadata related to the DDCC:VS (the signed 
FHIR document), such as its signature. This metadata may include the location from which the 
DDCC:VS may be retrieved from the DDCC:VS Repository, if one exists.
The DDCC:VS Registry Service can be utilized to determine whether a DDCC:VS has been 
revoked, for example, due to revocation of a key within the PKI, a compromised batch of 
vaccinations, or issues within the supply chain.
It is important to note that a DDCC:VS Registry Service is not the same as an electronic 
immunization registry, which is commonly used for routine immunization programmes.
DDCC:VS 
Repository Service
The optional service that has a repository, or database, of all the DDCC:VS and which is 
able to return a copy of the DDCC:VS (the signed FHIR document) and potentially the one 
dimensional or two dimensional barcode representation (such as a QR code) of the signed 
FHIR document. This can be architected in a centralized or decentralized manner. Regardless, 
it is a mechanism that stores and persists the DDCC:VS information. 
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Page
29
SECTION 4
Proof of Vaccination scenario
