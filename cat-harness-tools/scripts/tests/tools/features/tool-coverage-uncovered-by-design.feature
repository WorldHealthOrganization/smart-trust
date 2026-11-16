# scripts/tool-coverage.ts declares UNCOVERED_BY_DESIGN, the tier-A skills that stay
# uncovered on purpose, and flags any annotation that has gone stale.
# Each Scenario names the test that executes it.
Feature: Skills uncovered by design and their stale annotations

  @test:scripts/tests/tools/tool-coverage-uncovered-by-design.test.ts::the_table_is_well_formed::every_entry_carries_a_non-trivial_reason
  Scenario: Every uncovered-by-design entry carries a substantial reason
    Given the uncovered-by-design table
    Then every reason is longer than 80 characters
    And every reason mentions a bean or contains a backtick

  @test:scripts/tests/tools/tool-coverage-uncovered-by-design.test.ts::the_table_is_well_formed::no_skill_is_annotated_twice
  Scenario: No skill appears twice in the table
    Given the uncovered-by-design table
    Then its skill names are all distinct

  @test:scripts/tests/tools/tool-coverage-uncovered-by-design.test.ts::the_table_is_well_formed::every_state_is_one_the_type_admits
  Scenario: Every entry's state is an admitted one
    Given the uncovered-by-design table
    Then every state is "folio-mechanism" or "contract-unsatisfied"

  @test:scripts/tests/tools/tool-coverage-uncovered-by-design.test.ts::the_table_is_well_formed::contract-unsatisfied_is_still_empty,_and_that_is_deliberate
  Scenario: No entry is in the contract-unsatisfied state
    Given the uncovered-by-design table
    Then no entry has state "contract-unsatisfied"

  @test:scripts/tests/tools/tool-coverage-uncovered-by-design.test.ts::staleAnnotations_discriminates::an_annotated_skill_that_is_uncovered_and_tier_A_is_not_stale
  Scenario: An annotated skill still uncovered in tier A is not stale
    Given triage rows holding the first annotated skill in tier A
    When the stale annotations are computed
    Then that skill is not among them

  @test:scripts/tests/tools/tool-coverage-uncovered-by-design.test.ts::staleAnnotations_discriminates::an_annotated_skill_absent_from_the_uncovered_set_is_stale_—_it_gained_a_Tool
  Scenario: An annotated skill missing from the triage is stale because it has a Tool
    Given no triage rows
    When the stale annotations are computed
    Then every table entry is stale
    And the first one's reason contains "Tool now"

  @test:scripts/tests/tools/tool-coverage-uncovered-by-design.test.ts::staleAnnotations_discriminates::an_annotated_skill_that_moved_off_tier_A_is_stale,_and_says_which_tier
  Scenario: An annotated skill moved off tier A is stale and names its tier
    Given triage rows holding the first annotated skill in tier C
    When the stale annotations are computed
    Then that skill is among them
    And its reason contains "tier C"

  @test:scripts/tests/tools/tool-coverage-uncovered-by-design.test.ts::uncoveredByDesign::returns_the_entry_for_an_annotated_skill_and_undefined_otherwise
  Scenario: Looking up a skill returns its entry only when annotated
    Given the uncovered-by-design table
    When the first annotated skill is looked up
    Then its state matches the table entry's state
    And looking up "a-skill-that-does-not-exist" returns nothing
