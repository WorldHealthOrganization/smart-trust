# pipeline/ca.ts (correspondence analysis) and pipeline/lsi.ts checked against the worked
# example of Qi, Hessen & van der Heijden (2023), Table 1 and Fig. 1.
# Each Scenario names the test that executes it.
Feature: Correspondence analysis against the published worked example

  @test:pipeline/ca.test.ts::the_shared_matrix,_read_as_LSA-RAW_(Qi_et_al._Table_2)::singular_values_8.425,_3.261,_0.988,_0.574,_0.272
  Scenario: Read as LSA-RAW, the matrix has the published singular values
    Given the six-document, six-term matrix of Qi et al. Table 1, where "jaguar" is both a cat and a car
    When an LSI index with raw weighting and k = 5 is built
    Then its singular values are 8.425, 3.261, 0.988, 0.574 and 0.272 to within 0.0015

  @test:pipeline/ca.test.ts::correspondence_analysis_(Qi_et_al._§2.2,_Fig._1b)::the_first_two_principal_inertias_are_0.475_(93.2_%)_and_0.017_(3.4_%)
  Scenario: The first two principal inertias match the published figure
    Given the six-document, six-term matrix of Qi et al. Table 1, where "jaguar" is both a cat and a car
    When a correspondence analysis with k = 4 is built
    Then the first two principal inertias are 0.475 and 0.017 to within 0.0006
    And they are 93.2 % and 3.4 % of the total inertia to within 0.0006

  @test:pipeline/ca.test.ts::correspondence_analysis_(Qi_et_al._§2.2,_Fig._1b)::the_principal_inertias_sum_to_the_total_inertia_χ²/N_—_a_theorem,_not_a_fit
  Scenario: The principal inertias sum to the total inertia
    Given the six-document, six-term matrix of Qi et al. Table 1, where "jaguar" is both a cat and a car
    When a full-rank correspondence analysis with k = 5 is built
    Then the sum of its squared singular values equals the total inertia to within 1e-9

  @test:pipeline/ca.test.ts::correspondence_analysis_(Qi_et_al._§2.2,_Fig._1b)::jaguar_lies_between_the_cat_terms_and_the_car_terms,_document_4_between_the_cat_and_car_documents
  Scenario: The polysemous term and the mixed document fall between the cat and car groups
    # Gap: document 4 is only checked to sit closer to the car side than every cat document, not to lie short of the car documents
    Given the six-document, six-term matrix of Qi et al. Table 1, where "jaguar" is both a cat and a car
    When a correspondence analysis with k = 4 is built
    Then on dimension 1 "jaguar" lies between the cat terms and the car terms
    And the cat documents 1-3 share one sign and the car documents 5-6 the opposite sign
    And document 4 sits nearer the car side than every cat document

  @test:pipeline/ca.test.ts::correspondence_analysis_(Qi_et_al._§2.2,_Fig._1b)::every_dimension_is_centred_on_the_masses:_Σ_r_i_φ_ik_=_0_(the_margins_are_removed)
  Scenario: Every dimension is centred on the row masses
    Given the six-document, six-term matrix of Qi et al. Table 1, where "jaguar" is both a cat and a car
    When a correspondence analysis with k = 4 is built
    Then on every dimension the mass-weighted sum of the document coordinates is 0 to within 1e-9

  @test:pipeline/ca.test.ts::correspondence_analysis_(Qi_et_al._§2.2,_Fig._1b)::the_transition_formula_places_a_document_where_the_analysis_put_it
  Scenario: Folding a document in through the transition formula reproduces its position
    Given the six-document, six-term matrix of Qi et al. Table 1, where "jaguar" is both a cat and a car
    When each document's text is folded into the analysis
    Then the folded vector has cosine above 0.999999 with the document's own coordinates
