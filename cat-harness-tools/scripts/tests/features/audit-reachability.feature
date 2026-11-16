# scripts/audit-reachability.ts separates what loads from what can be reached: DMN tables
# the evaluator cannot read, BPMN diagrams the resolver cannot reach, and runnable modules nothing runs.
# Each Scenario names the test that executes it.
Feature: Reachability audit

  @test:scripts/tests/audit-reachability.test.ts::evaluability_is_not_loadability::a_table_that_LOADS_can_still_be_unevaluable_—_the_whole_premise,_in_one_table
  Scenario: A decision table that loads can still hold an unevaluable cell
    Given a one-rule decision table whose input entry is the range "[1..5]"
    When it is loaded
    Then it has 1 rule
    And exactly 1 unreadable expression is found, on the input side, for "fact", in rule "Rule_Probe"
    And its message contains "this evaluator does not implement"

  @test:scripts/tests/audit-reachability.test.ts::evaluability_is_not_loadability::the_supported_subset_is_clean_—_otherwise_this_check_would_fail_every_table
  Scenario: Every expression in the supported subset reads clean
    Given one-rule tables whose input entry is each of "-", "green", "> 0", "<= 2", "= 5", "true", a string list, a number list, and two not(...) forms
    When each is loaded and checked
    Then none has an unreadable expression

  @test:scripts/tests/audit-reachability.test.ts::evaluability_is_not_loadability::an_unreadable_atom_AFTER_a_matching_one_is_still_found_—_`unaryTest`'s_`some`_would_stop_early
  Scenario: An unreadable atom after a matching one is still found
    Given a one-rule table whose input entry is "0, [1..5]"
    When it is checked for unreadable expressions
    Then exactly 1 is found
    And its expression names "[1..5]" within the list "0, [1..5]"

  @test:scripts/tests/audit-reachability.test.ts::evaluability_is_not_loadability::an_unreadable_OUTPUT_literal_is_found_—_`possibleOutcomes`_reads_the_first_column_only
  Scenario: An unreadable output literal is found
    Given a one-rule table whose output entry is the bare word green
    When it is checked for unreadable expressions
    Then exactly 1 is found, on the output side, for "outcome"

  @test:scripts/tests/audit-reachability.test.ts::evaluability_is_not_loadability::a_comparison_against_a_non-numeric_literal_can_never_evaluate,_for_any_fact
  Scenario: A comparison against a non-numeric literal is unreadable
    Given a one-rule table whose input entry is '> "a"'
    When it is checked for unreadable expressions
    Then exactly 1 is found

  @test:scripts/tests/audit-reachability.test.ts::the_declared_corpus_is_the_denominator::the_union_over_instances_is_non-empty,_and_wider_than_one_instance's_scope
  Scenario: The declared diagram corpus is non-empty and spans more than one instance
    Given the declared diagrams of this repository
    Then there is at least one .bpmn and one .dmn
    And more than one instance contributes

  @test:scripts/tests/audit-reachability.test.ts::the_declared_corpus_is_the_denominator::every_declared_decision_lands_in_exactly_one_state,_with_evidence_when_it_is_not_clean
  Scenario: Every declared decision lands in one state with evidence when not clean
    Given the declared decisions of this repository and the decision references its processes make
    When their reach is computed
    Then there is at least one row
    And each row is evaluable, unevaluable or unloadable
    And an unevaluable row lists its unreadable expressions, an unloadable row says why, and an evaluable row lists none

  @test:scripts/tests/audit-reachability.test.ts::a_diagram_the_resolver_cannot_reach::every_declared_.bpmn_gets_a_state,_and_an_unreachable_one_says_why
  Scenario: Every declared .bpmn gets a state, and an unreachable one says why
    Given the declared .bpmn files of this repository
    When their process reach is computed
    Then there is one row per file
    And each row is reachable, shadowed, unloadable or shared
    And a reachable row names its process, and any other row says why
    And each ambiguity is on "stem" or "process-id" and names more than one file

  @test:scripts/tests/audit-reachability.test.ts::@entrypoint_tells_a_use_from_a_mention::only_a_declaration_at_exactly_one_space_past_the_star_counts
  Scenario: Only an @entrypoint at exactly one space past the star is a declaration
    Given docblock lines carrying @entrypoint
    Then " * @entrypoint script:merge:steward" declares "script:merge:steward"
    And a deeper-indented line, a continuation line and a "//" comment declare nothing

  @test:scripts/tests/audit-reachability.test.ts::@entrypoint_tells_a_use_from_a_mention::this_script's_own_docblock_declares_nothing,_though_it_shows_three_examples
  Scenario: The audit script's own docblock declares no entry point
    Given the source of scripts/audit-reachability.ts
    When its entry points are read
    Then there are none

  @test:scripts/tests/audit-reachability.test.ts::the_subject_is_a_declaration,_not_a_guess::a_module_is_only_examined_when_it_SAYS_it_is_runnable
  Scenario: A module is examined only when it declares itself runnable
    Given module sources
    Then one starting with a bun shebang has shape shebang true, main guard false
    And one with "if (import.meta.main)" has shape shebang false, main guard true
    And a plain export has no executable shape

  @test:scripts/tests/audit-reachability.test.ts::the_subject_is_a_declaration,_not_a_guess::test_files_are_not_entry_points,_by_either_convention
  Scenario: Test files are not entry points by either convention
    Given module paths
    Then "cat-harness/scripts/tests/x.ts", "cat-harness/schemas/x.test.ts" and "cat-harness/test/x.e2e.ts" are test modules
    And "cat-harness/scripts/x.ts" is not

  @test:scripts/tests/audit-reachability.test.ts::the_subject_is_a_declaration,_not_a_guess::the_corpus_is_swept,_every_row_carries_its_shape,_and_an_orphan_is_imported_by_no_non-test_module
  Scenario: The module sweep covers the corpus and each state carries its evidence
    Given the module reach of this repository
    Then more than 100 modules and more than 10 executables were seen
    And there is one row per executable, each with a shebang or main guard
    And an invoked row names what invokes it, and a declared row lists its entry points
    And an orphan row has no importers, and a latent row has at least one

  @test:scripts/tests/audit-reachability.test.ts::the_subject_is_a_declaration,_not_a_guess::this_gate_is_itself_reached_—_the_self-test_the_first_run_failed
  Scenario: The reachability audit itself is invoked
    Given the module reach of this repository
    Then scripts/audit-reachability.ts has a row
    And its state is "invoked"

  @test:scripts/tests/audit-reachability.test.ts::the_subject_is_a_declaration,_not_a_guess::an_invocation_must_stand_CLOSE_BEFORE_the_path,_not_merely_on_the_same_line
  Scenario: An invocation must stand close before the path, not merely on the same line
    Given lines naming a script path
    Then a workflow "run: bun run" line, an execFileSync bun run call and an inProcess invoke each count as invocations
    And a prose sentence containing "spawns" and naming scripts/merge-queue.ts in backticks does not

  @test:scripts/tests/audit-reachability.test.ts::the_subject_is_a_declaration,_not_a_guess::the_tokens_are_anchored_at_BOTH_ends_—_`executable`_and_`denominators`_are_not_invocations
  Scenario: Invocation tokens are anchored at both ends
    Given lines naming scripts/x.ts
    Then "a self-declared executable at" before it is not an invocation
    And "both denominators, then" before it is not an invocation
    And "node" and "deno run" before it are invocations

  @test:scripts/tests/audit-reachability.test.ts::the_subject_is_a_declaration,_not_a_guess::a_module_named_only_in_a_diagram's_documentation_is_NOT_counted_as_reached
  Scenario: A module named only in a diagram's documentation is not credited as reached
    # Gap: nothing is asserted unless merge-queue.ts is in the invoked state
    Given the module reach of this repository
    When scripts/merge-queue.ts reads as invoked
    Then what invokes it is not a .bpmn, a .dmn or a glossary file
