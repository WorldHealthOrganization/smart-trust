# check:read-only-graphs: a directory's readOnly declaration and its bytes
# must agree, and a deliberate difference with a stated basis is an
# exception, not a failure (owner, 2026-09-22). A fixture layer declares one
# directory "d/" holding a given number of materialized records. Each
# Scenario names the test that executes it.
Feature: A directory's read-only declaration agrees with what it holds

  @test:scripts/tests/read-only-graphs.test.ts::the_four_verdicts_stay_apart::declared_read-only_over_materialized_nodes_agrees
  Scenario: Read-only over materialized nodes agrees
    Given a directory declared read-only with a basis, holding 3 materialized nodes
    Then its verdict is "agrees"

  @test:scripts/tests/read-only-graphs.test.ts::the_four_verdicts_stay_apart::declared_read-only_over_NOTHING_materialized_contradicts
  Scenario: Read-only over nothing materialized contradicts
    Given a directory declared read-only with a basis, holding nothing
    Then its verdict is "contradicts"

  @test:scripts/tests/read-only-graphs.test.ts::the_four_verdicts_stay_apart::declared_read-only_over_nothing_YET_is_not-applicable_when_its_content_is_built_at_publish
  Scenario: Read-only over nothing yet is not applicable when built at publish
    Given a directory declared read-only, holding nothing, and the layer declaring "d/index.json" built at publish
    Then its verdict is "not-applicable", saying "built at publish" and naming "d/index.json"

  @test:scripts/tests/read-only-graphs.test.ts::the_four_verdicts_stay_apart::...but_a_builtAtPublish_path_OUTSIDE_the_directory_excuses_nothing
  Scenario: A built-at-publish path outside the directory excuses nothing
    Given a directory declared read-only, holding nothing, and built-at-publish paths "d2/index.json" and "e/"
    Then its verdict is "contradicts"

  @test:scripts/tests/read-only-graphs.test.ts::the_four_verdicts_stay_apart::...and_does_not_excuse_a_missing_basis
  Scenario: Built at publish does not excuse a missing basis
    Given a directory declared read-only with no basis, holding nothing, and "d/index.json" built at publish
    Then its verdict is "contradicts"

  @test:scripts/tests/read-only-graphs.test.ts::the_four_verdicts_stay_apart::DECLARED_WRITABLE_OVER_MATERIALIZED_NODES_IS_AN_EXCEPTION_when_a_basis_says_why
  Scenario: Writable over materialized nodes with a basis is an exception
    Given a directory declared writable with basis "the ingestion drop zone", holding 1 materialized node
    Then its verdict is "exception", saying "drop zone"

  @test:scripts/tests/read-only-graphs.test.ts::the_four_verdicts_stay_apart::...and_a_CONTRADICTION_when_nothing_says_why
  Scenario: Writable over materialized nodes with no basis contradicts
    Given a directory declared writable with no basis, holding 1 materialized node
    Then its verdict is "contradicts"

  @test:scripts/tests/read-only-graphs.test.ts::the_four_verdicts_stay_apart::silence_over_materialized_nodes_is_`undeclared`,_never_`false`
  Scenario: Silence over materialized nodes is undeclared
    Given a directory with no readOnly field, holding 2 materialized nodes
    Then its verdict is "undeclared" with nothing declared

  @test:scripts/tests/read-only-graphs.test.ts::the_four_verdicts_stay_apart::silence_over_nothing_materialized_is_not_a_finding_at_all
  Scenario: Silence over nothing materialized is not a finding
    Given a directory with no readOnly field, holding nothing
    Then its verdict is "not-applicable"

  @test:scripts/tests/read-only-graphs.test.ts::materializedNodesIn_counts_records,_not_the_word::does_not_count_prose_that_mentions_the_state
  Scenario: Prose mentioning the state is not counted
    Given a JSON file whose note mentions "materialized"
    Then it holds 0 materialized nodes

  @test:scripts/tests/read-only-graphs.test.ts::materializedNodesIn_counts_records,_not_the_word::finds_a_record_nested_at_any_depth
  Scenario: A record nested at any depth is counted
    Given a JSON file with a materialized record nested in an array
    Then it holds 1 materialized node

  @test:scripts/tests/read-only-graphs.test.ts::materializedNodesIn_counts_records,_not_the_word::ignores_states_that_are_not_materialized
  Scenario: Other materialization states are not counted
    Given a JSON file with a "referenced" record
    Then it holds 0 materialized nodes

  @test:scripts/tests/read-only-graphs.test.ts::this_repository's_own_declarations::examines_directories_at_all
  Scenario: The repository's declarations are examined
    When this repository's read-only declarations are checked
    Then there is at least one verdict

  @test:scripts/tests/read-only-graphs.test.ts::this_repository's_own_declarations::none_contradicts_its_content
  Scenario: No directory of this repository contradicts its content
    Then no verdict is "contradicts"

  @test:scripts/tests/read-only-graphs.test.ts::this_repository's_own_declarations::every_directory_holding_materialized_nodes_has_answered
  Scenario: Every directory of this repository holding materialized nodes has answered
    Then no verdict is "undeclared"

  @test:scripts/tests/read-only-graphs.test.ts::this_repository's_own_declarations::every_stated_exception_actually_states_something
  Scenario: Every stated exception states something
    Then every "exception" verdict's reason is longer than 40 characters
