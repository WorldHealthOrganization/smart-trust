# Specifies readVoicesGraph (scripts/voices-graph.ts) and viewerHtml
# (scripts/gen-voices-viz.ts) over the voices the checkout ships.
Feature: The voices graph lists every shipped voice once, with honest provenance flags

  @test:test/coordinator/voices-viz-checkout.test.ts::the_reader_finds_what_the_declarations_say_is_there::every_voice_this_repository_ships_appears_exactly_once
  Scenario: Every shipped voice appears exactly once
    Given the voices graph read from the cat-harness instance
    When its voice ids are compared with the shipped voices
    Then they are the same, sorted
    And no id repeats

  @test:test/coordinator/voices-viz-checkout.test.ts::the_reader_finds_what_the_declarations_say_is_there::a_voice_is_attributed_to_the_instance_that_DERIVED_it,_never_to_the_platform
  Scenario: No voice is attributed to the checkout's root instance, and several instances own voices
    Given the voices graph
    When each voice's instance is read
    Then none is "folio-assistant"
    And there is more than one owning instance

  @test:test/coordinator/voices-viz-checkout.test.ts::the_reader_finds_what_the_declarations_say_is_there::the_path_it_reports_is_the_file_a_reader_can_actually_open
  Scenario: Every voice's path is a file in the checkout
    Given the voices graph
    When each voice's path is looked up
    Then it exists in the checkout

  @test:test/coordinator/voices-viz-checkout.test.ts::the_provenance_QA_flag_—_a_question_for_a_person,_not_a_gate::`house`_is_never_flagged,_however_its_rules_cite_—_the_owner's_ruling
  Scenario: The house voice milnor is not flagged
    Given the voice milnor
    When its provenance and rules are read
    Then its provenance is "house"
    And every rule cites "library"
    And it has no provenance flags

  @test:test/coordinator/voices-viz-checkout.test.ts::the_provenance_QA_flag_—_a_question_for_a_person,_not_a_gate::...and_it_fires_on_the_voice_that_IS_mixed,_so_the_exemption_is_not_a_blanket
  Scenario: Only technical-writer is flagged, as declared-outside-cites-inside
    Given the voices graph
    When the voices with provenance flags are taken
    Then they are exactly technical-writer
    And its first flag has the code "declared-outside-cites-inside" and names 3 rules
    And its detail contains no backtick

  @test:test/coordinator/voices-viz-checkout.test.ts::the_provenance_QA_flag_—_a_question_for_a_person,_not_a_gate::the_flag_is_advisory_—_nothing_about_it_is_a_severity_the_sidecars_carry
  Scenario: A provenance flag carries no severity
    Given every provenance flag of every voice
    When each is read
    Then none has a severity

  @test:test/coordinator/voices-viz-checkout.test.ts::the_provenance_QA_flag_—_a_question_for_a_person,_not_a_gate::the_viewer_renders_provenance_at_all,_which_it_did_not_before
  Scenario: The viewer renders provenance
    Given the voices viewer HTML
    When it is read
    Then it contains "renderFlags", "provenance <b>" and "pflag"
