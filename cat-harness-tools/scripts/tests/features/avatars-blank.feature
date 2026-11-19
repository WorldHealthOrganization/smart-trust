# schemas/content/avatars.ts supplies a themed blank avatar for any kind with no declared art,
# and the navbar, harness mark and graph-typology rows draw it in the resolved tone.
# Each Scenario names the test that executes it.
Feature: Themed blank avatar fallback

  @test:scripts/tests/avatars-blank.test.ts::BLANK_AVATAR_definition::has_a_distinct_glyph_that_matches_a_blank_square_box
  Scenario: The blank avatar's glyph is a blank square box
    Given the blank avatar
    Then its glyph is "M3 3h18v18H3z"

  @test:scripts/tests/avatars-blank.test.ts::BLANK_AVATAR_definition::is_distinct_from_GENERIC_(the_question_mark)
  Scenario: The blank avatar differs from the generic question mark
    Given the blank avatar and the generic avatar
    Then their glyphs differ
    And their readings differ
    And the blank avatar reads as a "blank mark"

  @test:scripts/tests/avatars-blank.test.ts::BLANK_AVATAR_definition::is_distinct_from_every_declared_avatar_in_the_registry
  Scenario: The blank avatar's glyph differs from every declared avatar
    Given every avatar in the registry
    Then none has the blank avatar's glyph

  @test:scripts/tests/avatars-blank.test.ts::BLANK_AVATAR_definition::blankAvatar(tone)_creates_an_avatar_with_the_given_hue_tone
  Scenario: A blank avatar takes the given hue tone
    When a blank avatar is made with tone 210
    Then it has the blank glyph and the blank reading
    And its tone is 210

  @test:scripts/tests/avatars-blank.test.ts::BLANK_AVATAR_definition::avatarOrBlank_returns_the_declared_avatar_for_known_kinds_and_blankAvatar_for_unknown
  Scenario: A known kind gets its declared avatar and an unknown kind a toned blank
    Given "docs" has a declared avatar
    Then the avatar-or-blank for "docs" with tone 120 is its declared avatar
    And a kind with no avatar gets the blank glyph with tone 145

  @test:scripts/tests/avatars-blank.test.ts::navbar_rendering_of_themed_blank_mark::renders_a_fa-nav-blank_span_with_the_resolved_theme_tone
  Scenario: The navbar draws a blank harness mark as a toned span with no glyph
    Given a rail with one harness link marked blank with tone 215
    When the navbar regions are rendered
    Then the bottom region contains a "fa-nav-glyph fa-nav-tone fa-nav-blank" span with hue 215
    And the harness row holds no SVG glyph

  @test:scripts/tests/avatars-blank.test.ts::navbar_rendering_of_themed_blank_mark::navbarCss_includes_the_.fa-nav-glyph.fa-nav-blank_rule
  Scenario: The navbar CSS styles the blank mark
    When the navbar CSS is rendered
    Then it contains the ".fa-nav-glyph.fa-nav-blank" rule

  @test:scripts/tests/avatars-blank.test.ts::harness-mark_navMarkFields::returns_blank:_true_when_mark_is_blank
  Scenario: A blank harness mark yields blank nav fields with its tone
    Given a harness mark with the blank glyph flagged blank
    When its nav fields are read with tone 180
    Then they are blank, carry the blank glyph, and have tone 180

  @test:scripts/tests/avatars-blank.test.ts::graphTypologyRowDecor_fallback::falls_back_to_BLANK_AVATAR_when_kind_has_no_declared_avatar
  Scenario: A graph-typology row with no declared avatar falls back to the blank avatar
    Given a graph typology with no declared avatar
    When its row decoration is read with tone 270
    Then it is marked as a kind
    And it carries the blank glyph with tone 270
    And it is flagged blank
