# Below the harness is every layer that does not reach the harness through
# needs (bean w1gy). Each Scenario names the test that executes it.
Feature: Which layers reach the harness

  @test:scripts/tests/needs-reach.test.ts::needs-reach::an_instance_reaches_itself_and_what_it_transitively_needs
  Scenario: An instance reaches itself and what it transitively needs
    Then cat-harness reaches cat-harness, folio-assistant-core reaches it, and bootstrap-tools does not

  @test:scripts/tests/needs-reach.test.ts::needs-reach::a_needed_name_with_no_declaration_of_its_own_still_counts_as_reached
  Scenario: A needed name with no declaration still counts as reached
    Then a layer needing cat-harness reaches it though cat-harness is not declared

  @test:scripts/tests/needs-reach.test.ts::needs-reach::bootstrap-tools_is_below_the_harness_although_the_harness_does_not_need_it
  Scenario: bootstrap-tools is below the harness although the harness does not need it
    Then the layers below cat-harness are bootstrap and bootstrap-tools

  @test:scripts/tests/needs-reach.test.ts::needs-reach::an_instance_that_needs_a_layer_the_checkout_does_not_declare_is_not_called_below
  Scenario: An instance needing an undeclared layer is not called below
    Given a checkout declaring only smart-x, which needs an undeclared layer, and bootstrap
    Then only bootstrap is below the harness

  @test:scripts/tests/needs-reach.test.ts::needs-reach::a_cycle_in_needs_terminates
  Scenario: A cycle in needs terminates
    Then a reaches cat-harness is false when a and b need each other
