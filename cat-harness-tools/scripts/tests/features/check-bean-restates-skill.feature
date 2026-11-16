# scripts/check-bean-restates-skill.ts finds open beans that carry a phase-contract table (an enumerated phase column plus an exit-criterion column) restating what a skill should hold.
# Each Scenario names the test that executes it.
Feature: Beans that restate a skill's phase contract

  @test:scripts/tests/check-bean-restates-skill.test.ts::the_fixture_that_decides_it_—_one_bean,_two_states::kn0t_BEFORE_PR_#1185_is_flagged
  Scenario: The kn0t bean before its repair carries one phase-contract table
    Given the kn0t bean body as it stood before PR #1185, with phases P0 to P4 and an exit criterion column
    When contractTables reads it
    Then 1 table is found
    And its header is "| phase | does | exit criterion |"
    And it has 5 rows

  @test:scripts/tests/check-bean-restates-skill.test.ts::the_fixture_that_decides_it_—_one_bean,_two_states::kn0t_AFTER_PR_#1185_is_clean_—_though_it_still_says_'exit_criterion'_twice
  Scenario: The kn0t bean after its repair has no contract table though it still mentions exit criteria
    Given the kn0t bean body after PR #1185, a skill pointer and a drift table
    Then the body still contains "exit criteri"
    And contractTables finds no table

  @test:scripts/tests/check-bean-restates-skill.test.ts::the_fixture_that_decides_it_—_one_bean,_two_states::the_pre-repair_bean_named_NO_skill_—_so_the_pointer_cannot_be_a_CONDITION
  Scenario: The pre-repair bean named no skill, so a skill pointer cannot be a condition
    Given the kn0t bean before and after PR #1185
    When skillPathsNamed reads each
    Then the before body names no skill path
    And the after body names "fhir-harness/skills/fhir-ig-base/ig-publisher-reduction.md"

  @test:scripts/tests/check-bean-restates-skill.test.ts::the_measured_false_positives,_each_pinned_as_clean::`3pqn`_—_an_exit-CODE_table_is_not_a_contract
  Scenario: An exit-code table is not a contract
    Given a table with columns state, means and exit whose exit cells are 0, 1 and 2
    When contractTables reads it
    Then no table is found

  @test:scripts/tests/check-bean-restates-skill.test.ts::the_measured_false_positives,_each_pinned_as_clean::`6f1x`_—_an_exit_column_that_IS_the_first_column,_still_codes
  Scenario: An exit-code column placed first is still codes, not a contract
    Given a table with columns exit and meaning whose exit cells are 0, 1 and 2
    When contractTables reads it
    Then no table is found

  @test:scripts/tests/check-bean-restates-skill.test.ts::the_measured_false_positives,_each_pinned_as_clean::`3kbd`_—_QA_criteria_as_identifiers_are_a_design_record,_not_a_contract
  Scenario: QA criteria listed as identifiers are a design record, not a contract
    Given a table with columns criterion, severity and why listing criterion identifiers
    When contractTables reads it
    Then no table is found

  @test:scripts/tests/check-bean-restates-skill.test.ts::the_measured_false_positives,_each_pinned_as_clean::`5xfr`_—_a_registry_read-off_keyed_by_domain_is_not_a_contract
  Scenario: A registry read-off keyed by domain is not a contract
    Given a table with columns domain and criteria listing criteria per domain
    When contractTables reads it
    Then no table is found

  @test:scripts/tests/check-bean-restates-skill.test.ts::the_measured_false_positives,_each_pinned_as_clean::`jut3`_—_a_measurement_table_has_no_criterion_column_at_all
  Scenario: A measurement table with no criterion column is not a contract
    Given a table of page kinds with published, rendered and gap counts
    When contractTables reads it
    Then no table is found

  @test:scripts/tests/check-bean-restates-skill.test.ts::the_conditions,_each_falsified_by_mutation::drop_the_criterion_column_and_it_is_an_ordinary_plan_table
  Scenario: Without a criterion column a phased table is an ordinary plan table
    Given a phased P0/P1 table
    Then with an "exit criterion" column contractTables finds 1 table
    And with that column renamed "notes" it finds none

  @test:scripts/tests/check-bean-restates-skill.test.ts::the_conditions,_each_falsified_by_mutation::drop_the_phase_enumeration_and_it_is_an_ordinary_criterion_table
  Scenario: Without a phase enumeration a criterion table is ordinary
    Given a table with columns area and exit criterion and rows "navigation" and "terminology"
    When contractTables reads it
    Then no table is found

  @test:scripts/tests/check-bean-restates-skill.test.ts::the_conditions,_each_falsified_by_mutation::a_numbered_phase_in_the_CELLS_carries_it_when_the_header_does_not
  Scenario: Numbered phases in the cells count when the header names no phase
    Given a table headed what, does and exit criterion with rows "Phase 1" and "Phase 2"
    When contractTables reads it
    Then 1 table is found

  @test:scripts/tests/check-bean-restates-skill.test.ts::the_conditions,_each_falsified_by_mutation::ONE_numbered_cell_is_not_an_enumeration_—_two_are
  Scenario: One numbered cell is not an enumeration but two are
    Given a criterion table whose first cells are "P0" and "the rest"
    Then contractTables finds no table
    And with "the rest" replaced by "P1" it finds 1 table

  @test:scripts/tests/check-bean-restates-skill.test.ts::the_conditions,_each_falsified_by_mutation::a_single_data_row_is_a_heading_in_disguise,_not_a_contract
  Scenario: A phased table with a single data row is not a contract
    Given a phase table with only a P0 row and an exit criterion column
    When contractTables reads it
    Then no table is found

  @test:scripts/tests/check-bean-restates-skill.test.ts::the_conditions,_each_falsified_by_mutation::a_numeric_criterion_among_prose_rows_still_counts_—_the_exclusion_is_ALL_or_nothing
  Scenario: A numeric criterion among prose criteria still counts as a contract
    Given a phase table whose P0 criterion is "0" and P1 criterion is prose
    When contractTables reads it
    Then 1 table is found

  @test:scripts/tests/check-bean-restates-skill.test.ts::parseTables::two_tables_separated_by_prose_are_two_tables,_not_one
  Scenario: Two tables separated by prose are parsed as two tables
    Given two pipe tables with a line of prose between them
    When parseTables reads them
    Then 2 tables are returned
    And the first header is "a" and "exit"
    And the second has the single row "P1", "y"

  @test:scripts/tests/check-bean-restates-skill.test.ts::parseTables::a_line_of_pipes_with_no_separator_row_is_not_a_table
  Scenario: A line of pipes with no separator row is not a table
    Given a pipe line followed by prose and no separator row
    When parseTables reads it
    Then no table is returned

  @test:scripts/tests/check-bean-restates-skill.test.ts::the_report_names_a_disagreement,_never_a_direction_—_`ekp9`_point_4::it_does_not_tell_anyone_to_delete_the_bean's_copy
  Scenario: The report asks to reconcile and does not say to delete the bean's copy
    Given a result with one finding for bean "aaaa" naming the todo-manager skill
    When formatReport renders it
    Then it does not contain "Delete the copy"
    And it contains "RECONCILE" and "read both before editing either"
    And it names "aaaa" and "cat-harness/work-plan/skills/work-plan/todo-manager.md"

  @test:scripts/tests/check-bean-restates-skill.test.ts::the_report_names_a_disagreement,_never_a_direction_—_`ekp9`_point_4::the_clean_line_claims_only_what_was_measured
  Scenario: The clean report line claims only what was measured
    Given a result with 258 beans examined and no findings
    When formatReport renders it
    Then it contains "no open bean carries a phase-contract table"
    And it does not contain "no bean restates"

  @test:scripts/tests/check-bean-restates-skill.test.ts::checkBeanRestatesSkill_over_a_synthetic_tree::an_open_bean_with_the_contract_table_is_a_finding;_a_closed_one_is_history
  Scenario: An open bean with the contract table is a finding and a closed one is not examined
    Given a synthetic bean store with an in-progress and a completed bean carrying the pre-repair kn0t body and a todo bean with the repaired body
    When checkBeanRestatesSkill runs
    Then 2 beans are examined
    And the only finding is bean "aaaa"

  @test:scripts/tests/check-bean-restates-skill.test.ts::checkBeanRestatesSkill_over_a_synthetic_tree::the_finding_says_whether_the_contract_has_a_home_—_the_remedy_differs
  Scenario: A finding records which skill paths the bean names
    Given two todo beans with the pre-repair kn0t body, one also citing the todo-manager skill path
    When checkBeanRestatesSkill runs
    Then the finding for "aaaa" names no skills
    And the finding for "bbbb" names "cat-harness/work-plan/skills/work-plan/todo-manager.md"

  @test:scripts/tests/check-bean-restates-skill.test.ts::checkBeanRestatesSkill_over_a_synthetic_tree::no_bean_store_at_all_is_`absent`,_not_a_defect
  Scenario: No bean store at all is reported as absent, not as a defect
    Given an empty directory
    When checkBeanRestatesSkill runs
    Then store is false
    And there are no findings

  @test:scripts/tests/check-bean-restates-skill.test.ts::checkBeanRestatesSkill_over_a_synthetic_tree::a_store_with_no_OPEN_bean_examines_nothing_—_the_caller's_vacuity_guard_exits_2
  Scenario: A store with no open bean examines nothing
    Given a bean store whose only bean is completed
    When checkBeanRestatesSkill runs
    Then store is true
    And 0 beans are examined
    And there are no findings
    # Gap: the caller's exit code 2 is not run; only examined being 0 is asserted.
