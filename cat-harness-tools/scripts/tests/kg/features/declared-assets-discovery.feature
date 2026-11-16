# scripts/check-declared-assets.ts discovers the instances whose declared assets it checks,
# rather than reading a hand-kept list, and finding none is what the gate must refuse (bean 6tkl).
# Each Scenario names the test that executes it.
Feature: The declared-asset gate discovers its instances

  @test:scripts/tests/kg/declared-assets-discovery.test.ts::instances_are_discovered,_not_listed::this_repository_has_at_least_three,_and_the_next_one_needs_no_edit
  Scenario: This repository's discovered instances number at least three
    Given this repository's checkout root
    When the declared instances are discovered
    Then at least 3 are found

  @test:scripts/tests/kg/declared-assets-discovery.test.ts::instances_are_discovered,_not_listed::folio-assistant-core_is_among_them_—_the_instance_that_was_silently_unchecked
  Scenario: folio-assistant-core is among the discovered instances
    Given this repository's checkout root
    When the declared instances are discovered
    Then the instances, relative to the root, include "folio-assistant-core"

  @test:scripts/tests/kg/declared-assets-discovery.test.ts::instances_are_discovered,_not_listed::the_root_declares_no_instance,_so_it_is_not_among_them
  Scenario: The checkout root declares no instance and is not discovered as one
    Given this repository's checkout root
    When its declaration is read
    Then there is none
    And the discovered instances do not include the root itself

  @test:scripts/tests/kg/declared-assets-discovery.test.ts::instances_are_discovered,_not_listed::a_directory_with_no_harness.json_is_NOT_an_instance
  Scenario: A directory with no declaration is not an instance
    Given a temporary root holding an empty directory "not-an-instance"
    When the declared instances are discovered
    Then "not-an-instance" is not among them

  @test:scripts/tests/kg/declared-assets-discovery.test.ts::instances_are_discovered,_not_listed::a_nested_harness.json_IS_discovered_—_declaring_itself_is_the_contract
  Scenario: A nested declaration is discovered
    Given a temporary root whose directory "sub" holds a declaration named "sub"
    When the declared instances are discovered
    Then "sub" is among them

  @test:scripts/tests/kg/declared-assets-discovery.test.ts::instances_are_discovered,_not_listed::a_repository_with_NO_declarations_discovers_none_—_which_the_gate_must_refuse
  Scenario: A root with no declarations discovers no instances
    # Gap: that the gate then refuses (exits 2) is not checked here
    Given an empty temporary root
    When the declared instances are discovered
    Then the list is empty
