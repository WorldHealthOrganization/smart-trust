---
doc_id: 10665-341997
doc_title: "Digital adaptation kit: family planning: operational requirements for implementing WHO recommendations in digital systems"
section_id: sec-002-background
section_title: "Background"
section_number: null
pages: 10-14
source_pdf: 10665-341997.pdf
source_sha256: 31e381afabc25132
toc_source: outline
---
Digital health – defined broadly as the systematic application of information and communications technologies (ICT), computer science and data 
to support informed decision-making by individuals, the health workforce and health systems, to strengthen resilience to disease and improve health 
and wellness (1) – is increasingly being applied as an essential enabler for health service delivery and accountability. Ministries of health (MOHs) have 
recognized the value of digital health as articulated within the World Health Assembly resolution (2) and the Global strategy on digital health (3). 
Likewise, donors have advocated for the rational use of digital tools as part of efforts to expand coverage and quality of services, as well as promote data 
use and monitoring efforts (4–6). Despite the investments into and abundance of digital systems, there is often limited transparency in the health data 
and logic contained in these digital tools, or relationship with evidence-based clinical or public health recommendations, which not only undermines the 
credibility of such systems, but also impedes opportunities for interoperability and threatens potential for continuity of care.
Evidence-based recommendations, such as those featured in WHO guidelines, establish standards of care and offer a reference point for informing 
the content of digital systems that countries adopt. However, guidelines are often only available in a narrative format that requires a resource-intensive 
process to be elaborated into the specifications needed for digital systems. This translation of guidelines for digital systems often results in subjective 
interpretation for implementers and software vendors, which can lead to inconsistencies or an inability to verify the content within these systems, 
potentially leading to adverse health outcomes and other unintended effects. Where digital systems exist, the documentation of the underlying data and 
content may be unavailable or proprietary, requiring governments to start from scratch and expend additional resources each time they intend to deploy 
such a system. This lack of documentation of the health content can lead to dependence on one vendor and haphazard deployments that are unscalable 
or difficult to replicate across different settings.
To ensure countries can effectively benefit from digital health investments, digital adaptation kits (DAKs) are designed to facilitate the accurate reflection 
of WHO’s clinical, public health and data use guidelines within the digital systems countries are adopting. DAKs are operational, software-neutral, 
standardized documentation that distil clinical, public health and data use guidance into a format that can be transparently incorporated into digital 
systems. Although digital implementations comprise multiple factors – including the (i) health domain data and content, (ii) digital intervention or 
functionality, and (iii) digital application or communication channel for delivering the digital intervention – DAKs focus primarily on ensuring the validity 
of the health content (see Fig. 1) (1,7). Accordingly, DAKs provide the generic content requirements that should be housed within digital systems, 
independently of a specific software application and with the intention that countries can customize them to local needs.
overview
For this particular DAK, the requirements are based 
on systems that provide the functionalities of digital 
tracking and decision support (see Box 1) and include 
components such as personas, workflows, core data 
elements, decision-support algorithms, scheduling logic 
and reporting indicators. Operational outputs, such as 
spreadsheets of the data dictionary and the detailed 
decision-support algorithms, are included as part of 
the DAK as practical resources that implementers can 
use as starting points when developing digital systems. 
Furthermore, data components within the DAK are 
mapped to standards-based terminology, such as the 
International Classification of Diseases (ICD), to facilitate 
interoperability.
The DAKs follow a modular approach in detailing the 
data and content requirements for a specific health 
programme area – such as antenatal care, family 
planning, sexually transmitted infections (STIs) – among 
the different health areas for which DAKs have been 
developed. This DAK focuses on providing the content 
requirements for a digital tracking and decision-
support system used in primary health care settings 
by health workers for family planning/contraception 
services. It also includes cross-cutting elements focused 
on the client, such as self-care interventions, although 
these interventions are described from the perspective of 
the health worker, not from that of the clients.
Foundational Layer: ICT and enabling environment
LEADERSHIP & GOVERNANCE
STRATEGY &  
INVESTMENT
SERVICES &  
APPLICATIONS
LEGISLATION,  
POLICY &  
COMPLIANCE
WORKFORCE
STANDARDS &  
INTEROPERABILITY
INFRASTRUCTURE
Health Content
Information that is aligned with 
recommended health practices 
or validated health content 
Digital Health 
Interventions
A discrete function of digital 
technology to achieve health-
sector objectives
Digital  
Applications
ICT systems and communication 
channels that facilitate delivery 
of the digital interventions and 
health content
+
+
Digital adaptation kits and their role in digital 
health implementations
FIG. 1
overview
What is digital tracking and decision support?
Digital tracking is the use of digitized records to capture and store clients’ health information to enable follow-up of their health 
status and services received (8). This may include digital forms of paper-based registers and case management logs within specific 
target populations, as well as electronic patient records linked to uniquely identified individuals (7,8).
Digital tracking makes it possible to register and follow up patient services, and may be done through an electronic medical record (EMR) or other digital 
forms of health records. Digital tracking aims to reduce lapses in continuity of care by stimulating timely follow-up contacts, and may incorporate decision-
support tools to guide health workers in: executing clinical protocols to deliver appropriate care, scheduling upcoming services, and following checklists 
for appropriate case management at point of care. Some other descriptors include: “digital versions of paper-based registers for specific health domains; 
digitized registers for longitudinal health programmes including tracking of migrant populations’ benefits and health status; case management logs within 
specific target populations, including migrant populations”(8).
Health worker decision support is defined as: “digitized job aids that combine an individual’s health information with the health worker’s knowledge and 
clinical protocols to assist health workers in making diagnosis and treatment decisions”(8). Thus, a person-centred digital tracking and decision-support 
(DTDS) system is one used by health workers at the point of care; it includes a persistent record of health events and encounters that links to clinical 
decision-support systems to reinforce good practice. It also links to reporting and management tools to reinforce accountability. A DTDS record includes all 
the information required for detailing an individual’s health status and the health interventions provided to them.
DTDS end-users are all cadres of health-care providers operating at all care levels, including those operating outside of formal health-care facilities (e.g. 
community health workers, health volunteers). DTDS systems emphasize the use of “collect once, use for many purposes” (9), in which data collected for 
service delivery can also be used for accountability (i.e. they can be used to calculate aggregate indicators required for reporting, including monitoring 
provider, stock and system performance).
WHO has provided the following 
context-specific recommendation 
for the use of an integrated system 
that provides both a digital track of 
client’s health status and decision 
support (7).
BOX 1
Effective coverage
Accountability 
coverage
Digital tracking of 
clients’ health status 
and services (digital 
tracking) combined 
with decision 
support
Recommendation 8: WHO recommends digital tracking of clients’ 
health status and services, combined with decision support under 
these conditions:
 Ⱥ in settings where the health system can support the 
