# Issue #1164: the bootstrap Requirement, the harness Requirement built on it,
# test runs that cite requirements, and the checks check:requirements and
# check:bootstrap-concepts. The base requirement "req:glass-navigation" has a
# functional statement "zoom" and a non-functional statement "no-drag-only".
# Each Scenario names the test that executes it.
Feature: Requirements, their statements and the checks that hold them

  @test:scripts/tests/requirements.test.ts::the_bootstrap_Requirement::a_functional_and_a_non-functional_statement,_together
  Scenario: A functional and a non-functional statement together parse
    Then the base requirement parses

  @test:scripts/tests/requirements.test.ts::the_bootstrap_Requirement::a_KIND_is_a_promise_about_the_fields_—_a_non-functional_statement_cannot_want
  Scenario: A non-functional statement cannot carry a capability
    Given the non-functional statement given capability "go faster"
    Then the requirement fails to parse, with an issue naming "capability"

  @test:scripts/tests/requirements.test.ts::the_bootstrap_Requirement::…and_a_functional_one_has_no_quality_category
  Scenario: A functional statement has no quality category
    Given the functional statement given category "performance"
    Then the requirement fails to parse

  @test:scripts/tests/requirements.test.ts::the_bootstrap_Requirement::a_statement_key_is_its_address,_so_it_appears_once
  Scenario: A statement key appears once
    Given both statements keyed "zoom"
    Then the requirement fails to parse

  @test:scripts/tests/requirements.test.ts::the_bootstrap_Requirement::superseded_names_what_superseded_it
  Scenario: A superseded requirement names what superseded it
    Then status "superseded" without supersededBy fails, and with supersededBy "req:x" parses

  @test:scripts/tests/requirements.test.ts::the_bootstrap_Requirement::an_id_is_`req:<slug>`
  Scenario: An id is req:<slug>
    Then id "Glass Navigation" fails to parse

  @test:scripts/tests/requirements.test.ts::the_bootstrap_Requirement::a_statement_MAY_carry_success_criteria_(issue_#2405_—_optional_until_migrated)
  Scenario: Success criteria are optional
    Then the requirement parses with a success criterion on "zoom"
    And it still parses without one

  @test:scripts/tests/requirements.test.ts::the_bootstrap_Requirement::…and_when_it_does:_at_least_one,_a_known_verification_method,_keys_unique
  Scenario: Success criteria, when present, are non-empty, known and uniquely keyed
    Then an empty list, an unknown verification "vibes", and two criteria keyed "a" each fail
    And two distinct criteria with known methods parse

  @test:scripts/tests/requirements.test.ts::the_bootstrap_Requirement::a_reference_may_name_one_success_criterion_of_a_statement
  Scenario: A reference may name one success criterion
    Then the reference to criterion "pinch" of "zoom" is "req:glass-navigation#zoom/pinch" and parses
    And "req:glass-navigation/pinch" and "req:glass-navigation#zoom/" do not

  @test:scripts/tests/requirements.test.ts::the_bootstrap_Requirement::a_reference_names_a_requirement,_or_one_statement_in_it
  Scenario: A reference names a requirement or one statement
    Then the reference to "zoom" is "req:glass-navigation#zoom"
    And "req:glass-navigation" and "req:glass-navigation#zoom" parse, while "glass-navigation#zoom" does not

  @test:scripts/tests/requirements.test.ts::the_PUBLISHED_schema_refuses_what_the_Zod_refuses_(FR-7:_bootstrap_holds_only_the_JSON)::a_valid_requirement_passes
  Scenario: The published JSON schema accepts a valid requirement
    Then the published requirement.schema.json validates the base requirement

  @test:scripts/tests/requirements.test.ts::the_PUBLISHED_schema_refuses_what_the_Zod_refuses_(FR-7:_bootstrap_holds_only_the_JSON)::success_criteria:_optional,_but_never_empty_and_never_an_unknown_method
  Scenario: The published schema takes success criteria as optional but never empty or unknown
    Then it accepts one known criterion
    And it refuses an empty list, verification "vibes", and a criterion with no text

  @test:scripts/tests/requirements.test.ts::the_PUBLISHED_schema_refuses_what_the_Zod_refuses_(FR-7:_bootstrap_holds_only_the_JSON)::a_non-functional_statement_cannot_want
  Scenario: The published schema refuses a non-functional statement with a capability
    Then it refuses the non-functional statement given capability "go faster"

  @test:scripts/tests/requirements.test.ts::the_PUBLISHED_schema_refuses_what_the_Zod_refuses_(FR-7:_bootstrap_holds_only_the_JSON)::a_functional_statement_has_no_quality_category
  Scenario: The published schema refuses a functional statement with a category
    Then it refuses the functional statement given category "performance"

  @test:scripts/tests/requirements.test.ts::the_PUBLISHED_schema_refuses_what_the_Zod_refuses_(FR-7:_bootstrap_holds_only_the_JSON)::superseded_names_what_superseded_it
  Scenario: The published schema requires supersededBy for a superseded requirement
    Then it refuses status "superseded" alone and accepts it with supersededBy "req:x"

  @test:scripts/tests/requirements.test.ts::the_harness's_Requirement_is_built_on_it::every_existing_requirement_file_still_parses_—_building_on_the_base_moved_nothing
  Scenario: Every existing harness requirement file still parses
    Given the JSON files in cat-harness/skills/requirements
    Then there is at least one
    And each parses as a harness requirement

  @test:scripts/tests/requirements.test.ts::the_harness's_Requirement_is_built_on_it::the_base's_rules_survive_the_narrowing
  Scenario: The base's rules survive in the harness requirement
    Then the harness requirement refuses the non-functional statement given capability "go faster"

  @test:scripts/tests/requirements.test.ts::a_test_run_lists_the_requirements_it_checks::as_references
  Scenario: A test run lists requirements as references
    Then a test run listing "req:glass-navigation#zoom" parses

  @test:scripts/tests/requirements.test.ts::a_test_run_lists_the_requirements_it_checks::never_as_free_text
  Scenario: A test run never lists requirements as free text
    Then a test run listing "the zoom works" does not parse

  @test:scripts/tests/requirements.test.ts::a_test_run_lists_the_requirements_it_checks::a_run_recorded_before_the_field_existed_still_parses
  Scenario: A test run without the requirements field still parses
    Then a test run with no requirements parses

  @test:scripts/tests/requirements.test.ts::check:requirements::a_valid_page_passes,_its_layout_keys_ignored
  Scenario: A valid requirement page passes, its layout keys ignored
    Then the page glass-navigation.md with a layout key and a valid requirement has no problems

  @test:scripts/tests/requirements.test.ts::check:requirements::the_id_is_the_file_name
  Scenario: The id is the file name
    When the same page is checked as other-name.md
    Then a problem names "req:other-name"

  @test:scripts/tests/requirements.test.ts::check:requirements::a_statement_without_success_criteria_is_WARNED,_not_failed_(#2405_decision_3)
  Scenario: A statement without success criteria is warned, not failed
    Then the valid page has no problems
    And the statements without criteria of the base are its two statement references
    And with criteria on every statement there are none

  @test:scripts/tests/requirements.test.ts::check:requirements::no_front_matter_is_no_requirement
  Scenario: No front matter is no requirement
    Then a page with no front matter has one problem

  @test:scripts/tests/requirements.test.ts::check:requirements::a_slug_in_both_sub-graphs_is_a_collision
  Scenario: A slug in both sub-graphs is a collision
    Then the collisions of ["a", "b", "c"] and ["c", "d"] are ["c"]
    And of ["a"] and ["b"] there are none

  @test:scripts/tests/requirements.test.ts::check:requirements::both_sub-graphs_are_declared,_from_within_docs/,_and_exist
  Scenario: Both sub-graphs are declared from within docs/
    # Gap: the title says they exist; the body checks only that the declared paths end in docs/requirements/ and docs/proposals/, not that the directories exist.
    Then cat-harness declares "requirements" at docs/requirements/ and "proposals" at docs/proposals/

  @test:scripts/tests/requirements.test.ts::check:bootstrap-concepts::names_outside_concepts,_and_leaves_plain_English_alone
  Scenario: Outside concepts are named and plain English left alone
    When text naming "who", "WHO", "smart-base", "FHIR" and "smart" is scanned
    Then the outside concepts found are WHO, smart-base and FHIR

  @test:scripts/tests/requirements.test.ts::check:bootstrap-concepts::reads_the_declared_schema_directories_—_never_an_empty_list
  Scenario: The declared bootstrap schema directories are read
    Then the bootstrap schema directories are not empty

  @test:scripts/tests/requirements.test.ts::check:bootstrap-concepts::…and_the_Zod_sources_they_are_generated_from,_not_the_generator's_helpers
  Scenario: The Zod sources are read, not the generator's helpers
    Then the bootstrap schema sources include requirement.ts and not cat-harness.ts
