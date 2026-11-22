---
doc_id: 10665-381036
doc_title: "WHO consolidated guidelines on tuberculosis. Module 3: Diagnosis"
section_id: page-339
section_title: "Page 339"
section_number: null
pages: 339-339
source_pdf: 10665-381036.pdf
source_sha256: 83e481b3ccc61cf4
toc_source: undetermined
---
accomplished by assuming that difference in TP (TP of parallel testing minus TP of component test) 
and difference in TN (TN of parallel testing minus TN of component test) both follow a binomial 
distribution.  This approach naturally accounts for the dependence between the two tests being 
compared (i.e. the parallel testing strategy and the component test) and ensures that difference in 
sensitivity cannot be lower than zero and difference in specificity cannot be greater than zero, as 
would be expected when using two tests in parallel. As the binomial distribution does not allow 
negative integers (TN of parallel testing minus TN of component test is likely to be negative), we 
used positive values to fit the model and edited the specificity calculation to report a negative 
difference estimate. 
We conducted these analyses in R statistical software version 4.3.2 using the package rjags. 
We specified prior distributions as follows: 
• Mean logit-transformed sensitivity and mean logit-transformed specificity: normal 
distribution with mean 0 and variance of 4, corresponding to a roughly uniform 
distribution on the probability scale. 
• Corresponding between-study standard deviation: gamma distribution with a shape 
parameter of 2 and rate parameter of 0.5 
• Correlation between the logit-transformed sensitivities and specificities across 
studies: uniform distribution from -1 to 1 
Overall, index test results were analysed as either test ‘positive’ or ‘negative’. For the parallel 
testing, we considered any positive test result as a ‘positive’ result for the combination. Participants 
in whom diagnostic testing was attempted but who did not have a result for any reason along the 
diagnostic testing pathway were regarded as ‘not positive’. This included (a) participants with an 
inadequate or unavailable specimen for testing and (b) participants with an invalid or technical 
failure (i.e. non-determinate test results). For the primary analysis, we analysed participants with a 
‘not positive’ as test negative. We performed a sensitivity analysis in which those participants with 
at least one missing or non-determinate index test result were excluded (see below). 
3.3.5 Approach to unavailable or non-determinate results  
To avoid selection bias, we analysed the total number of participants with positive and negative 
reference standard results, irrespective of participants’ ability to provide a specific sample for the 
index test. In some patients, urine or sputum specimens may have been unavailable because the 
patient was unable to produce the specimen (i.e. unavailable). For some specimens, testing may not 
have resulted in a valid result (i.e. a non-determinate result). When possible, we clarified the 
reasons for unavailable index test result (e.g. specimen was unable to be obtained; specimen was 
inadequate for testing; processing or transportation issue; invalid or indeterminate lab result). 
For LC-aNAATs, non‐determinate results for the detection of tuberculosis included tests classified as 
“INVALID”, “ERROR”, or “NO RESULT”.  
For LF-LAM, the non‐determinate results for the detection of tuberculosis were the number of tests 
where the control band did not appear or where the test band intensity could not be read.  
For analytical purposes of evaluating a parallel testing strategy (in which either sputum LC-aNAAT or 
urine LF-LAM may contribute diagnostic data), non-determinate index test results on one index test 
were included as ‘not positive’ (i.e. negative). 
We did not include data on indeterminate results for the detection of rifampicin resistance.  
3.3.6 Investigations of heterogeneity 
All investigations of heterogeneity were conducted using diagnostic accuracy data based on the 
microbiological reference standard. We investigated heterogeneity in comparative accuracy 
estimates by performing subgroup analysis with the covariates:  
• Signs and symptoms of tuberculosis (i.e. pulmonary, extrapulmonary or both) versus 
asymptomatic
