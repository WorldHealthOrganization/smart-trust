# A remote declaration is not resolution: the half that reads skill_fetch and
# the registry generator (bean nup0). Each Scenario names the test that executes it.
Feature: skill_fetch does not resolve remote-declared skills

  @test:scripts/tests/manifest-remote-resolution.test.ts::the_reason_the_allowance_was_closed_is_still_true::neither_skill_fetch_nor_the_registry_reads_skills/remote-packages/
  Scenario: Neither skill_fetch nor the registry reads skills/remote-packages/
    When the code, without comments, of src/tools/skill-fetch.ts and scripts/generate-registry.ts is read
    Then neither mentions remote-packages
