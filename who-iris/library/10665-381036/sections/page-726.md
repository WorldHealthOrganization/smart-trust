---
doc_id: 10665-381036
doc_title: "WHO consolidated guidelines on tuberculosis. Module 3: Diagnosis"
section_id: page-726
section_title: "Page 726"
section_number: null
pages: 726-726
source_pdf: 10665-381036.pdf
source_sha256: 83e481b3ccc61cf4
toc_source: undetermined
---
setting minimal performance characteristics which individual platforms within class will have to meet 
in the future. 
 
We performed and individual patient data (IPD) meta-analysis instead of a classical meta-analysis. 
There were a number of reasons for this: 
- 
The studies identified in the literature were generally too small to contribute to a classical 
meta-analysis 
- 
An IPD meta-analysis allowed for co-variables to be included in the model 
- 
A large proportion of the data came from FIND where the same samples were sequenced 
on different platforms. The IPD approach allowed us to control for this. 
 
For each of sensitivity, specificity, positive predictive value (PPV), negative predictive value (NPV), 
we generated a binary dependent variable (1/0): 
 
• 
Sensitivity=1 if true positive; Sensitivity=0 if false negative 
• 
Specificity=1 if true negative; Specificity =0 if false positive 
• 
NPV=1 if true negative; NPV=0 if false negative 
• 
PPV=1 if true positive; PPV=0 if false positive 
 
For each dependent variable we then built a multivariable model in which we included a number of 
co-variables as fixed effects. These included rifampicin resistance as determined by MTB/RIF Xpert® 
or Xpert Ultra® for all drugs other than rifampicin; semi-quantitative CT value from MTB/RIF Xpert® 
or Xpert Ultra®; and a co-variable to indicate which samples featured in duplicate and which not (all 
FIND samples were assayed once by Deeplex® Myc-TB and once by NanoTB®). We initially included 
this variable as a random effect but the model failed to converge, so it was included as a fixed effect. 
For models looking specifically at diagnostic test accuracy in HIV infection, we also included HIV 
test results as a co-variable. However, as data on HIV were only available from FIND, we did not 
include HIV in the main models to avoid losing all the data from other studies. Finally, we included 
the study site as a random effect. 
 
The models were run in STATA (version 17) using the melogit command, and the outputs 
transformed using the margins command: 
 
 
 
In this example the dependent variable is ‘sensiti ity for isoniazi ’  We include an additional variable 
‘all’ that is coded uniformly as ‘1’ in order to capture the overall effect with the margins command.  
 
We ran models for all PICO questions for sensitivity, specificity, NPV and PPV.  
 
No data on patient outcomes were available. 
 
Using MTB/RIF Xpert® or Xpert Ultra® results 
 
Data on rifampicin resistance by MTB/RIF Xpert® or Xpert Ultra® were used for two different 
purposes. First, these results formed part of the composite reference standard for rifampicin. In this 
case it was important to use the MTB/RIF Xpert® or Xpert Ultra® obtained from the same sample 
that was used for the index test. Second, these results informed the co-variable ‘ i a picin 
 esistance’ in the multivariable models. 
 
Whilst each study that provided us with data on MTB/RIF Xpert® or Xpert Ultra® did so for just a 
melogit sens_inh i.all i.rif i.ct i.hiv i.duplicate ||   study: 
Independent variables
Dependent variable
Random effect
