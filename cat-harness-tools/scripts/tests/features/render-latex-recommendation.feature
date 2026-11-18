# A document folio's recommendation block in LaTeX (bean 55ao): a run-in
# \paragraph in the document's own words, anchored like a labelled prose
# block, and not a theorem-like environment. Each Scenario names the test that
# executes it.
Feature: A recommendation renders as a labelled run-in paragraph

  @test:scripts/tests/render-latex-recommendation.test.ts::recommendation_in_LaTeX::a_run-in_heading_with_its_title,_a_referenceable_label,_and_the_body
  Scenario: A run-in heading with the title, a label, and the body
    Given a recommendation "who-anc:rec-12" titled "Iron and folic acid"
    When it is rendered with its body
    Then the output has "\paragraph{Recommendation. Iron and folic acid}"
    And "\phantomsection\label{who-anc:rec-12}"
    And the body text

  @test:scripts/tests/render-latex-recommendation.test.ts::recommendation_in_LaTeX::the_label_is_skipped_when_it_is_the_enclosing_section's_own,_as_for_prose
  Scenario: The label is skipped when it is the enclosing section's
    When the recommendation is rendered inside a section labelled "who-anc:rec-12"
    Then the output has no "\label{who-anc:rec-12}"

  @test:scripts/tests/render-latex-recommendation.test.ts::recommendation_in_LaTeX::is_not_a_theorem-like_environment
  Scenario: A recommendation is not a theorem-like environment
    Then the environment table has no "recommendation"
    And the rendered recommendation contains no "\begin{"
