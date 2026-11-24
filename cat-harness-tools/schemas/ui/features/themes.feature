# Specifies schemas/ui/themes.ts: the shipped theme corpus — its families,
# its default, its high-contrast pair and gradated themes — held to WCAG
# contrast ratios computed from the palettes, to backdrops that resolve
# against this instance's image declaration, and to opaque surfaces.
Feature: The shipped themes are what was asked for, legible, and resolvable

  @test:schemas/ui/themes.test.ts::the_corpus_is_what_was_asked_for::there_are_themes_to_check_—_otherwise_this_proves_nothing
  Scenario: There are themes to check
    When the shipped themes are counted
    Then there are more than 4

  @test:schemas/ui/themes.test.ts::the_corpus_is_what_was_asked_for::every_shipped_theme_parses_and_defines_all_three_layouts
  Scenario: Every shipped theme parses and defines every layout
    When each shipped theme is parsed with the theme schema
    Then each parses
    And each defines every one of the theme layouts

  @test:schemas/ui/themes.test.ts::the_corpus_is_what_was_asked_for::ids_are_unique_—_the_CSS_class_is_built_from_the_id
  Scenario: Theme ids are unique
    When the shipped theme ids are collected
    Then none repeats

  @test:schemas/ui/themes.test.ts::the_corpus_is_what_was_asked_for::the_asked-for_families_are_all_present
  Scenario: The asked-for families are present
    When the shipped theme ids are collected
    Then some id starts with "pale-sage" and some with "dusty-carolina"
    And "grumpy-cat" is among them
    And every high-contrast theme id is among them

  @test:schemas/ui/themes.test.ts::the_corpus_is_what_was_asked_for::a_couple_of_fading_gradations_exist
  Scenario: At least two gradated themes exist
    When the gradated theme ids are counted
    Then there are at least 2

  @test:schemas/ui/themes.test.ts::the_default::it_resolves,_and_it_is_a_pale_sage
  Scenario: The default theme resolves and is a pale sage
    # That it matches the staging bar is a human judgement, made on the
    # staging preview of PR #405 and confirmed by the owner on 2026-09-19; no
    # test asserts it, because a checkout cannot see the banner.
    When the default theme id is looked up
    Then it resolves to a theme of that id
    And the id starts with "pale-sage"

  @test:schemas/ui/themes.test.ts::the_high-contrast_pair_really_is_high_contrast::%s_clears_WCAG_AAA_body_text_(7:1)
  Scenario: Each high-contrast theme clears AAA body text
    When the contrast of ink on surface is computed for each high-contrast theme
    Then each is at least 7:1

  @test:schemas/ui/themes.test.ts::the_high-contrast_pair_really_is_high_contrast::they_carry_NO_gradient,_and_that_is_deliberate
  Scenario: The high-contrast themes carry no gradient
    When each high-contrast theme's gradient start is read
    Then each is undefined

  @test:schemas/ui/themes.test.ts::a_sticky's_inline-code_chip_is_legible_in_every_theme::%s_clears_AAA_(7:1)_for_ink_on_surface
  Scenario: Every theme clears AAA for ink on surface
    When the contrast of ink on surface is computed for each shipped theme
    Then each is at least 7:1

  @test:schemas/ui/themes.test.ts::a_sticky's_inline-code_chip_is_legible_in_every_theme::`edge`_is_NOT_a_safe_chip_background,_which_is_why_the_rule_does_not_use_it
  Scenario: Edge is not a safe chip background in every theme
    When the contrast of ink on edge is computed for every shipped theme
    Then the lowest is below 4.5:1

  @test:schemas/ui/themes.test.ts::every_theme_is_readable,_not_just_the_ones_that_advertise_it::%s_clears_WCAG_AA_body_text_(4.5:1)
  Scenario: Every theme clears AA body text
    When the contrast of ink on surface is computed for each shipped theme
    Then each is at least 4.5:1

  @test:schemas/ui/themes.test.ts::every_theme_is_readable,_not_just_the_ones_that_advertise_it::%s_clears_AA_at_BOTH_gradient_stops,_not_just_the_surface
  Scenario: Every gradated theme clears AA at both gradient stops
    When the contrast of ink on each gradient stop is computed for each theme with a gradient
    Then each is at least 4.5:1

  @test:schemas/ui/themes.test.ts::every_shipped_backdrop_resolves_against_THIS_instance's_declaration::there_are_backdrops_to_check_—_otherwise_this_proves_nothing
  Scenario: There are backdrops to check
    When the shipped themes with a backdrop are counted
    Then there is at least one

  @test:schemas/ui/themes.test.ts::every_shipped_backdrop_resolves_against_THIS_instance's_declaration::`%s`_resolves_all_three_layouts
  Scenario: Each shipped backdrop resolves every layout
    Given the harness's declaration and its images
    When each themed backdrop is resolved against them
    Then nothing is missing and the backdrop is not "none"
    And it has art for exactly the theme layouts

  @test:schemas/ui/themes.test.ts::every_shipped_backdrop_resolves_against_THIS_instance's_declaration::`%s`'s_art_exists_on_disk
  Scenario: Each shipped backdrop's art exists on disk
    Given the harness's declaration and its images
    When each themed backdrop is resolved
    Then every art src exists under the harness root

  @test:schemas/ui/themes.test.ts::every_shipped_backdrop_resolves_against_THIS_instance's_declaration::the_check_CAN_fire_—_a_role_nothing_declares_is_reported_missing
  Scenario: A backdrop role nothing declares is reported missing
    Given a resolved theme copied from the first themed one, with image role "no-such-role"
    When its backdrop is resolved against the declaration
    Then every theme layout is missing
    And the backdrop is not "none"

  @test:schemas/ui/themes.test.ts::every_shipped_backdrop_resolves_against_THIS_instance's_declaration::the_high-contrast_pair_declares_NO_backdrop,_deliberately
  Scenario: The high-contrast themes declare no backdrop
    When each high-contrast theme's backdrop is read
    Then each is undefined

  @test:schemas/ui/themes.test.ts::every_surface_is_OPAQUE_—_the_pin_gesture_depends_on_it::no_theme's_surface_can_be_seen_through
  Scenario: Every theme's surface is an opaque hex colour
    When each shipped theme's surface is matched against a 3- or 6-digit hex colour
    Then none fails
    And there is at least one theme

  @test:schemas/ui/themes.test.ts::every_surface_is_OPAQUE_—_the_pin_gesture_depends_on_it::the_check_CAN_fire_—_an_rgba()_surface_is_caught
  Scenario: The opacity check rejects an rgba colour
    When "rgba(128, 128, 128, 0.08)" is matched against the opaque pattern
    Then it does not match
    And "#e9efe6" does

  @test:schemas/ui/themes.test.ts::every_surface_is_OPAQUE_—_the_pin_gesture_depends_on_it::a_gradated_theme's_stops_are_opaque_too
  Scenario: Every gradient stop is an opaque hex colour
    When each defined gradient stop of every shipped theme is matched against the opaque pattern
    Then none fails
