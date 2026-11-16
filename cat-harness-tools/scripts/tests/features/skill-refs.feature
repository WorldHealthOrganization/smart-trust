# A skill reference, name or package/name, names exactly one skill.
# Each Scenario names the test that executes it.
Feature: Resolving skill references

  Background:
    Given "solo" is held by folio-core and "twice" by folio-core and crdm

  @test:scripts/tests/skill-refs.test.ts::resolveSkillRef::a_bare_name_one_package_holds_resolves_to_it
  Scenario: A bare name one package holds resolves
    Then "solo" resolves to folio-core/solo

  @test:scripts/tests/skill-refs.test.ts::resolveSkillRef::a_bare_name_two_packages_hold_is_ambiguous,_never_picked
  Scenario: A bare name two packages hold is ambiguous
    Then "twice" is ambiguous between crdm and folio-core

  @test:scripts/tests/skill-refs.test.ts::resolveSkillRef::qualifying_it_resolves_it
  Scenario: Qualifying an ambiguous name resolves it
    Then "crdm/twice" resolves to crdm/twice

  @test:scripts/tests/skill-refs.test.ts::resolveSkillRef::a_name_nothing_holds,_or_a_package_that_does_not_hold_it,_is_missing
  Scenario: An unheld name or wrong package is missing
    Then "nope" is missing
    And "crdm/solo" is missing
