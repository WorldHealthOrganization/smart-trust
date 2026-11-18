---
doc_id: 9789240101197-eng
doc_title: "Digital transformation handbook for health supply chain architecture"
section_id: sec-015-step-2-define-a-target-dhsc-architecture
section_title: "Step 2. Define a target DHSC architecture"
section_number: null
pages: 32-35
source_pdf: 9789240101197-eng.pdf
source_sha256: cd157b40eef513c1
toc_source: inferred
---
2
Step
This step involves defining a target DHSC architecture to ensure that all of the HSCISs are optimally 
structured and aligned with strategic goals.
INPUTS
TASKS
OUTPUTS
	» Assessment of the 
supply chain to identify 
opportunities for digital 
transformation
	» List of existing HSCISs
	» SCISMM assessment 
report
	» HSCIS gaps that need to 
be addressed to achieve 
the DHSC strategic goals
1.	 Draw the current-state architecture of 
the HSCISs by mapping existing systems 
against the DHSC architecture framework.
2.	 Identify gaps and necessary digital 
interventions based on the current state.
3.	 Define a future state of the DHSC 
architecture that considers core supply 
chain functions and foundational 
components while using existing digital 
assets where appropriate.
	» Current-state architecture of 
health supply chain systems 
	» Future state of the DHSC 
architecture
RESOURCES
DHSC architecture framework (described 
later in this section)
SCISMM (16)
TSS v2 (20)
Country examples (Chapter 5)
Potential risks
Mitigation strategies
Design of the DHSC architecture not aligning 
with best practices
	»
Consult resources such as this handbook, SCISMM (16) and TSS v2 (20), along with principles 
such as the Principles for Digital Development (Annex 1), TOGAF (18) and the OpenHIE (17) 
framework, to help ensure alignment with best practices.
	»
Engage with the practitioner community through groups such as the DHSC small working 
group to seek feedback on design.
Risk of choosing technology solutions 
prematurely, without considering innovation 
trends and potential future changes, resulting 
in those solutions quickly becoming outdated 
or challenging to adapt
In addition to following the outlined DHSC architecture framework, consider scalability and 
sustainability when selecting digital solutions for the health supply chain. A key mandate of the 
TWG should be oversight in this area.
BEST PRACTICE
	
Ð While upstream health supply chain levels such as the central warehouse use advanced systems to manage 
inventory and distribution, it is important to have sufficient system coverage at the lowest supply chain 
level to capture actual consumption. Health supply chains typically rely on inventory distribution data 
from warehouses or data on inventory issues from pharmacies to determine consumption. However, actual 
consumption should include what is dispensed to individuals, product expiries, wastages and inventory 
shrinkage. Systems, especially at the last mile of the supply chain, should have the ability to track and capture 
batch details and serial numbers, where available, as part of product expiries, wastages, inventory shrinkage 
and dispensation. 
Fig 13. DIIG digital health enterprise architecture framework
Fig. 
13
SHARED SERVICES
DATA SERVICES
DATA SOURCES
Institution-based 
health info. system 
and data sources
Population-based 
health info system 
and data sources
Analytics, 
dashboards, aids, 
repositories 
Digital health platform
Shared services
Business domain 
services
Registry services
Terminology 
services
Health worker 
registry
Client 
registry
Product registry
Facility 
registry
Logistics mgmt 
info system
Shared 
health record
Health mgmt 
info system
Digital and 
nondigital data 
sets sourced from 
processes that 
systematically 
record information 
within health 
institutions and 
facilities (e.g.,
Service Availability 
and Readiness 
Assessment)
Provides 
software 
capabilities, 
or “services,” 
that are 
specific to 
health care 
and may 
be used 
by other 
applications 
across the
digital 
health 
enterprise
Provides 
software 
capabilities, 
or “services,” 
that are 
canonical/ 
master 
“lists” and 
are enforced 
by specified 
governance 
mechanisms
Digital and nondigital data sets 
sourced from processes that 
systematically record information 
about members of a population 
(e.g., census, Demographic and 
Health Surveys)
Data tools 
that are 
used to 
facilitate 
decision- 
making 
(e.g., GIS)
INTER-
OPERABILITY 
LAYER
Enabling 
components
Provides software capabilities to support 
managed data exchange and interoperability 
between applications and services across 
the digital health enterprise
APPLICATIONS WITH INTERVENTIONS FOR:
Health programme
Use case
Health programme
Use case
A
B
C
D
Point-of-service applications
Applications that are reused within more than one use case or health 
programme area
Applications that are uniquely used for only one use case or health 
programme area
Investment in 
new software
Funded 
software under 
development 
Investment in 
strengthening 
software 
Software for 
decommissioning 
Funded fully 
functional 
software 
Investment in 
scaling functional 
software
LEGEND
Reused 
point-of-
service 
application
Unique 
point-of-
service 
application
ENTERPRISE
EXTERNAL SYSTEMS
Nonhealth digital 
applications, 
services, 
interoperability-
enabling 
components and 
data sources with 
capabilities that 
can be used by 
the digital health 
enterprise (e.g., 
national unique 
identification 
system, national 
procurement 
system, national 
weather service
data sources)
Source: adapted from the 2020 WHO Digital Implementation Investment Guide (1).
Fig 14. DHSC architecture framework
Fig. 
14
INTER-
OPERABILITY 
LAYER
Enabling 
components
Authentication
Orchestration
Encryption
Validation
Transformation
Translation
Components that support data exchange and interoperability 
across the DHSC enterprise. OpenHIM is a useful open-source 
reference when planning for these capabilities.
HEALTH SUPPLY CHAIN INFORMATION SYSTEMS
Forecasting & 
planning
Procurement
Order management
Supplier and contract 
management
Warehouse 
management
Transportation 
management
Cold chain 
management
Dispensing
Software capabilities that support various health supply chain 
services. SCISMM and TSS v2 can be useful resources in planning and 
implementing these capabilities.
EXTERNAL SYSTEMS
Systems and 
data repositories 
(e.g., product 
master data and 
serialization data) 
that may be used 
by the DHSC 
enterprise.
DIGITAL HEALTH SUPPLY CHAIN ENTERPRISE
SHARED SERVICES
Foundational components
Product registry
Supplier registry
Facility registry
Digital ecosystems
DATA SERVICES
Analytics
Traceability
Data tools that help aggregate and 
analyse data to support decision-
making and traceability.
Other digital systems that may 
interoperate with DHSC to enable 
a collaborative ecosystem.
Data warehouse
Product verification
Supply chain reports
Track and trace
Manufacturer systems
Regulatory systems
Data repositories
Finance and insurance systems
Global platforms
Health mgmt. info systems
Quality systems
Services that 
organize 
and manage 
standardized 
master lists that will 
be referred to by 
systems across the 
DHSC enterprise.
The key components are as follows.
	
