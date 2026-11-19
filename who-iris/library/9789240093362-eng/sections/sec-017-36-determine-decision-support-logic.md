---
doc_id: 9789240093362-eng
doc_title: "Digital transformation handbook for primary health care Optimizing person-centred point of service systems"
section_id: sec-017-36-determine-decision-support-logic
section_title: "Determine decision-support logic"
section_number: 3.6
pages: 44-47
source_pdf: 9789240093362-eng.pdf
source_sha256: 0d47d98390b1451d
toc_source: outline
---
Digital systems can go beyond simple data collection and aggregation by introducing additional 
layers of sophistication that are generally unavailable on paper. This includes the opportunity to 
enhance care provision with built-in decision-support logic. 
In PCPOSSs, embedded decision-support logic can help health 
workers follow appropriate clinical care pathways set out by 
WHO and national public health authorities’ guidelines and 
recommendations. The decision-support logic that can be 
integrated includes: 
•	 scheduling
•	 asking
•	 risk assessment for triage and/or referrals
•	 medical eligibility. 
These decision support mechanisms should be directed by 
clinical and evidence-based protocols that have been outlined 
by WHO or the national governing agency (e.g. the public 
health authority). 
This section describes the methods for documenting 
scheduling logic and other decision-support logic, which will 
be used to inform the back-end formulas in the PCPOSS. There 
are many ways to document and design decision-support logic. 
Decision-support logic in care pathways can be represented in 
many ways, including decision trees and/or decision-support 
tables. The methods outlined here are designed to be as simple 
as possible to use while still ensuring comprehensiveness. 
3.6.1 	 Document clinical care pathway decision-support logic
The health worker occupational group relevant to the target 
end-users dictates the clinical protocol to be embedded in 
a PCPOSS. For example, a risk-profiling decision-support 
logic can be used for the identification and prioritization of 
health service users who are at greater risk of adverse health 
outcomes. The identification of a high-risk pregnancy, for 
example, could provide risk-profiling decision support for a 
nurse/midwife doing triage, but could also give risk-profiling 
decision support to a community health worker for the 
purposes of referral. 
The clinical protocols used in the PCPOSS should follow WHO 
and/or national public health authority recommendations. 
Reference decision support logic
Depending on the health area targeted, there may 
already be decision-support logics and algorithms 
documented, in accordance with WHO guidelines. WHO’s 
Digital adaptation kits (DAKs) provide a starting point 
for decision support logic and algorithms to support 
guidelines-based service delivery. For example, WHO’s 
DAK for family planning outlines the decision support 
tables for family planning counselling and medical 
eligibility (30). Adaptation of WHO’s DAKs may require 
changes in thresholds or triggers in a logic statement and 
additional decision support logic formulas depending on 
national policies and context.
Safe decision support systems
If there is no clinical care pathway decision-support logic that is in line with evidence-based global or national normative 
guidelines, reconsider the inclusion of this decision-support logic in the system. Changes to the decision-support logic 
should be considered carefully and any new additions should be agreed upon by clinical experts. Inappropriate or 
inaccurate decision logic can put health service user’s safety and wellbeing at risk. 
TIP
WARNING
Decision-support logic matrix
A matrix of “decision-support logic” provides an inventory 
(i.e. listing) of all the decision-support logics made in clinical 
care pathways. Fig. 13 offers an example from the DAK for HIV, 
and Annex 10 offers a guide for the decision-support logic 
matrix, with brief explanations of the components needed to 
complete it. Note that the decision-support logics identified in 
the matrix are only intended to provide an overview of what 
is detailed further as decision trees and/or decision-support 
tables. 
Decision trees
A decision tree is a visual representation of the logic in 
the PCPOSS that directs the series of decisions applied in 
care pathways. Visualizing the relationships, linkages and 
dependencies between each decision helps to determine what 
the health worker needs to do next, or which screen needs 
to be displayed on the PCPOSS after a given set of inputs. 
Decision trees may be particularly useful for decision points 
that consist of multiple inputs and outputs.
Clinical protocols and algorithms depicted with decision trees 
can be based on a selected health worker occupational group, 
but note that in some settings, and depending on task-shifting 
policies, one decision logic could involve more than one health 
worker occupational group. 
WHO’s DAK for ANC provides examples of decision trees 
to supplement the use of decision-support tables (29). 
For example, Fig. 14 depicts a decision tree for antenatal 
registration for HIV testing and counselling. Each box 
represents one decision, which is represented by an algorithm 
or a series of algorithms. If that decision’s output(s) become 
another decision’s input(s), these two decisions are linked. The 
arrows show the sequence of decisions in a care pathway.
Decision trees are different from workflow diagrams. In the 
workflows mapped in section 3.3, activities would indicate 
whether a decision needs to be made. The proceeding tasks 
or activity following the outcomes of decisions might be the 
same, but the content associated with the tasks or activity 
might differ. Decision trees fill this gap. Each box in a decision 
tree will need to be further detailed so that engineers can 
programme the decision-support logic into software.
Fig. 13	 Example decision-support logic matrix from DAK for HIV

