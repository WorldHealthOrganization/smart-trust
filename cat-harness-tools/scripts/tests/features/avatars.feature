# schemas/content/avatars.ts gives every declared kind an avatar; scripts/gen-avatars-css.ts styles
# each in light and dark, in and out of trash; scripts/check-avatar-coverage.ts reports gaps.
# Each Scenario names the test that executes it.
Feature: Avatars for every declared kind

  @test:scripts/tests/avatars.test.ts::the_registry::it_is_not_empty_—_the_guard_every_count_below_needs
  Scenario: The avatar registry is not empty
    Given the avatar registry
    Then it holds more than 10 kinds

  @test:scripts/tests/avatars.test.ts::the_registry::every_declared_graph_typology_has_an_avatar_of_its_own
  Scenario: Every declared graph typology has an avatar of its own
    Given the default graph typologies
    Then none lacks an avatar

  @test:scripts/tests/avatars.test.ts::the_registry::an_unknown_kind_gets_the_question_mark,_not_a_blank
  Scenario: An unknown kind gets the question-mark avatar
    When the avatar for "no-such-kind-exists" is read
    Then it is the generic avatar
    And the generic avatar reads as "no avatar is declared"

  @test:scripts/tests/avatars.test.ts::the_registry::every_avatar_says_what_it_reads_as
  Scenario: Every avatar says what it reads as and has a glyph
    Given every avatar in the registry
    Then each has a reading longer than 8 characters
    And each has a glyph longer than 8 characters

  @test:scripts/tests/avatars.test.ts::the_registry::a_tone_is_a_HUE,_so_no_kind_can_be_authored_into_an_unreadable_corner
  Scenario: Every avatar tone is an integer hue
    Given every avatar in the registry
    Then each tone is an integer from 0 up to but not including 360

  @test:scripts/tests/avatars.test.ts::the_registry::no_two_kinds_share_a_glyph
  Scenario: No two kinds share a glyph
    Given every avatar in the registry
    Then no glyph belongs to more than one kind

  @test:scripts/tests/avatars.test.ts::the_generated_stylesheet::it_is_current_—_an_edited_node_that_was_never_regenerated_fails_here
  Scenario: The generated avatar stylesheet is current
    # Skipped: when the avatar stylesheet has not been built
    Given the avatar stylesheet on disk
    Then it equals a fresh render of the avatar CSS

  @test:scripts/tests/avatars.test.ts::the_generated_stylesheet::every_kind_is_styled_in_BOTH_schemes
  Scenario: Every kind is styled in both light and dark schemes
    # Skipped: when the avatar stylesheet has not been built
    Given the avatar stylesheet on disk
    Then every kind has a rule under the light scheme
    And every kind has a rule under the dark scheme

  @test:scripts/tests/avatars.test.ts::the_generated_stylesheet::the_dual_guard_is_present,_not_just_the_explicit_choice
  Scenario: The stylesheet carries both the media-query and the explicit-scheme guards
    # Skipped: when the avatar stylesheet has not been built
    Given the avatar stylesheet on disk
    Then it contains media queries for both prefers-color-scheme dark and light
    And it contains ':root:not([data-fa-scheme="light"])' and ':root:not([data-fa-scheme="dark"])'

  @test:scripts/tests/avatars.test.ts::the_generated_stylesheet::the_trash_state_is_muted_in_both_schemes,_and_never_invisible
  Scenario: The trash state is muted but stays visible
    # Skipped: when the avatar stylesheet has not been built
    Given the avatar stylesheet on disk
    Then it has more than 20 trash background rules
    And each has saturation under 25%
    And each has lightness between 40% and 70%, exclusive

  @test:scripts/tests/avatars.test.ts::the_generated_stylesheet::the_glyph_is_a_mask,_so_the_colour_is_a_property_and_not_an_asset
  Scenario: The avatar glyph is drawn as a CSS mask
    # Skipped: when the avatar stylesheet has not been built
    Given the avatar stylesheet on disk
    Then it contains "--fa-avatar-glyph:"
    And it contains "mask-image: var(--fa-avatar-glyph)"
    And it contains "-webkit-mask-image:"

  @test:scripts/tests/avatars.test.ts::the_generated_stylesheet::the_data_URI_is_escaped,_so_it_does_not_terminate_early
  Scenario: The SVG data URI in the stylesheet is escaped
    # Skipped: when the avatar stylesheet has not been built
    Given the avatar stylesheet on disk
    Then no data URI holds a raw "<svg"
    And it contains the escaped "%3Csvg"

  @test:scripts/tests/avatars.test.ts::coverage_is_a_QA_axis,_not_a_promise::the_answer_does_not_depend_on_what_the_caller_imported
  Scenario: The required kinds include the base table and kinds registered on import
    Given the required kinds for the harness
    Then every base graph typology is required
    And "folio", which is not in the base table, is required
    And "folio" has an avatar

  @test:scripts/tests/avatars.test.ts::coverage_is_a_QA_axis,_not_a_promise::it_reports_against_the_instance's_OWN_declaration,_not_just_the_registry
  Scenario: Every kind the instance declares is required
    Given the required kinds for the harness
    Then it declares at least one kind
    And every declared kind is required

  @test:scripts/tests/avatars.test.ts::coverage_is_a_QA_axis,_not_a_promise::the_real_corpus_is_fully_covered
  Scenario: The real corpus is fully covered by avatars
    Given avatar coverage over the harness
    Then no kind is missing an avatar

  @test:scripts/tests/avatars.test.ts::coverage_is_a_QA_axis,_not_a_promise::an_INSTANCE-keyed_avatar_is_REPORTED_on_the_kind_axis,_not_pruned
  Scenario: An instance-keyed avatar is reported as orphaned on the kind axis
    Given avatar coverage over the harness
    Then "bootstrap" is among the orphaned avatar keys
    And "folio-assistant-core" is not

  @test:scripts/tests/avatars.test.ts::coverage_is_a_QA_axis,_not_a_promise::and_`folio-assistant-core`_resolves_to_its_own_avatar,_not_the_question_mark
  Scenario: The folio-assistant-core layer resolves to its own avatar
    # Skipped: when no folio-assistant-core declaration is composed alongside the harness
    When the avatar for "folio-assistant-core" is read
    Then it is not the generic avatar

  @test:scripts/tests/avatars.test.ts::coverage_is_a_QA_axis,_not_a_promise::every_instance-keyed_avatar_resolves_for_the_name_an_instance_declares
  Scenario: Every orphaned avatar key is a name some instance declares
    Given the names declared by the instances in the repository
    Then every orphaned avatar key from coverage over the harness is one of them

  @test:scripts/tests/avatars.test.ts::coverage_is_a_QA_axis,_not_a_promise::the_trash_derivation_is_asserted_once,_and_it_is_in_place
  Scenario: The trash derivation is in place
    Then the trash derivation check reports it present
