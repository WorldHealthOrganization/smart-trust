# scripts/library-keywords.ts derives one folio-keywords node per library entry over
# the checkout, holding every keyword variant, never written inside the entry.
# Each Scenario names the test that executes it.
Feature: The derived keywords graph over the checkout

  @test:test/coordinator/library-keywords-checkout.test.ts::the_derived_keywords_graph_(cat-harness#1144)::names_the_six_variants,_the_surface_log-entropy_one_first
  Scenario: The six keyword variants are named, the surface log-entropy one first
    When the keyword variants are listed
    Then they are "lsi-log-entropy-surface", "lsi-tfidf-surface", "lsi-log-entropy-latent", "lsi-tfidf-latent", "lsi-log-entropy-latent-rerank" and "ca-latent", in that order

  @test:test/coordinator/library-keywords-checkout.test.ts::the_derived_keywords_graph_(cat-harness#1144)::every_node_parses_and_carries_every_variant,_for_the_document_and_each_section
  Scenario: Every keywords node parses and carries every variant, for the document and each section
    Given the keywords graphs derived from the checkout's "library" directory
    Then there is at least one
    And each parses against the keywords graph schema
    And its document and every section carry every variant
    And its path is "assets/keywords/<instance>/<encoded entry>.jsonld"

  @test:test/coordinator/library-keywords-checkout.test.ts::the_derived_keywords_graph_(cat-harness#1144)::nothing_is_written_inside_an_entry
  Scenario: No keywords file is written inside a library entry
    # Gap: when the checkout has no "library" directory nothing is checked
    Given the checkout's "library" directory
    When every file under it is listed
    Then none is a ".jsonld" file whose name contains "keywords"
