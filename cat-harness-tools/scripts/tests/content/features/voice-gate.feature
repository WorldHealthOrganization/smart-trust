# The voice gate: criterionVoices and voiceExcludesCriterion (schemas/sdlc/block-qa.ts) and
# readActiveVoices (schemas/content/voices.ts) keep "activates no voice" apart from "config unreadable".
# Each Scenario names the test that executes it.
Feature: Voice-scoped criteria are opt-in, and an unreadable config runs them

  @test:scripts/tests/content/voice-gate.test.ts::criterionVoices::absent_means_NOT_voice-scoped_—_the_opposite_default_from_profiles
  Scenario: A criterion with no voices is not voice-scoped
    Given a criterion with no "voices" field
    Then criterionVoices returns undefined
    Given a criterion with voices "milnor"
    Then criterionVoices returns "milnor"

  @test:scripts/tests/content/voice-gate.test.ts::voiceExcludesCriterion::a_criterion_naming_no_voice_always_runs
  Scenario: A criterion naming no voice always runs
    Given a criterion naming no voice
    Then it is not excluded when the active voices are empty
    And it is not excluded when the active voices are undefined

  @test:scripts/tests/content/voice-gate.test.ts::voiceExcludesCriterion::a_voice_criterion_is_excluded_when_the_folio_activates_none
  Scenario: A voice criterion is excluded when the folio activates no voice
    Given a criterion scoped to "who-editorial"
    When the active voices are empty
    Then the criterion is excluded

  @test:scripts/tests/content/voice-gate.test.ts::voiceExcludesCriterion::...and_runs_when_its_voice_is_active
  Scenario: A voice criterion runs when its voice is active
    Given a criterion scoped to "who-editorial"
    When "who-editorial" is active
    Then the criterion is not excluded

  @test:scripts/tests/content/voice-gate.test.ts::voiceExcludesCriterion::one_match_out_of_several_is_enough
  Scenario: One active voice out of several named is enough
    Given a criterion scoped to "milnor" and "who-editorial"
    When only "milnor" is active
    Then the criterion is not excluded

  @test:scripts/tests/content/voice-gate.test.ts::voiceExcludesCriterion::a_different_active_voice_does_not_satisfy_it
  Scenario: A different active voice does not satisfy a voice criterion
    Given a criterion scoped to "who-editorial"
    When only "milnor" is active
    Then the criterion is excluded

  @test:scripts/tests/content/voice-gate.test.ts::voiceExcludesCriterion::UNREADABLE_config_runs_the_criterion_—_the_third_state
  Scenario: An unreadable config runs the voice criterion
    Given a criterion scoped to "who-editorial"
    When the active voices are undefined
    Then the criterion is not excluded

  @test:scripts/tests/content/voice-gate.test.ts::readActiveVoices::no_config_at_all_is_undefined,_not_[]
  Scenario: A directory with no config has undetermined voices
    Given an empty temporary directory
    Then readActiveVoices returns undefined

  @test:scripts/tests/content/voice-gate.test.ts::readActiveVoices::a_config_with_no_voices_key_activates_none
  Scenario: A config with no voices key activates none
    Given an instance config of "contentType" "document" and no voices key
    Then readActiveVoices returns an empty list

  @test:scripts/tests/content/voice-gate.test.ts::readActiveVoices::a_config_listing_voices_returns_them_in_order
  Scenario: A config listing voices returns them in order
    Given an instance config activating "who-editorial" then "milnor"
    Then readActiveVoices returns "who-editorial" then "milnor"

  @test:scripts/tests/content/voice-gate.test.ts::readActiveVoices::folio.config.json_is_NOT_read_here_either_—_the_old_name_is_dead
  Scenario: A legacy folio.config.json is not read
    Given a directory holding only a "folio.config.json" that activates "who-editorial"
    Then readActiveVoices returns undefined

  @test:scripts/tests/content/voice-gate.test.ts::readActiveVoices::UNPARSEABLE_config_is_undefined,_not_[]
  Scenario: An unparseable config has undetermined voices
    Given an instance config that is not valid JSON
    Then readActiveVoices returns undefined

  @test:scripts/tests/content/voice-gate.test.ts::readActiveVoices::a_voices_key_of_the_wrong_shape_is_undefined,_not_[]
  Scenario: A voices key of the wrong shape has undetermined voices
    Given an instance config whose active voices is a string, not a list
    Then readActiveVoices returns undefined

  @test:scripts/tests/content/voice-gate.test.ts::readActiveVoices::an_instance_with_NO_config_of_its_own_is_`undefined`,_not_`[]`
  Scenario: An instance with no config of its own has undetermined voices
    # Gap: the body is the same as "no config at all is undefined" (a fresh empty temporary directory); no real instance layer without a config is read
    Given a fresh temporary directory that declares nothing
    Then readActiveVoices returns undefined

  @test:scripts/tests/content/voice-gate.test.ts::the_voice_scope_is_in_the_freshness_key::re-scoping_a_criterion's_voices_changes_its_def_hash
  Scenario: Re-scoping a criterion's voices changes its definition hash
    Given a criterion depending on "md"
    When it is also scoped to voice "milnor"
    Then its criterionDefHash differs from the unscoped one
