# scripts/lib/harness-mark.ts: navMarkFields, the one conversion from a harness.json row's mark
# to navbar fields (avatar, glyphPath, tone). Each Scenario names the test that executes it.
Feature: A harness mark becomes navbar fields

  @test:scripts/tests/kg/harness-mark.test.ts::navMarkFields::an_image_mark_becomes_an_avatar,_re-based,_with_its_declared_crop
  Scenario: An image mark becomes a re-based avatar with its declared crop
    Given an image mark with src "/docs/who-iris/assets/img/who-emblem.svg", title "WHO emblem" and region x 0, y 0, w 0.3, h 1
    When navMarkFields converts it with tone 198 and a re-base that prefixes "../.."
    Then the result is an avatar with src "../../docs/who-iris/assets/img/who-emblem.svg", the same title and the same region
    And the tone is 198
    And no other field is set

  @test:scripts/tests/kg/harness-mark.test.ts::navMarkFields::a_glyph_mark_becomes_glyphPath_—_never_a_letter
  Scenario: A glyph mark becomes glyphPath, never a letter
    Given a glyph mark "M3 18h18" titled "a base"
    When navMarkFields converts it with tone 199
    Then the result is exactly glyphPath "M3 18h18" and tone 199

  @test:scripts/tests/kg/harness-mark.test.ts::navMarkFields::a_declared_ground_rides_along,_so_the_navbar_can_leave_the_tone_out_(issue_#46,_gap_5)
  Scenario: A declared ground rides along on the avatar
    # Gap: the navbar leaving the tone out is not rendered or checked
    Given an image mark "/assets/img/logo.svg" titled "logo" with ground "none"
    When navMarkFields converts it with tone 208 and a re-base that prefixes "."
    Then the avatar has src "./assets/img/logo.svg", title "logo" and ground "none"
    And the tone is 208

  @test:scripts/tests/kg/harness-mark.test.ts::navMarkFields::no_mark_leaves_only_the_tone,_and_the_navbar_draws_the_initial
  Scenario: No mark leaves only the tone
    # Gap: the navbar drawing the initial is not rendered or checked
    Given no mark
    When navMarkFields converts undefined with tone 212
    Then the result is only tone 212
    And converting null with no tone gives an empty object
