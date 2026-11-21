# Specifies readActiveVoices (schemas/content/voices.ts) for the cat-harness
# instance and the checkout root, and the registration of the four shipped
# voices' criteria.
Feature: The instance activates its voice by config, and the checkout root has no voices to answer

  @test:test/coordinator/voice-gate-checkout.test.ts::readActiveVoices::this_instance_activates_the_base_skill-authoring_voice
  Scenario: cat-harness activates the agent-skill-authoring voice
    Given the cat-harness instance
    When its active voices are read
    Then they are exactly agent-skill-authoring

  @test:test/coordinator/voice-gate-checkout.test.ts::readActiveVoices::the_checkout_root_declares_no_instance,_so_it_has_no_voices_to_answer
  Scenario: The checkout root answers no voices at all
    Given the checkout root
    When its active voices are read
    Then the answer is undefined, not an empty list

  @test:test/coordinator/voice-gate-checkout.test.ts::the_four_shipped_voices_each_have_a_criterion::%s_is_registered,_voice-scoped_and_agent-adjudicated
  Scenario: Each shipped voice's criterion is registered, voice-scoped and agent-adjudicated
    Given a table of the ids voice-overlay-who-editorial, voice-overlay-who-guideline-development, voice-overlay-who-publication-design and voice-overlay-milnor
    And the QA criteria by id for the cat-harness instance
    When the row's criterion is looked up
    Then it exists
    And its domain is "voice"
    And it names exactly one voice
    And it is not automated
