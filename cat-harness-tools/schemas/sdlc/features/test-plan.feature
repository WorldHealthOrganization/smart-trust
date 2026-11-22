# Specifies schemas/sdlc/test-plan.ts: the test-plan schema in the FHIR R5
# TestPlan shape, its test-data references and its structural rules
# (bean ygzh).
Feature: A test plan states its requirements, cases and exit criteria

  Background:
    Given a sample plan "crdm-detect" with two cases: "fires-on-feature-request" on reviewed fixed data, and "silent-on-content-work" on seeded generated data that depends on the first

  @test:schemas/sdlc/test-plan.test.ts::the_shape::a_plan_in_the_FHIR_R5_TestPlan_shape_parses,_and_carries_its_tag
  Scenario: A plan in the TestPlan shape parses and carries its tag
    When the sample plan is parsed
    Then its $schema is the current test-plan tag
    And its dependencies default to an empty list

  @test:schemas/sdlc/test-plan.test.ts::the_shape::requirements_are_`req:`_refs_—_the_same_shape_test-run_uses_—_and_at_least_one
  Scenario: Requirements are at least one req: ref
    When the plan's requirements are ["crdm-detect"] or empty
    Then it is refused
    And requirements ["req:crdm-detect#s1"] parse

  @test:schemas/sdlc/test-plan.test.ts::the_shape::scope_says_the_system_kind_and_a_version_range;_the_kind_vocabulary_is_closed
  Scenario: Scope has a closed kind vocabulary and a version range
    When the scope kind is "IG"
    Then the plan is refused
    And a scope of kind "ig" without a version range is refused

  @test:schemas/sdlc/test-plan.test.ts::the_shape::exitCriteria_is_a_DMN_reference,_not_narrative
  Scenario: Exit criteria are a DMN decision reference
    When the exit criteria decision is "all cases pass" or "x.dmn"
    Then the plan is refused

  @test:schemas/sdlc/test-plan.test.ts::the_shape::a_case_with_no_assertion_is_refused_—_it_would_pass_vacuously
  Scenario: A case with no assertion is refused
    When the first case has no assertions
    Then the plan is refused

  @test:schemas/sdlc/test-plan.test.ts::the_shape::a_Gherkin_link_names_a_.feature_file
  Scenario: A case's Gherkin link must name a .feature file
    When the first case's feature is "features/crdm-detect.md"
    Then the plan is refused

  @test:schemas/sdlc/test-plan.test.ts::the_shape::under_v1.1_every_case_names_its_.feature;_a_v1_plan_without_one_parses,_deprecated
  Scenario: The current version requires a feature per case; v1 parses with deprecations
    When the second case has no feature
    Then the plan is refused with one issue at "testCases.1.feature"
    And the same plan declared as v1 parses
    And its deprecations say v1 is deprecated and that case "silent-on-content-work" names no .feature
    And the sample plan has no deprecations

  @test:schemas/sdlc/test-plan.test.ts::the_shape::a_plan_names_no_run_—_there_is_no_field_for_one,_and_a_strict_object_refuses_it
  Scenario: A plan names no run
    When the plan carries a runs field
    Then it is refused

  @test:schemas/sdlc/test-plan.test.ts::fixed_and_generated_test_data_are_told_apart_from_the_record_(vm6m)::the_discriminator_is_`kind`,_not_the_path
  Scenario: Test data kind is read from kind, not the path
    When a fixed test-data ref at "generated/looks-generated.json" and a generated one from template "fixed/t.tmpl" are parsed
    Then the first is fixed and the second is generated

  @test:schemas/sdlc/test-plan.test.ts::fixed_and_generated_test_data_are_told_apart_from_the_record_(vm6m)::a_generated_set_is_never_stored_materialised_—_a_`path`_on_it_is_refused
  Scenario: A generated set may not carry a path
    When a generated test-data ref carries a path
    Then it is refused

  @test:schemas/sdlc/test-plan.test.ts::fixed_and_generated_test_data_are_told_apart_from_the_record_(vm6m)::a_generated_set_needs_its_seed_—_without_it_the_hashed_bytes_cannot_be_regenerated_(zz0a)
  Scenario: A generated set needs its seed
    When a generated test-data ref has no seed
    Then it is refused

  @test:schemas/sdlc/test-plan.test.ts::fixed_and_generated_test_data_are_told_apart_from_the_record_(vm6m)::a_fixed_set_carries_no_recipe_fields
  Scenario: A fixed set carries no recipe fields
    When a fixed test-data ref carries a seed
    Then it is refused

  @test:schemas/sdlc/test-plan.test.ts::fixed_and_generated_test_data_are_told_apart_from_the_record_(vm6m)::only_a_REVIEWED_fixed_set_is_evidence
  Scenario: Only a reviewed fixed set is evidence
    Then the sample plan's reviewed fixed data is evidence
    And an unreviewed fixed set is not evidence
    And the generated set is not evidence

  @test:schemas/sdlc/test-plan.test.ts::structural_rules::duplicate_case_ids_are_refused
  Scenario: Duplicate case ids are refused
    When the second case takes the first case's id
    Then the plan is refused

  @test:schemas/sdlc/test-plan.test.ts::structural_rules::duplicate_assertion_ids_within_a_case_are_refused
  Scenario: Duplicate assertion ids within a case are refused
    When the first case gets a second assertion with the id "crdm-detect-fires"
    Then the plan is refused

  @test:schemas/sdlc/test-plan.test.ts::structural_rules::dependsOn_must_name_a_sibling_case,_never_itself
  Scenario: dependsOn must name a sibling case, not itself
    When the second case depends on "no-such-case"
    Then the plan is refused
    And when it depends on itself the plan is refused

  @test:schemas/sdlc/test-plan.test.ts::structural_rules::a_dependency_cycle_is_refused_—_no_order_executes_it
  Scenario: A dependency cycle is refused
    When the first case also depends on the second
    Then the plan is refused with an issue mentioning a cycle

  @test:schemas/sdlc/test-plan.test.ts::structural_rules::a_plan_is_not_its_own_predecessor
  Scenario: A plan is not its own predecessor
    When the plan's dependencies name "crdm-detect" as predecessor
    Then it is refused
    And a predecessor "workflow-complete" parses

  @test:schemas/sdlc/test-plan.test.ts::the_graph_typology_it_is_held_under::registered,_not_renderable,_and_`content`_—_a_process_reads_a_plan_and_never_writes_it
  Scenario: The test-plan graph typology is registered content a process never writes
    When the "test-plan" graph typology is looked up
    Then it is registered
    And it is not renderable
    And its layer is "content"
    And a process may not write it
