# Specifies voiceOverlayCriteria, shippedVoices and judgesBlocks
# (pipeline/voice-criteria.ts) and their reach into qaCriteriaFor and
# qaCriteriaByIdFor, over the voices the checkout ships.
Feature: Voice-overlay criteria are derived from the shipped voices and reach every consumer

  @test:test/coordinator/voice-criteria-checkout.test.ts::the_derivation_reproduces_the_hand-written_criteria::every_voice_this_repository_ships_that_judges_BLOCKS_produces_one_criterion
  Scenario: Every shipped voice that judges blocks produces one criterion
    Given the voices the checkout ships
    When the voice-overlay criteria are derived
    Then there is one per voice that judges blocks
    And there is at least one

  @test:test/coordinator/voice-criteria-checkout.test.ts::the_derivation_reproduces_the_hand-written_criteria::%s_keeps_its_severity,_domain,_voices,_deps_and_automated_flag
  Scenario: Each formerly hand-written voice criterion keeps its fields
    Given a table of criterion ids and severities: voice-overlay-who-editorial major, voice-overlay-who-guideline-development critical, voice-overlay-who-publication-design major, voice-overlay-milnor minor
    When the derived criterion with the row's id is found
    Then it exists with the row's default severity
    And its domain is "voice"
    And its voices are exactly the id without "voice-overlay-"
    And it depends on exactly "md"
    And it is not automated

  @test:test/coordinator/voice-criteria-checkout.test.ts::the_derivation_reproduces_the_hand-written_criteria::no_criterion_appeared_that_was_not_registered_before
  Scenario: The four previously hand-written criteria are all derived
    Given the derived voice-overlay criteria
    When the four previously hand-written ids are looked up
    Then every one is present

  @test:test/coordinator/voice-criteria-checkout.test.ts::the_derived_criteria_reach_the_consumers::`qaCriteriaFor`_carries_them_and_`QA_CRITERIA_REGISTRY`_does_not
  Scenario: qaCriteriaFor carries the voice criteria and the static registry does not
    Given the static QA criteria registry and the criteria for the instance
    When the "voice-overlay-" criteria are counted in each
    Then the static registry has none
    And the instance's criteria have at least one
    And the instance has as many criteria as the static registry plus the derived ones

  @test:test/coordinator/voice-criteria-checkout.test.ts::the_derived_criteria_reach_the_consumers::the_by-id_index_carries_them_too
  Scenario: The by-id index carries the voice criteria
    Given the instance's criteria indexed by id
    When the four voice-overlay ids are looked up
    Then every one is present

  @test:test/coordinator/voice-criteria-checkout.test.ts::the_derived_criteria_reach_the_consumers::every_voice_criterion_is_agent-adjudicated,_which_is_why_the_drain_queue_had_to_change
  Scenario: Every voice criterion is agent-adjudicated
    Given the derived voice-overlay criteria
    When each is read
    Then none is automated

  @test:test/coordinator/voice-criteria-checkout.test.ts::the_description_names_the_voice_and_does_not_restate_it::it_says_where_the_voice_lives_and_who_ships_it
  Scenario: The milnor criterion names where its voice lives and who ships it
    Given the derived criterion voice-overlay-milnor
    When its description is read
    Then it mentions "folio-assistant-sci"
    And it mentions "skills/voices/milnor/"

  @test:test/coordinator/voice-criteria-checkout.test.ts::the_description_names_the_voice_and_does_not_restate_it::it_tells_a_reviewer_to_open_the_citation
  Scenario: Every voice criterion tells a reviewer to open the citation
    Given the derived voice-overlay criteria
    When each description is read
    Then it mentions "citation"

  @test:test/coordinator/voice-criteria-checkout.test.ts::the_description_names_the_voice_and_does_not_restate_it::a_WHO_criterion_no_longer_carries_WHO_editorial_RULES
  Scenario: The WHO guideline-development criterion restates no WHO rule
    Given the derived criterion voice-overlay-who-guideline-development
    When its description is read
    Then it does not contain "not recommended"
    And it does not contain "PICO"
