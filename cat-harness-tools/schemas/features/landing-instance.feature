# resolveLandingInstance and rootInstanceName in schemas/kg/harness-config.ts decide which instantiated harness a checkout root lands on, and formatLanding in scripts/check-landing-instance.ts turns that into the gate's pass or fail.
# Each Scenario names the test that executes it.
Feature: Choosing the landing instance

  @test:schemas/landing-instance.test.ts::resolveLandingInstance::one_instantiated_harness_is_the_landing,_with_no_flag_(the_smart-trust_case)
  Scenario: A single instantiated harness is the landing without a flag
    Given a checkout root holding only "smart-base.config.json" with no landing flag
    When resolveLandingInstance resolves the root
    Then the landing is the instance "smart-base", chosen by "sole", with names ["smart-base"]
    And the landing gate passes

  @test:schemas/landing-instance.test.ts::resolveLandingInstance::several,_exactly_one_flagged:_the_flagged_one
  Scenario: Among several harnesses, the one flagged as landing is chosen
    Given a root with "bootstrap", "cat-harness" and "who-iris" configs, only "cat-harness" having site.landing true
    When resolveLandingInstance resolves the root
    Then the landing is the instance "cat-harness", chosen by "flag"
    And the landing gate passes

  @test:schemas/landing-instance.test.ts::resolveLandingInstance::several,_none_flagged:_ambiguous,_and_the_gate_fails
  Scenario: Several harnesses with none flagged are ambiguous and fail the gate
    Given a root with unflagged "bootstrap" and "cat-harness" configs
    When resolveLandingInstance resolves the root
    Then the result is ambiguous with reason "none-flagged", names ["bootstrap", "cat-harness"] and no unreadable configs
    And the landing gate fails

  @test:schemas/landing-instance.test.ts::resolveLandingInstance::`landing:_false`_is_not_a_flag
  Scenario: site.landing false does not count as a flag
    Given a root with config "a" having site.landing false and an unflagged config "b"
    When resolveLandingInstance resolves the root
    Then the result is ambiguous

  @test:schemas/landing-instance.test.ts::resolveLandingInstance::several,_two_or_more_flagged:_the_neutral_hub,_listing_every_harness
  Scenario: Two or more flagged harnesses give a neutral hub listing every harness
    Given a root with flagged configs "a" and "b" and an unflagged config "c"
    When resolveLandingInstance resolves the root
    Then the result is a hub with names ["a", "b", "c"] and flagged ["a", "b"]
    And the landing gate passes

  @test:schemas/landing-instance.test.ts::resolveLandingInstance::nothing_instantiated_is_its_own_state,_not_a_default
  Scenario: A root with no instantiated harness is in the none state
    Given a root with no config files
    When resolveLandingInstance resolves the root
    Then the result is kind "none" with no names
    And the landing gate passes

  @test:schemas/landing-instance.test.ts::resolveLandingInstance::an_unreadable_config_among_several_cannot_be_decided
  Scenario: An unreadable config among several makes the landing undecidable
    Given a root with a flagged config "a" and a config "b" that is not valid JSON
    When resolveLandingInstance resolves the root
    Then the result is ambiguous with reason "unreadable"
    And the unreadable list is ["b"]
    And the landing gate fails

  @test:schemas/landing-instance.test.ts::resolveLandingInstance::a_non-boolean_flag_is_unreadable_rather_than_truthy
  Scenario: A non-boolean landing flag is treated as unreadable
    Given a root with config "a" having site.landing "yes" and an unflagged config "b"
    When resolveLandingInstance resolves the root
    Then the result is ambiguous with reason "unreadable"

  @test:schemas/landing-instance.test.ts::resolveLandingInstance::the_retired_global_`harness.config.json`_is_not_an_instance
  Scenario: The retired harness.config.json is not counted as an instance
    Given a root holding "harness.config.json" and "a.config.json"
    When instantiatedHarnessNames lists the root
    Then the names are ["a"]

  @test:schemas/landing-instance.test.ts::rootInstanceName_—_never_the_clone's_folder_name::an_undeclared_root_with_one_instantiated_harness_is_that_harness
  Scenario: An undeclared root with one harness is named after that harness, not its folder
    Given a root folder "smart-trust" holding only "smart-base.config.json"
    When rootInstanceName names the root
    Then the name is "smart-base"

  @test:schemas/landing-instance.test.ts::rootInstanceName_—_never_the_clone's_folder_name::an_undeclared_root_with_nothing_decided_has_no_name
  Scenario: An undeclared root with no decided harness has no name
    Given a root folder "bare-folio" with no configs
    And a root folder "bare-folio" with two unflagged configs "a" and "b"
    When rootInstanceName names each root
    Then each name is undefined

  @test:schemas/landing-instance.test.ts::this_repository::lands_on_folio-assistant-core,_named_by_index.config.json
  Scenario: This checkout lands on folio-assistant-core, named by the index config
    Given the checkout root two levels above the schemas directory
    When resolveLandingInstance resolves that root
    Then the landing is the instance "folio-assistant-core"
    And it was chosen by "index"