| Activity ID & activity name | Decision table ID | Decision table description | Reference/source |
| --- | --- | --- | --- |
| HIV.B2. Check for signs of serious illness OR HIV.D3. Check for signs of serious illness | HIV.DT.01 | Check for serious illness | Consolidated guidelines on HIV prevention, testing, treatment, service delivery and monitoring: recommendations for a public health<br>approach (2021) (27) Table 5.1. Components of the package of care for people with advanced HIV disease. |
| HIV.B7. Test for HIV using testing algorithm, HIV.C4. PrEP visit, HIV.D.11. Retest using HIV strategy, HIV.E4. Test [mother] for HIV using HIV testing algorithm, HIV.E12. Test [infant] for HIV using testing algorithm, HIV.F8. Test [infant] for HIV using HIV testing algorithm | HIV.DT.02 | Test for HIV using testing algorithm | Consolidated guidelines on HIV testing services (2019) (22).<br>Fig. 2. WHO universal HIV testing strategy.<br>8.4.2 Multiplex testing for HIV-1 and other infections<br>Figure 8.6. WHO recommended testing strategy for dual detection of HIV and syphilis in ANC settings.<br>Fig. 8.4. WHO HIV testing strategy for early infant diagnosis.<br>Consolidated guidelines on HIV prevention, testing, treatment, service delivery and monitoring: recommendations for a public health<br>approach (2021) (27).<br>Fig. 2.7 Simplified infant diagnosis algorithm; Fig. 2.8 Managing indeterminate test results: standard operating procedure. |
| HIV.B9. Determine recommended services | HIV.DT.03 | Determine retest recommendation | Consolidated guidelines on HIV testing services (2019) (22).<br>7.2.4 Retesting – when and who?<br>7.2.5 Testing pregnant and breastfeeding women. |
| HIV.C8. Check eligibility for PrEP | HIV.DT.04 | PrEP eligibility check | Implementation tool for pre-exposure prophylaxis of HIV infection (2017) (35). Module 1: Clinical. Use criteria in pocket card, p. 4,<br>Indications for PrEP (by history over the past 6 months) and Contraindications (with provider discretion).<br>See also Implementation tool for pre-exposure prophylaxis of HIV infection (2017) (35). Module 10. Testing providers. Table 1. Summary<br>tool for starting or monitoring PrEP and Preventing HIV during pregnancy and breastfeeding in the context of PrEP. Technical brief<br>(2017) (29). |
| HIV.C.24 Prescribe | HIV.DT.05 | Determine PEP or PrEP regimen | Consolidated guidelines on HIV prevention, testing, treatment, service delivery and monitoring: recommendations for a public health<br>approach (2021) (27) Chapter 3: HIV prevention. |
| HIV.D4. Screen for TB | HIV.DT.06 | Screen for TB | WHO consolidated guidelines on tuberculosis: tuberculosis preventive treatment. (2020) (36). Supplementary table.<br>WHO consolidated guidelines on tuberculosis Module 2: Screening – Systematic screening for tuberculosis disease (47). |

Source: WHO (31)
Fig. 14	 Decision-support logic for a clinical care pathway in the form of a decision tree
Decision-support tables
Within each of the boxes depicted in the decision tree, more 
detailed decisions can be depicted in decision-support tables. 
Decision-support tables include a decision ID, business rule, 
trigger, inputs, output, action and annotations. There are 
many methods available to document such decision-support 
logic, such as Microsoft Excel or Camunda, while adhering to 
the Decision Model and Notation (DMN) standard. Regardless 
of the method or tooling used, the engineers involved in 
building the PCPOSS will need to translate this decision-
support logic into code and a rules engine, which will then 
run the decision-support logic in the back end of the PCPOSS. 
To facilitate this process, this handbook offers a template for 
decision-support tables in Annex 11, including an example.
Antenatal registration
Provider-initiated HIV testing & counselling
HIV-positive
PMTCT, treatment, support, 
offer partner notification
Partner testing
Partner 
HIV-
negative
Woman at 
substantial risk of 
HIV acquisition
Partner not 
tested or 
HIV-positive
Offer partner:
1.	 HIV treatment 
(if HIV-positive)
2.	 Condom 
promotion
3.	 Risk reduction 
counselling
Woman not at 
substantial risk of 
HIV acquisition
Offer partner testing 
& conduct risk 
assessment
HIV-negative
Standard HIV post-test guidance and 
counselling on prevention
Provide comprehensive HIV prevention options: 
1.	 STI screening and 
treatment (syndromic 
and syphilis) 
2.	 Condom promotion
3.	 Risk reduction 
counselling
4.	 PrEP with emphasis on 
adherence
5.	 Emphasize importance 
of follow-up ANC visits
Woman who chooses to initiate PrEP
1.	 Clinical laboratory assessments
2.	 Adherence counselling
3.	 Emphasize importance of follow-up visits and repeat 
HIV testing
	»
Reassess 
woman’s 
risk
	»
Offer 
partner 
referral for 
VMMC
Risk assessment 
using tool
ANC: antenatal care; PMTCT: prevention of mother-to-child transmission; PrEP: pre-exposure prophylaxis; STI: sexually 
transmitted infection; VMMC: voluntary medical male circumcision.
Source: WHO (29)
