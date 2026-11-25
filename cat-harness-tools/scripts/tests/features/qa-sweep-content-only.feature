# A QA sweep walks active content, and the declaration's graph layers say
# which that is: a context graph such as fsh-guts is skipped, a derived one
# such as library is too, and a declaration fault walks everything (owner,
# 2026-09-20; bean hqku). The fixture repository holds one block in "folio/"
# and one in "fsh-guts/". Each Scenario names the test that executes it.
Feature: A QA sweep walks only active content

  @test:scripts/tests/qa-sweep-content-only.test.ts::a_sweep_walks_content_and_skips_what_is_declared_retired::the_fixture_is_real_—_both_blocks_exist_and_are_admissible
  Scenario: The fixture's two blocks are both admissible
    When the fixture is walked including non-content
    Then the blocks are "folio/probe.ts" and "fsh-guts/probe.ts"

  @test:scripts/tests/qa-sweep-content-only.test.ts::a_sweep_walks_content_and_skips_what_is_declared_retired::by_default_the_`fsh-guts`_block_is_NOT_walked
  Scenario: By default the fsh-guts block is not walked
    When the fixture is walked
    Then the only block is "folio/probe.ts"

  @test:scripts/tests/qa-sweep-content-only.test.ts::a_sweep_walks_content_and_skips_what_is_declared_retired::`includeNonContent`_is_the_'unless_explicit_otherwise'
  Scenario: includeNonContent walks the retired block
    When the fixture is walked including non-content
    Then "fsh-guts/probe.ts" is walked

  @test:scripts/tests/qa-sweep-content-only.test.ts::a_sweep_walks_content_and_skips_what_is_declared_retired::the_FOLIO_is_never_the_thing_skipped_—_the_corpus_is_what_a_sweep_is_for
  Scenario: The folio is never skipped
    When the fixture is walked
    Then "folio/probe.ts" is walked

  @test:scripts/tests/qa-sweep-content-only.test.ts::a_sweep_walks_content_and_skips_what_is_declared_retired::an_entry_declaring_NO_graphs_is_walked_—_silence_is_not_evidence_of_retirement
  Scenario: A directory declaring no graphs is walked
    Given a repository whose only directory "odd/" declares no graph typologies
    When it is walked
    Then the only block is "odd/probe.ts"

  @test:scripts/tests/qa-sweep-content-only.test.ts::a_sweep_walks_content_and_skips_what_is_declared_retired::a_MALFORMED_declaration_walks_everything_rather_than_nothing
  Scenario: A malformed declaration walks everything
    Given a repository whose declaration is not JSON, with a block in "folio/"
    When it is walked
    Then the only block is "folio/probe.ts"

  @test:scripts/tests/qa-sweep-content-only.test.ts::why_the_skip_needs_no_'unknown_layer'_arm::an_unknown_graph_typology_THROWS_in_readDeclaration,_so_it_never_reaches_the_filter
  Scenario: An unknown graph typology throws when the declaration is read
    Given a declaration naming graph typology "totally-made-up"
    When it is read
    Then it throws "unknown graph typology"

  @test:scripts/tests/qa-sweep-content-only.test.ts::why_the_skip_needs_no_'unknown_layer'_arm::...and_such_a_repo_is_WALKED,_not_silently_emptied
  Scenario: A repository with an unknown typology is walked
    Given a declaration naming graph typology "totally-made-up" for "x/", with a block there
    When it is walked
    Then the only block is "x/probe.ts"

  @test:scripts/tests/qa-sweep-content-only.test.ts::`derived`_—_the_fourth_layer,_and_why_`library/`_is_on_it_(bean_`hqku`)::`library`_is_`derived`
  Scenario: library is a derived graph
    Then the layer of "library" is "derived"
    And "library" is a derived graph

  @test:scripts/tests/qa-sweep-content-only.test.ts::`derived`_—_the_fourth_layer,_and_why_`library/`_is_on_it_(bean_`hqku`)::...so_a_sweep_skips_it,_with_no_directory_name_written_down
  Scenario: library is not a content graph
    # Gap: the title says a sweep skips library; the body checks only that "library" is not a content graph, and walks nothing.
    Then "library" is not a content graph

  @test:scripts/tests/qa-sweep-content-only.test.ts::`derived`_—_the_fourth_layer,_and_why_`library/`_is_on_it_(bean_`hqku`)::`context`_is_ruled_out_—_a_declared_process_WRITES_library/
  Scenario: library is not a context graph
    # Gap: the title says a declared process writes library/; the body checks only that document-ingestion.bpmn mentions "library" somewhere.
    Given the document-ingestion.bpmn diagram
    Then it mentions "library"
    And the layer of "library" is not "context"

  @test:scripts/tests/qa-sweep-content-only.test.ts::`derived`_—_the_fourth_layer,_and_why_`library/`_is_on_it_(bean_`hqku`)::a_`derived`_graph_is_not_writable-in-passing_either_—_it_is_produced
  Scenario: A derived graph is not writable in passing
    Then a process may not write "library" in passing

  @test:scripts/tests/qa-sweep-content-only.test.ts::`derived`_—_the_fourth_layer,_and_why_`library/`_is_on_it_(bean_`hqku`)::the_layer_predicates_stay_mutually_exclusive,_and_none_is_a_negation
  Scenario: The layer predicates are mutually exclusive
    Then each of "library", "folio", "beans" and "memory" satisfies at most one of the content, context, state and derived predicates

  @test:scripts/tests/qa-sweep-content-only.test.ts::`derived`_—_the_fourth_layer,_and_why_`library/`_is_on_it_(bean_`hqku`)::an_unregistered_kind_is_still_not_`derived`_—_absence_says_nothing
  Scenario: An unregistered kind is not derived
    Then "not-a-kind" is not a derived graph
