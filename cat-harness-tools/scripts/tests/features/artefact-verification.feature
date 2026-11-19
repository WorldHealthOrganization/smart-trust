# scripts/check-artefact-verification.ts derives the generated-artefact checks from package.json
# and reports each one that has no declared consumer verification. Each Scenario names the test that executes it.
Feature: Artefact verification declarations

  @test:scripts/tests/artefact-verification.test.ts::the_inventory_is_DERIVED,_never_listed::a_check_running_a_generator_with_--check_is_picked_up
  Scenario: A script running a generator with --check is picked up
    Given a package.json whose "thing:check" script runs "gen-thing.ts --check"
    When the artefact checks are derived
    Then the only check is "thing:check"

  @test:scripts/tests/artefact-verification.test.ts::the_inventory_is_DERIVED,_never_listed::a_check_that_is_not_a_--check_run_is_not
  Scenario: A check script that is not a --check run is not picked up
    Given a package.json whose "check:something" script runs "x.ts" without --check
    When the artefact checks are derived
    Then there are none

  @test:scripts/tests/artefact-verification.test.ts::the_inventory_is_DERIVED,_never_listed::a_NEW_generator_is_picked_up_with_no_edit_here_—_the_tyyc_property
  Scenario: A new generator is picked up without editing a list
    Given a package.json with two scripts each running a generator with --check
    When the artefact checks are derived
    Then there are two

  @test:scripts/tests/artefact-verification.test.ts::the_middle_class_is_`undetermined`,_not_`validated`::no_parse_call_at_all_means_it_CANNOT_be_validating_its_output
  Scenario: A generator with no parse call is classified as not parsing
    Given a --check generator whose source only writes a file
    When the artefact checks are derived
    Then its classification is "no-parsing"

  @test:scripts/tests/artefact-verification.test.ts::the_middle_class_is_`undetermined`,_not_`validated`::a_parse_call_does_NOT_establish_that_the_OUTPUT_is_validated
  Scenario: A generator with a parse call is undetermined, not validated
    Given a --check generator whose source calls JSON.parse on its input
    When the artefact checks are derived
    Then its classification is "undetermined"

  @test:scripts/tests/artefact-verification.test.ts::three_states,_and_undeclared_is_the_finding::a_declared_consumer_check_is_not_a_finding
  Scenario: A check declared as verified by a consumer is not a finding
    Given two derived checks, both declared as verified by a test
    When the report is made
    Then nothing is undeclared

  @test:scripts/tests/artefact-verification.test.ts::three_states,_and_undeclared_is_the_finding::a_declared_`none`_WITH_a_reason_is_not_a_finding_—_saying_so_is_the_point
  Scenario: A check declared as none with a reason is not a finding
    Given two derived checks, both declared "none" with a reason
    When the report is made
    Then nothing is undeclared and nothing is reasonless

  @test:scripts/tests/artefact-verification.test.ts::three_states,_and_undeclared_is_the_finding::a_`none`_with_an_EMPTY_reason_is_a_finding_—_it_looks_decided_and_is_not
  Scenario: A none declaration with a blank reason is a finding
    Given "a:check" declared "none" with a whitespace-only reason
    When the report is made
    Then "a:check" is reported as reasonless

  @test:scripts/tests/artefact-verification.test.ts::three_states,_and_undeclared_is_the_finding::UNDECLARED_is_a_finding_—_nobody-said_is_not_nothing-to-check
  Scenario: An undeclared check is a finding
    Given only "a:check" is declared, while "b:check" is also derived
    When the report is made
    Then "b:check" is reported as undeclared

  @test:scripts/tests/artefact-verification.test.ts::three_states,_and_undeclared_is_the_finding::a_declaration_for_a_check_that_no_longer_exists_is_stale_—_the_list_may_only_shrink
  Scenario: A declaration for a check that no longer exists is stale
    Given a "none" declaration for "gone:check", which is not derived
    When the report is made
    Then "gone:check" is reported as stale

  @test:scripts/tests/artefact-verification.test.ts::a_checkout_holding_part_of_the_declared_table::an_entry_the_table_lacks_is_excused,_not_stale,_and_says_so
  Scenario: In a partial checkout an entry the table lacks is excused, not stale
    Given a declaration naming "index-only:check" and an unchecked "gone.ts", neither present in this checkout
    When the report is made for a partial "a rooted checkout"
    Then nothing is stale or unchecked-stale
    And "index-only:check" and "gone.ts" are reported as excused

  @test:scripts/tests/artefact-verification.test.ts::a_checkout_holding_part_of_the_declared_table::a_check_present_here_with_no_declaration_is_still_a_finding
  Scenario: In a partial checkout a present check with no declaration is still a finding
    Given a derived "new:check" that has no declaration
    When the report is made for a partial checkout
    Then "new:check" is reported as undeclared

  @test:scripts/tests/artefact-verification.test.ts::a_checkout_holding_part_of_the_declared_table::without_a_partial_table_the_same_entry_is_stale,_as_before
  Scenario: Without a partial table the same entry is stale
    Given the same declarations naming "index-only:check"
    When the report is made without naming a partial checkout
    Then "index-only:check" is reported as stale
    And nothing is excused

  @test:scripts/tests/artefact-verification.test.ts::a_GENERATOR_with_no_--check_is_visible_too_(bean_`v556`)::a_qa-results_writer_that_no_command_runs_with_--check_is_listed
  Scenario: A qa-results writer that no script runs with --check is listed
    Given a "gen:x" script running "gen-x.ts", whose source calls the qa-results writer, with no --check script
    When the unchecked generators are derived
    Then they are exactly "gen-x.ts"

  @test:scripts/tests/artefact-verification.test.ts::a_GENERATOR_with_no_--check_is_visible_too_(bean_`v556`)::the_same_writer_with_a_--check_invocation_is_not_—_it_is_in_the_main_inventory_instead
  Scenario: A writer that also has a --check script is in the main inventory instead
    Given "gen-x.ts" run both plainly and by a "gen:x:check" script with --check
    When the unchecked generators and the artefact checks are derived
    Then there are no unchecked generators
    And the only artefact check is "gen:x:check"

  @test:scripts/tests/artefact-verification.test.ts::a_GENERATOR_with_no_--check_is_visible_too_(bean_`v556`)::the_writer's_DEFINITION_is_not_a_call
  Scenario: The writer's definition is not a call to it
    Given a script whose source only defines the qa-results writer function
    When the unchecked generators are derived
    Then there are none

  @test:scripts/tests/artefact-verification.test.ts::a_GENERATOR_with_no_--check_is_visible_too_(bean_`v556`)::an_undeclared_unchecked_generator_is_a_finding;_a_declared_one_is_not;_a_stale_one_is
  Scenario: Unchecked generators are reported as undeclared or stale against their declarations
    Given unchecked declarations for "a.ts" and "gone.ts" and derived unchecked generators "a.ts" and "b.ts"
    When the report is made
    Then "b.ts" is reported as an undeclared unchecked generator
    And "gone.ts" is reported as a stale unchecked declaration

  @test:scripts/tests/artefact-verification.test.ts::a_GENERATOR_with_no_--check_is_visible_too_(bean_`v556`)::an_`unchecked`_entry_with_an_empty_reason_is_reasonless
  Scenario: An unchecked declaration with a blank reason is reasonless
    Given "a.ts" declared unchecked with a whitespace-only reason
    When the report is made with "a.ts" as an unchecked generator
    Then "a.ts" is reported as reasonless

  @test:scripts/tests/artefact-verification.test.ts::a_GENERATOR_with_no_--check_is_visible_too_(bean_`v556`)::the_REAL_repository:_kg-export.ts_is_no_longer_an_unchecked_generator
  Scenario: The real repository's kg-export.ts is not an unchecked generator
    When the unchecked generators of the real repository are derived
    Then they do not include "cat-harness/scripts/kg-export.ts"