→
Foundational components. These components provide 
system capabilities for organizing and managing master 
data such as product, facility and supplier data. They 
complement other registries, such as the client registry 
and terminology services, in the digital health enterprise 
architecture. These components are foundational in that 
they enable interoperability of transactional data across 
health supply chain information systems and processes. 
They ensure a uniform and standardized referencing 
of products, facilities and suppliers across processes, 
including those for planning, order management and 
warehouse management. 
	
→
Interoperability layer. This component facilitates the 
exchange of data across various systems as well as 
across levels of the health system. Interoperability of 
DSHC systems and DHSC with other digital ecosystems 
is essential to ensure seamless data exchange that 
facilitates efficient supply chain operations and supports 
patient safety by enabling commodity traceability. The 
use of an interoperability layer eliminates the need 
for point-to-point integrations of systems, which over 
time are not sustainable and are expensive to maintain. 
With the interoperability layer, systems that share data 
with other systems need to publish data only once. The 
interoperability layer can transform the data as needed 
and route them to multiple consuming systems. Any 
future integrations can be accomplished by integrating 
with the interoperability layer without disrupting existing 
systems and their integrations.
	
→
HSCISs. These systems support the various supply chain 
processes. Note that one system or digital platform 
might support one or more supply chain processes. For 
example, an enterprise resource planning (ERP) system 
could support procurement, order management and 
warehouse management processes.
Resources such as SCISMM, TSS v2 and the IHE white 
paper on the supply of products for health care (23) 
provide details on the functional and nonfunctional 
requirements of various HSCISs as well as foundational 
and data management capabilities such as product 
master data management and interoperability. These 
resources specify what capabilities should be supported 
by each of the components within the “health supply 
chain information systems” layer.
	
→
Data services. These include components that support 
data aggregation and analysis. Digital infrastructure such 
as the data warehouse and reporting and analytics tools 
would be part of the analytical components of these 
services. These components also include traceability 
services that use the aggregated supply chain data to 
enable health product tracking, tracing and verification. 
(See Chapter 4 for more details on how the DHSC can 
enable traceability capabilities.)
	
→
External systems. These include systems that are 
outside the public health ecosystem but may integrate 
with it to exchange data, including manufacturers’ 
systems, global platforms developed by funders or 
procurement agencies, and global or regional data 
repositories that aggregate master or transactional data.
	
→
Digital ecosystems. These are other digital ecosystems 
that benefit from health supply chain data. Examples 
include the following:
	» regulatory systems that combine supply chain data 
from the dispensing system with health information 
and individuals’ data to conduct post-market 
surveillance and pharmacovigilance;
	» regulatory systems that use supply chain data such 
as data on inventory or products dispensed from 
various facilities to perform product recalls in the 
event of quality issues;
	» finance and insurance systems that combine data 
from the dispensing system with individuals’ 
information to verify and process insurance claims; 
and
	» laboratory or quality monitoring systems that 
integrate with HSCISs to trigger alerts on quality 
issues or trigger swift product quarantines or 
recalls.
