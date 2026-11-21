---
doc_id: 10665-341997
doc_title: "Digital adaptation kit: family planning: operational requirements for implementing WHO recommendations in digital systems"
section_id: sec-014-8-high-level-functional-and-non-functional-requi
section_title: "High-level functional and non-functional requirements"
section_number: 8
pages: 75-81
source_pdf: 10665-341997.pdf
source_sha256: 31e381afabc25132
toc_source: outline
---
personas
workflows
data
decisions
scenarios
indicators
requirements
This section provides an overview of illustrative functional and non-functional requirements that may be considered to kick-start the process of 
designing or adapting the digital tracking and decision-support system. Functional requirements describe the capabilities the system must have in order 
to meet the end-users’ needs and achieve tasks within the business process. Non-functional requirements provide the general attributes and features of 
the digital system to ensure usability and overcome technical and physical constraints. Examples of non-functional requirements include ability to work 
offline, multiple language settings and password protection.
Table 15 highlights some key functional requirements for executing the business processes listed in Component 4 of this document, and the complete 
set of functional requirements can be accessed in Web Annex D. Table 16 provides non-functional requirements as general characteristics of the overall 
system. Please note that these are not exhaustive lists and should be modified according to context and user persona needs.
 8.1 	Functional requirements
Table 15. Functional requirementsa
Requirement ID
Activity ID and description
As a…
I want …
So that…
Business process A: Registration
FP.FXNREQ.001
Rapid assessment and 
management
Health worker or clerk
To bypass the standard flow at any point if an urgent case 
is identified
The woman can receive immediate 
attention
FP.FXNREQ.002
Search for clientb name and 
record
Health worker or clerk
To search to see whether client is already in the system 
(using at least two identifiers)
I can check whether this is a new or 
existing client
FP.FXNREQ.003
Search for client name and 
record
Health worker or clerk
The system to display sufficient data to identify the client
I can confirm that it is the correct client
High-level functional 
and non-functional 
requirements
Component
recommendations
personas
indicators
workflows
data
decisions
scenarios
requirements
Requirement ID
Activity ID and description
As a…
I want …
So that…
FP.FXNREQ.004
Search for client name and 
record
Health worker or clerk
The system to require me (a user) to search to see 
whether a client is already in the system prior to starting a 
new medical record entry
I can confirm that it is the correct client 
and update information as necessary
FP.FXNREQ.005
Search for client name and 
record
Health worker or clerk
To use patient identification system (e.g. QR code, 
barcode, fingerprint) and pull up patient information
I can confirm that it is the correct client 
and update information as necessary
FP.FXNREQ.006
Search for patient name and 
record
Health worker or clerk
To provide sufficient data to rule out the possibility that 
this patient is already in the system
I can avoid duplicates 
FP.FXNREQ.007
Create client record
Health worker or clerk
To be able to enter identification information
I can enter new client information or 
update an existing client record
FP.FXNREQ.008
Create client record
Health worker or clerk
The system to indicate mandatory fields that must be 
filled out for registration to be valid
I can ensure all necessary information has 
been completed
FP.FXNREQ.009
Create client record
Health worker or clerk
To generate encounter number for contact
I can initiate the required antenatal care 
services
FP.FXNREQ.010
Create client record
Health worker or clerk
To generate or associate to existing hospital or clinic 
medical record number
I can check and confirm the information
FP.FXNREQ.011
Create client record
Health worker or clerk
To edit fields on screen before information is committed
I can ensure information has been 
checked before submission
FP.FXNREQ.012
Create client record
Health worker or clerk
To enter a temporary identification in emergency 
situations when full identity unknown
I can proceed with registration 
FP.FXNREQ.013
Validate client details
Health worker or clerk
To display patient information for validation (and be able 
to edit it)
I can ensure information has been 
checked before submission
FP.FXNREQ.014
Validate client details
Health worker or clerk
To be able to update demographic information
The most current information on client 
can be recorded
FP.FXNREQ.015
Validate client details
Health worker or clerk
To retain previous history of updated information
I can review past information
FP.FXNREQ.016
Validate client details
Health worker or clerk
To be able to include other multiple ways of identifying 
the client (e.g. photo, biometrics), as needed and based 
on consent and national standards
I have additional ways of identifying client 
FP.FXNREQ.017
Validate client details
Health worker or clerk
To be able to confirm client identity
I can be sure it is the right person
FP.FXNREQ.018
Validate client details
Health worker or clerk
If this is a returning contact, to add the information to 
their previous contact
I can link the information across different 
contacts
FP.FXNREQ.019
Check in client
Health worker or clerk
To record a time- and date-stamped new contact 
(encounter)
I can confirm when the client came
recommendations
personas
workflows
data
decisions
scenarios
indicators
requirements
Requirement ID
Activity ID and description
As a…
I want …
So that…
Business process B: Counselling
FP.REQ.020
Conduct risk assessment
Health-care provider (e.g. 
nurse midwife)
To have different questions and language prompts 
when clients are adolescents 
I can better support adolescents with their 
unique needs
FP.REQ.021
Conduct risk assessment
Health-care provider (e.g. 
nurse midwife)
To have the option of conducting a screening at 
multiple steps during a client’s visit, such as for 
sexually transmitted infections (STIs) or HIV
I can better support the client
FP.REQ.022
Discuss methods and options
Health-care provider (e.g. 
nurse midwife)
To know which contraceptive methods are 
available at my facility
I can better serve the client in getting their 
method of choice or refer them elsewhere
FP.REQ.023
Discuss methods and options
Health-care provider (e.g. 
nurse midwife)
To have educational information available about 
different types of methods
I can better answer the client’s questions to 
support their selection of a method
FP.REQ.024
Discuss methods and options
Health-care provider (e.g. 
nurse midwife)
To have access to a graphic which shows what 
methods look like and how effective they are
I have a visual aid to support clients in selecting 
a method
FP.REQ.025
Discuss methods and options
Health-care provider (e.g. 
nurse midwife)
To have available general information about 
methods to share with clients
I have a quick reference to help clients pick a 
method
FP.REQ.026
Discuss methods and options 
Health-care provider (e.g. 
nurse midwife)
To have available general sexual and reproductive 
health education information
I will not have to look elsewhere to find 
information
FP.REQ.027
Screen for medical eligibility
Health-care provider (e.g. 
nurse midwife)
To have questions that guide me in counselling 
clients 
I can better match method suggestions with client’s 
needs, values and preferences for contraception
FP.REQ.028
Screen for medical eligibility 
Health-care provider (e.g. 
nurse midwife)
To have the option to check a returning client’s 
medical eligibility for their current method
I can re-evaluate a client’s eligibility, but will not 
be required to do so
FP.REQ.029
Screen for medical eligibility
Health-care provider (e.g. 
nurse midwife)
To be prompted to ask about conditions that 
would exclude a client from using a method
Clients are not given a method that may not be 
safe for them
FP.REQ.030
Screen for medical eligibility
Health-care provider (e.g. 
nurse midwife)
To be able to use my clinical judgement when a 
client has a medical condition indicating a method 
should not be used
I do not prevent clients from selecting a family 
planning method when they are eligible, with 
clinical judgement (e.g. when other methods are 
not available)
FP.REQ.031
Screen for medical eligibility
Health-care provider (e.g. 
nurse midwife)
To have the option to restrict classifying a woman 
as medically eligible where resources for clinical 
judgement are limited 
Clients are better protected, such as when 
clinical judgement is needed to determine the 
severity of the condition and the availability, 
practicality and acceptability of alternative 
methods
FP.REQ.032
Screen for medical eligibility
Health-care provider (e.g. 
nurse midwife)
To log the reason a client is not medically eligible 
for a method
The next provider has this information, client 
safety is better protected, and on a future visit it 
is easier to check whether a client is now eligible
FP.REQ.033
Screen for medical eligibility
Health-care provider (e.g. 
nurse midwife)
To see history of past medical eligibility screenings 
to see if anything has changed 
I better protect client safety and reduce time 
spent on methods the client is still ineligible for 
due to known conditions
recommendations
personas
indicators
workflows
data
decisions
scenarios
requirements
Requirement ID
Activity ID and description
As a…
I want …
So that…
FP.REQ.034
Screen for medical eligibility
Health-care provider (e.g. 
nurse midwife)
To be alerted if a client was previously not eligible 
for a method
I do not have to search through records, given I 
have limited time
Business process C: Service provision
FP.REQ.035
Get informed consent
Programme manager
To ensure the system prompts the health worker 
to get informed consent from the client
Jurisdictional requirements are adhered to and 
clients’ rights are protected
FP.REQ.036
Schedule follow-up
Health-care provider (e.g. 
nurse midwife)
To have the system automatically calculate a date 
when the client should return for care, based on 
method, quantity of the method provided, etc. 
I do not have to calculate this myself
FP.REQ.037
Encourage follow-up as 
needed
Health-care provider (e.g. 
nurse midwife)
To be able to still send communications to a client, 
even if follow-up is not necessarily required
The client’s ongoing family planning needs may 
be better served
a 	
Complete business processes C, D and E are available in the full spreadsheet of “FP functional and non-functional requirements”.
b 	
The term “client” is used for the registration workflow, as this is applicable to other health domains, and “woman” is used for the family planning-specific business processes. 
8.2 	Non-functional requirements
Table 16. Non-functional requirements
Requirement ID
Category
Non-functional requirement
FP.NFXNREQ.001
Security – confidentiality
Provide password-protected access for authorized users 
FP.NFXNREQ.002
Security – confidentiality
Provide a means to ensure confidentiality and privacy of personal health information
FP.NFXNREQ.003
Security – confidentiality
Provide ability for allowed users to view confidential data  
FP.NFXNREQ.004
Security – confidentiality
Anonymize data that is exported from the system
FP.NFXNREQ.005
Security – confidentiality
Prevent remembering username and password
FP.NFXNREQ.006
Security – confidentiality
Automatically log out the user after specified time of inactivity
FP.NFXNREQ.007
Security – confidentiality
Provide encrypted communication between components
FP.NFXNREQ.008
Security – authentication
Notify the user to change their password the first time they log in
FP.NFXNREQ.009
Security – authentication
Adhere to complex password requirements
FP.NFXNREQ.010
Security – authentication
Provide a mechanism to securely change a user’s password
FP.NFXNREQ.011
Security – authentication
Notify the user of password change to their account
FP.NFXNREQ.012
Security – authentication
Reset a user’s password in a secure manner
FP.NFXNREQ.013
Security – authentication
Lock a user out after a specified number of wrong password attempts
recommendations
personas
workflows
data
decisions
scenarios
indicators
requirements
Requirement ID
Category
Non-functional requirement
FP.NFXNREQ.014
Security – authentication
Notify a user if their account is locked due to wrong password attempts
FP.NFXNREQ.015
Security – authentication
Provide role-based access to the system
FP.NFXNREQ.016
Security – audit trail and logs
Log system logins and logouts
FP.NFXNREQ.017
Security – audit trail and logs
Record all authentication violations
FP.NFXNREQ.018
Security – audit trail and logs
Log all activities performed by the user, including date and time stamp
FP.NFXNREQ.019
Security – audit trail and logs
Log access to views of individual client records
FP.NFXNREQ.020
Security – audit trail and logs
Log access to data summaries, reports, analysis and visualization features
FP.NFXNREQ.021
Security – audit trail and logs
Log exchange of data with other systems
FP.NFXNREQ.022
Security – audit trail and logs
Generate analysis of the usage of different system features and reports 
FP.NFXNREQ.023
Security – audit trail and logs
Log all data and system errors
FP.NFXNREQ.024
Security – user management
Allow user with permission to create a new user and temporary password
FP.NFXNREQ.025
Security – user management
Provide role-based access  
FP.NFXNREQ.026
Security – user management
Allow roles to be associated with specific geographical areas and/or health-care facilities
FP.NFXNREQ.027
Security – user management
Allow cascading user management and assignment of roles
FP.NFXNREQ.028
Security – user management
Allow user to change their own password
FP.NFXNREQ.029
Security – user management
Allow admin user to request password reset
FP.NFXNREQ.030
Security – user management
Notify the user to regularly change their password
FP.NFXNREQ.031
Security – user management
Allow each user to be assigned to one or more roles
FP.NFXNREQ.032
Security – user management
Support definitions of unlimited roles and assigned levels of access, viewing, entry, editing and auditing 
FP.NFXNREQ.033
System requirements – general
Provide a unique version number for each revision 
FP.NFXNREQ.034
System requirements – general
Enable earlier versions of a record to be recoverable
FP.NFXNREQ.035
System requirements – general
Enable deployment in an environment subject to power loss
FP.NFXNREQ.036
System requirements – general
Work in an environment that is subject to loss of connectivity
FP.NFXNREQ.037
System requirements – general
Generate IDs that are unique across different installations or sites
FP.NFXNREQ.038
System requirements – general
Report version number when saving data to the database
FP.NFXNREQ.039
System requirements – general
Be designed to be flexible enough to accommodate necessary changes in the future
FP.NFXNREQ.040
System requirements – general
Allow for offline and online functionality
FP.NFXNREQ.041
System requirements – general
Show the number of records that are not yet synchronized
FP.NFXNREQ.042
System requirements – general
Have ability to easily back up information
recommendations
personas
indicators
workflows
data
decisions
scenarios
requirements
Requirement ID
Category
Non-functional requirement
FP.NFXNREQ.043
System requirements – general
Warn user if no valid backup for more than a predefined number of days
FP.NFXNREQ.044
System requirements – general
Have the ability to store images and other unstructured data
FP.NFXNREQ.045
System requirements – scalability
Be scalable to accommodate new demands
FP.NFXNREQ.046
System requirements – scalability
Be able to accommodate at least [x number of] health-care facilities
FP.NFXNREQ.047
System requirements – scalability
Be able to accommodate at least [x number of] concurrent users
FP.NFXNREQ.048
System requirements – usability
Be user-friendly for people with low computer literacy
FP.NFXNREQ.049
System requirements – usability
Provide informative error messages and tool-tips  
FP.NFXNREQ.050
System requirements – usability
Alert the user when navigating away from a form without saving
FP.NFXNREQ.051
System requirements – usability
Support real-time data-entry validation and feedback to prevent data-entry errors from being recorded
FP.NFXNREQ.052
System requirements – usability
Simplify data recording through predefined drop-down menu or searchable lists, radio buttons, check boxes
FP.NFXNREQ.053
System requirements – usability
Support multiple languages
FP.NFXNREQ.054
System requirements – usability
Use industry-standard user interface practices and apply them consistently throughout the system
FP.NFXNREQ.055
System requirements – usability
Be easy to learn and intuitive to enable user to navigate between pages
FP.NFXNREQ.056
System requirements – usability
Provide guidance to users to better support clinical guidelines and best clinical practices
FP.NFXNREQ.057
System requirements – usability
Be reliable and robust (minimize the number of system crashes)
FP.NFXNREQ.058
System requirements – usability
Adjust display to fit small screens (e.g. mobile phones)
FP.NFXNREQ.059
System requirements – configuration
Configure the system centrally
FP.NFXNREQ.060
System requirements – configuration
Configure business rules in line with guidelines and standard operating procedures (SOPs)
FP.NFXNREQ.061
System requirements – configuration
Configure error messages
FP.NFXNREQ.062
System requirements – configuration
Configure workflows and business rules to accommodate differences between facilities
FP.NFXNREQ.063
System requirements – interoperability
Communicate with external systems through mediators
FP.NFXNREQ.064
System requirements – interoperability
Provide access to data through application programming interfaces (APIs)
FP.NFXNREQ.065
System requirements – interoperability
Be interoperable with external systems through mediators
FP.NFXNREQ.066
System requirements – interoperability
Exchange data with other approved systems
FP.NFXNREQ.067
System requirements – interoperability
Accept data from multiple input methods, including paper and geocoding via Global Positioning System (GPS)
FP.NFXNREQ.068
System requirements – hardware and 
connectivity
Allow for data exchange and efficient synchronization across multiple facilities and points of service when Internet 
is available, even when it is intermittent and slow 
recommendations
personas
workflows
data
decisions
scenarios
indicators
requirements
