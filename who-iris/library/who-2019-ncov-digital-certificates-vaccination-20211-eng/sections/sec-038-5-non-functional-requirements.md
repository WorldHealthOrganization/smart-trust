---
doc_id: who-2019-ncov-digital-certificates-vaccination-20211-eng
doc_title: "DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021 SECTION 1"
section_id: sec-038-5-non-functional-requirements
section_title: "Non-functional requirements"
section_number: 5
pages: 89-94
source_pdf: WHO-2019-nCoV-Digital-certificates-vaccination-2021.1-eng.pdf
source_sha256: f57b14cb2acb728d
toc_source: inferred
---
This section contains a suggested set of generic non-functional requirements (see Table A5.1). Along 
with the functional requirements in sections 3.3 and 4.3, these non-functional requirements can be 
adapted when specifying a digital solution for the scenarios in this paper. Non-functional requirements 
explain the conditions under which any digital solution must remain effective and are organized into 
the following categories.
	
→ACCESSIBILITY: The provision of flexibility to accommodate each user’s needs and preferences, along 
with appropriate measures to ensure access to persons with disabilities on an equal basis with 
others; for example, the solution should still be accessible to those with visual impairment.
	
→AVAILABILITY (SERVICE LEVEL AGREEMENTS; SLAS): The definition of when the system will be 
available to the user community, how such metrics will be measured, and the functionality in the 
tool for managing planned downtime.
	
→CAPACITY – CURRENT AND FORECAST: The number of concurrent users that can interact with the 
system without an unacceptable degradation in performance, speed or responsiveness. User 
populations are never static, and so the ability to handle current typical and peak volumes of usage 
and predicted future states, and the strategy for handling a traffic surge, must be considered.
	
→UPTIME SLAs – DISASTER RECOVERY, BUSINESS CONTINUITY, RESILIENCE: The requirements for the 
system in terms of how it recovers from critical, unexpected failure and the support for business 
continuity. This includes time to recovery, how recovery is established, and at what levels resilience 
and redundancy are built into the system to minimize any data loss.
	
→PERFORMANCE/RESPONSE TIME: The speed with which the system is expected to respond under 
normal and exceptional loads, with a definition of what those terms mean.
	
→PLATFORM COMPATIBILITY: The different operating systems, machines and configuration on which 
the solution is expected to run.
	
→SECURITY AND PRIVACY: The levels of security that the solution must provide in terms of user 
authentication and data protection.
	
→REGULATION AND COMPLIANCE: Any regulatory/legal constraints with which the system must 
comply, such as data protection policies, WHO cloud policies, and information management and 
retention rules of the jurisdiction(s) in which the solution will run.
	
→RELIABILITY: A measure of the reliability of the tool, for example the acceptable mean time between 
failures of the solution (both hardware and software components). 
	
→SCALABILITY (HORIZONTAL, VERTICAL): The ability to, and strategy for, handling an increasing load 
on the solution (in terms of increased number of users it can support, higher volumes of data it 
can handle, quicker performance and response, etc.). A solution can be scaled either horizontally 
(adding more elements to the solution, such as extra load-balanced servers) or vertically (adding 
extra capacity in existing elements, such as upgrading an existing server).
	
→SUPPORTABILITY: The requirements for engineers to detect, diagnose, resolve and monitor any 
issues and faults that arise while the solution is being used. This covers the features/functions that 
will be built into the system to facilitate technical support work.
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Page
73
	
→USABILITY BY TARGET USER COMMUNITY: The extent to which a product can be used by specified 
users to achieve specified goals with effectiveness, efficiency and satisfaction in a specified context 
of use. This includes optimization of the interface for clarity and efficiency, and ensuring that the 
solution is appropriate to the needs and the experience level and expectations of the target users.
	
