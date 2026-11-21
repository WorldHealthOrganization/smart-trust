---
doc_id: 9789240101197-eng
doc_title: "Digital transformation handbook for health supply chain architecture"
section_id: sec-026-traceability-models
section_title: "Traceability models"
section_number: null
pages: 54-57
source_pdf: 9789240101197-eng.pdf
source_sha256: cd157b40eef513c1
toc_source: inferred
---
The three main models for implementing traceability are the 
centralized, semi-centralized and distributed models. They 
differ mostly in how they store the data and share them with 
the relevant health authority and across actors in the supply 
chain. The centralized model involves a single database 
or repository for storing all traceability data. In a semi-
centralized model, the traceability data are spread across 
multiple databases or repositories. In the distributed model, 
traceability data are maintained separately by each supply 
chain partner. 
This handbook does not recommend a particular model 
because the best choice depends on the context and various 
other factors. But it uses the centralized model – the most 
widely implemented model – to illustrate a traceability use 
case within a DHSC architecture (Fig. 24). Details on the 
traceability models are available in WHO’s Policy Paper on 
Traceability of Medical Products (14) and the International 
Coalition of Medicines Regulatory Authorities (ICMRA) 
guidance on traceability (26).
For a centralized traceability model, the following 
technology components are essential. Note that many of 
the components required for enabling tracking, tracing 
and verification can use existing supply chain systems and 
architectural elements:
	
→foundational components – namely, globally unique 
identification of facility and product based on global 
standards and captured in a data carrier such as 
a barcode, as well as supplier master registries to 
provide master data that help combine data from 
disparate systems and derive traceability by providing 
the foundational layer for interoperability;
	
→database or repository – to aggregate and organize 
master data, transactional data and supply chain 
events data from various systems;
	
→interoperability layer – to facilitate data exchange and 
orchestration to and from various disparate systems to 
enable data sharing and data querying;
	
→HSCISs – to share data related to supply chain 
transactions and events; and
	
→traceability and analytical components – to 
synthesize the aggregated data and generate 
results for track, trace and verification queries. 
The analytical capabilities of existing reporting or 
business intelligence tools can be used for this. These 
components also include tools such as web-based and 
mobile applications that individuals can use to track, 
trace or verify health products.
Fig. 25 depicts how supply chain transactional data and 
event data can be aggregated from existing HSCISs in the 
data repository to provide verification and track and trace 
services.
Fig 24. Achieving track and trace capabilities through DHSC architecture components 
External 
systems
Manufacturer 
systems
Data 
repositories
Global 
platforms
INTEROPERABILITY 
LAYER
DATA SERVICES
Analytics
Traceability
Data 
warehouse
Product 
verification
Supply chain 
reports
Track and 
trace
Traceability data
What: product identifier, batch 
no., serial no.
When: date and time of the event
Where: location of the event
Why: details of the transaction 
(e.g., receiving, shipping, 
dispensing, discarding)
Patients
Health facilities
District 
warehouses
Regional
warehouses
Central
warehouse
Regulator
Regulator
systems
 Verification
Warehouse 
management
Warehouse 
management
Transportation 
management
Inventory 
management
Dispensing
Traceability services sysynthesize the aggregated data to answer 
questions such as:
•	 Where is the specific batch of a product currently?
•	 Has the supply chain’s integrity been maintained?
•	 Who had custody of the product on a particular date?
•	 Where were the products from a specific batch dispensed?
•	 Did the product move through known supply chain locations to reach 
the delivery point?
•	 Were there are any anomalies or gaps in the product’s movements from 
central warehouse to patients?
•	 Is the product verified as genuine?
Data
Data
Data
Data
Data
Data
Data
Fig. 
24
Using the DHSC to implement traceability
The following are some factors to consider.
	
→While the institutionalization of traceability could be 
a drawn-out, intensive process, the use of existing 
technology assets where feasible can help minimize 
the costs of system development and implementation.
	
→Designing the exchange of traceability data requires 
a technical understanding of applicable standards 
as well as a structured methodology. Traceability 
processes should be designed according to a 
structured architecture that is independent of 
the technology used to capture and share data. 
This independence is crucial to the flexibility and 
scalability of the system – that is, the ecosystem and 
the technology may evolve while the design of the 
traceability data content stays the same.
	
→One of the most important and challenging areas 
related to the implementation of traceability, or 
any DHSC process, is the quality of the master 
data. In a traceability model, sharing data across 
all stakeholders of the supply chain creates an 
information flow that precedes the physical flow of 
the product. This creates a data chain-of-custody 
effect that requires each stakeholder in the process 
to share responsibility for maintaining data integrity 
and quality. It is important that the required data be 
limited to the master data needed for the traceability 
system and that it be defined in consultation with the 
stakeholders.
	
→While the tracking and tracing of a product is 
predominantly conducted in country, traceability 
in fact commences before the product reaches that 
country. For example, manufacturers identify and 
mark the product using global standards and store 
traceability data in their databases, and those data are 
transferred to the recipient country to support local 
processes.
Fig 25. Illustrative example of a traceability service interface
Manufacturer
Patients
Central/regional 
warehouse
Track and trace results for product 001001123123
Batch number: 
A1001234
Event
Verified and 
received
Shipped
Verified and 
received
Verified and 
dispensed
Verified serial 
number 202
Event location
Central 
warehouse
Central 
warehouse
Health facility 
001
Health facility 
001
1°55'59.2"S 
30°05'57.4"E
Event date and 
time
11-Mar-2023
10:33:22
05-Apr-2023
14:05:00
06-Apr-2023
09:14:00
10-Apr-2023
15:43:00
10-Apr-2023
16:14:00
Health facilities
Product code: 001001123123
Batch: A1001234 
(serial nos. 201, 202, 203, 204)
Exp. date: 240831
Data
DATA SERVICES
Analytics
Traceability
Data 
warehouse
Product 
verification
Supply chain 
reports
Track and 
trace
Warehouse 
management
Inventory 
management
Dispensing
Event:
Ship
Event:
Receive
Event:
Receive
Event:
Dispense
Event:
Ship
Verify
Verify
Verify
Traceability service interface
Fig. 
25
Chapter
