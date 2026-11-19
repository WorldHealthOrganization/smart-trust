# Specifies probeBeans and countConsideredOptions (test/health/probes.ts)
# over the checkout's real bean store and its archive.
Feature: The health probes are given the repository root and find real subjects

  @test:test/coordinator/health-probes-repo-root.test.ts::the_root_the_sweep_is_given::is_the_REPOSITORY_root,_not_the_instance_root
  Scenario: The bean store is at the repository root, and the probe finds it there
    Given the instance root and the repository root above it
    When each is checked for beans/beans.json
    Then the repository root has it
    And the instance root does not
    And probing the beans at the repository root gives the state "ok"

  @test:test/coordinator/health-probes-repo-root.test.ts::countConsideredOptions_—_the_parse_the_MADR_criterion_rests_on::the_real_store_has_SUBJECTS_—_a_detector_with_none_is_not_a_detector_that_passed
  Scenario: The real store and its archive hold beans with considered options
    Given the bean probe of the repository root
    When the probed beans with considered options and the archived beans with considered options are counted
    Then the probe state is "ok"
    And together there is at least one
