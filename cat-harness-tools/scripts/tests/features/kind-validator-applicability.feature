# `scripts/check-kind-validators.ts` sorts every registered kind into one state, keeping
# a reasoned `validatorNotApplicable` decision apart from a gap.
# Each Scenario names the test that executes it.
Feature: Kind validator applicability

  @test:scripts/tests/kind-validator-applicability.test.ts::the_three_states_partition_the_registry::no_kind_has_stayed_silent,_and_none_contradicts_itself
  Scenario: No kind is undeclared and none contradicts itself
    Given the harness instance
    When the kind-validator sweep runs
    Then no kind is undeclared
    And no kind is contradictory
    And at least one kind is marked not applicable

  @test:scripts/tests/kind-validator-applicability.test.ts::the_three_states_partition_the_registry::every_kind_lands_in_exactly_ONE_state
  Scenario: Every kind lands in exactly one state
    Given the harness instance
    When the kind-validator sweep runs
    Then the kinds named across resolved, not applicable, undeclared, unresolvable, contradictory and elsewhere have no duplicates
    And their count equals the number of kinds in the default registry

  @test:scripts/tests/kind-validator-applicability.test.ts::the_three_states_partition_the_registry::a_kind_left_to_another_layer_names_an_owner_this_checkout_does_not_hold
  Scenario: A kind left to another layer names an owner this checkout does not hold
    Given the harness instance and the layers this checkout holds
    When the kind-validator sweep runs
    Then every kind left elsewhere names the owner the registry records for it
    And that owner is not a layer this checkout holds

  @test:scripts/tests/kind-validator-applicability.test.ts::a_reason_must_name_a_FACT,_not_a_preference::each_cites_a_file_format,_an_absent_subject,_or_several_families
  Scenario: Each not-applicable reason cites a file format, an absent subject, or several families
    Given the harness instance
    When the kind-validator sweep runs
    Then every not-applicable reason is longer than 40 characters
    And every reason matches at least one of: a file format, an absent subject, several node families

  @test:scripts/tests/kind-validator-applicability.test.ts::a_kind_cannot_claim_both::nothing_marked_not-applicable_also_declares_a_schema
  Scenario: Nothing marked not applicable also declares a validator or node schemas
    Given the harness instance
    When the kind-validator sweep runs
    Then no not-applicable kind declares a validator
    And no not-applicable kind declares nodeSchemas

  @test:scripts/tests/kind-validator-applicability.test.ts::the_clean_break_(bean_riit):_validators_are_nodes,_not_strings_on_a_kind::no_authored_kind_carries_validator_code,_except_code_in_another_repository
  Scenario: No authored kind carries validator code, except code in another repository
    When the authored validator strings are listed
    Then none remain once those referring to a foreign repository prefix are set aside