implementation of these intervention components in an integrated 
manner; and
 Ⱥ for tasks that are already defined as within the scope of practice for 
the health worker. 
(Recommended only in specific contexts or conditions)
overview
Digital adaptation kits within a strategic vision for SMART Guidelines
The operational and standardized documentation reflected within the DAKs represents one of the steps within a broader vision of Standards-based, 
Machine-readable, Adaptive, Requirements-based and Testable (SMART) Guidelines. SMART Guidelines aim to maximize health impact through 
improved fidelity and uptake of recommendations within standards-based digital systems through a systematic process for transforming guideline 
development, delivery and application (10,11). Within this vision, DAKs serve as a prerequisite for developing computable, or machine-readable, 
guidelines, as well as executable reference software and advanced analytics for precision health. Fig. 2 provides an overview of the different layers of the 
SMART Guidelines continuum and where DAKs fit within this strategy (10).
Progressive layers across SMART Guideline components
FIG. 2
Narrative
Evidence-based guideline recommendations and accompanying 
implementation and data guidance
Narrative 
guidelines
L1
Operational
Human-readable software-neutral documentation of operational and 
functional requirements (e.g. personas, workflows, relevant metadata, 
transparently documented algorithms, minimum data sets, priority 
metrics, listing of relevant health interventions, functional requirements)
Digital  
adaptation  
kits
Machine  
readable
Structured software-neutral specifications, code, terminology and 
interoperability standards 
Machine-  
readable 
recommendations
Executable
Software that is able to execute static algorithms and interoperable digital 
components to deliver the operational and functional requirements
Reference 
software
Dynamic
Executable dynamic algorithms that are trained and optimized with 
advanced analytics to achieve prioritized outcomes
Precision  
health  
model
Paper 
systems
Smart 
digital 
systems
L2
L3
L4
L5
COCs   Barrier methods   IUDs   Fertility
awareness-based methods   Lactational
Coitus interruptus  Copper IUD for
amenorrhoea   Patch   Female surgical
sterilization  Intrauterine devices  CICs
emergency contraception  POCs  Patch
Male surgical sterilization Ring   ECPs
COCs   Barrier methods   IUDs   Fertility
awareness-based methods   Lactational
Coitus interruptus  Copper IUD for
amenorrhoea   Patch   Female surgical
sterilization  Intrauterine devices  CICs
emergency contraception  POCs  Patch
Male surgical sterilization Ring   ECPs
COCs   Barrier methods   IUDs   Fertility
awareness-based methods   Lactational
Coitus interruptus  Copper IUD for
amenorrhoea   Patch   Female surgical
sterilization  Intrauterine devices  CICs
emergency contraception  POCs  Patch
Male surgical sterilization Ring   ECPs
COCs   Barrier methods   IUDs   Fertility
awareness-based methods   Lactational
Coitus interruptus  Copper IUD for
amenorrhoea   Patch   Female surgical
sterilization  Intrauterine devices  CICs
emergency contraception  POCs  Patch
Male surgical sterilization Ring   ECPs
A WHO family planning cornerstone
Fifth edition, 2015
Medical eligibility 
criteria for 
contraceptive use
Contraceptive  
eligibility for women 
at high risk of HIV  
Guidance statement
Recommendations on contraceptive methods used by 
women at high risk of HIV
2018 EDITION
NEW
2018
overview