→DATA RETENTION/ARCHIVING: Requirements relating to how information will be archived from its 
normal location and then retained, including the frequency, the approval process and any process 
for restoring information from the archive.
Table A5.1 
Non-functional requirements for the DDCC:VS 
Requirement ID
Category
Non-functional requirement
DDCC.NFXNREQ.001
Accessibility
Any solution SHALL provide optimization for delivery to users with low bandwidth, as 
in a low digital maturity setting users will often have limited (or intermittent) Internet 
connectivity.
DDCC.NFXNREQ.002
Accessibility
Any solution SHOULD provide offline availability that permits a user to continue to 
work with data while offline, such as by creating a set of requests to be sent when 
next online.
DDCC.NFXNREQ.003
Accessibility
Any solution SHALL provide a mechanism for the resynchronization/dispatch of data 
created offline when the solution is reconnected.
DDCC.NFXNREQ.004
Accessibility
Any solution SHOULD follow best practice to deliver interfaces that are clear, intuitive 
and consistent (standardized colour schemes, icons, placement of visual elements – 
titles, buttons, filters, navigation, etc.)
DDCC.NFXNREQ.005
Accessibility
Any solution SHOULD follow best practice to deliver interfaces that are accessible by 
the widest range of users, including considerations for different cultures (e.g. left-to-
right and right-to-left scripts), visual impairment (e.g. colour blindness) and physical 
disability (e.g. the need to interact using one hand).
DDCC.NFXNREQ.006
Accessibility
Any solution SHOULD automatically optimize its interface (layout of elements, 
organization of information, etc.) to adapt to the device on which it is being used, 
so that it is accessible on personal computers (desktops, laptops), tablets and 
smartphones using principles of adaptive design.
DDCC.NFXNREQ.007
Availability
Any solution developed SHOULD NOT be able to accept more than 10 minutes of 
outage during normal usage and cannot accept more than 1 minute of data loss of 
queries and responses.
DDCC.NFXNREQ.008
Availability
It MAY be possible to provide an indication of the availability status of any solution so 
that users can check the system’s “health”. The same functionality MAY also notify of 
any planned downtime, retired functionality, release notes, etc.
DDCC.NFXNREQ.009
Capacity – current and 
forecast
The system SHALL be able to support the potentially large number of concurrent users 
performing read and write operations during normal operation. This metric will vary 
significantly between different country contexts and will depend on the design, but 
should be used as the anticipated capacity standard.
DDCC.NFXNREQ.010
Capacity, current and 
forecast
During periods of peak usage, system traffic MAY surge the number of concurrent 
users performing read and write operations.
DDCC.NFXNREQ.011
Capacity, current and 
forecast
Forecast growth of the user base is anticipated to be high. As a safety contingency, 
the system SHOULD support, or have scaling plans to support, growth of 25% per year.
DDCC.NFXNREQ.012
Disaster recovery, 
business continuity, 
resilience
All data and derived analysis SHALL be stored within an appropriate data architecture 
to ensure redundancy and rapid disaster recovery, to eliminate the risk of data loss.
DDCC.NFXNREQ.013
Disaster recovery, 
business continuity, 
resilience
The system SHOULD provide near-instantaneous switch-over if any one component 
of the system architecture fails critically (database server, web server, system 
monitoring job, service bus, etc.).
Page
74
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Requirement ID
Category
Non-functional requirement
DDCC.NFXNREQ.014
Disaster recovery, 
business continuity, 
resilience
The system SHOULD provide near-instantaneous switch-over if any one component of 
the physical architecture fails critically (data centre destroyed, server destroyed, etc.)
DDCC.NFXNREQ.015
Disaster recovery, 
business continuity, 
resilience
All components of the solution SHOULD be underpinned by robust monitoring 
tools that track usage across space and time, so that system load and source can be 
queried.
DDCC.NFXNREQ.016
Disaster recovery, 
business continuity, 
resilience
Data concerning system usage SHOULD be available to system administrators via a 
dashboard to show current load, and recent load (last week, last month), and be able 
to perform custom queries by place and time. It SHOULD be possible to export this 
data.
DDCC.NFXNREQ.017
Disaster recovery, 
business continuity, 
resilience
It SHALL be possible to automatically log any periods of outage of the system and to 
supplement and update this record manually.
DDCC.NFXNREQ.018
Disaster recovery, 
business continuity, 
resilience
It SHALL be possible to trigger system alerts based on uptime and performance.
DDCC.NFXNREQ.019
Disaster recovery, 
business continuity, 
resilience
It SHOULD be possible to use system alerts to perform actions such as dispatch of a 
warning email/SMS to a system administrator or to execute a script that (for example) 
spins up a new virtual machine for load balancing.
DDCC.NFXNREQ.020
Performance/
response time
The solution SHALL follow best practices to deliver a responsive interface in which 
typical requests can be served (end-to-end interaction) in a maximum time specified 
in a number of seconds to be determined based on typical bandwidths. Degradation 
to a greater maximum time in number of seconds for limited-bandwidth scenarios is 
acceptable.
DDCC.NFXNREQ.021
Performance/
response time
The solution SHOULD be designed so that degradation of performance due to 
increased load (surge of users) is minimized.
DDCC.NFXNREQ.022
Performance/
response time
Where appropriate, long-running processes such as complex queries MAY be available 
for asynchronous execution, to allow a user to continue to interact with the system 
while the job executes and to receive a notification when the work is complete.
DDCC.NFXNREQ.023
Performance/
response time
The system MAY implement detection of a frozen (“hung”) interface to give the user 
the option to cancel a current request.
DDCC.NFXNREQ.024
Performance/
response time
The system SHOULD collect metrics on performance and response time to allow a 
system administrator to monitor system behaviour, identify bottlenecks or issues, 
and pro-actively address any risk of unacceptable degradation of speed.
DDCC.NFXNREQ.025
Performance/
response time
As with system availability, the solution SHALL provide dashboards of performance 
metrics, allow querying of the performance log and export of performance data for 
reports.
DDCC.NFXNREQ.026
Performance/
response time
As with system availability, the solution SHALL have the ability to set thresholds on 
performance and use the breach of those thresholds to raise alerts that can trigger 
email notifications or automated system actions (bring an extra server into a load-
balanced set, for example).
DDCC.NFXNREQ.027
Security and privacy
Tools to request an account, log in, log out, set and change passwords, and receive 
password reminders SHALL be provided.
DDCC.NFXNREQ.028
Security and privacy
All interactions between a client and a server component of the solution SHALL be 
securely encrypted to prevent “man in the middle” interference with data in transit.
DDCC.NFXNREQ.029
Security and privacy
Any cloud components of the solution SHALL store their cloud data-at-rest in an 
encrypted format.
DDCC.NFXNREQ.030
Security and privacy
The solution SHALL have a security model that is robust and flexible and controls both 
access to data and the operations that can be executed against data.
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Page
75
Requirement ID
Category
Non-functional requirement
DDCC.NFXNREQ.031
Security and privacy
Information about the governance and restricted use of data SHOULD be available 
within any solution alongside the data concerned, so that users have a clear and 
consistent reminder of the level of confidentiality, sensitivity and the permitted use 
of the data they are currently viewing.
DDCC.NFXNREQ.032
Security and privacy
Dashboards, reports, standard queries and exports of security information 
SHOULD be provided to assist system administrators in the management of access 
permissions. Queries to highlight conflicting permissions SHOULD be available.
DDCC.NFXNREQ.033
Security and privacy
The confidentiality of data must be managed with utmost care. In shared data 
environments, there SHALL be a clear separation of between the system’s data 
and any other hosted clients’ information. Dedicated hosting and data sources are 
preferred.
DDCC.NFXNREQ.034
Regulation and 
compliance
Any solution SHOULD be designed to be mindful of existing reference architecture 
guidelines and standards for distributed trust framework solutions and tools for 
exchanging vaccination data.
DDCC.NFXNREQ.035
Regulation and 
compliance
Any solution SHALL be compliant with any data policies and legal requirements 
identified by the country in whose jurisdiction the solution will operate.
DDCC.NFXNREQ.036
Regulation and 
compliance
It MAY be possible to tag data sets with any regulation and compliance information 
relevant to them so that this is readily available with the data set. Such information 
might include the data provider, intended purpose of the data, restrictions on the use 
of the data, and restrictions on where data can be stored.
DDCC.NFXNREQ.037
Regulation and 
compliance
Any solution SHALL be compliant with any data storage, retention and destruction 
laws mandated by the data policies and data laws of the countries in which data are 
located.
DDCC.NFXNREQ.038
Reliability
Any solution SHOULD be designed to maximize the mean time between failures, with 
appropriate best practice to deliver a robust, well-tested and reliable platform.
DDCC.NFXNREQ.039
Reliability
Any solution SHOULD provide a log, in which failures in any part of the system are 
logged, so that mean time between failures can be calculated and tracked.
DDCC.NFXNREQ.040
Scalability
Any solution SHOULD be designed so that elements can be scaled horizontally by, for 
example, adding extra resources (more servers, extra virtual machines, etc.) and the 
mechanisms for coordinating their activity (load balancing, session management, 
etc.)
DDCC.NFXNREQ.041
Scalability
Any solution SHOULD be designed so that elements can be scaled vertically by, for 
example, adding extra capacity to solution elements (increased CPU, increased RAM, 
etc.)
DDCC.NFXNREQ.042
Scalability
It MAY be possible to configure rules for automatic horizontal scaling of the system 
to respond to increased load (e.g. spinning up a new virtual machine and adding it to 
a load-balanced pool of resources). Rules will be based on thresholds for system load 
and performance.
DDCC.NFXNREQ.043
Scalability
Any solution SHOULD log sufficient information about performance and load so that 
technical staff can refine the system’s scaling strategy based on actual usage.
DDCC.NFXNREQ.044
Supportability
Any solution SHOULD provide a feedback channel as described in functional 
requirements for collecting information and support requests.
DDCC.NFXNREQ.045
Supportability
Any solution MAY provide access to learning material to support a user’s 
understanding of how to use the tool and achieve specific aims.
DDCC.NFXNREQ.046
Supportability
The solution SHALL include a system log of activity in which events of interest, the 
time and date when they occur, their categorization, and the user (if appropriate) 
who triggered the event are recorded. The log must be of sufficient detail to assist 
technical staff with debugging issues.
Page
76
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Requirement ID
Category
Non-functional requirement
DDCC.NFXNREQ.047
Supportability
It MAY be possible to configure system logging in a verbose and a standard format. 
Verbose format will be used for periods of testing or bug fixing, and standard for 
production use of a stable system in which smaller log size is prioritized over a high 
level of detail.
DDCC.NFXNREQ.048
Supportability
It SHOULD be possible for technical support staff to filter and query system logs to 
quickly identify sections of interest.
DDCC.NFXNREQ.049
Supportability
It MAY be possible to trigger alerts from the creation of predefined log entries (e.g. an 
error, warning, failure). Alerts can be used to take actions such as email dispatch.
DDCC.NFXNREQ.050
Supportability
Any solution SHALL have a published strategy for the release of patches, maintenance 
releases and version upgrades.
DDCC.NFXNREQ.051
Usability
Any interface created SHOULD be mindful of best practices for user design/adaptive 
design to ensure the best chance of presenting a clear and concise, and intuitive user 
experience. This is particularly important for any interface dealing with data entry.
DDCC.NFXNREQ.052
Usability
It SHOULD be possible to deliver definition/explanation text in the language currently 
selected for the interface via the solution, so that acronyms, jargon, technical terms, 
etc. can be clarified where necessary.
DDCC.NFXNREQ.053
Usability
The user interface MAY be designed so that navigation via keyboard (tab movement 
between fields, use of shortcut keys) is possible if the user does not have access to a 
pointer device.
DDCC.NFXNREQ.054
Usability
When the solution adapts for display on a smartphone/tablet, the interface SHALL be 
designed mindful of touch-screen interaction.
DDCC.NFXNREQ.055
Usability
The solution MAY provide an efficient and easy way to manage taxonomy (for 
administrator users) to record standard definitions, relationships between terms, etc.
DDCC.NFXNREQ.056
Data retention/
archiving
It SHOULD be possible to manually request an archive of a selected subset of 
information.
DDCC.NFXNREQ.057
Data retention/
archiving
It MAY be possible to schedule the archiving of a selected subset of information and 
to set a recurrence for this operation. The archive operation will execute when the 
scheduled date and time arrives.
DDCC.NFXNREQ.058
Data retention/
archiving
It MAY be possible to trigger a notification alert when an archive operation completes 
(including success and failure reports).
DDCC.NFXNREQ.059
Data retention/
archiving
Any archive function SHALL not affect the performance of the system.
DDCC.NFXNREQ.060
Data retention/
archiving
Any archive material SHOULD be labelled with metadata about the information it 
contains and the date and time it was created, to facilitate quick navigation of all 
archived material.
DDCC.NFXNREQ.061
Data retention/
archiving
It SHOULD be possible, with the necessary authority and permissions, to restore 
information from a chosen archive back into the operational set of information.
DDCC.NFXNREQ.062
Data retention/
archiving
All archival operations SHALL be logged.
DDCC.NFXNREQ.063
Data retention/
archiving
It SHOULD be possible, with the necessary authority and permissions, to perform a 
limited search of the contents of archives to identify information of interest.
DDCC.NFXNREQ.064
Data retention/
archiving
All information written to archives SHALL be in an encrypted format to prevent 
misuse if accessed by an unauthorized system or person.
CPU, central processing unit; RAM, random-access memory.
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Page
77
Annex 6
