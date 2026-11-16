# A gate that examined nothing refuses, and the refusal is actionable
# (bean iym1). Each Scenario names the test that executes it.
Feature: Vacuity refusal

  Background:
    Given gate "check:example" covering "skills"

  @test:scripts/tests/vacuity-refusal.test.ts::a_population_that_is_NOT_empty::one_source_with_members_is_enough_—_the_gate_judges_on_its_own_findings
  Scenario: One populated source is enough
    Then sources "a" with 1 member and "b" with none give no refusal

  @test:scripts/tests/vacuity-refusal.test.ts::a_population_that_is_NOT_empty::the_discriminating_case:_it_is_about_members,_not_about_directories_existing
  Scenario: A present but empty source refuses
    Then a single present source with no members gives a refusal

  @test:scripts/tests/vacuity-refusal.test.ts::an_empty_population_—_falsified_by_breaking::it_refuses
  Scenario: An empty population refuses
    Given source "actors" absent and "packages" present with no members
    Then the refusal says "refusing to call that a clean run"

  @test:scripts/tests/vacuity-refusal.test.ts::an_empty_population_—_falsified_by_breaking::it_names_the_SCRIPT,_so_the_reader_can_re-run_exactly_this
  Scenario: The refusal names the script
    Then the refusal names "check:example"

  @test:scripts/tests/vacuity-refusal.test.ts::an_empty_population_—_falsified_by_breaking::it_names_every_source_with_its_resolved_path
  Scenario: The refusal names every source and its path
    Then the refusal names "actors" at "/repo/actors" and "packages" at "/repo/packages"

  @test:scripts/tests/vacuity-refusal.test.ts::an_empty_population_—_falsified_by_breaking::ABSENT_and_present-but-empty_are_DIFFERENT_states,_because_they_are_different_repairs
  Scenario: Absent and present-but-empty are told apart
    Then the refusal says "ABSENT" and "present, nothing matched"

  @test:scripts/tests/vacuity-refusal.test.ts::an_empty_population_—_falsified_by_breaking::it_says_which_declared_kind_would_be_falsely_credited
  Scenario: The refusal names the kind that would be credited
    Then the refusal says "@covers skills" and "audit:coverage"

  @test:scripts/tests/vacuity-refusal.test.ts::an_empty_population_—_falsified_by_breaking::...and_says_nothing_about_a_kind_when_the_gate_declares_none
  Scenario: A gate covering no kind does not mention coverage
    Then for a gate covering nothing or "none", the refusal says "refusing" but not "audit:coverage"

  @test:scripts/tests/vacuity-refusal.test.ts::an_empty_population_—_falsified_by_breaking::it_cites_the_bean_and_the_class,_so_the_next_reader_finds_the_reasoning
  Scenario: The refusal cites its beans
    Then the refusal names "iym1" and "6tkl"

  @test:scripts/tests/vacuity-refusal.test.ts::an_empty_population_—_falsified_by_breaking::it_says_an_empty_population_may_be_legitimate,_and_how_to_record_that
  Scenario: The refusal says how to record a legitimate empty
    Then the refusal says "record" and names "check-bean-front-matter"

  @test:scripts/tests/vacuity-refusal.test.ts::a_gate_that_recorded_no_sources_at_all::refuses,_and_says_THAT_is_its_own_defect
  Scenario: A gate with no sources refuses
    Then a gate recording no sources is refused with "NO sources" and "its own defect"
