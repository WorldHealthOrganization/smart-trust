# schemas/bootstrap-reading.test.ts checks how cat-harness reads bootstrap: the
# published class vocabulary and the graph-typology registry take bootstrap's own
# sentences. Each Scenario names the test that executes it.
Feature: The harness reads bootstrap's terms and kinds as bootstrap states them

  @test:schemas/bootstrap-reading.test.ts::the_harness_reads_bootstrap's_terms_and_kinds_as_bootstrap_states_them::the_published_vocabulary_uses_bootstrap's_definitions,_and_bootstrap's_terms_link_nowhere_above
  Scenario: The published vocabulary glosses exactly bootstrap's terms with bootstrap's sentences
    Given bootstrap's published terms and the harness's class glosses
    When each term is looked up as a class with its whitespace removed
    Then its gloss is bootstrap's sentence and its layer is "bootstrap"
    And the bootstrap-layer classes are exactly bootstrap's terms, nothing more
    And "Tool" is no bootstrap term and its class belongs to the harness
    And no bootstrap-layer class carries a see-also link

  @test:schemas/bootstrap-reading.test.ts::the_harness_reads_bootstrap's_terms_and_kinds_as_bootstrap_states_them::the_harness's_registry_reads_bootstrap's_sentence;_the_class_it_types_a_directory_with_is_its_own
  Scenario: The registry reads each bootstrap kind's summary as bootstrap's sentence
    # Gap: the title's claim that the class typing a directory is the harness's own is not checked.
    Given bootstrap's graph typologies, of which there is at least one
    When each kind is looked up in the harness's base graph-typology registry
    Then it is defined there with bootstrap's sentence as its summary
    And its graph-typology layer is "bootstrap"
