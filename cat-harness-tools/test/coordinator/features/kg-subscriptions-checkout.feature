# Specifies knownSubstrates (scripts/subscriptions-viz.ts): a staged instance
# is derived as planned, over a synthetic checkout and over the real one.
Feature: A staged instance is derived as a planned substrate; the real checkout stages none

  @test:test/coordinator/kg-subscriptions-checkout.test.ts::the_known-substrates_registry_(subscriptions-viz)::a_staged_instance_is_DERIVED_as_planned_—_nobody_keeps_a_second_list_of_it
  Scenario: A staged instance is derived as planned and a home instance is not listed
    Given a synthetic checkout with an instance "staged" living at o/host and an instance "home" living at its own repository o/home
    When the known substrates are derived
    Then "staged" is listed with status "planned", source "staged instance" and repository "o/staged"
    And "home" is not listed

  @test:test/coordinator/kg-subscriptions-checkout.test.ts::the_known-substrates_registry_(subscriptions-viz)::this_checkout_stages_nothing,_so_nothing_is_derived_as_planned_—_core_is_its_own_repository_now
  Scenario: The real checkout stages nothing
    Given the checkout
    When the known substrates are derived
    Then none has the source "staged instance"
    And folio-assistant-core is not listed
