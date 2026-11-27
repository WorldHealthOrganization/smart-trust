# pipeline/lsi.ts is the latent semantic indexing engine, checked against the worked example of
# Deerwester et al. (1990), plus its tokenizer, cross-group link proposals and keywords.
# Each Scenario names the test that executes it.
Feature: Latent semantic indexing engine

  @test:pipeline/lsi.test.ts::LSI_engine_against_Deerwester_et_al._(1990)::reads_the_paper's_12_×_9_matrix
  Scenario: The index reads the paper's 12 by 9 term-document matrix
    Given the nine memo titles of Deerwester et al. Table 2 as text over its twelve index terms
    When an index is built with k 8 and raw weighting
    Then its terms are the paper's twelve terms
    And its unit ids are c1 to c5 and m1 to m4 in order

  @test:pipeline/lsi.test.ts::LSI_engine_against_Deerwester_et_al._(1990)::the_singular_values_match_the_Appendix_to_the_two_decimals_printed
  Scenario: The singular values match the paper's Appendix to two decimals
    Given the index built with k 8 from the paper's matrix
    When its singular values are compared with the Appendix values 3.34, 2.54, 2.35, 1.64, 1.5, 1.31, 0.85 and 0.56
    Then each differs by less than 0.006

  @test:pipeline/lsi.test.ts::LSI_engine_against_Deerwester_et_al._(1990)::the_paper's_query_retrieves_c3_and_c5,_which_share_no_term_with_it
  Scenario: The paper's query retrieves c3 and c5, which share no term with it
    Given an index built with k 2 from the paper's matrix
    When "human computer interaction" is queried for 9 hits
    Then the top 5 hits are c1, c2, c3, c4 and c5
    And each of m1 to m4 has a cosine below 0.5

  @test:pipeline/lsi.test.ts::LSI_engine_against_Deerwester_et_al._(1990)::is_deterministic:_the_same_inputs_give_the_same_index
  Scenario: The same inputs give the same index
    Given the index built with k 8 and seed 1990
    When it is built again from the same inputs
    Then the singular values are equal
    And the 3 neighbours of c3 are the same

  @test:pipeline/lsi.test.ts::tokenizer::a_soft_hyphen_(U+00AD)_at_a_line_break_joins_the_word,_not_splits_it
  Scenario: A soft hyphen at a line break joins the word
    Given text with soft hyphens in "recommenda-tions" across a line break and in "organi-zation"
    When it is tokenized
    Then the tokens are "strong", "recommendations" and "organization"

  @test:pipeline/lsi.test.ts::cross-group_link_proposals_(bean_9udd)::never_links_two_units_of_the_same_group
  Scenario: Cross-group links never join two units of the same group
    Given six units in groups a, b and c sharing cat, car and music topics across groups
    When cross-group links are proposed with floor 0.5 and one link per unit
    Then no link joins two units of the same group

  @test:pipeline/lsi.test.ts::cross-group_link_proposals_(bean_9udd)::proposes_the_shared_topics_across_groups
  Scenario: Cross-group links propose the shared topics
    Given the six grouped units
    When cross-group links are proposed with floor 0.5 and one link per unit
    Then the links include "a/1~b/1", "b/2~c/1" and "a/2~c/2"

  @test:pipeline/lsi.test.ts::cross-group_link_proposals_(bean_9udd)::nothing_below_the_floor_is_proposed
  Scenario: Nothing below the floor is proposed
    Given the six grouped units
    When cross-group links are proposed with floor 0.5
    Then every link has a cosine of at least 0.5
    And with floor 1.01 there are no links and 6 are counted below the floor

  @test:pipeline/lsi.test.ts::keywordsOf_(issue_#2302)::an_adjacent_pair_said_twice_is_a_phrase_and_covers_its_words;_generic_words_are_not_keywords
  Scenario: An adjacent pair said twice is a phrase that covers its words, and generic words are not keywords
    Given five units where unit a repeats "systematic review" and says "Anyone"
    When the 8 keywords of unit a are read
    Then they include "systematic review"
    And they do not include "systematic" or "anyone"

  @test:pipeline/lsi.test.ts::keywordsOf_(issue_#2302)::a_heading_names_a_term:_it_is_boosted_to_the_front
  Scenario: A term named in a heading is boosted to the front
    Given unit d about mobile wireframe layouts
    When its 8 keywords are read with the heading "Mobile layouts"
    Then the first keyword is "mobile"

  @test:pipeline/lsi.test.ts::keywordsOf_(issue_#2302)::the_budget_scales_with_length:_a_short_text_gets_at_most_three
  Scenario: The keyword budget scales with text length
    When the keyword budget is read for length 10 with a maximum of 8
    Then it is 3
    And for length 1000 it is 8
