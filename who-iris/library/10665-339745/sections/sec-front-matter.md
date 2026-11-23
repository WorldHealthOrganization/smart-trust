---
doc_id: 10665-339745
doc_title: "Digital Adaptation Kit for Antenatal Care"
section_id: sec-front-matter
section_title: "Front matter"
section_number: null
pages: 1-6
source_pdf: 10665-339745.pdf
source_sha256: 27dcd2fc950be021
toc_source: outline
---
recommendations
A
indicators
workflows
data
decisions
scenarios
requirements
personas
Digital 
Adaptation Kit 
for Antenatal 
Care
Operational requirements  
for implementing WHO  
recommendations in  
digital systems
SMART GUIDELINES
Digital 
Adaptation Kit 
for Antenatal 
Care
Operational requirements  
for implementing WHO  
recommendations in  
digital systems
SMART GUIDELINES
Digital adaptation kit for antenatal care: operational requirements for implementing WHO recommendations in digital systems
ISBN 978-92-4-002030-6 (electronic version) 
ISBN 978-92-4-002031-3 (print version)
© World Health Organization 2021
Some rights reserved. This work is available under the Creative Commons Attribution-NonCommercial-ShareAlike 3.0 IGO licence (CC BY-NC-SA 3.0 IGO; https://creativecommons.org/
licenses/by-nc-sa/3.0/igo). 
Under the terms of this licence, you may copy, redistribute and adapt the work for non-commercial purposes, provided the work is appropriately cited, as indicated below. In any use of 
this work, there should be no suggestion that WHO endorses any specific organization, products or services. The use of the WHO logo is not permitted. If you adapt the work, then you 
must license your work under the same or equivalent Creative Commons licence. If you create a translation of this work, you should add the following disclaimer along with the suggested 
citation: “This translation was not created by the World Health Organization (WHO). WHO is not responsible for the content or accuracy of this translation. The original English edition shall 
be the binding and authentic edition”.
Any mediation relating to disputes arising under the licence shall be conducted in accordance with the mediation rules of the World Intellectual Property Organization (http://www.wipo.
int/amc/en/mediation/rules/).
Suggested citation. Digital adaptation kit for antenatal care: operational requirements for implementing WHO recommendations in digital systems. Geneva: World Health Organization; 
2021. Licence: CC BY-NC-SA 3.0 IGO.
Cataloguing-in-Publication (CIP) data. CIP data are available at http://apps.who.int/iris.
Sales, rights and licensing. To purchase WHO publications, see http://apps.who.int/bookorders. To submit requests for commercial use and queries on rights and licensing, see  
http://www.who.int/about/licensing.
Third-party materials. If you wish to reuse material from this work that is attributed to a third party, such as tables, figures or images, it is your responsibility to determine whether 
permission is needed for that reuse and to obtain permission from the copyright holder. The risk of claims resulting from infringement of any third-party-owned component in the work 
rests solely with the user.
General disclaimers. The designations employed and the presentation of the material in this publication do not imply the expression of any opinion whatsoever on the part of WHO 
concerning the legal status of any country, territory, city or area or of its authorities, or concerning the delimitation of its frontiers or boundaries. Dotted and dashed lines on maps 
represent approximate border lines for which there may not yet be full agreement. 
The mention of specific companies or of certain manufacturers’ products does not imply that they are endorsed or recommended by WHO in preference to others of a similar nature that 
are not mentioned. Errors and omissions excepted, the names of proprietary products are distinguished by initial capital letters.
All reasonable precautions have been taken by WHO to verify the information contained in this publication. However, the published material is being distributed without warranty of any 
kind, either expressed or implied. The responsibility for the interpretation and use of the material lies with the reader. In no event shall WHO be liable for damages arising from its use. 
Design and layout by RRD Design LLC
Contents
Acknowledgements .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . iv
Abbreviations .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . v
Part 1. Overview	
Background .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  2
Objectives .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 6
Components of a digital adaptation kit .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  7
How to use this digital adaptation kit .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 11
Linkages to the broader digital health ecosystem .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  14
Part 2. Digital adaptation kit content for antenatal care
Component 1.	
Health interventions and recommendations
16
Component 2.	
Generic personas
18
Component 3.	
User scenarios
23
Component 4.	
Generic business processes and workflows
28
Component 5.	
Core data elements
49
Component 6.	
Decision-support logic
59
Component 7.	
Indicators and performance metrics
67
Component 8.	
Functional and non-functional requirements
72
Glossary .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 78
Annexes
Annex 1. Examples of detailed persona .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  82
Annex 2. Guidance adding or amending data elements to the data dictionary .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 84
References .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  87
Web Annexes	
Web Annex A. Core data dictionary .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  apps.who.int/iris/bitstream/handle/10665/339740/WHO-SRH-21.1-eng.xlsx
Web Annex B. Decision-support logic .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . apps.who.int/iris/bitstream/handle/10665/339741/WHO-SRH-21.2-eng.xlsx
Web Annex C. Indicators and performance metrics .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  apps.who.int/iris/bitstream/handle/10665/339742/WHO-SRH-21.3-eng.xlsx
Web Annex D. Functional and non-functional requirements  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . apps.who.int/iris/bitstream/handle/10665/339744/WHO-SRH-21.4-eng.xlsx
