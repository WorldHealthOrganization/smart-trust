# The published docs must not claim a capability this repository does not
# have (bean wlqd): nothing syncs the remote skill packages. The page tests
# read what the retired generator (fsh-guts/scripts/generate-docs.ts) emits,
# and run only in a composed checkout. Each Scenario names the test that
# executes it.
Feature: The Remote Packages page does not claim a sync that does not exist

  @test:scripts/tests/remote-packages-honest-docs.test.ts::the_generated_Remote_Packages_page::does_not_state_that_anything_syncs_automatically
  Scenario: The page does not state that anything syncs automatically
    When the text the generator emits for the Remote Packages page is read
    Then it contains none of "can sync and update these automatically", "are synced automatically" and "Agents can sync"

  @test:scripts/tests/remote-packages-honest-docs.test.ts::the_generated_Remote_Packages_page::says_the_skills_cannot_be_fetched_from_this_instance
  Scenario: The page says the skills cannot be fetched from here
    Then the emitted page text contains "not fetchable"

  @test:scripts/tests/remote-packages-honest-docs.test.ts::the_generated_Remote_Packages_page::labels_the_sync_fields_as_intent_rather_than_as_behaviour
  Scenario: The page labels the sync fields as intent
    Then the emitted page text contains "Intended strategy" and "Intended frequency"
    And it does not contain "| Strategy | Frequency |"

  @test:scripts/tests/remote-packages-honest-docs.test.ts::the_generated_Remote_Packages_page::points_at_the_bean,_so_a_reader_can_find_the_decision
  Scenario: The page points at the bean
    Then the emitted page text contains "wlqd"

  @test:scripts/tests/remote-packages-honest-docs.test.ts::the_reason_the_page_has_to_say_that_is_still_true::neither_skill_fetch_nor_the_registry_reads_skills/remote-packages/
  Scenario: Neither skill_fetch nor the registry generator reads skills/remote-packages/
    When the code of src/tools/skill-fetch.ts and scripts/generate-registry.ts is read with comments removed
    Then neither contains "remote-packages"

  @test:scripts/tests/remote-packages-honest-docs.test.ts::the_reason_the_page_has_to_say_that_is_still_true::`sync`_is_optional,_so_a_Docker-only_wrapper_need_not_claim_a_strategy
  Scenario: sync is optional in a skill package
    Then the skill package schema declares "sync: RemoteSyncConfigSchema.optional()"
