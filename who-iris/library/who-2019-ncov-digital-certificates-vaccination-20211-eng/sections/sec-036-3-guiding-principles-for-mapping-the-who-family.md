---
doc_id: who-2019-ncov-digital-certificates-vaccination-20211-eng
doc_title: "DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021 SECTION 1"
section_id: sec-036-3-guiding-principles-for-mapping-the-who-family
section_title: "Guiding principles for mapping the WHO Family of International Classifications (WHO-FIC) and other classifications"
section_number: 3
pages: 82-85
source_pdf: WHO-2019-nCoV-Digital-certificates-vaccination-2021.1-eng.pdf
source_sha256: f57b14cb2acb728d
toc_source: inferred
---
International Classifications (WHO-FIC) and other 
classifications
Mapping from classifications and terminologies used in existing systems to the International 
Classification of Diseases, 11th revision (ICD-11), and other WHO-FIC classifications should follow the 
principles listed below.1 
1.	
Establish use case(s) prior to developing the map – this involves identifying and formulating the 
purpose(s) for which the map will be used and describing the different types of users and how 
they will process data using the map. 
2.	
Clearly define the purpose, scope and directionality of the map.
3.	
Maps should be unidirectional and single-purpose. Separate unidirectional maps should be used 
in place of bidirectional maps (to support both a forward and a backward map table). Such 
unidirectional maps can support data continuity for epidemiological and longitudinal studies. 
Maps should not be reversed.
4.	
Develop clear and transparent documentation that is freely available to all and that describes the 
purpose, scope, limitations and methodology of the map.
5.	
Ideally, the producers of both terminologies in any map should participate in the mapping effort 
to ensure that the result accurately reflects the meaning and usage of their terminologies. As 
a minimum, both terminology producers should participate in defining the basic purpose and 
parameters of the mapping task, reviewing and verifying the map, developing the plan for testing 
and validation, and devising a cost-effective strategy for building, maintaining and enhancing the 
map over time.
6.	
Map developers should agree on the competencies, knowledge and skills required of team 
members at the onset of the project. Ideally, target users of the map should also participate in its 
design and testing to ensure that it is fit for its intended purpose.
7.	
Establish quality assurance (QA) and usage validation protocols at the beginning of the project 
and apply them throughout the mapping process. QA and usage validation involve ensuring the 
reproducibility, traceability, usability and comparability of the maps. 
Factors that may be involved in QA include quality-assurance rules, testing (test protocols, pilot 
testing) and quality metrics (such as computational metrics or precisely defined cardinality, 
equivalence and conditionality). Clear documentation of the QA process and validation procedures 
is an important component of this step in the mapping process. If it is feasible to conduct a pilot 
test, doing so will improve the QA and validation process. Mapping is an iterative process that will 
improve over time as it is used in real settings. 
Usage validation of maps is an independent process involving users of the maps (not developers 
of the maps) in order to determine whether the maps are fit for purpose (e.g. whether end-users 
reach the correct code in the target terminology when using manual and automated maps, etc.). 
1	 Further mapping guidance details are provided in the forthcoming white paper on WHO-FIC classifications and terminology mapping 
produced in collaboration with the WHO-FIC Network, available at: www.who.int/classifications.
Page
66
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Key principles for usage validation of maps include:
a.	 Use a “gold standard” (i.e. a statement in the original source data – e.g. a diagnosis as written in 
the medical record) as the reference point. 
b.	 Compare the original source data with the end results of the following two processes.
	»
Coding of original source data with a source terminology – map code(s) of source terminology to 
code(s) of target terminology; and
	»
Coding of original source data with target terminology.
c.	 Use a statistically significant sample size that is representative of the target terminology and its 
prototypical use case settings.
d.	 When performing usage validation of automated maps, always include human (i.e. manual) 
validation.
8.	
Upon publication and release, include information about release mechanisms, release cycle, 
versioning, source/target and licence agreement requirements, and provide a feedback mechanism 
for users. Dissemination of maps should also include documentation as stated above, describing 
the purpose, scope, limitations and methodology used to create the maps.
9.	
Establish an ongoing maintenance mechanism, release cycle, types and drivers of changes, and 
versioning of maps. The maintenance phase should include an outline of the overall life-cycle 
plan for the map, conflict resolution mechanism, continuous improvement process, and decision 
process around when an update is required. Whenever maps are updated, the cycle of QA and 
validation must be repeated.
10.	 When map specialists are conducting mapping manually, it is recommended to provide the 
necessary tools and documentation to drive consistency. Such items include: the tooling 
environment (workflow details and resources related to both source and target schemes); source 
and target browsers, if available; technical specifications (use case, scope, definitions); editorial 
mapping principles or rules to ensure consistency of the maps, particularly where human 
judgement is required; and implementation guidance. Additionally, it is best practice to provide an 
environment that supports dual independent authoring of maps, as this is thought to reduce bias 
among human map specialists. Development of a consensus management process to aid in the 
resolution of discrepancies and complex issues is also beneficial. 
11.	 In computational mapping, it is advisable to include resources to ensure consistency when 
building a map using a computational approach, including a description of the tooling 
environment, when human intervention would occur, documentation (e.g. the rules used in 
computerized algorithms), and implementation guidance. It is also advisable to always compute 
the accuracy and error rate of maps. It is important to manually verify and validate the computer-
generated mapping lists. Such manual checking is necessary in the QA process, as maps that are 
generated automatically often contain errors. Such manually verified maps can also assist in the 
training of the machine-learning model when maps for different sections of terminologies are 
being generated sequentially.
12.	 The level of equivalence between source and target entities – such as equivalent, broader, 
narrower – should be specified. 
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Page
67
13.	 If the mapping uses cardinality as a metric, then it must be clearly defined in terms of what is 
being linked between source and target, how the cardinalities are counted, and the direction of 
the map. The cardinality of a map (one-to-one, one-to-many, many-to-one, and many-to-many), 
without a clear definition, however, has a very weak semantic definition, being nothing more than 
the numbers of source entities and target entities that are linked in the map.
14.	 Maps should be machine-readable to optimize their utility.
15.	 When creating maps using ICD-11, map into the foundation component first, then generate maps 
to mortality and morbidity statistics through linearization aggregation.
Page
68
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Annex 4
