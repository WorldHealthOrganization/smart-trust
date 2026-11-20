# Specifies owningInstanceRoot, validatePath and validateText
# (scripts/kg-validate.ts) over the checkout's nested instances and their
# kg-audit sidecars, read from disk or, where absent, from the qa-reports
# stores.
Feature: kg:validate owns a nested instance's path and validates every kg-audit sidecar

  @test:test/coordinator/kg-validate-nested-instances.test.ts::kg:validate_over_nested_instances_(bean_`676g`)::a_path_is_owned_by_the_DEEPEST_instance_that_contains_it
  Scenario: A path is owned by the deepest instance containing it
    Given the checkout and cat-harness as the auditing instance
    When the owning instance root is asked for a smart-base sidecar path, a cat-harness manifest and the root package.json
    Then the smart-base path is owned by smart-base
    And the cat-harness manifest is owned by cat-harness
    And the checkout root declares no instance
    And the root package.json falls back to cat-harness

  @test:test/coordinator/kg-validate-nested-instances.test.ts::kg:validate_over_nested_instances_(bean_`676g`)::resolving_against_the_auditor's_own_instance_—_the_old_behaviour_—_refuses_a_nested_sidecar
  Scenario: Resolving a nested sidecar against the auditor's own instance cannot determine it
    Given the first kg-audit sidecar found for an instance other than cat-harness
    When it is validated against cat-harness, against its own instance, and against its own instance with cat-harness as schema root
    Then at least one such sidecar was found
    And the first two are "undetermined"
    And the last is "valid"

  @test:test/coordinator/kg-validate-nested-instances.test.ts::kg:validate_over_nested_instances_(bean_`676g`)::every_committed_kg-audit_sidecar,_in_every_instance,_validates
  Scenario: Every kg-audit sidecar in every instance validates
    Given every instance's kg-audit sidecars and manifests
    When each is validated against its owning instance with cat-harness as schema root
    Then every instance with a manifest also has sidecars
    And sidecars were found for at least one instance other than cat-harness
    And more than 50 files were validated
    And every one is "valid"
