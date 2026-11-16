# RACI over the process diagrams: R is the lane and cannot be declared, the
# one-accountable rule bites on the real corpus, and every breach carries the
# kind kg-audit partitions on (bean 3kbd). Each Scenario names the test that
# executes it.
Feature: RACI involvement on process activities

  @test:scripts/tests/raci.test.ts::R_is_the_lane,_and_is_not_declarable::`responsible`_is_not_an_involvement_value
  Scenario: responsible is not an involvement value
    Then the RACI involvements are exactly "accountable", "consulted" and "informed"

  @test:scripts/tests/raci.test.ts::R_is_the_lane,_and_is_not_declarable::the_chart's_R_column_comes_from_the_lane's_role_binding
  Scenario: The chart has rows with a responsible role
    # Gap: the title says R comes from the lane's role binding; the body checks only that some row has a responsible role, not where it came from.
    When the RACI rows of the harness's diagrams are read
    Then there is at least one row
    And at least one row has a responsible role

  @test:scripts/tests/raci.test.ts::the_corpus::something_is_annotated_—_a_rule_over_an_empty_set_is_not_a_rule
  Scenario: The corpus is annotated
    When the RACI rows of the harness's diagrams are read
    Then there is at least one row, and one belongs to "Process_CRDM_DataModel"

  @test:scripts/tests/raci.test.ts::the_corpus::it_is_clean,_against_the_REAL_role_registry
  Scenario: The corpus is clean against the real role registry
    Given the declared roles, more than 10
    Then the RACI rows of the harness's diagrams have no breaches

  @test:scripts/tests/raci.test.ts::the_rule::two_accountable_roles_is_a_breach
  Scenario: Two accountable roles is a breach
    Given an activity with accountable roles "a-role" and "b-role"
    Then there is one breach saying "exactly one carries the decision"

  @test:scripts/tests/raci.test.ts::the_rule::ZERO_accountable_is_also_a_breach,_once_anything_is_claimed
  Scenario: Zero accountable is a breach once anything is claimed
    Given an activity with no accountable role and consulted "b-role"
    Then there is one breach saying "no `accountable`"

  @test:scripts/tests/raci.test.ts::the_rule::exactly_one_is_clean
  Scenario: Exactly one accountable is clean
    Given an activity accountable to "a-role" and consulting "b-role"
    Then there are no breaches

  @test:scripts/tests/raci.test.ts::the_rule::a_role_in_no_registry_is_a_breach,_in_every_column
  Scenario: A role in no registry is a breach in every column
    Given an activity naming "ghost" as accountable, as consulted, or as informed
    Then each has a breach naming "ghost"

  @test:scripts/tests/raci.test.ts::the_rule::accountable_AND_consulted_on_one_activity_is_a_breach
  Scenario: Accountable and consulted on one activity is a breach
    Given an activity accountable to and consulting "a-role"
    Then there is one breach saying "asking yourself is not consultation"

  @test:scripts/tests/raci.test.ts::the_parser::an_unrecognised_involvement_is_DROPPED,_never_coerced
  Scenario: Every role in the parsed corpus is a non-empty string
    # Gap: CAN NEVER FAIL on coercion. The title says an unrecognised involvement is dropped, never coerced; the body checks only that every accountable, consulted and informed role is a non-empty string, which a coerced involvement would also satisfy.
    When the RACI rows of the harness's diagrams are read
    Then every accountable, consulted and informed role is a non-empty string

  @test:scripts/tests/raci.test.ts::breaches_carry_the_kind_kg-audit_partitions_on::every_breach_is_tagged,_and_with_a_kind_kg-qa_registers_a_criterion_for
  Scenario: Every breach is tagged with a kind kg-qa registers a criterion for
    Given five activities each producing one breach: no accountable, two accountable, an unknown informed role, accountable also consulted, and an unknown involvement
    Then there are five breaches
    And kg-qa registers four "raci-" criteria
    And every breach has a kind whose criterion is registered

  @test:scripts/tests/raci.test.ts::breaches_carry_the_kind_kg-audit_partitions_on::severities_follow_the_registry's_dangling-vs-structural_split
  Scenario: RACI severities follow the dangling-versus-structural split
    Then "raci-role-resolves" has the severity of "role-ref-resolves", which is "critical"
    And "raci-single-accountable" and "raci-accountable-not-consulted" are "major"
