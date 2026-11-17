---
doc_id: 10665-381036
doc_title: "WHO consolidated guidelines on tuberculosis. Module 3: Diagnosis"
section_id: page-271
section_title: "Page 271"
section_number: null
pages: 271-271
source_pdf: 10665-381036.pdf
source_sha256: 83e481b3ccc61cf4
toc_source: undetermined
---
266 
 
involved in any of the included studies did not participate in data extraction of their own study. We 
extracted the data and recorded it using Microsoft® Excel and entered it into Review Manager Web 
directly [Collaboration 2020].  
3.3.3 Assessment of methodological quality 
We assessed the methodological quality of included studies using QUADAS-2 [Whiting 2011] and 
QUADAS-C [Yang 2021a] tools (Appendices 2 and 3). QUADAS-2 is a tool for assessing risk of bias in and 
applicability of single test accuracy estimates; QUADAS-C is an extension to QUADAS-2 for assessing risk 
of bias in comparative accuracy estimates. Two review authors independently assessed each study. We 
resolved disagreements through discussion and, if necessary, by involving a third review author as 
arbiter. Review authors who were involved in any of the included studies did not participate in 
assessment of their own study.    
3.3.4 Statistical analysis and data synthesis 
See Appendix 7: Data analysis plan. From each study, we estimated sensitivity, specificity, and their 
absolute differences (parallel testing minus component test) between index tests under comparison 
(together with 95% confidence intervals) and visualised these in forest plots and summary receiver 
operating characteristic (SROC) plots.  
If at least 3 studies were available for a given analysis, we performed bivariate random-effects meta-
analysis [Reitsma 2005; Chu 2006] using a Bayesian approach to estimate mean sensitivity, mean 
specificity, the 95% credible interval (CrI) and the 95% prediction interval (PI) of each test.  
To estimate the absolute summary difference in sensitivity and the absolute summary difference in 
specificity between tests, we also used the Bayesian bivariate random-effects model, but with slight 
changes to the original approach. Instead of modelling at the lower level (within-study) sensitivity and 
specificity and computing the difference between summary estimates across tests, we directly modelled 
the difference in sensitivity and difference in specificity within each study. This was accomplished by 
assuming that difference in TP (TP of parallel testing minus TP of component test) and difference in TN 
(TN of parallel testing minus TN of component test) both follow a binomial distribution.  This approach 
naturally accounts for the dependence between the two tests being compared (i.e. the parallel testing 
strategy and the component test) and ensures that difference in sensitivity cannot be lower than zero 
and difference in specificity cannot be greater than zero, as would be expected when using two tests in 
parallel. As the binomial distribution does not allow negative integers (TN of parallel testing minus TN of 
component test is likely to be negative), we used positive values to fit the model and edited the 
specificity calculation to report a negative difference estimate. 
We conducted these analyses in R statistical software version 4.3.2 using the package rjags. 
We specified prior distributions as follows (log-odds scale): 
• Mean logit-transformed sensitivity and mean logit-transformed specificity: normal 
distribution with mean 0 and variance of 4, corresponding to a roughly uniform 
distribution on the probability scale. 
• Corresponding between-study standard deviation: gamma distribution with a shape 
parameter of 2 and rate parameter of 0.5 
• Correlation between the logit-transformed sensitivities and specificities across studies: 
uniform distribution from -1 to 1 
Overall, index test results were analysed as either test ‘positive’ or ‘negative’. For the parallel testing, we 
considered any positive test result as a ‘positive’ result for the combination. Participants in whom 
diagnostic testing was attempted but who did not have a result for any reason along the diagnostic
