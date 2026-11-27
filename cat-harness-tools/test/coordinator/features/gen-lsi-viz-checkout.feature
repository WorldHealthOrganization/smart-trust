# Specifies evidenceModel (scripts/gen-lsi-viz.ts) over the whole checkout:
# the Indexing evidence page reads every layer's methodologies, skills, Tools
# and processes (cat-harness#1144). Each Scenario names the test that executes it.
Feature: The Indexing evidence page over the checkout

  @test:test/coordinator/gen-lsi-viz-checkout.test.ts::the_Indexing_evidence_page_over_the_checkout_(cat-harness#1144)::every_indexing_method_this_layer_declares_has_its_section,_with_held_evidence
  Scenario: Every declared indexing method has its section, with held evidence
    Given the evidence model read from the checkout
    When its methods are listed
    Then their names are INDEXING_METHODS, in order
    And every method holds at least one piece of evidence

  @test:test/coordinator/gen-lsi-viz-checkout.test.ts::the_Indexing_evidence_page_over_the_checkout_(cat-harness#1144)::lsi_is_applied_by_lsi-indexing,_which_its_Tools_satisfy
  Scenario: lsi is applied by the lsi-indexing skill, whose Tools include lsi-index and lsi-query
    Given the evidence model read from the checkout
    When the "lsi" method's skill "lsi-indexing" is read
    Then its Tools include "lsi-index" and "lsi-query"

  @test:test/coordinator/gen-lsi-viz-checkout.test.ts::the_Indexing_evidence_page_over_the_checkout_(cat-harness#1144)::an_indexing_skill_is_either_under_a_method_or_listed_as_unbacked,_never_both
  Scenario: An indexing skill is under a method or listed as unbacked, never both
    Given the evidence model read from the checkout
    When the skills under its methods and its unbacked skills are compared
    Then no unbacked skill is also under a method
    And "corpus-grep" is listed as unbacked
